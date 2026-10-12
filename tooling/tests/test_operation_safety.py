"""
Comprehensive security regression tests for Megalith Task 017:
- Operation Classifications
- Machine-Enforced Approval Gates
- Structural Secret Masking
- PostgreSQL Version Compatibility Controls
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "platform" / "deploy" / "scripts"))
sys.path.insert(0, str(REPO_ROOT / "platform" / "deploy" / "postgres"))

from operations import (  # type: ignore
    OperationClassification,
    OperationApproval,
    ApprovalValidationError,
    ApprovalNonceStore,
    classify_command,
    enforce_operation_approval,
)
from masking import (  # type: ignore
    mask_database_url,
    mask_key_value,
    mask_text,
    sanitize_exception,
    safe_run_subprocess,
)
from version_compat import (  # type: ignore
    VersionCompatibilityError,
    parse_version_tuple,
    validate_pg_dump_compatibility,
    validate_restore_target_compatibility,
    verify_restored_database_integrity,
)


# ============================================================================
# Task 1: Operation Classification & Machine-Enforced Approval Gates
# ============================================================================

def test_operation_classifications_exist():
    """All 5 required classifications must be defined."""
    assert OperationClassification.LOCAL_READ.value == "LOCAL_READ"
    assert OperationClassification.LOCAL_MUTATION.value == "LOCAL_MUTATION"
    assert OperationClassification.EXTERNAL_READ.value == "EXTERNAL_READ"
    assert OperationClassification.EXTERNAL_MUTATION.value == "EXTERNAL_MUTATION"
    assert OperationClassification.DESTRUCTIVE.value == "DESTRUCTIVE"


def test_classify_known_megalith_commands():
    """Commands must be strictly classified per policy."""
    assert classify_command("python3 tooling/validate.py") == OperationClassification.LOCAL_READ
    assert classify_command("docker compose config") == OperationClassification.LOCAL_READ
    assert classify_command("docker compose up -d") == OperationClassification.LOCAL_MUTATION
    assert classify_command("terraform plan") == OperationClassification.EXTERNAL_READ
    assert classify_command("SELECT 1 FROM counter", is_external=True) == OperationClassification.EXTERNAL_READ
    assert classify_command("alembic upgrade head", is_external=True) == OperationClassification.EXTERNAL_MUTATION
    assert classify_command("terraform apply") == OperationClassification.EXTERNAL_MUTATION
    assert classify_command("terraform destroy") == OperationClassification.DESTRUCTIVE
    assert classify_command("DROP DATABASE neondb", is_external=True) == OperationClassification.DESTRUCTIVE


def test_reject_missing_approval():
    """EXTERNAL_MUTATION or DESTRUCTIVE must fail closed if approval is missing."""
    with pytest.raises(ApprovalValidationError, match="No approval record provided"):
        enforce_operation_approval(
            classification=OperationClassification.EXTERNAL_MUTATION,
            provider="neon",
            resource="weathered-tree-15128117",
            environment="production",
            action="migrate",
            approval_file=None,
        )


def test_reject_in_tree_approval(tmp_path: Path):
    """Approval inside the Git repository tree must be rejected (cannot self-authorize)."""
    in_tree = REPO_ROOT / "platform" / "deploy" / ".test_in_tree_auth.json"
    try:
        in_tree.write_text("{}", encoding="utf-8")
        in_tree.chmod(0o600)
        with pytest.raises(ApprovalValidationError, match="located inside the repository tree"):
            OperationApproval.from_file(in_tree, repo_root=REPO_ROOT)
    finally:
        in_tree.unlink(missing_ok=True)


def test_reject_loose_permissions(tmp_path: Path):
    """Approval records with group or world permissions must be rejected."""
    auth_file = tmp_path / "loose_auth.json"
    auth_file.write_text(json.dumps({
        "schema_version": 1,
        "approval_id": "appr-20261012-001",
        "operator": "operator-alice",
        "provider": "neon",
        "resource": "weathered-tree-15128117",
        "environment": "production",
        "allowed_actions": ["migrate"],
        "max_classification": "EXTERNAL_MUTATION",
        "authorized_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
    }), encoding="utf-8")

    auth_file.chmod(0o644)
    with pytest.raises(ApprovalValidationError, match="Insecure permissions"):
        OperationApproval.from_file(auth_file, repo_root=REPO_ROOT)


def test_reject_wrong_project(tmp_path: Path):
    """Approval for project-A cannot authorize operations on project-B."""
    auth_file = tmp_path / "auth.json"
    auth = OperationApproval(
        schema_version=1,
        approval_id="appr-20261012-002",
        operator="operator-alice",
        provider="neon",
        resource="project-alpha",
        environment="production",
        allowed_actions=["migrate"],
        max_classification=OperationClassification.EXTERNAL_MUTATION,
        authorized_at=datetime.now(timezone.utc).isoformat(),
        expires_at=(datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
    )
    auth.save(auth_file)

    with pytest.raises(ApprovalValidationError, match="Resource mismatch"):
        enforce_operation_approval(
            classification=OperationClassification.EXTERNAL_MUTATION,
            provider="neon",
            resource="project-beta",
            environment="production",
            action="migrate",
            approval_file=auth_file,
            repo_root=REPO_ROOT,
        )


def test_reject_wrong_environment(tmp_path: Path):
    """Approval for staging cannot authorize production."""
    auth_file = tmp_path / "auth.json"
    auth = OperationApproval(
        schema_version=1,
        approval_id="appr-20261012-003",
        operator="operator-alice",
        provider="neon",
        resource="project-alpha",
        environment="staging",
        allowed_actions=["migrate"],
        max_classification=OperationClassification.EXTERNAL_MUTATION,
        authorized_at=datetime.now(timezone.utc).isoformat(),
        expires_at=(datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
    )
    auth.save(auth_file)

    with pytest.raises(ApprovalValidationError, match="Environment mismatch"):
        enforce_operation_approval(
            classification=OperationClassification.EXTERNAL_MUTATION,
            provider="neon",
            resource="project-alpha",
            environment="production",
            action="migrate",
            approval_file=auth_file,
            repo_root=REPO_ROOT,
        )


def test_reject_expired_approval(tmp_path: Path):
    """Approval expired by TTL must be rejected."""
    auth_file = tmp_path / "auth.json"
    past = datetime.now(timezone.utc) - timedelta(minutes=5)
    auth = OperationApproval(
        schema_version=1,
        approval_id="appr-20261012-004",
        operator="operator-alice",
        provider="neon",
        resource="project-alpha",
        environment="production",
        allowed_actions=["migrate"],
        max_classification=OperationClassification.EXTERNAL_MUTATION,
        authorized_at=(past - timedelta(minutes=10)).isoformat(),
        expires_at=past.isoformat(),
    )
    auth.save(auth_file)

    with pytest.raises(ApprovalValidationError, match="expired"):
        enforce_operation_approval(
            classification=OperationClassification.EXTERNAL_MUTATION,
            provider="neon",
            resource="project-alpha",
            environment="production",
            action="migrate",
            approval_file=auth_file,
            repo_root=REPO_ROOT,
        )


def test_reject_reused_one_time_approval(tmp_path: Path):
    """One-time approvals must be recorded in nonce store and rejected on replay."""
    auth_file = tmp_path / "auth.json"
    nonce_db = tmp_path / "nonces.json"
    nonce_store = ApprovalNonceStore(nonce_db)

    auth = OperationApproval(
        schema_version=1,
        approval_id="appr-20261012-one-time",
        operator="operator-alice",
        provider="neon",
        resource="project-alpha",
        environment="production",
        allowed_actions=["migrate"],
        max_classification=OperationClassification.EXTERNAL_MUTATION,
        authorized_at=datetime.now(timezone.utc).isoformat(),
        expires_at=(datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
        one_time=True,
    )
    auth.save(auth_file)

    # First execution succeeds
    assert enforce_operation_approval(
        classification=OperationClassification.EXTERNAL_MUTATION,
        provider="neon",
        resource="project-alpha",
        environment="production",
        action="migrate",
        approval_file=auth_file,
        repo_root=REPO_ROOT,
        nonce_store=nonce_store,
    ) is True

    # Replay attempt must fail closed
    with pytest.raises(ApprovalValidationError, match="One-time approval 'appr-20261012-one-time' has already been consumed"):
        enforce_operation_approval(
            classification=OperationClassification.EXTERNAL_MUTATION,
            provider="neon",
            resource="project-alpha",
            environment="production",
            action="migrate",
            approval_file=auth_file,
            repo_root=REPO_ROOT,
            nonce_store=nonce_store,
        )


def test_reject_readonly_approval_used_for_mutation(tmp_path: Path):
    """An EXTERNAL_READ approval cannot be used for an EXTERNAL_MUTATION."""
    auth_file = tmp_path / "auth.json"
    auth = OperationApproval(
        schema_version=1,
        approval_id="appr-20261012-ro",
        operator="operator-alice",
        provider="neon",
        resource="project-alpha",
        environment="production",
        allowed_actions=["inspect"],
        max_classification=OperationClassification.EXTERNAL_READ,
        authorized_at=datetime.now(timezone.utc).isoformat(),
        expires_at=(datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
    )
    auth.save(auth_file)

    with pytest.raises(ApprovalValidationError, match="Insufficient classification clearance"):
        enforce_operation_approval(
            classification=OperationClassification.EXTERNAL_MUTATION,
            provider="neon",
            resource="project-alpha",
            environment="production",
            action="migrate",
            approval_file=auth_file,
            repo_root=REPO_ROOT,
        )


def test_reject_interactive_modal_or_prerequisite_as_approval(tmp_path: Path):
    """Raw strings or interactive dialog responses cannot substitute for signed/authenticated approval files."""
    invalid_inputs = [
        "password roration has been done",
        "(Recommended) Automatically update NEON_ADMIN_URL and proceed with Gate B live testing",
        "yes",
        "approved",
    ]

    for inv in invalid_inputs:
        with pytest.raises(ApprovalValidationError):
            OperationApproval.from_raw_string(inv)


def test_reject_exceeding_approved_action_scope(tmp_path: Path):
    """Actions outside the approved allowed_actions list must be rejected."""
    auth_file = tmp_path / "auth.json"
    auth = OperationApproval(
        schema_version=1,
        approval_id="appr-20261012-scope",
        operator="operator-alice",
        provider="neon",
        resource="project-alpha",
        environment="production",
        allowed_actions=["migrate"],
        max_classification=OperationClassification.EXTERNAL_MUTATION,
        authorized_at=datetime.now(timezone.utc).isoformat(),
        expires_at=(datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
    )
    auth.save(auth_file)

    with pytest.raises(ApprovalValidationError, match="Action 'drop_table' is not in approved allowed_actions"):
        enforce_operation_approval(
            classification=OperationClassification.EXTERNAL_MUTATION,
            provider="neon",
            resource="project-alpha",
            environment="production",
            action="drop_table",
            approval_file=auth_file,
            repo_root=REPO_ROOT,
        )


def test_fail_closed_when_approval_file_missing_or_corrupt(tmp_path: Path):
    """If approval file does not exist or has corrupt JSON, fail closed."""
    with pytest.raises(ApprovalValidationError, match="Approval file not found"):
        OperationApproval.from_file(tmp_path / "nonexistent.json", repo_root=REPO_ROOT)

    corrupt = tmp_path / "corrupt.json"
    corrupt.write_text("{invalid json...", encoding="utf-8")
    corrupt.chmod(0o600)
    with pytest.raises(ApprovalValidationError, match="Corrupt or unparseable"):
        OperationApproval.from_file(corrupt, repo_root=REPO_ROOT)


# ============================================================================
# Task 2: Structural Secret Masking & Safe Subprocess Output
# ============================================================================

def test_mask_database_urls():
    """Database URLs must have passwords redacted while preserving host/port/db."""
    raw = "postgresql://role_demo_app:SuperSecret123@ep-mute.c-7.aws.neon.tech:5432/neondb?sslmode=verify-full"
    masked = mask_database_url(raw)
    assert "SuperSecret123" not in masked
    assert "postgresql://role_demo_app:***@ep-mute.c-7.aws.neon.tech:5432/neondb?sslmode=verify-full" == masked

    dialect_raw = "postgresql+psycopg://user:p@ssw0rd!@localhost:5432/db"
    assert "p@ssw0rd!" not in mask_database_url(dialect_raw)


def test_mask_key_value_assignments():
    """Environment variables and assignments must mask passwords and tokens."""
    text = (
        'POSTGRES_PASSWORD="secret_pg_pass"\n'
        'ROLE_DEMO_APP_PASSWORD=demo_app_pass\n'
        'API_KEY="key_998877"\n'
        'Authorization: Bearer secret_bearer_token\n'
        'SAFE_HOST="db.internal.net"'
    )
    masked = mask_text(text)
    assert "secret_pg_pass" not in masked
    assert "demo_app_pass" not in masked
    assert "key_998877" not in masked
    assert "secret_bearer_token" not in masked
    assert 'SAFE_HOST="db.internal.net"' in masked


def test_mask_exceptions_with_credentials():
    """Exceptions containing connection strings must be sanitized."""
    try:
        raise ValueError("Failed connecting to postgresql://admin:leaked_pw@db.cloud:5432/prod")
    except Exception as exc:
        sanitized = sanitize_exception(exc)
        assert "leaked_pw" not in sanitized
        assert "postgresql://admin:***@db.cloud:5432/prod" in sanitized


def test_mask_subprocess_output_and_args():
    """Subprocess execution wrapper must mask sensitive outputs and command representations."""
    cmd = ["python3", "-c", "print('Connecting to postgresql://usr:pass123@host:5432/db'); print('DEMO_PASSWORD=leaked')"]
    res = safe_run_subprocess(cmd)
    assert "pass123" not in res.stdout
    assert "leaked" not in res.stdout
    assert "postgresql://usr:***@host:5432/db" in res.stdout


def test_mask_docker_compose_config_output():
    """Docker configuration dumps containing secrets must have passwords masked."""
    docker_cfg = """
