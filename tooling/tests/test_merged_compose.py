"""
Automated tests verifying the fully merged production Compose configuration.

Validates Task 008 Follow-up D and Task 009 requirements:
- Only Caddy exposes public ports (80 and 443).
- demo-web ports are completely stripped via !reset [].
- demo-api and postgres do not expose any host ports.
- Network segmentation: Caddy has no data-network access; postgres has no edge-network access.
- Persistent volumes exist for postgres data and Caddy certificates.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
COMPOSE_BASE = REPO_ROOT / "platform" / "deploy" / "compose.yaml"
COMPOSE_PROD = REPO_ROOT / "platform" / "deploy" / "compose.prod.yaml"


@pytest.fixture(scope="module")
def merged_config() -> dict:
    if not shutil.which("docker"):
        pytest.skip("docker binary not available on PATH")

    cmd = [
        "docker", "compose",
        "-f", str(COMPOSE_BASE),
        "-f", str(COMPOSE_PROD),
        "config",
        "--format", "json",
    ]
    res = subprocess.run(cmd, cwd=REPO_ROOT, text=True, capture_output=True)
    if res.returncode != 0:
        pytest.fail(f"docker compose config failed: {res.stderr}")

    return json.loads(res.stdout)


def test_only_caddy_publishes_ports(merged_config: dict):
    services = merged_config["services"]

    # Caddy must expose exactly 80 and 443
    assert "caddy" in services
    caddy_ports = services["caddy"].get("ports", [])
    published_ports = {p["published"] for p in caddy_ports}
    assert published_ports == {"80", "443"}

    # All upstream services must NOT publish host ports
    for svc_name in ["demo-web", "demo-api", "demo-migrate", "postgres"]:
        assert svc_name in services
        ports = services[svc_name].get("ports")
        assert not ports, f"Service {svc_name} unexpectedly publishes host ports: {ports}"


def test_network_segmentation(merged_config: dict):
    services = merged_config["services"]

    # Caddy attached only to edge-network
    caddy_nets = set(services["caddy"].get("networks", {}).keys())
    assert caddy_nets == {"edge-network"}

    # demo-web attached only to edge-network
    web_nets = set(services["demo-web"].get("networks", {}).keys())
    assert web_nets == {"edge-network"}

    # postgres and demo-migrate attached only to data-network
    pg_nets = set(services["postgres"].get("networks", {}).keys())
    assert pg_nets == {"data-network"}
    migrate_nets = set(services["demo-migrate"].get("networks", {}).keys())
    assert migrate_nets == {"data-network"}

    # demo-api bridges edge-network and data-network
    api_nets = set(services["demo-api"].get("networks", {}).keys())
    assert api_nets == {"edge-network", "data-network"}


def test_persistent_volumes_declared(merged_config: dict):
    volumes = merged_config.get("volumes", {})
    assert "postgres-data" in volumes
    assert "caddy-data" in volumes
    assert "caddy-config" in volumes


def test_narrow_edge_network_subnet(merged_config: dict):
    networks = merged_config.get("networks", {})
    assert "edge-network" in networks
    edge_ipam = networks["edge-network"].get("ipam", {})
    configs = edge_ipam.get("config", [])
    assert len(configs) > 0
    assert configs[0].get("subnet") == "172.28.0.0/24"
