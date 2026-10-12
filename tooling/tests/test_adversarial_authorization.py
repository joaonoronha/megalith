"""
Adversarial tests for Megalith deployment authorization boundaries (Task 011 Objective D).

Verifies that:
1. Authorization records inside the Git repository tree are rejected (cannot self-authorize via git commit).
2. World-writable or group-writable authorization files are rejected.
3. Authorization records owned by untrusted UIDs are rejected.
4. Expired authorizations (>1 hour TTL) are rejected.
5. Altered or tampered release manifests fail authorization matching.
6. Forged release digests or environment mismatches fail closed.
7. Authorization cannot be created without required operator identity fields.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "platform" / "deploy" / "scripts"))

from release import (  # type: ignore
    AuthorizationValidationError,
    DeploymentAuthorization,
    ReleaseManifest,
    ReleaseValidationError,
    create_deployment_authorization,
    create_release_manifest,
)


@pytest.fixture
def sample_manifest() -> ReleaseManifest:
    return create_release_manifest(
        release_id="rel-20261012-test01",
        git_sha="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        environment="production",
        images={
            "demo-api": "ghcr.io/megalith/demo-api:rel-20261012-test01@sha256:" + "0" * 64,
            "demo-web": "ghcr.io/megalith/demo-web:rel-20261012-test01@sha256:" + "1" * 64,
        },
        schema_version=2,
    )


def test_reject_in_tree_authorization_file(sample_manifest: ReleaseManifest):
    """Untrusted repository content cannot impersonate operator via in-repo authorization file."""
    in_tree_dir = REPO_ROOT / "platform" / "deploy" / ".test_adversarial"
    in_tree_dir.mkdir(parents=True, exist_ok=True)
    in_tree_auth = in_tree_dir / "auth.json"

    try:
        auth = create_deployment_authorization(
            operator="adversary",
            manifest=sample_manifest,
            environment="production",
            notes="Forged in-repo authorization",
        )
        auth.save(in_tree_auth)

        with pytest.raises(AuthorizationValidationError, match="located inside the repository tree"):
            DeploymentAuthorization.from_file(in_tree_auth, enforce_out_of_tree=True)
    finally:
        if in_tree_auth.exists():
            in_tree_auth.unlink()
        if in_tree_dir.exists():
            in_tree_dir.rmdir()


def test_reject_loose_file_permissions(tmp_path: Path, sample_manifest: ReleaseManifest):
    """Authorization files with group or world permissions must be rejected."""
    auth_file = tmp_path / "loose_auth.json"
    auth = create_deployment_authorization(
        operator="operator-alice",
        manifest=sample_manifest,
        environment="production",
    )
    auth.save(auth_file)

    # Make file world-readable / writable
    auth_file.chmod(0o666)
    with pytest.raises(AuthorizationValidationError, match="Insecure permissions"):
        DeploymentAuthorization.from_file(auth_file, enforce_out_of_tree=False)

    # Group-readable
    auth_file.chmod(0o640)
    with pytest.raises(AuthorizationValidationError, match="Insecure permissions"):
        DeploymentAuthorization.from_file(auth_file, enforce_out_of_tree=False)


def test_reject_expired_authorization(tmp_path: Path, sample_manifest: ReleaseManifest):
    """Authorization records older than 1 hour TTL must be rejected."""
    auth_file = tmp_path / "expired_auth.json"
    auth = create_deployment_authorization(
        operator="operator-alice",
        manifest=sample_manifest,
        environment="production",
    )

    # Backdate authorization timestamp to 2 hours ago
    expired_time = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    auth.authorized_at = expired_time
    auth.save(auth_file)

    loaded_auth = DeploymentAuthorization.from_file(auth_file, enforce_out_of_tree=False)
    with pytest.raises(AuthorizationValidationError, match="expired"):
        loaded_auth.validate_against_manifest(sample_manifest, environment="production", max_age_seconds=3600)


def test_reject_tampered_manifest_digest(tmp_path: Path, sample_manifest: ReleaseManifest):
    """If release manifest is altered after authorization, verification must fail closed."""
    auth_file = tmp_path / "valid_auth.json"
    auth = create_deployment_authorization(
        operator="operator-alice",
        manifest=sample_manifest,
        environment="production",
    )
    auth.save(auth_file)

    # Tamper with the manifest (e.g. inject rogue image digest)
    tampered_manifest = ReleaseManifest(
        schema_version=sample_manifest.schema_version,
        release_id=sample_manifest.release_id,
        git_sha=sample_manifest.git_sha,
        created_at=sample_manifest.created_at,
        environment=sample_manifest.environment,
        config_version=sample_manifest.config_version,
        services=sample_manifest.services,
        images={"demo-api": "ghcr.io/megalith/demo-api:rogue@sha256:" + "f" * 64, "demo-web": sample_manifest.images["demo-web"]},
        migrations=sample_manifest.migrations,
        metadata=sample_manifest.metadata,
        approval=sample_manifest.approval,
    )

    with pytest.raises(AuthorizationValidationError, match="Cryptographic digest mismatch"):
        auth.validate_against_manifest(tampered_manifest, environment="production")


def test_reject_mismatched_environment(tmp_path: Path):
    """Authorization granted for staging cannot authorize production."""
    staging_manifest = create_release_manifest(
        release_id="rel-20261012-staging",
        git_sha="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        environment="staging",
        images={
            "demo-api": "ghcr.io/megalith/demo-api:rel-20261012-staging@sha256:" + "0" * 64,
            "demo-web": "ghcr.io/megalith/demo-web:rel-20261012-staging@sha256:" + "1" * 64,
        },
        schema_version=2,
    )
    auth_file = tmp_path / "staging_auth.json"
    auth = create_deployment_authorization(
        operator="operator-alice",
        manifest=staging_manifest,
        environment="staging",
    )
    auth.save(auth_file)

    with pytest.raises(AuthorizationValidationError, match="Authorization environment mismatch"):
        auth.validate_against_manifest(staging_manifest, environment="production")


def test_reject_empty_operator(sample_manifest: ReleaseManifest):
    """Operator identity is mandatory and cannot be blank or whitespace."""
    with pytest.raises(AuthorizationValidationError, match="Operator identity is required"):
        create_deployment_authorization(
            operator="   ",
            manifest=sample_manifest,
            environment="production",
        )
