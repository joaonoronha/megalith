"""
Unit tests for Megalith crash-safe deployment state machine, concurrency locking,
operator authorization, and interrupted transaction detection (Task 010).
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "platform" / "deploy" / "scripts"))

from deploy import (  # type: ignore
    Deployer,
    DeploymentExecutionError,
    DeploymentLock,
    DeploymentLockError,
    DeploymentState,
    InterruptedDeploymentError,
    PHASE_APPLYING,
    PHASE_MIGRATING,
    PHASE_PREPARED,
    PHASE_SUCCEEDED,
)
from release import (  # type: ignore
    AuthorizationValidationError,
    create_deployment_authorization,
    create_release_manifest,
)


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as td:
        yield Path(td)


@pytest.fixture
def sample_manifest():
    return create_release_manifest(
        release_id="rel-20261011-001",
        git_sha="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        environment="production",
        images={
            "demo-api": "ghcr.io/example/demo-api@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258",
            "demo-web": "ghcr.io/example/demo-web@sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2a1b2c3d4e5f6a1b2c3d4e5f6",
        },
        schema_version=2,
    )


def test_deployment_lock_concurrency(temp_dir: Path):
    lock_file = temp_dir / "deploy.lock"
    with DeploymentLock(lock_file):
        assert lock_file.exists()
        # Second concurrent lock must fail
        with pytest.raises(DeploymentLockError, match="Another deployment is currently in progress"):
            with DeploymentLock(lock_file):
                pass
    # Lock cleanly released after exit
    with DeploymentLock(lock_file):
        pass


def test_deployment_state_phases(temp_dir: Path, sample_manifest):
    state_file = temp_dir / "state.json"
    state = DeploymentState(state_file)

    # Start transaction
    tx = state.start_transaction(
        tx_id="tx-test-1",
        operator="admin",
        target_manifest=sample_manifest,
        previous_manifest=None,
    )
    assert tx["phase"] == PHASE_PREPARED
    assert state.data["status"] == "in_progress"
    assert state_file.exists()

    # Phase transitions
    state.transition_phase(PHASE_MIGRATING, completed_op="migrations")
    assert state.data["active_transaction"]["phase"] == PHASE_MIGRATING
    assert "migrations" in state.data["active_transaction"]["completed_operations"]

    state.transition_phase(PHASE_APPLYING, completed_op="compose_up")
    assert state.data["active_transaction"]["phase"] == PHASE_APPLYING

    # Record success
    state.record_deployment_success(sample_manifest)
    assert state.data["status"] == "active"
    assert state.data["active_transaction"] is None
    assert state.data["current_release"]["release_id"] == sample_manifest.release_id


def test_operator_authorization_enforcement(temp_dir: Path, sample_manifest):
    deployer = Deployer(
        compose_files=[],
        state_dir=temp_dir,
        dry_run=True,
    )

    # Missing authorization rejected
    with pytest.raises(AuthorizationValidationError, match="Deployment authorization missing"):
        deployer.authorize_deployment(manifest=sample_manifest, operator="")

    # Mismatched confirmation rejected
    with pytest.raises(AuthorizationValidationError, match="confirm_release_id .* does not match"):
        deployer.authorize_deployment(
            manifest=sample_manifest,
            operator="admin",
            confirm_release_id="wrong-id",
        )

    # Correct operator confirmation succeeds and writes host record
    auth = deployer.authorize_deployment(
        manifest=sample_manifest,
        operator="admin",
        confirm_release_id=sample_manifest.release_id,
    )
    assert auth.operator == "admin"
    assert auth.release_id == sample_manifest.release_id
    assert (temp_dir / f"{sample_manifest.release_id}.auth.json").exists()


def test_authorization_file_rejected_if_world_writable(temp_dir: Path, sample_manifest):
    auth = create_deployment_authorization("admin", sample_manifest)
    auth_file = temp_dir / "insecure.auth.json"
    auth.save(auth_file)

    # Make world-writable
    auth_file.chmod(0o666)

    deployer = Deployer(compose_files=[], state_dir=temp_dir, dry_run=True)
    with pytest.raises(AuthorizationValidationError, match="Insecure permissions"):
        deployer.authorize_deployment(manifest=sample_manifest, operator="admin", auth_file=auth_file)


def test_interrupted_deployment_detection_and_safe_recovery(temp_dir: Path, sample_manifest):
    deployer = Deployer(compose_files=[], state_dir=temp_dir, dry_run=True)

    # Simulate crash during PREPARED phase
    deployer.state.start_transaction(
        tx_id="tx-crash-prepared",
        operator="admin",
        target_manifest=sample_manifest,
        previous_manifest=None,
    )

    # Trying to deploy while interrupted transaction exists is rejected
    auth = create_deployment_authorization("admin", sample_manifest)
    with pytest.raises(InterruptedDeploymentError, match="Unfinished deployment transaction"):
        deployer.apply_release(sample_manifest, auth)

    # Running recover cleanly aborts unstarted transaction
    deployer.recover()
    assert deployer.state.data["active_transaction"] is None
    assert deployer.state.data["status"] == "idle"


def test_micro_profile_production_rejection(temp_dir: Path):
    """The micro profile is strictly forbidden for production environments."""
    with pytest.raises(DeploymentExecutionError, match="CRITICAL POLICY VIOLATION"):
        Deployer(compose_files=[], state_dir=temp_dir, profile="micro", environment="production")


def test_micro_profile_staging_permitted(temp_dir: Path):
    """The micro profile is permitted for staging/dev bootstrap verification."""
    deployer = Deployer(compose_files=[], state_dir=temp_dir, profile="micro", environment="staging")
    assert deployer.profile == "micro"
    assert deployer.environment == "staging"


def test_invalid_profile_rejected(temp_dir: Path):
    """Unrecognized deployment profile names are rejected."""
    with pytest.raises(ValueError, match="Invalid deployment profile"):
        Deployer(compose_files=[], state_dir=temp_dir, profile="unsupported", environment="staging")
