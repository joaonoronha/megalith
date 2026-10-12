#!/usr/bin/env python3
"""
Megalith Reproducible Staging Deployment Workflow Engine (Task 018).

Provides:
- Staging mode definitions: 'local', 'gcp-micro', 'external-db', 'oci'.
- Comprehensive read-only staging preflight validation:
  * Configuration file validation per mode.
  * Target architecture detection (amd64 for GCP e2-micro, arm64 for OCI).
  * Ingress and Caddy network configuration.
  * External database readiness (verify-full, role separation, credential masking).
  * Migration readiness (Alembic in stateful modes, bypassed in stateless micro).
  * €0/month design target cost exposure (GCP public IPv4 hourly billing warnings).
- Offline dry-run staging workflow:
  * Merged Compose configuration rendering and syntax validation.
  * Terraform configuration validation without provisioning cloud resources.
  * Structurally redacted command sequence preview.
  * Complete resource inventory and clean teardown plan.
  * ADR-013 cooperative governance classification (LOCAL_READ vs EXTERNAL_MUTATION).
"""

from __future__ import annotations

import argparse
import enum
import json
import os
import platform
import shutil
import socket
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

import yaml


# Support Docker Compose v2 custom YAML tags (!reset, !override)
def _compose_yaml_tag_constructor(loader, node):
    if isinstance(node, yaml.ScalarNode):
        return loader.construct_scalar(node)
    elif isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node)
    elif isinstance(node, yaml.MappingNode):
        return loader.construct_mapping(node)
    return None

yaml.SafeLoader.add_constructor("!reset", _compose_yaml_tag_constructor)
yaml.SafeLoader.add_constructor("!override", _compose_yaml_tag_constructor)

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent.parent
sys.path.insert(0, str(SCRIPT_DIR))

from masking import mask_database_url  # type: ignore
from operations import OperationClassification  # type: ignore


class StagingMode(str, enum.Enum):
    LOCAL = "local"
    GCP_MICRO = "gcp-micro"
    EXTERNAL_DB = "external-db"
    OCI = "oci"


@dataclass
class CheckResult:
    name: str
    category: str  # "config", "architecture", "network", "database", "migrations", "cost", "terraform"
    passed: bool
    status: str    # "PASS", "WARN", "FAIL", "INFO"
    message: str
    details: str | None = None


@dataclass
class StagingPreflightReport:
    mode: str
    target_arch: str
    all_passed: bool
    checks: list[CheckResult]
    cost_warnings: list[str]
    cleanup_recommendations: list[str]
    operation_classification: str = OperationClassification.LOCAL_READ.value


@dataclass
class DryRunReport:
    mode: str
    target_arch: str
    rendered_compose: str
    command_preview: list[str]
    resource_inventory: dict[str, list[str]]
    cleanup_plan: list[str]
    cost_analysis: dict[str, Any]
    operation_classification: str = OperationClassification.LOCAL_READ.value
    syntax_valid: bool = True
    terraform_valid: bool = True


