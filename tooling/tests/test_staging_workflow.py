"""
Automated regression tests for Megalith Reproducible Staging Deployment Workflow (Task 018).

Covers the 12 required scenarios:
1. Local mode validation succeeds
2. GCP micro mode validates stateless configuration
3. Missing external database configuration fails safely
4. Insecure external database connection (sslmode != verify-full) is rejected
5. Connection string credentials are masked in all output
6. Architecture mismatch is detected
7. Terraform configuration validates cleanly
8. Rendered compose configurations are syntactically valid
9. Cost warning is displayed for GCP IPv4
10. Dry-run generates complete cleanup plan
11. Preflight succeeds with valid mock configuration
12. Operation classification correctly distinguishes read-only vs mutation
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEPLOY_SCRIPTS = REPO_ROOT / "platform" / "deploy" / "scripts"
if str(DEPLOY_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(DEPLOY_SCRIPTS))

from operations import OperationClassification, classify_command  # type: ignore
from staging import StagingMode, StagingWorkflow  # type: ignore


# 1. Local mode validation succeeds
def test_local_mode_validation_succeeds():
    workflow = StagingWorkflow(repo_root=REPO_ROOT, mode=StagingMode.LOCAL)
    report = workflow.run_preflight()
    assert report.all_passed is True
    assert report.mode == "local"
    assert report.operation_classification == OperationClassification.LOCAL_READ.value

    # Verify key checks
    check_names = {c.name: c for c in report.checks}
    assert "Configuration Files" in check_names
    assert check_names["Configuration Files"].status == "PASS"
    assert "Local Database Baseline" in check_names
    assert check_names["Local Database Baseline"].status == "PASS"
    assert "Database Migrations" in check_names
    assert check_names["Database Migrations"].status == "PASS"


# 2. GCP micro mode validates stateless configuration
def test_gcp_micro_mode_validates_stateless_configuration():
    workflow = StagingWorkflow(
        repo_root=REPO_ROOT,
        mode=StagingMode.GCP_MICRO,
        target_arch="amd64",
    )
    report = workflow.run_preflight()
    assert report.all_passed is True

    check_names = {c.name: c for c in report.checks}
    assert "Stateless Validation" in check_names
    assert check_names["Stateless Validation"].status == "PASS"
    assert "no local PostgreSQL" in check_names["Stateless Validation"].message
    assert "Database Migrations" in check_names
    assert "bypassed" in check_names["Database Migrations"].message.lower()


# 3. Missing external database configuration fails safely
def test_missing_external_database_configuration_fails_safely():
    # Neither DATABASE_URL nor DATABASE_MIGRATE_URL provided
    workflow = StagingWorkflow(
        repo_root=REPO_ROOT,
        mode=StagingMode.EXTERNAL_DB,
        database_url=None,
        database_migrate_url=None,
    )
    report = workflow.run_preflight()
    assert report.all_passed is False

    db_checks = [c for c in report.checks if c.name == "External Database Configuration"]
    assert len(db_checks) == 1
    assert db_checks[0].status == "FAIL"
    assert "DATABASE_URL" in db_checks[0].message
    assert "DATABASE_MIGRATE_URL" in db_checks[0].message


# 4. Insecure external database connection (sslmode != verify-full) is rejected
@pytest.mark.parametrize(
    "app_url,migrate_url",
    [
        (
            "postgresql+psycopg://app_usr:pw1@ep-pool.example.com:5432/db?sslmode=require",
            "postgresql+psycopg://mig_usr:pw2@ep-dir.example.com:5432/db?sslmode=verify-full",
        ),
        (
            "postgresql+psycopg://app_usr:pw1@ep-pool.example.com:5432/db?sslmode=verify-full",
            "postgresql+psycopg://mig_usr:pw2@ep-dir.example.com:5432/db?sslmode=disable",
        ),
        (
            "postgresql+psycopg://app_usr:pw1@ep-pool.example.com:5432/db",
            "postgresql+psycopg://mig_usr:pw2@ep-dir.example.com:5432/db?sslmode=prefer",
        ),
    ],
)
def test_insecure_external_database_connection_rejected(app_url: str, migrate_url: str):
    workflow = StagingWorkflow(
        repo_root=REPO_ROOT,
        mode=StagingMode.EXTERNAL_DB,
        database_url=app_url,
        database_migrate_url=migrate_url,
    )
    report = workflow.run_preflight()
    assert report.all_passed is False

    tls_checks = [c for c in report.checks if c.name == "External Database TLS Enforcement"]
    assert len(tls_checks) == 1
    assert tls_checks[0].status == "FAIL"
    assert "sslmode=verify-full is strictly required" in tls_checks[0].message


# 5. Connection string credentials are masked in all output
def test_connection_string_credentials_masked_in_all_output():
    secret_pass_app = "UltraSuperSecretPasswordApp123!"
    secret_pass_mig = "UltraSuperSecretPasswordMig456!"

    app_url = f"postgresql+psycopg://role_demo_app:{secret_pass_app}@ep-pool.example.com:5432/db_demo?sslmode=require"
    mig_url = f"postgresql+psycopg://role_demo_migrate:{secret_pass_mig}@ep-direct.example.com:5432/db_demo?sslmode=verify-full"

    workflow = StagingWorkflow(
        repo_root=REPO_ROOT,
        mode=StagingMode.EXTERNAL_DB,
        database_url=app_url,
        database_migrate_url=mig_url,
    )

    # 1. Check preflight report
    report = workflow.run_preflight()
    report_json = json.dumps([c.__dict__ for c in report.checks])
    assert secret_pass_app not in report_json
    assert secret_pass_mig not in report_json
    assert ":***@" in report_json

    # 2. Check dry-run report
    dry_run = workflow.run_dry_run()
    dry_run_cmds = " ".join(dry_run.command_preview)
    assert secret_pass_app not in dry_run_cmds
    assert secret_pass_mig not in dry_run_cmds


# 6. Architecture mismatch is detected
def test_architecture_mismatch_detected():
    # GCP micro requires amd64 / x86_64; arm64 must fail
    workflow_gcp = StagingWorkflow(
        repo_root=REPO_ROOT,
        mode=StagingMode.GCP_MICRO,
        target_arch="arm64",
    )
    report_gcp = workflow_gcp.run_preflight()
    assert report_gcp.all_passed is False
    arch_checks = [c for c in report_gcp.checks if c.name == "Target Architecture"]
    assert len(arch_checks) == 1
    assert arch_checks[0].status == "FAIL"
    assert "Architecture mismatch" in arch_checks[0].message

    # OCI requires arm64 / aarch64; x86_64 must fail
    workflow_oci = StagingWorkflow(
        repo_root=REPO_ROOT,
        mode=StagingMode.OCI,
        target_arch="x86_64",
    )
    report_oci = workflow_oci.run_preflight()
    assert report_oci.all_passed is False
    arch_checks_oci = [c for c in report_oci.checks if c.name == "Target Architecture"]
    assert len(arch_checks_oci) == 1
    assert arch_checks_oci[0].status == "FAIL"
    assert "Architecture mismatch" in arch_checks_oci[0].message


# 7. Terraform configuration validates cleanly
def test_terraform_configuration_validates_cleanly():
    workflow = StagingWorkflow(
        repo_root=REPO_ROOT,
        mode=StagingMode.GCP_MICRO,
        target_arch="amd64",
    )
    report = workflow.run_preflight()
    tf_checks = [c for c in report.checks if c.name == "Terraform Configuration"]
    assert len(tf_checks) == 1
    assert tf_checks[0].status == "PASS"


# 8. Rendered compose configurations are syntactically valid
@pytest.mark.parametrize("mode", [StagingMode.LOCAL, StagingMode.GCP_MICRO, StagingMode.EXTERNAL_DB, StagingMode.OCI])
def test_rendered_compose_configurations_are_syntactically_valid(mode: StagingMode):
    workflow = StagingWorkflow(
        repo_root=REPO_ROOT,
        mode=mode,
        target_arch="amd64" if mode != StagingMode.OCI else "arm64",
        database_url="postgresql+psycopg://role_demo_app:pw@ep-pool.example.com:5432/db?sslmode=verify-full",
        database_migrate_url="postgresql+psycopg://role_demo_migrate:pw@ep-dir.example.com:5432/db?sslmode=verify-full",
    )
    dry_run = workflow.run_dry_run()
    assert dry_run.syntax_valid is True
    assert dry_run.rendered_compose is not None

    parsed = yaml.safe_load(dry_run.rendered_compose)
    assert isinstance(parsed, dict)
    assert "services" in parsed
    assert len(parsed["services"]) > 0


# 9. Cost warning is displayed for GCP IPv4
def test_cost_warning_displayed_for_gcp_ipv4():
    workflow = StagingWorkflow(
        repo_root=REPO_ROOT,
        mode=StagingMode.GCP_MICRO,
        target_arch="amd64",
    )
    report = workflow.run_preflight()
    cost_checks = [c for c in report.checks if c.name == "Cost Exposure Safeguard"]
    assert len(cost_checks) == 1
    assert cost_checks[0].status == "WARN"
    assert "$0.005/hour" in cost_checks[0].message
    assert "IPv4" in cost_checks[0].message

    dry_run = workflow.run_dry_run()
    assert dry_run.cost_analysis["estimated_hourly_cost_usd"] == 0.005
    assert any("$0.005/hour" in w for w in dry_run.cost_analysis["billing_risks"])


# 10. Dry-run generates complete cleanup plan
def test_dry_run_generates_complete_cleanup_plan():
    # GCP micro cleanup plan
    workflow_gcp = StagingWorkflow(
        repo_root=REPO_ROOT,
        mode=StagingMode.GCP_MICRO,
        target_arch="amd64",
    )
    dry_run_gcp = workflow_gcp.run_dry_run()
    assert len(dry_run_gcp.cleanup_plan) > 0
    cleanup_text_gcp = "\n".join(dry_run_gcp.cleanup_plan)
    assert "terraform -chdir=platform/infra/gcp destroy" in cleanup_text_gcp
    assert "docker compose -f platform/deploy/compose.micro.yaml down -v" in cleanup_text_gcp

    # Inventory must include cloud resources and containers
    assert "cloud_resources" in dry_run_gcp.resource_inventory
    assert "containers" in dry_run_gcp.resource_inventory
    assert "caddy" in dry_run_gcp.resource_inventory["containers"]
    assert "demo-web" in dry_run_gcp.resource_inventory["containers"]


# 11. Preflight succeeds with valid mock configuration
def test_preflight_succeeds_with_valid_mock_configuration():
    workflow = StagingWorkflow(
        repo_root=REPO_ROOT,
        mode=StagingMode.EXTERNAL_DB,
        target_arch="amd64",
        database_url="postgresql+psycopg://role_demo_app:SecretAppPw99!@ep-pool.test.neon.tech:5432/db_demo?sslmode=verify-full",
        database_migrate_url="postgresql+psycopg://role_demo_migrate:SecretMigPw99!@ep-direct.test.neon.tech:5432/db_demo?sslmode=verify-full",
    )
    report = workflow.run_preflight()
    assert report.all_passed is True
    assert all(c.passed for c in report.checks if c.status in ("PASS", "FAIL"))


# 12. Operation classification correctly distinguishes read-only vs mutation
def test_operation_classification_distinguishes_read_only_vs_mutation():
    # Staging preflight and dry-run are LOCAL_READ
    assert classify_command("megalith staging preflight --mode local") == OperationClassification.LOCAL_READ
    assert classify_command("megalith staging dry-run --mode gcp-micro") == OperationClassification.LOCAL_READ
    assert classify_command("python3 platform/deploy/scripts/staging.py preflight") == OperationClassification.LOCAL_READ
    assert classify_command("python3 platform/deploy/scripts/staging.py dry-run") == OperationClassification.LOCAL_READ

    # Cloud mutations and live executions
    assert classify_command("terraform apply", is_external=True) == OperationClassification.EXTERNAL_MUTATION
    assert classify_command("terraform destroy") == OperationClassification.DESTRUCTIVE
    assert classify_command("docker compose up -d") == OperationClassification.LOCAL_MUTATION