services:
  demo-api:
    environment:
      DATABASE_URL: postgresql+psycopg://app_usr:very_secret_pwd@db:5432/neondb
      SECRET_KEY: top_secret_jwt_key
    image: megalith-demo-api:local
"""
    masked = mask_text(docker_cfg)
    assert "very_secret_pwd" not in masked
    assert "top_secret_jwt_key" not in masked
    assert "megalith-demo-api:local" in masked


# ============================================================================
# Task 3: PostgreSQL Version Compatibility Controls
# ============================================================================

def test_parse_version_tuple():
    """Version string parsing handles diverse server and client banners."""
    assert parse_version_tuple("pg_dump (PostgreSQL) 18.6 (Ubuntu 18.6-1.pgdg24.04+2)") == (18, 6)
    assert parse_version_tuple("PostgreSQL 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)") == (16, 15)
    assert parse_version_tuple("180006") == (18, 6)
    assert parse_version_tuple("16.2") == (16, 2)


def test_validate_pg_dump_compatibility_rejection():
    """Client pg_dump version older than server version must raise VersionCompatibilityError."""
    # pg_dump 16 cannot dump server 18
    with pytest.raises(VersionCompatibilityError, match="incompatible with server version 18"):
        validate_pg_dump_compatibility("16.15", "18.6")

    # pg_dump 18 CAN dump server 16 or 18
    validate_pg_dump_compatibility("18.6", "16.15")
    validate_pg_dump_compatibility("18.6", "18.6")


def test_validate_restore_target_compatibility_warnings():
    """Cross-version downgrade restore generates actionable warnings."""
    warnings = validate_restore_target_compatibility("18.6", "16.15")
    assert len(warnings) == 1
    assert "Cross-version downgrade restore detected" in warnings[0]
    assert "transaction_timeout" in warnings[0]

    # Matching version produces zero warnings
    assert len(validate_restore_target_compatibility("16.15", "16.15")) == 0


class MockCursor:
    def __init__(self, tables: set[str], counts: dict[str, int], rev: Optional[str]):
        self.tables = tables
        self.counts = counts
        self.rev = rev
        self._last_query = ""

    def execute(self, query: str):
        self._last_query = query.strip()

    def fetchall(self):
        if "information_schema.tables" in self._last_query:
            return [[t] for t in self.tables]
        return []

    def fetchone(self):
        if "COUNT(*)" in self._last_query:
            for tbl, count in self.counts.items():
                if f"public.{tbl}" in self._last_query:
                    return [count]
            return [0]
        if "alembic_version" in self._last_query:
            return [self.rev] if self.rev else None
        return None


def test_verify_restored_database_integrity_success():
    """Structural verification confirms tables, row counts, and migration revisions."""
    cursor = MockCursor(
        tables={"counter", "alembic_version"},
        counts={"counter": 3},
        rev="0001_create_counter_table",
    )
    result = verify_restored_database_integrity(
        cursor=cursor,
        expected_tables=["counter", "alembic_version"],
        min_rows={"counter": 1},
        expected_alembic_rev="0001_create_counter_table",
    )
    assert result["verified"] is True
    assert result["row_counts"]["counter"] == 3


def test_verify_restored_database_integrity_rejection_missing_table():
    """Restored database missing a required table must fail validation."""
    cursor = MockCursor(
        tables={"alembic_version"},
        counts={},
        rev="0001_create_counter_table",
    )
    with pytest.raises(VersionCompatibilityError, match="missing expected tables: \\['counter'\\]"):
        verify_restored_database_integrity(
            cursor=cursor,
            expected_tables=["counter", "alembic_version"],
        )


def test_verify_restored_database_integrity_rejection_empty_rows():
    """Restored database with 0 rows where data was expected must fail validation."""
    cursor = MockCursor(
        tables={"counter", "alembic_version"},
        counts={"counter": 0},
        rev="0001_create_counter_table",
    )
    with pytest.raises(VersionCompatibilityError, match="Table 'counter' has 0 rows, expected at least 1"):
        verify_restored_database_integrity(
            cursor=cursor,
            expected_tables=["counter", "alembic_version"],
            min_rows={"counter": 1},
        )


# ============================================================================
# Cooperative Governance Model Tests (Operator Decision 2026-10-12)
# ============================================================================

def test_cooperative_approval_lifecycle(tmp_path: Path):
    """
    Verifies the cooperative governance model:
    Agy can programmatically create, persist, and consume out-of-tree approval files
    when authorized by the operator, while retaining one-time replay protection.
    """
    approval_file = tmp_path / "cooperative_approval.json"
    now = datetime.now(timezone.utc)

    # 1. Agy creates and saves the approval record locally out-of-tree
    approval = OperationApproval(
        schema_version=1,
        approval_id="appr-20261012-cooperative-01",
        operator="operator-alice",
        provider="neon",
        resource="weathered-tree-15128117",
        environment="production",
        allowed_actions=["migrate"],
        max_classification=OperationClassification.EXTERNAL_MUTATION,
        authorized_at=now.isoformat(),
        expires_at=(now + timedelta(minutes=15)).isoformat(),
        one_time=True,
    )
    approval.save(approval_file)

    assert approval_file.exists()
    assert (approval_file.stat().st_mode & 0o777) == 0o600

    # 2. Replay store tracks consumption
    nonce_store_path = tmp_path / "nonces.json"
    nonce_store = ApprovalNonceStore(store_path=nonce_store_path)

    # 3. Successful execution gate check
    valid_approval = enforce_operation_approval(
        classification=OperationClassification.EXTERNAL_MUTATION,
        provider="neon",
        resource="weathered-tree-15128117",
        environment="production",
        action="migrate",
        approval_file=approval_file,
        nonce_store=nonce_store,
        repo_root=REPO_ROOT,
    )
    assert valid_approval is True
    assert nonce_store.is_consumed("appr-20261012-cooperative-01")

    # 4. Immediate replay attempt fails closed
    with pytest.raises(ApprovalValidationError, match="has already been consumed"):
        enforce_operation_approval(
            classification=OperationClassification.EXTERNAL_MUTATION,
            provider="neon",
            resource="weathered-tree-15128117",
            environment="production",
            action="migrate",
            approval_file=approval_file,
            nonce_store=nonce_store,
            repo_root=REPO_ROOT,
        )


def test_pr_review_does_not_replace_live_operation_approval():
    """
    PR review governs code changes; live external operations strictly require
    an explicit out-of-tree OperationApproval record. Passing commit hashes or PR
    context without an approval file fails closed.
    """
    with pytest.raises(ApprovalValidationError, match="No approval record provided"):
        enforce_operation_approval(
            classification=OperationClassification.EXTERNAL_MUTATION,
            provider="gcp",
            resource="prod-cluster",
            environment="production",
            action="deploy",
            approval_file=None,
        )


def test_agent_generated_approval_record_permitted(tmp_path: Path):
    """
    Scenario 1: Agent-generated approval records via OperationApproval.create()
    are fully permitted and pass cooperative validation.
    """
    approval_file = tmp_path / "agent_created_appr.json"
    approval = OperationApproval.create(
        approval_id="appr-20261012-agent01",
        operator="operator-alice",
        provider="oci",
        resource="vm-standard-a1",
        environment="staging",
        allowed_actions=["deploy", "migrate"],
        max_classification=OperationClassification.EXTERNAL_MUTATION,
        ttl_minutes=45,
        one_time=True,
        notes="Agent generated for operator authorized staging deploy",
    )
    approval.save(approval_file)

    assert approval_file.exists()
    loaded = OperationApproval.from_file(approval_file, enforce_out_of_tree=False)
    assert loaded.approval_id == "appr-20261012-agent01"
    assert loaded.provider == "oci"
    assert loaded.environment == "staging"
    assert "deploy" in loaded.allowed_actions


def test_live_operations_remain_explicitly_gated_by_policy(tmp_path: Path):
    """
    Scenario 7: Live operations remain explicitly gated by policy:
    - LOCAL_READ and LOCAL_MUTATION succeed autonomously without approval.
    - EXTERNAL_MUTATION and DESTRUCTIVE fail closed without valid approval.
    """
    # Local operations proceed autonomously without approval
    assert enforce_operation_approval(
        classification=OperationClassification.LOCAL_READ,
        provider="local",
        resource="repo",
        environment="local",
        action="read",
        approval_file=None,
    ) is True

    assert enforce_operation_approval(
        classification=OperationClassification.LOCAL_MUTATION,
        provider="docker",
        resource="dev-containers",
        environment="development",
        action="up",
        approval_file=None,
    ) is True

    # External mutation fails without approval
    with pytest.raises(ApprovalValidationError, match="requires operator approval"):
        enforce_operation_approval(
            classification=OperationClassification.EXTERNAL_MUTATION,
            provider="neon",
            resource="prod-db",
            environment="production",
            action="write",
            approval_file=None,
        )

    # Destructive operation fails without approval
    with pytest.raises(ApprovalValidationError, match="requires operator approval"):
        enforce_operation_approval(
            classification=OperationClassification.DESTRUCTIVE,
            provider="oci",
            resource="prod-vm",
            environment="production",
            action="destroy",
            approval_file=None,
        )


def test_existing_deployment_and_database_operations_compatibility(tmp_path: Path):
    """
    Scenario 10: Existing deployment and database operations remain compatible:
    A valid approval authorizes migrate and deploy actions across tooling.
    """
    auth_file = tmp_path / "compat_auth.json"
    approval = OperationApproval.create(
        approval_id="appr-20261012-compat01",
        operator="operator-alice",
        provider="neon",
        resource="neondb",
        environment="production",
        allowed_actions=["migrate", "backup"],
        max_classification=OperationClassification.EXTERNAL_MUTATION,
        ttl_minutes=20,
        one_time=False,
    )
    approval.save(auth_file)

    # Check migration clearance
    assert enforce_operation_approval(
        classification=OperationClassification.EXTERNAL_MUTATION,
        provider="neon",
        resource="neondb",
        environment="production",
        action="migrate",
        approval_file=auth_file,
        repo_root=REPO_ROOT,
    ) is True

    # Check external read (backup) clearance
    assert enforce_operation_approval(
        classification=OperationClassification.EXTERNAL_READ,
        provider="neon",
        resource="neondb",
        environment="production",
        action="backup",
        approval_file=auth_file,
        repo_root=REPO_ROOT,
    ) is True

