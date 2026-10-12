"""
Unit tests for Megalith release manifest parsing and strict validation rules.

Validates Section 16 requirements:
- Valid release manifests.
- Invalid schema versions.
- Missing or malformed commit SHA.
- Invalid image digests.
- Mutable tag references (rejected).
- Unknown or duplicate services.
- Invalid environment names.
- Unsafe release identifiers and path traversal attempts.
- Invalid migration declarations.
- Rollback compatibility flags.
- Missing or mismatched human approval metadata.
"""

from __future__ import annotations

import sys
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
    validate_release_dict,
)


@pytest.fixture
def valid_manifest_dict() -> dict:
    return {
        "schema_version": 1,
        "release_id": "rel-20261010-001",
        "git_sha": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        "created_at": "2026-10-10T12:00:00Z",
        "environment": "production",
        "config_version": "1.0",
        "services": ["demo-api", "demo-web"],
        "images": {
            "demo-api": "ghcr.io/example/demo-api@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258",
            "demo-web": "ghcr.io/example/demo-web@sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2a1b2c3d4e5f6a1b2c3d4e5f6",
        },
        "migrations": [
            {
                "service": "demo-api",
                "applied": True,
                "command": "alembic upgrade head",
                "backward_compatible": True,
            }
        ],
        "metadata": {
            "author": "engineer@example.com",
            "summary": "Verified initial release",
        },
        "approval": {
            "authorized_by": "lead-platform-engineer",
            "authorized_at": "2026-10-10T12:05:00Z",
            "release_id": "rel-20261010-001",
            "target_environment": "production",
            "intent": "deploy",
        },
    }


def test_valid_manifest_passes_validation(valid_manifest_dict: dict):
    manifest = validate_release_dict(valid_manifest_dict, require_approval=True)
    assert manifest.schema_version == 1
    assert manifest.release_id == "rel-20261010-001"
    assert manifest.git_sha == "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
    assert len(manifest.services) == 2
    assert manifest.approval is not None
    assert manifest.approval.authorized_by == "lead-platform-engineer"


def test_invalid_schema_version(valid_manifest_dict: dict):
    valid_manifest_dict["schema_version"] = 3
    with pytest.raises(ReleaseValidationError, match="Unsupported schema_version: 3"):
        validate_release_dict(valid_manifest_dict)


def test_missing_or_invalid_git_sha(valid_manifest_dict: dict):
    # Short SHA rejected
    valid_manifest_dict["git_sha"] = "a1b2c3d4"
    with pytest.raises(ReleaseValidationError, match="Field 'git_sha' must be a 40-character"):
        validate_release_dict(valid_manifest_dict)

    # Non-hex SHA rejected
    valid_manifest_dict["git_sha"] = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"
    with pytest.raises(ReleaseValidationError, match="Field 'git_sha' must be a 40-character"):
        validate_release_dict(valid_manifest_dict)


def test_mutable_tag_rejected(valid_manifest_dict: dict):
    # Mutable tag without digest must be strictly rejected
    valid_manifest_dict["images"]["demo-api"] = "ghcr.io/example/demo-api:latest"
    with pytest.raises(ReleaseValidationError, match="Mutable image reference rejected"):
        validate_release_dict(valid_manifest_dict)

    valid_manifest_dict["images"]["demo-api"] = "ghcr.io/example/demo-api:v1.2.3"
    with pytest.raises(ReleaseValidationError, match="Mutable image reference rejected"):
        validate_release_dict(valid_manifest_dict)


def test_invalid_digest_syntax(valid_manifest_dict: dict):
    # Truncated digest rejected
    valid_manifest_dict["images"]["demo-api"] = "ghcr.io/example/demo-api@sha256:1234"
    with pytest.raises(ReleaseValidationError, match="Invalid digest syntax"):
        validate_release_dict(valid_manifest_dict)


