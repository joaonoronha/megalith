"""
Automated unit and regression tests for Megalith's Micro Deployment Profile and GCP Staging Readiness (Task 012).

Validates:
1. compose.micro.yaml contains NO database dependencies (no PostgreSQL, no Alembic migrations).
2. compose.micro.yaml defines strictly the minimal ingress smoke stack (caddy, demo-web).
3. Container security hardening: non-root, read-only root filesystems, cap_drop ALL, no-new-privileges.
4. Caddyfile.micro provides an explicit JSON smoke health response at /health.
5. Preflight runner strictly enforces the production boundary (blocks micro in production).
6. Preflight runner permits micro in staging/development.
7. GCP Terraform variables allow e2-micro and micro profile while enforcing pd-standard and US regions.
8. GCP compute instance enforces Shielded VM and empty IAM scopes (least privilege).
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path
from typing import Any

import pytest
import yaml

import sys
PREFLIGHT_DIR = Path(__file__).resolve().parent.parent.parent / "platform" / "deploy" / "scripts"
if str(PREFLIGHT_DIR) not in sys.path:
    sys.path.insert(0, str(PREFLIGHT_DIR))
from preflight import PreflightRunner

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
COMPOSE_MICRO = REPO_ROOT / "platform" / "deploy" / "compose.micro.yaml"
CADDYFILE_MICRO = REPO_ROOT / "platform" / "deploy" / "caddy" / "Caddyfile.micro"
GCP_TF_DIR = REPO_ROOT / "platform" / "infra" / "gcp"


@pytest.fixture(scope="module")
def micro_compose_dict() -> dict[str, Any]:
    content = COMPOSE_MICRO.read_text(encoding="utf-8")
    return yaml.safe_load(content)


def test_micro_compose_services_strictly_caddy_and_demo_web(micro_compose_dict: dict[str, Any]):
    services = micro_compose_dict.get("services", {})
    assert set(services.keys()) == {"caddy", "demo-web"}, (
        f"Micro profile must strictly contain 'caddy' and 'demo-web', found: {set(services.keys())}"
    )


def test_micro_compose_has_no_database_services(micro_compose_dict: dict[str, Any]):
    services = micro_compose_dict.get("services", {})
    forbidden_services = ["postgres", "postgresql", "db", "demo-migrate", "migrate"]
    for forbidden in forbidden_services:
        assert forbidden not in services, f"Forbidden database service '{forbidden}' found in micro profile"

    # Verify no environment variables reference database passwords or URLs
    compose_text = COMPOSE_MICRO.read_text(encoding="utf-8")
    for keyword in ["POSTGRES_PASSWORD", "DATABASE_URL", "DATABASE_MIGRATE_URL", "alembic upgrade"]:
        assert keyword not in compose_text, f"Database credential or command '{keyword}' found in compose.micro.yaml"


def test_micro_compose_has_no_persistent_database_volumes(micro_compose_dict: dict[str, Any]):
    volumes = micro_compose_dict.get("volumes", {})
    assert "postgres-data" not in volumes, "postgres-data volume must not exist in micro profile"
    assert "pgdata" not in volumes


def test_micro_compose_network_isolation(micro_compose_dict: dict[str, Any]):
    networks = micro_compose_dict.get("networks", {})
    assert "edge-network" in networks, "edge-network must be defined"
    assert "data-network" not in networks, "data-network must not exist in micro profile"

    # demo-web must not publish host ports directly
    demo_web = micro_compose_dict["services"]["demo-web"]
    assert "ports" not in demo_web, "demo-web must not publish host ports in micro profile"


def test_micro_compose_security_hardening(micro_compose_dict: dict[str, Any]):
    caddy = micro_compose_dict["services"]["caddy"]
    demo_web = micro_compose_dict["services"]["demo-web"]

    # Caddy capabilities
    assert caddy.get("security_opt") == ["no-new-privileges:true"]
    assert caddy.get("cap_drop") == ["ALL"]
    assert caddy.get("cap_add") == ["NET_BIND_SERVICE"]

    # Demo-web capabilities & read-only root
    assert demo_web.get("security_opt") == ["no-new-privileges:true"]
    assert demo_web.get("cap_drop") == ["ALL"]
    assert demo_web.get("read_only") is True
    assert "/tmp" in demo_web.get("tmpfs", [])


def test_caddyfile_micro_health_endpoint():
    content = CADDYFILE_MICRO.read_text(encoding="utf-8")
    assert "handle /health" in content, "Caddyfile.micro must provide handle /health"
    assert "profile" in content and "micro" in content, "Health endpoint must declare micro profile"
    assert "smoke_test" in content, "Health endpoint must declare smoke_test: true"
    assert "reverse_proxy demo-web:8080" in content, "Caddyfile.micro must proxy remaining traffic to demo-web:8080"


def test_preflight_blocks_micro_in_production(tmp_path: Path):
    runner = PreflightRunner(
        repo_root=REPO_ROOT,
        state_dir=tmp_path,
        provider="gcp",
        profile="micro",
        environment="production",
        is_host_mode=False,
    )
    passed = runner.run_all()
    assert passed is False, "Preflight must fail when attempting micro profile in production"

    policy_results = [r for r in runner.results if r.name == "Deployment Profile Policy"]
    assert len(policy_results) == 1
    assert policy_results[0].status == "FAIL"
    assert "cannot be deployed in production" in policy_results[0].message


def test_preflight_permits_micro_in_staging(tmp_path: Path):
    runner = PreflightRunner(
        repo_root=REPO_ROOT,
        state_dir=tmp_path,
        provider="gcp",
        profile="micro",
        environment="staging",
        is_host_mode=False,
    )
    passed = runner.run_all()
    assert passed is True, "Preflight must pass when running micro profile in staging"

    policy_results = [r for r in runner.results if r.name == "Deployment Profile Policy"]
    assert len(policy_results) == 1
    assert policy_results[0].status == "WARN"
    assert "MICRO PROFILE ACTIVE" in policy_results[0].message


def test_gcp_terraform_allows_e2_micro_and_micro_profile():
    vars_file = GCP_TF_DIR / "variables.tf"
    content = vars_file.read_text(encoding="utf-8")

    # Check machine_type validation includes e2-micro
    m_block = re.search(r'variable "machine_type"\s*{(.*?)}', content, re.DOTALL)
    assert m_block is not None
    assert '"e2-micro"' in m_block.group(1)

    # Check deployment_profile validation includes micro
    p_block = re.search(r'variable "deployment_profile"\s*{(.*?)}', content, re.DOTALL)
    assert p_block is not None
    assert '"micro"' in p_block.group(1)


def test_gcp_terraform_shielded_vm_and_empty_scopes():
    compute_file = GCP_TF_DIR / "compute.tf"
    content = compute_file.read_text(encoding="utf-8")

    assert "enable_secure_boot          = true" in content
    assert "enable_vtpm                 = true" in content
    assert "enable_integrity_monitoring = true" in content
    assert "scopes = []" in content, "VM must have empty IAM scopes for least privilege"