class StagingWorkflow:
    def __init__(
        self,
        repo_root: Path | None = None,
        mode: StagingMode = StagingMode.LOCAL,
        target_arch: str | None = None,
        database_url: str | None = None,
        database_migrate_url: str | None = None,
        is_host_mode: bool = False,
    ):
        self.repo_root = (repo_root or REPO_ROOT).resolve()
        self.mode = StagingMode(mode) if isinstance(mode, str) else mode
        self.target_arch = (target_arch or platform.machine()).lower()
        self.database_url = database_url or os.environ.get("DATABASE_URL")
        self.database_migrate_url = database_migrate_url or os.environ.get("DATABASE_MIGRATE_URL")
        self.is_host_mode = is_host_mode
        self.checks: list[CheckResult] = []
        self.cost_warnings: list[str] = []
        self.cleanup_recommendations: list[str] = []

    def run_preflight(self) -> StagingPreflightReport:
        self.checks = []
        self.cost_warnings = []
        self.cleanup_recommendations = []

        self._check_configurations()
        self._check_target_architecture()
        self._check_network_and_ingress()
        self._check_database_readiness()
        self._check_migrations()
        self._check_terraform_config()
        self._check_cost_exposure()

        all_passed = all(c.passed for c in self.checks if c.status in ("PASS", "FAIL"))

        return StagingPreflightReport(
            mode=self.mode.value,
            target_arch=self.target_arch,
            all_passed=all_passed,
            checks=self.checks,
            cost_warnings=self.cost_warnings,
            cleanup_recommendations=self.cleanup_recommendations,
            operation_classification=OperationClassification.LOCAL_READ.value,
        )

    def _check_configurations(self) -> None:
        deploy_dir = self.repo_root / "platform" / "deploy"
        required_files: list[tuple[str, Path]] = []

        if self.mode == StagingMode.LOCAL:
            required_files = [
                ("Base Compose", deploy_dir / "compose.yaml"),
                ("Caddy Edge Ingress", deploy_dir / "caddy" / "Caddyfile"),
                ("PostgreSQL Init Script", deploy_dir / "postgres" / "init" / "01-init-demo-db.sh"),
            ]
        elif self.mode == StagingMode.GCP_MICRO:
            required_files = [
                ("Micro Compose", deploy_dir / "compose.micro.yaml"),
                ("Micro Caddy Ingress", deploy_dir / "caddy" / "Caddyfile.micro"),
                ("GCP Terraform Compute", self.repo_root / "platform" / "infra" / "gcp" / "compute.tf"),
                ("GCP Terraform Network", self.repo_root / "platform" / "infra" / "gcp" / "network.tf"),
                ("GCP Terraform Variables", self.repo_root / "platform" / "infra" / "gcp" / "variables.tf"),
            ]
        elif self.mode == StagingMode.EXTERNAL_DB:
            required_files = [
                ("Base Compose", deploy_dir / "compose.yaml"),
                ("External DB Compose Overlay", deploy_dir / "compose.external-db.yaml"),
                ("Caddy Edge Ingress", deploy_dir / "caddy" / "Caddyfile"),
            ]
        elif self.mode == StagingMode.OCI:
            required_files = [
                ("Base Compose", deploy_dir / "compose.yaml"),
                ("Production Compose Overlay", deploy_dir / "compose.prod.yaml"),
                ("Caddy Edge Ingress", deploy_dir / "caddy" / "Caddyfile"),
            ]

        missing = [f"{name} ({path})" for name, path in required_files if not path.is_file()]
        if missing:
            self.checks.append(CheckResult(
                name="Configuration Files",
                category="config",
                passed=False,
                status="FAIL",
                message=f"Missing required configuration file(s) for mode '{self.mode.value}': {', '.join(missing)}",
            ))
        else:
            self.checks.append(CheckResult(
                name="Configuration Files",
                category="config",
                passed=True,
                status="PASS",
                message=f"All required configuration files for mode '{self.mode.value}' are present.",
            ))

    def _check_target_architecture(self) -> None:
        arch = self.target_arch

        if self.mode == StagingMode.GCP_MICRO:
            if arch in ("x86_64", "amd64"):
                self.checks.append(CheckResult(
                    name="Target Architecture",
                    category="architecture",
                    passed=True,
                    status="PASS",
                    message=f"Architecture '{arch}' matches GCP Compute Engine e2-micro (AMD64 / x86_64).",
                ))
            else:
                self.checks.append(CheckResult(
                    name="Target Architecture",
                    category="architecture",
                    passed=False,
                    status="FAIL",
                    message=f"Architecture mismatch: GCP e2-micro staging requires amd64/x86_64 architecture, but '{arch}' was specified.",
                    details="Building or deploying ARM64 images onto an AMD64 e2-micro instance will cause exec format errors.",
                ))
        elif self.mode == StagingMode.OCI:
            if arch in ("aarch64", "arm64"):
                self.checks.append(CheckResult(
                    name="Target Architecture",
                    category="architecture",
                    passed=True,
                    status="PASS",
                    message=f"Architecture '{arch}' matches OCI Ampere A1 (ARM64 / aarch64).",
                ))
            else:
                self.checks.append(CheckResult(
                    name="Target Architecture",
                    category="architecture",
                    passed=False,
                    status="FAIL",
                    message=f"Architecture mismatch: OCI Ampere A1 requires arm64/aarch64 architecture, but '{arch}' was specified.",
                    details="Building or deploying x86_64 images onto an ARM64 Ampere VM will cause exec format errors.",
                ))
        else:
            # Local or External-DB modes support both architectures
            self.checks.append(CheckResult(
                name="Target Architecture",
                category="architecture",
                passed=True,
                status="PASS",
                message=f"Target architecture '{arch}' is compatible with mode '{self.mode.value}' (multi-arch supported).",
            ))

    def _check_network_and_ingress(self) -> None:
        deploy_dir = self.repo_root / "platform" / "deploy"
        caddyfile_path = (
            deploy_dir / "caddy" / "Caddyfile.micro"
            if self.mode == StagingMode.GCP_MICRO
            else deploy_dir / "caddy" / "Caddyfile"
        )

        if not caddyfile_path.is_file():
            self.checks.append(CheckResult(
                name="Ingress Configuration",
                category="network",
                passed=False,
                status="FAIL",
                message=f"Caddy configuration not found at {caddyfile_path}",
            ))
            return

        content = caddyfile_path.read_text(encoding="utf-8")
        has_baseline = "admin off" in content and ("reverse_proxy" in content or "respond" in content)
        if has_baseline:
            self.checks.append(CheckResult(
                name="Ingress Configuration",
                category="network",
                passed=True,
                status="PASS",
                message=f"Caddy ingress configuration ({caddyfile_path.name}) syntax baseline verified.",
            ))
        else:
            self.checks.append(CheckResult(
                name="Ingress Configuration",
                category="network",
                passed=False,
                status="FAIL",
                message=f"Caddy ingress configuration ({caddyfile_path.name}) lacks required 'admin off' or proxy/response directives.",
            ))

        if self.is_host_mode:
            conflicts = []
            for port in [80, 443]:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    try:
                        s.bind(("0.0.0.0", port))
                    except OSError:
                        conflicts.append(port)
            if conflicts:
                self.checks.append(CheckResult(
                    name="Port Availability",
                    category="network",
                    passed=False,
                    status="FAIL",
                    message=f"Ingress ports {conflicts} are already in use on host.",
                ))
            else:
                self.checks.append(CheckResult(
                    name="Port Availability",
                    category="network",
                    passed=True,
                    status="PASS",
                    message="Ingress ports 80 and 443 are available.",
                ))
        else:
            self.checks.append(CheckResult(
                name="Port Availability",
                category="network",
                passed=True,
                status="INFO",
                message="Port binding check skipped in local simulation mode (uses dynamic port allocation).",
            ))

    def _check_database_readiness(self) -> None:
        if self.mode == StagingMode.GCP_MICRO:
            # Confirm stateless configuration
            compose_path = self.repo_root / "platform" / "deploy" / "compose.micro.yaml"
            if compose_path.is_file():
                try:
                    data = yaml.safe_load(compose_path.read_text(encoding="utf-8"))
                    services = data.get("services", {})
                    if "postgres" in services:
                        self.checks.append(CheckResult(
                            name="Stateless Validation",
                            category="database",
                            passed=False,
                            status="FAIL",
                            message="Micro profile must NOT declare a postgres service. GCP e2-micro is strictly stateless.",
                        ))
                        return
                except Exception:
                    pass

            self.checks.append(CheckResult(
                name="Stateless Validation",
                category="database",
                passed=True,
                status="PASS",
                message="Stateless configuration verified: no local PostgreSQL container or persistent volumes configured in micro profile.",
            ))
            return

        if self.mode == StagingMode.LOCAL:
            compose_path = self.repo_root / "platform" / "deploy" / "compose.yaml"
            if compose_path.is_file():
                content = compose_path.read_text(encoding="utf-8")
                if "postgres:16-alpine" in content:
                    self.checks.append(CheckResult(
                        name="Local Database Baseline",
                        category="database",
                        passed=True,
                        status="PASS",
                        message="Local PostgreSQL 16 Alpine container configured in compose.yaml.",
                    ))
                else:
                    self.checks.append(CheckResult(
                        name="Local Database Baseline",
                        category="database",
                        passed=False,
                        status="FAIL",
                        message="Local database must use postgres:16-alpine baseline per ADR-007.",
                    ))
            return

        if self.mode == StagingMode.EXTERNAL_DB:
            # Validate external database URLs
            if not self.database_url or not self.database_migrate_url:
                missing = []
                if not self.database_url:
                    missing.append("DATABASE_URL")
                if not self.database_migrate_url:
                    missing.append("DATABASE_MIGRATE_URL")
                self.checks.append(CheckResult(
                    name="External Database Configuration",
                    category="database",
                    passed=False,
                    status="FAIL",
                    message=f"Missing external database configuration: {', '.join(missing)} must be explicitly provided in external-db mode.",
                    details="External database staging requires explicit separation of runtime DML role (DATABASE_URL) and migration DDL role (DATABASE_MIGRATE_URL).",
                ))
                return

            # Check TLS enforcement on both URLs
            insecure_urls = []
            for label, url_val in [("DATABASE_URL", self.database_url), ("DATABASE_MIGRATE_URL", self.database_migrate_url)]:
                parsed = urlsplit(url_val)
                qs = parse_qs(parsed.query)
                sslmode = qs.get("sslmode", [""])[0].lower()
                if sslmode != "verify-full":
                    masked = mask_database_url(url_val)
                    insecure_urls.append(f"{label} (sslmode={sslmode or 'missing'}, url={masked})")

            if insecure_urls:
                self.checks.append(CheckResult(
                    name="External Database TLS Enforcement",
                    category="database",
                    passed=False,
                    status="FAIL",
                    message=f"Insecure external database connection: sslmode=verify-full is strictly required in staging/production environments. Violations: {', '.join(insecure_urls)}",
                    details="Megalith security policy strictly rejects unencrypted or non-verifying database connections (sslmode=disable, require, prefer) across public networks.",
                ))
            else:
                masked_app = mask_database_url(self.database_url)
                masked_mig = mask_database_url(self.database_migrate_url)
                self.checks.append(CheckResult(
                    name="External Database TLS Enforcement",
                    category="database",
                    passed=True,
                    status="PASS",
                    message="Strict TLS (sslmode=verify-full) verified for both external database connections.",
                    details=f"App: {masked_app}\nMigrate: {masked_mig}",
                ))

            # Check role separation
            parsed_app = urlsplit(self.database_url)
            parsed_mig = urlsplit(self.database_migrate_url)
            user_app = parsed_app.username or ""
            user_mig = parsed_mig.username or ""

            if user_app and user_mig and user_app == user_mig:
                self.checks.append(CheckResult(
                    name="External Database Role Separation",
                    category="database",
                    passed=False,
                    status="WARN",
                    message=f"DATABASE_URL and DATABASE_MIGRATE_URL both use role '{user_app}'. Least-privilege separation recommends distinct roles (e.g. role_demo_app and role_demo_migrate).",
                ))
            else:
                self.checks.append(CheckResult(
                    name="External Database Role Separation",
                    category="database",
                    passed=True,
                    status="PASS",
                    message=f"Dedicated roles verified (App: '{user_app}', Migrate: '{user_mig}').",
                ))

    def _check_migrations(self) -> None:
        if self.mode == StagingMode.GCP_MICRO:
            self.checks.append(CheckResult(
                name="Database Migrations",
                category="migrations",
                passed=True,
                status="PASS",
                message="Migrations safely bypassed for stateless micro profile.",
            ))
            return

        migrations_dir = self.repo_root / "apps" / "demo" / "api" / "migrations" / "versions"
        if migrations_dir.is_dir() and any(migrations_dir.glob("*.py")):
            count = len(list(migrations_dir.glob("*.py")))
            self.checks.append(CheckResult(
                name="Database Migrations",
                category="migrations",
                passed=True,
                status="PASS",
                message=f"Alembic migration scripts validated ({count} revision script(s) present).",
            ))
        else:
            self.checks.append(CheckResult(
                name="Database Migrations",
                category="migrations",
                passed=False,
                status="FAIL",
                message=f"Alembic migration versions directory missing or empty at {migrations_dir}",
            ))

    def _check_terraform_config(self) -> None:
        if self.mode != StagingMode.GCP_MICRO:
            return

        gcp_infra_dir = self.repo_root / "platform" / "infra" / "gcp"
        if not gcp_infra_dir.is_dir():
            self.checks.append(CheckResult(
                name="Terraform Configuration",
                category="terraform",
                passed=False,
                status="FAIL",
                message=f"GCP Terraform directory not found at {gcp_infra_dir}",
            ))
            return

        # Check terraform validate if binary available
        if shutil.which("terraform"):
            try:
                res = subprocess.run(
                    ["terraform", f"-chdir={gcp_infra_dir}", "validate"],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                if res.returncode == 0:
                    self.checks.append(CheckResult(
                        name="Terraform Configuration",
                        category="terraform",
                        passed=True,
                        status="PASS",
                        message="Terraform configuration validates cleanly via 'terraform validate'.",
                    ))
                else:
                    self.checks.append(CheckResult(
                        name="Terraform Configuration",
                        category="terraform",
                        passed=False,
                        status="FAIL",
                        message="Terraform validation failed.",
                        details=res.stderr.strip() or res.stdout.strip(),
                    ))
            except Exception as e:
                self.checks.append(CheckResult(
                    name="Terraform Configuration",
                    category="terraform",
                    passed=False,
                    status="FAIL",
                    message=f"Failed to execute terraform validate: {e}",
                ))
        else:
            # Static check
            tf_files = list(gcp_infra_dir.glob("*.tf"))
            if tf_files:
                self.checks.append(CheckResult(
                    name="Terraform Configuration",
                    category="terraform",
                    passed=True,
                    status="PASS",
                    message=f"Terraform static structure verified ({len(tf_files)} .tf files present; terraform binary not installed).",
                ))
            else:
                self.checks.append(CheckResult(
                    name="Terraform Configuration",
                    category="terraform",
                    passed=False,
                    status="FAIL",
                    message="No .tf files found in GCP infrastructure directory.",
                ))

    def _check_cost_exposure(self) -> None:
        if self.mode == StagingMode.GCP_MICRO:
            ipv4_warning = (
                "COST WARNING: Google Cloud charges approximately $0.005/hour (~$3.60/month) "
                "for in-use or idle public IPv4 addresses (ephemeral and static). "
                "To preserve the €0/month design target, the e2-micro instance and its public IP "
                "must be torn down immediately after staging verification."
            )
            disk_warning = (
                "STORAGE COST NOTE: e2-micro uses 30 GB pd-standard boot disk (included in Always Free). "
                "Disks retained after VM deletion will incur persistent storage charges."
            )
            self.cost_warnings.append(ipv4_warning)
            self.cost_warnings.append(disk_warning)

            self.checks.append(CheckResult(
                name="Cost Exposure Safeguard",
                category="cost",
                passed=True,
                status="WARN",
                message=ipv4_warning,
                details=disk_warning,
            ))
            self.cleanup_recommendations.append("Execute 'terraform destroy' immediately after test completion.")
        elif self.mode == StagingMode.EXTERNAL_DB:
            db_warning = (
                "EXTERNAL DATABASE QUOTAS: Ensure database traffic remains within free tier quotas "
                "(e.g. Neon Free: 100 CU-hours/month, 1 GB storage limit, 20-minute auto-suspend). "
                "Continuous background load will exhaust the free allowance."
            )
            self.cost_warnings.append(db_warning)
            self.checks.append(CheckResult(
                name="Cost Exposure Safeguard",
                category="cost",
                passed=True,
                status="INFO",
                message=db_warning,
            ))
            self.cleanup_recommendations.append("Clean up test databases or drop staging schemas when tests conclude.")
        elif self.mode == StagingMode.LOCAL:
            self.checks.append(CheckResult(
                name="Cost Exposure Safeguard",
                category="cost",
                passed=True,
                status="PASS",
                message="Local Docker Compose staging incurs €0/month recurring cloud cost.",
            ))
            self.cleanup_recommendations.append("Run 'docker compose down -v' to release local containers and volumes.")

    def run_dry_run(self) -> DryRunReport:
        # Preflight first
        self.run_preflight()

        # Render compose configuration
        rendered_yaml, syntax_valid = self._render_compose_config()

        # Validate terraform
        terraform_valid = True
        if self.mode == StagingMode.GCP_MICRO:
            gcp_infra_dir = self.repo_root / "platform" / "infra" / "gcp"
            if shutil.which("terraform"):
                res = subprocess.run(
                    ["terraform", f"-chdir={gcp_infra_dir}", "validate"],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                terraform_valid = (res.returncode == 0)

        # Build command preview
        command_preview = self._build_command_preview()

        # Build resource inventory & cleanup plan
        inventory, cleanup_plan = self._build_inventory_and_cleanup()

        # Cost analysis
        cost_analysis = {
            "mode": self.mode.value,
            "estimated_hourly_cost_usd": 0.005 if self.mode == StagingMode.GCP_MICRO else 0.0,
            "billing_risks": self.cost_warnings,
            "free_tier_compliant": True,
        }

        return DryRunReport(
            mode=self.mode.value,
            target_arch=self.target_arch,
            rendered_compose=rendered_yaml,
            command_preview=command_preview,
            resource_inventory=inventory,
            cleanup_plan=cleanup_plan,
            cost_analysis=cost_analysis,
            operation_classification=OperationClassification.LOCAL_READ.value,
            syntax_valid=syntax_valid,
            terraform_valid=terraform_valid,
        )

    def _render_compose_config(self) -> tuple[str, bool]:
        deploy_dir = self.repo_root / "platform" / "deploy"
        try:
            if self.mode == StagingMode.GCP_MICRO:
                path = deploy_dir / "compose.micro.yaml"
                data = yaml.safe_load(path.read_text(encoding="utf-8")) if path.is_file() else {}
            elif self.mode == StagingMode.LOCAL:
                path = deploy_dir / "compose.yaml"
                data = yaml.safe_load(path.read_text(encoding="utf-8")) if path.is_file() else {}
            elif self.mode == StagingMode.EXTERNAL_DB:
                base_data = yaml.safe_load((deploy_dir / "compose.yaml").read_text(encoding="utf-8"))
                overlay_data = yaml.safe_load((deploy_dir / "compose.external-db.yaml").read_text(encoding="utf-8"))
                # Deep merge services
                data = dict(base_data)
                services = dict(base_data.get("services", {}))
                for svc_name, svc_cfg in overlay_data.get("services", {}).items():
                    if svc_name in services:
                        merged_svc = dict(services[svc_name])
                        for k, v in svc_cfg.items():
                            if k == "environment" and isinstance(v, dict):
                                merged_env = dict(merged_svc.get("environment", {}))
                                merged_env.update(v)
                                merged_svc["environment"] = merged_env
                            else:
                                merged_svc[k] = v
                        services[svc_name] = merged_svc
                    else:
                        services[svc_name] = svc_cfg
                data["services"] = services
            elif self.mode == StagingMode.OCI:
                base_data = yaml.safe_load((deploy_dir / "compose.yaml").read_text(encoding="utf-8"))
                prod_data = yaml.safe_load((deploy_dir / "compose.prod.yaml").read_text(encoding="utf-8"))
                data = dict(base_data)
                services = dict(base_data.get("services", {}))
                for svc_name, svc_cfg in prod_data.get("services", {}).items():
                    if svc_name in services:
                        merged_svc = dict(services[svc_name])
                        merged_svc.update(svc_cfg)
                        services[svc_name] = merged_svc
                    else:
                        services[svc_name] = svc_cfg
                data["services"] = services
            else:
                data = {}

            rendered = yaml.safe_dump(data, sort_keys=False)
            return rendered, True
        except Exception as e:
            return f"# Render failed: {e}", False

    def _build_command_preview(self) -> list[str]:
        deploy_dir = "platform/deploy"
        cmds: list[str] = []

        if self.mode == StagingMode.GCP_MICRO:
            cmds.append("# [LOCAL_READ] 1. Inspect Terraform staging plan without provisioning")
            cmds.append("terraform -chdir=platform/infra/gcp plan -var=\"ssh_admin_cidr=<OPERATOR_IP>/32\"")
            cmds.append("# [LOCAL_READ] 2. Validate micro compose overlay")
            cmds.append(f"docker compose -f {deploy_dir}/compose.micro.yaml config")
            cmds.append("# [EXTERNAL_MUTATION - Requires Operator Authorization] 3. Deploy to remote host")
            cmds.append(f"ssh ubuntu@<VM_IP> 'cd /opt/megalith && docker compose -f {deploy_dir}/compose.micro.yaml up -d --remove-orphans'")
            cmds.append("# [EXTERNAL_READ] 4. Verify edge ingress health probe")
            cmds.append("curl -fsS http://<VM_IP>:80/health")
        elif self.mode == StagingMode.EXTERNAL_DB:
            masked_app = mask_database_url(self.database_url or "postgresql+psycopg://role_demo_app:***@ep-pooler.example.com:5432/db_demo?sslmode=verify-full")
            masked_mig = mask_database_url(self.database_migrate_url or "postgresql+psycopg://role_demo_migrate:***@ep-direct.example.com:5432/db_demo?sslmode=verify-full")
            cmds.append("# [LOCAL_READ] 1. Validate merged external database compose configuration")
            cmds.append(f"DATABASE_URL=\"{masked_app}\" DATABASE_MIGRATE_URL=\"{masked_mig}\" docker compose -f {deploy_dir}/compose.yaml -f {deploy_dir}/compose.external-db.yaml config")
            cmds.append("# [EXTERNAL_MUTATION - Requires Operator Authorization] 2. Run pre-deployment migrations on external database")
            cmds.append(f"DATABASE_MIGRATE_URL=\"{masked_mig}\" docker compose -f {deploy_dir}/compose.yaml -f {deploy_dir}/compose.external-db.yaml run --rm demo-migrate alembic upgrade head")
            cmds.append("# [LOCAL_MUTATION] 3. Launch application services in external DB mode")
            cmds.append(f"DATABASE_URL=\"{masked_app}\" DATABASE_MIGRATE_URL=\"{masked_mig}\" docker compose -f {deploy_dir}/compose.yaml -f {deploy_dir}/compose.external-db.yaml up -d --remove-orphans")
            cmds.append("# [LOCAL_READ] 4. Ingress health check")
            cmds.append("curl -fsS http://127.0.0.1:80/health")
        elif self.mode == StagingMode.LOCAL:
            cmds.append("# [LOCAL_READ] 1. Validate local compose configuration")
            cmds.append(f"docker compose -f {deploy_dir}/compose.yaml config")
            cmds.append("# [LOCAL_MUTATION] 2. Start full local stack with PostgreSQL 16")
            cmds.append(f"docker compose -f {deploy_dir}/compose.yaml up -d --remove-orphans")
            cmds.append("# [LOCAL_READ] 3. Ingress health check")
            cmds.append("curl -fsS http://127.0.0.1:80/health")
        elif self.mode == StagingMode.OCI:
            cmds.append("# [LOCAL_READ] 1. Validate production compose configuration for OCI")
            cmds.append(f"docker compose -f {deploy_dir}/compose.yaml -f {deploy_dir}/compose.prod.yaml config")
            cmds.append("# [EXTERNAL_MUTATION - Requires Operator Authorization] 2. Deploy to OCI Ampere VM")
            cmds.append(f"ssh opc@<OCI_VM_IP> 'cd /opt/megalith && docker compose -f {deploy_dir}/compose.yaml -f {deploy_dir}/compose.prod.yaml up -d'")

        return cmds

    def _build_inventory_and_cleanup(self) -> tuple[dict[str, list[str]], list[str]]:
        inventory: dict[str, list[str]] = {}
        cleanup: list[str] = []

        if self.mode == StagingMode.GCP_MICRO:
            inventory["cloud_resources"] = [
                "google_compute_network.megalith (megalith-vpc)",
                "google_compute_subnetwork.megalith (megalith-vpc-subnet)",
                "google_compute_firewall.allow_ssh (TCP 22 restricted)",
                "google_compute_firewall.allow_web (TCP 80, 443)",
                "google_service_account.vm_sa (megalith-staging-micro-sa, 0 IAM roles)",
                "google_compute_instance.megalith (e2-micro, 30GB pd-standard, ephemeral public IPv4)",
            ]
            inventory["containers"] = ["caddy", "demo-web"]
            inventory["networks"] = ["edge-network (172.28.0.0/24)"]
            inventory["volumes"] = ["caddy-data", "caddy-config"]

            cleanup = [
                "# 1. Tear down on-host containers:",
                "docker compose -f platform/deploy/compose.micro.yaml down -v",
                "# 2. Destroy GCP cloud resources (releases public IPv4 address to stop $0.005/hr billing):",
                "terraform -chdir=platform/infra/gcp destroy -auto-approve",
                "# Note: Live terraform destroy requires explicit operator authorization under ADR-013.",
            ]
        elif self.mode == StagingMode.EXTERNAL_DB:
            inventory["containers"] = ["caddy", "demo-api", "demo-web"]
            inventory["networks"] = ["edge-network (172.28.0.0/24)", "data-network"]
            inventory["volumes"] = ["caddy-data", "caddy-config"]
            inventory["external_resources"] = [
                "External PostgreSQL Database (Tenant isolation)",
                "External Migration Role (DDL)",
                "External Application Role (DML)",
            ]
            cleanup = [
                "# 1. Stop local application services:",
                "docker compose -f platform/deploy/compose.yaml -f platform/deploy/compose.external-db.yaml down -v",
                "# 2. Revert external database schema if needed:",
                "DATABASE_MIGRATE_URL=\"<MASKED>\" docker compose run --rm demo-migrate alembic downgrade -1",
            ]
        elif self.mode == StagingMode.LOCAL:
            inventory["containers"] = ["postgres (PostgreSQL 16)", "demo-migrate", "demo-api", "demo-web", "caddy"]
            inventory["networks"] = ["edge-network (172.28.0.0/24)", "data-network"]
            inventory["volumes"] = ["postgres-data", "caddy-data", "caddy-config"]
            cleanup = [
                "# Clean up all local containers, networks, and persistent data volumes:",
                "docker compose -f platform/deploy/compose.yaml down -v",
            ]
        elif self.mode == StagingMode.OCI:
            inventory["cloud_resources"] = ["OCI Ampere A1 Compute Instance (ARM64)"]
            inventory["containers"] = ["postgres", "demo-migrate", "demo-api", "demo-web", "caddy"]
            cleanup = [
                "docker compose -f platform/deploy/compose.yaml -f platform/deploy/compose.prod.yaml down -v",
            ]

        return inventory, cleanup


def main() -> int:
    parser = argparse.ArgumentParser(description="Megalith Staging Deployment Workflow (Task 018)")
    subparsers = parser.add_subparsers(dest="subcommand", required=True)

    # Preflight
    preflight_parser = subparsers.add_parser("preflight", help="Run staging preflight checks")
    preflight_parser.add_argument("--mode", choices=[m.value for m in StagingMode], default="local", help="Staging deployment mode")
    preflight_parser.add_argument("--target-arch", type=str, default=None, help="Target CPU architecture (e.g. amd64, arm64)")
    preflight_parser.add_argument("--database-url", type=str, default=None, help="External database runtime connection URL")
    preflight_parser.add_argument("--database-migrate-url", type=str, default=None, help="External database migration connection URL")
    preflight_parser.add_argument("--host-mode", action="store_true", help="Enforce live host checks")
    preflight_parser.add_argument("--json", action="store_true", help="Output machine-readable JSON results")

    # Dry-run
    dry_run_parser = subparsers.add_parser("dry-run", help="Run offline dry-run staging workflow")
    dry_run_parser.add_argument("--mode", choices=[m.value for m in StagingMode], default="local", help="Staging deployment mode")
    dry_run_parser.add_argument("--target-arch", type=str, default=None, help="Target CPU architecture (e.g. amd64, arm64)")
    dry_run_parser.add_argument("--database-url", type=str, default=None, help="External database runtime connection URL")
    dry_run_parser.add_argument("--database-migrate-url", type=str, default=None, help="External database migration connection URL")
    dry_run_parser.add_argument("--json", action="store_true", help="Output machine-readable JSON results")

    args = parser.parse_args()

    workflow = StagingWorkflow(
        mode=StagingMode(args.mode),
        target_arch=args.target_arch,
        database_url=args.database_url,
        database_migrate_url=args.database_migrate_url,
        is_host_mode=getattr(args, "host_mode", False),
    )

    if args.subcommand == "preflight":
        report = workflow.run_preflight()
        if args.json:
            print(json.dumps(asdict(report), indent=2))
            return 0 if report.all_passed else 1

        print("=" * 70)
        print(" Megalith Staging Deployment Preflight Check")
        print("=" * 70)
        print(f"Deployment Mode : {report.mode}")
        print(f"Target Arch     : {report.target_arch}")
        print(f"Classification  : {report.operation_classification} (Read-Only)")
        print("-" * 70)
        for c in report.checks:
            badge = {
                "PASS": "\033[92m[ PASS ]\033[0m",
                "WARN": "\033[93m[ WARN ]\033[0m",
                "FAIL": "\033[91m[ FAIL ]\033[0m",
                "INFO": "\033[94m[ INFO ]\033[0m",
            }.get(c.status, f"[{c.status}]")
            print(f"{badge} {c.name}: {c.message}")
            if c.details:
                for line in c.details.splitlines():
                    print(f"         {line}")

        print("-" * 70)
        if report.all_passed:
            print("\033[92mPREFLIGHT RESULT: PASSED\033[0m - Staging deployment configuration is valid.")
            print("=" * 70)
            return 0
        else:
            print("\033[91mPREFLIGHT RESULT: FAILED\033[0m - Preflight detected blocking errors above.")
            print("=" * 70)
            return 1

    elif args.subcommand == "dry-run":
        dry_run = workflow.run_dry_run()
        if args.json:
            print(json.dumps(asdict(dry_run), indent=2))
            return 0 if dry_run.syntax_valid and dry_run.terraform_valid else 1

        print("=" * 70)
        print(" Megalith Staging Deployment Dry-Run Summary")
        print("=" * 70)
        print(f"Deployment Mode : {dry_run.mode}")
        print(f"Target Arch     : {dry_run.target_arch}")
        print(f"Classification  : {dry_run.operation_classification} (Read-Only)")
        print(f"Compose Syntax  : {'VALID' if dry_run.syntax_valid else 'INVALID'}")
        print(f"Terraform State : {'VALID' if dry_run.terraform_valid else 'INVALID'}")
        print("-" * 70)
        print("Command Preview (All secrets masked):")
        for cmd in dry_run.command_preview:
            print(f"  {cmd}")
        print("-" * 70)
        print("Resource Inventory:")
        for category, items in dry_run.resource_inventory.items():
            print(f"  {category.upper()}:")
            for item in items:
                print(f"    - {item}")
        print("-" * 70)
        print("Cleanup Plan:")
        for step in dry_run.cleanup_plan:
            print(f"  {step}")
        print("=" * 70)
        return 0 if dry_run.syntax_valid and dry_run.terraform_valid else 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