def test_unknown_service_rejected(valid_manifest_dict: dict):
    valid_manifest_dict["services"].append("unknown-service")
    valid_manifest_dict["images"]["unknown-service"] = (
        "ghcr.io/example/unknown@sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2a1b2c3d4e5f6a1b2c3d4e5f6"
    )
    with pytest.raises(ReleaseValidationError, match="Unknown service 'unknown-service'"):
        validate_release_dict(valid_manifest_dict)


def test_duplicate_service_rejected(valid_manifest_dict: dict):
    valid_manifest_dict["services"] = ["demo-api", "demo-api"]
    with pytest.raises(ReleaseValidationError, match="Duplicate service declared"):
        validate_release_dict(valid_manifest_dict)


def test_invalid_environment_name(valid_manifest_dict: dict):
    valid_manifest_dict["environment"] = "development_local"
    with pytest.raises(ReleaseValidationError, match="Invalid environment 'development_local'"):
        validate_release_dict(valid_manifest_dict)


@pytest.mark.parametrize(
    "bad_id",
    [
        "../escape",
        "rel/subpath",
        "rel\\backslash",
        "a",  # too short
        "rel with spaces",
        "rel;rm -rf /",
    ],
)
def test_unsafe_release_id_rejected(valid_manifest_dict: dict, bad_id: str):
    valid_manifest_dict["release_id"] = bad_id
    with pytest.raises(ReleaseValidationError):
        validate_release_dict(valid_manifest_dict)


def test_invalid_migration_command_rejected(valid_manifest_dict: dict):
    valid_manifest_dict["migrations"] = [
        {
            "service": "demo-api",
            "applied": True,
            "command": "rm -rf /; echo evil",
            "backward_compatible": False,
        }
    ]
    with pytest.raises(ReleaseValidationError, match="Migration command .* not in allowlist"):
        validate_release_dict(valid_manifest_dict)


def test_approval_mismatch_rejected(valid_manifest_dict: dict):
    # Release ID mismatch in approval
    valid_manifest_dict["approval"]["release_id"] = "different-release-id"
    with pytest.raises(ReleaseValidationError, match="Approval release_id mismatch"):
        validate_release_dict(valid_manifest_dict, require_approval=True)

    # Environment mismatch in approval
    valid_manifest_dict["approval"]["release_id"] = valid_manifest_dict["release_id"]
    valid_manifest_dict["approval"]["target_environment"] = "staging"
    with pytest.raises(ReleaseValidationError, match="Approval environment mismatch"):
        validate_release_dict(valid_manifest_dict, require_approval=True)

    # Intent mismatch in approval
    valid_manifest_dict["approval"]["target_environment"] = "production"
    valid_manifest_dict["approval"]["intent"] = "preview"
    with pytest.raises(ReleaseValidationError, match="Approval intent must be 'deploy'"):
        validate_release_dict(valid_manifest_dict, require_approval=True)


def test_require_approval_fails_when_approval_missing(valid_manifest_dict: dict):
    del valid_manifest_dict["approval"]
    with pytest.raises(ReleaseValidationError, match="Explicit human authorization .* is required"):
        validate_release_dict(valid_manifest_dict, require_approval=True)


def test_create_release_manifest_helper():
    images = {
        "demo-api": "ghcr.io/example/demo-api@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258",
        "demo-web": "ghcr.io/example/demo-web@sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2a1b2c3d4e5f6a1b2c3d4e5f6",
    }
    manifest = create_release_manifest(
        release_id="rel-20261010-helper",
        git_sha="1122334455667788990011223344556677889900",
        environment="production",
        images=images,
    )
    assert manifest.release_id == "rel-20261010-helper"
    assert manifest.services == ["demo-api", "demo-web"]
    assert manifest.images == images
    assert manifest.schema_version == 2


def test_schema_v2_manifest_forbids_embedded_approval():
    images = {
        "demo-api": "ghcr.io/example/demo-api@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258",
        "demo-web": "ghcr.io/example/demo-web@sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2a1b2c3d4e5f6a1b2c3d4e5f6",
    }
    raw = {
        "schema_version": 2,
        "release_id": "rel-20261010-v2",
        "git_sha": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        "created_at": "2026-10-10T12:00:00Z",
        "environment": "production",
        "config_version": "1.0",
        "services": ["demo-api", "demo-web"],
        "images": images,
        "approval": {
            "authorized_by": "attacker",
            "authorized_at": "2026-10-10T12:05:00Z",
            "release_id": "rel-20261010-v2",
            "target_environment": "production",
            "intent": "deploy",
        },
    }
    with pytest.raises(ReleaseValidationError, match="Embedded 'approval' object is strictly forbidden in Release Manifest v2"):
        validate_release_dict(raw)


def test_canonical_digest_determinism():
    images = {
        "demo-api": "ghcr.io/example/demo-api@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258",
        "demo-web": "ghcr.io/example/demo-web@sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2a1b2c3d4e5f6a1b2c3d4e5f6",
    }
    m1 = create_release_manifest(
        release_id="rel-20261010-det",
        git_sha="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        environment="production",
        images=images,
        schema_version=2,
    )
    m2 = create_release_manifest(
        release_id="rel-20261010-det",
        git_sha="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        environment="production",
        images=images,
        schema_version=2,
    )
    # Ensure timestamps match for determinism test
    m2.created_at = m1.created_at
    assert m1.canonical_digest() == m2.canonical_digest()
    assert m1.canonical_digest().startswith("sha256:")


def test_canonical_digest_tamper_detection():
    images = {
        "demo-api": "ghcr.io/example/demo-api@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258",
        "demo-web": "ghcr.io/example/demo-web@sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2a1b2c3d4e5f6a1b2c3d4e5f6",
    }
    m1 = create_release_manifest(
        release_id="rel-20261010-tamper",
        git_sha="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        environment="production",
        images=images,
        schema_version=2,
    )
    digest1 = m1.canonical_digest()

    # Tampering with an image digest changes canonical digest
    m1.images["demo-api"] = "ghcr.io/example/demo-api@sha256:0000000000000000000000000000000000000000000000000000000000000000"
    digest2 = m1.canonical_digest()
    assert digest1 != digest2


def test_deployment_authorization_success_and_validation():
    images = {
        "demo-api": "ghcr.io/example/demo-api@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258",
        "demo-web": "ghcr.io/example/demo-web@sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2a1b2c3d4e5f6a1b2c3d4e5f6",
    }
    manifest = create_release_manifest(
        release_id="rel-20261010-auth",
        git_sha="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        environment="production",
        images=images,
        schema_version=2,
    )
    auth = create_deployment_authorization(
        operator="platform-admin",
        manifest=manifest,
        environment="production",
        notes="Pre-approved production launch",
    )
    assert auth.operator == "platform-admin"
    assert auth.release_id == manifest.release_id
    assert auth.target_environment == "production"
    assert auth.manifest_digest == manifest.canonical_digest()

    # Validates cleanly
    auth.validate_against_manifest(manifest, "production")

    # Rejects mismatched release
    other_manifest = create_release_manifest(
        release_id="rel-20261010-other",
        git_sha="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        environment="production",
        images=images,
        schema_version=2,
    )
    with pytest.raises(AuthorizationValidationError, match="release_id mismatch"):
        auth.validate_against_manifest(other_manifest, "production")

    # Rejects mismatched environment
    with pytest.raises(AuthorizationValidationError, match="environment mismatch"):
        auth.validate_against_manifest(manifest, "staging")

    # Rejects modified manifest content (tamper detection)
    manifest.images["demo-api"] = "ghcr.io/example/demo-api@sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    with pytest.raises(AuthorizationValidationError, match="Cryptographic digest mismatch"):
        auth.validate_against_manifest(manifest, "production")

