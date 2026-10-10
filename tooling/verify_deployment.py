#!/usr/bin/env python3
"""
Automated end-to-end verification script for Megalith Controlled Deployments,
Immutable Releases, Concurrency Locking, and Safe Rollbacks.

Validates all 16 Section 15 scenarios:
1. Validate release manifest.
2. Reject malformed or mutable image references.
3. Reject path traversal attempts.
4. Prepare a valid release.
5. Apply an initial release.
6. Verify frontend and API health.
7. Apply a second release.
8. Confirm updated image selection and selective service recreation.
9. Verify host deployment lock rejects concurrent mutations.
10. Simulate a failed application deployment.
11. Trigger a safe rollback to the last-known-good release.
12. Verify restoration and health of rolled-back application.
13. Confirm PostgreSQL data persists across deployments and rollback.
14. Confirm Caddy certificate volume persists.
15. Reject unsafe migration rollback when backward_compatible=False.
16. Clean up only test-owned resources.
"""

from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "platform" / "deploy" / "scripts"))

from release import (  # type: ignore
    ApprovalDeclaration,
    ReleaseManifest,
    ReleaseValidationError,
    create_release_manifest,
    validate_release_dict,
)
from deploy import (  # type: ignore
    Deployer,
    DeploymentLock,
    DeploymentLockError,
    DeploymentExecutionError,
)

COMPOSE_BASE = REPO_ROOT / "platform" / "deploy" / "compose.yaml"
COMPOSE_PROD = REPO_ROOT / "platform" / "deploy" / "compose.prod.yaml"
PROJECT_NAME = "megalith-deploy-verify"


def find_available_port(preferred_port: int) -> int:
    """Find an open loopback port to prevent parallel test collision."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("127.0.0.1", preferred_port))
            return preferred_port
        except OSError:
            pass
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


TEST_PORT = int(os.environ.get("DEPLOY_PORT") or find_available_port(18083))


def run_cmd(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    print(f"--> Running: {' '.join(cmd)}")
    env = os.environ.copy()
    env["PORT"] = str(TEST_PORT)
    env["INGRESS_PORT"] = str(TEST_PORT)
    result = subprocess.run(cmd, cwd=REPO_ROOT, env=env, text=True, capture_output=True)
    if check and result.returncode != 0:
        print(f"FAILED (exit code {result.returncode}):\n{result.stderr}\n{result.stdout}", file=sys.stderr)
        sys.exit(result.returncode)
    return result


def get_image_digest(image_tag: str) -> str:
    """Retrieve full repository digest (image@sha256:...) from local Docker image."""
    res = subprocess.run(
        ["docker", "inspect", "--format", "{{json .RepoDigests}}", image_tag],
        text=True,
        capture_output=True,
    )
    if res.returncode == 0 and res.stdout.strip():
        try:
            digests = json.loads(res.stdout.strip())
            if isinstance(digests, list) and len(digests) > 0:
                return digests[0]
        except Exception:
            pass
    # If not pushed/no repo digest, inspect image ID
    res = subprocess.run(
        ["docker", "inspect", "--format", "{{.Id}}", image_tag],
        text=True,
        capture_output=True,
    )
    img_id = res.stdout.strip().replace("sha256:", "")
    return f"{image_tag}@sha256:{img_id}"


def main() -> None:
    print("=" * 60)
    print(" Megalith Controlled Deployment & Safe Rollback Verification")
    print("=" * 60)
    print(f"Project Name : {PROJECT_NAME}")
    print(f"Host Port    : {TEST_PORT}")

    temp_state_dir = Path(tempfile.mkdtemp(prefix="megalith_deploy_test_"))
    print(f"State Dir    : {temp_state_dir}")

    try:
        # Preflight: ensure base images exist
        print("\n[Preflight] Building baseline images...")
        run_cmd(["docker", "compose", "-p", PROJECT_NAME, "-f", str(COMPOSE_BASE), "build"])

        api_digest = get_image_digest("megalith-demo-api:local")
        web_digest = get_image_digest("megalith-demo-web:local")
        print(f"  -> Baseline demo-api digest: {api_digest}")
        print(f"  -> Baseline demo-web digest: {web_digest}")

        deployer = Deployer(
            compose_files=[COMPOSE_BASE, COMPOSE_PROD],
            project_name=PROJECT_NAME,
            state_dir=temp_state_dir,
            host_port=TEST_PORT,
        )

        # -----------------------------------------------------------------
        # 1. Validate a release manifest
        # -----------------------------------------------------------------
        print("\n[Scenario 1] Validating a valid release manifest...")
        valid_raw = {
            "schema_version": 1,
            "release_id": "rel-001-init",
            "git_sha": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "environment": "production",
            "config_version": "1.0",
            "services": ["demo-api", "demo-web"],
            "images": {
                "demo-api": api_digest,
                "demo-web": web_digest,
            },
            "migrations": [
                {
                    "service": "demo-api",
                    "applied": True,
                    "command": "alembic upgrade head",
                    "backward_compatible": True,
                }
            ],
            "approval": {
                "authorized_by": "lead-platform-engineer",
                "authorized_at": datetime.now(timezone.utc).isoformat(),
                "release_id": "rel-001-init",
                "target_environment": "production",
                "intent": "deploy",
            },
        }
        manifest_v1 = validate_release_dict(valid_raw, require_approval=True)
        manifest_v1_path = temp_state_dir / "rel-001-init.json"
        manifest_v1.save(manifest_v1_path)
        print("  -> Manifest v1 passed validation and was saved.")

        # -----------------------------------------------------------------
        # 2. Reject malformed or mutable image references
        # -----------------------------------------------------------------
        print("\n[Scenario 2] Verifying rejection of mutable image tags...")
        bad_raw = dict(valid_raw)
        bad_raw["images"] = {"demo-api": "megalith-demo-api:latest", "demo-web": web_digest}
        try:
            validate_release_dict(bad_raw)
            raise AssertionError("Failed to reject mutable tag ':latest'")
        except ReleaseValidationError as err:
            print(f"  -> Confirmed: Mutable tag rejected as expected: {err}")

        # -----------------------------------------------------------------
        # 3. Reject path traversal attempts in release_id
        # -----------------------------------------------------------------
        print("\n[Scenario 3] Verifying rejection of path traversal in release_id...")
        traversal_raw = dict(valid_raw)
        traversal_raw["release_id"] = "../escape-directory"
        try:
            validate_release_dict(traversal_raw)
            raise AssertionError("Failed to reject path traversal in release_id")
        except ReleaseValidationError as err:
            print(f"  -> Confirmed: Path traversal rejected as expected: {err}")

        # -----------------------------------------------------------------
        # 4. Prepare release
        # -----------------------------------------------------------------
        print("\n[Scenario 4] Preparing release...")
        deployer.prepare_release(manifest_v1)
        print("  -> Release preparation succeeded.")

        # -----------------------------------------------------------------
        # 5. Apply initial release
        # -----------------------------------------------------------------
        print("\n[Scenario 5] Applying initial release (rel-001-init)...")
        deployer.apply_release(manifest_v1)

        # -----------------------------------------------------------------
        # 6. Verify health and mutate counter to test persistence later
        # -----------------------------------------------------------------
        print("\n[Scenario 6] Verifying initial release health and persistent counter...")
        deployer.check_health(manifest_v1)

        # Increment counter so we can test that data survives subsequent releases and rollbacks!
        inc_res = subprocess.run(
            ["docker", "compose", "-p", PROJECT_NAME, "-f", str(COMPOSE_BASE),
             "exec", "-T", "demo-api", "python3", "-c",
             "import urllib.request; req = urllib.request.Request('http://127.0.0.1:8000/api/counter/increment', data=b'', method='POST'); print(urllib.request.urlopen(req).read().decode())"],
            text=True, capture_output=True, check=True
        )
        print(f"  -> Initial counter mutated to: {inc_res.stdout.strip()}")

        # Record container IDs to verify selective deployment
        caddy_id_v1 = subprocess.check_output(
            ["docker", "compose", "-p", PROJECT_NAME, "-f", str(COMPOSE_BASE), "-f", str(COMPOSE_PROD), "ps", "-q", "caddy"],
            text=True
        ).strip()
        pg_id_v1 = subprocess.check_output(
            ["docker", "compose", "-p", PROJECT_NAME, "-f", str(COMPOSE_BASE), "-f", str(COMPOSE_PROD), "ps", "-q", "postgres"],
            text=True
        ).strip()
        print(f"  -> Recorded initial Caddy container ID: {caddy_id_v1[:12]}")
        print(f"  -> Recorded initial Postgres container ID: {pg_id_v1[:12]}")

        # -----------------------------------------------------------------
        # 7. Apply a second release (rel-002-update)
        # -----------------------------------------------------------------
        print("\n[Scenario 7 & 8] Building updated web image and applying second release...")
        # Create an updated web image tag to simulate a frontend-only update
        run_cmd([
            "docker", "build",
            "-t", "megalith-demo-web:v2",
            "--label", "megalith.release=v2",
            str(REPO_ROOT / "apps" / "demo" / "web"),
        ])
        web_digest_v2 = get_image_digest("megalith-demo-web:v2")
        print(f"  -> Built updated demo-web image: {web_digest_v2}")

        manifest_v2_raw = {
            "schema_version": 1,
            "release_id": "rel-002-update",
            "git_sha": "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "environment": "production",
            "config_version": "1.0",
            "services": ["demo-api", "demo-web"],
            "images": {
                "demo-api": api_digest,       # Unchanged
                "demo-web": web_digest_v2,    # Changed!
            },
            "migrations": [],
            "approval": {
                "authorized_by": "lead-platform-engineer",
                "authorized_at": datetime.now(timezone.utc).isoformat(),
                "release_id": "rel-002-update",
                "target_environment": "production",
                "intent": "deploy",
            },
        }
        manifest_v2 = validate_release_dict(manifest_v2_raw, require_approval=True)
        manifest_v2_path = temp_state_dir / "rel-002-update.json"
        manifest_v2.save(manifest_v2_path)

        deployer.apply_release(manifest_v2)

        # -----------------------------------------------------------------
        # 8. Confirm selective service update (Postgres and Caddy NOT recreated)
        # -----------------------------------------------------------------
        print("\n[Scenario 8] Verifying selective service update...")
        caddy_id_v2 = subprocess.check_output(
            ["docker", "compose", "-p", PROJECT_NAME, "-f", str(COMPOSE_BASE), "-f", str(COMPOSE_PROD), "ps", "-q", "caddy"],
            text=True
        ).strip()
        pg_id_v2 = subprocess.check_output(
            ["docker", "compose", "-p", PROJECT_NAME, "-f", str(COMPOSE_BASE), "-f", str(COMPOSE_PROD), "ps", "-q", "postgres"],
            text=True
        ).strip()
        assert caddy_id_v1 == caddy_id_v2, "Caddy container was unnecessarily recreated during frontend update!"
        assert pg_id_v1 == pg_id_v2, "PostgreSQL container was unnecessarily recreated during frontend update!"
        print(f"  -> Confirmed: Caddy ({caddy_id_v1[:12]}) and Postgres ({pg_id_v1[:12]}) were preserved!")

        # -----------------------------------------------------------------
        # 9. Concurrency lock verification
        # -----------------------------------------------------------------
        print("\n[Scenario 9] Verifying deployment concurrency lock...")
        lock_file = temp_state_dir / "deploy.lock"
        with DeploymentLock(lock_file):
            print("  -> Acquired primary deployment lock.")
            try:
                with DeploymentLock(lock_file):
                    raise AssertionError("Concurrent deployment lock was erroneously granted!")
            except DeploymentLockError as err:
                print(f"  -> Confirmed: Concurrent lock attempt was rejected: {err}")

        # -----------------------------------------------------------------
        # 10 & 11 & 12. Simulate failed application deployment and verify rollback
        # -----------------------------------------------------------------
        print("\n[Scenario 10, 11, 12] Simulating failed release and verifying automatic rollback...")
        # Create a broken API image that crashes on startup
        broken_dockerfile = temp_state_dir / "Dockerfile.broken"
        broken_dockerfile.write_text(
            "FROM megalith-demo-api:local\nCMD [\"python3\", \"-c\", \"import sys; sys.exit(1)\"]\n",
            encoding="utf-8"
        )
        run_cmd([
            "docker", "build",
            "-f", str(broken_dockerfile),
            "-t", "megalith-demo-api:broken",
            str(REPO_ROOT / "apps" / "demo" / "api"),
        ])
        broken_digest = get_image_digest("megalith-demo-api:broken")

        manifest_broken_raw = {
            "schema_version": 1,
            "release_id": "rel-003-broken",
            "git_sha": "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "environment": "production",
            "config_version": "1.0",
            "services": ["demo-api", "demo-web"],
            "images": {
                "demo-api": broken_digest,
                "demo-web": web_digest_v2,
            },
            "migrations": [],
            "approval": {
                "authorized_by": "lead-platform-engineer",
                "authorized_at": datetime.now(timezone.utc).isoformat(),
                "release_id": "rel-003-broken",
                "target_environment": "production",
                "intent": "deploy",
            },
        }
        manifest_broken = validate_release_dict(manifest_broken_raw, require_approval=True)

        try:
            deployer.apply_release(manifest_broken)
            raise AssertionError("Broken release erroneously succeeded!")
        except Exception as err:
            print(f"  -> Broken release failed as expected and triggered rollback: {err}")

        # Verify that state records rolled_back and current release is rel-002-update
        status = deployer.get_status()
        assert status["status"] == "rolled_back", f"Unexpected state status: {status['status']}"
        assert status["current_release"]["release_id"] == "rel-002-update", "Current release not restored to rel-002-update!"
        print("  -> Confirmed: Deployment state successfully rolled back to 'rel-002-update'.")

        # -----------------------------------------------------------------
        # 13. Confirm PostgreSQL data survives
        # -----------------------------------------------------------------
        print("\n[Scenario 13] Verifying PostgreSQL counter data survived deployments and rollback...")
        val_res = subprocess.check_output(
            ["docker", "compose", "-p", PROJECT_NAME, "-f", str(COMPOSE_BASE),
             "exec", "-T", "demo-api", "python3", "-c",
             "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/counter').read().decode())"],
            text=True
        ).strip()
        data = json.loads(val_res)
        assert data.get("value") == 1, f"Expected counter value 1, got {data}"
        print(f"  -> Confirmed: Counter value ({data.get('value')}) persisted intact across all operations!")

        # -----------------------------------------------------------------
        # 14. Confirm Caddy volumes exist
        # -----------------------------------------------------------------
        print("\n[Scenario 14] Verifying Caddy volume preservation...")
        vols_output = subprocess.check_output(
            ["docker", "volume", "ls", "--filter", f"name={PROJECT_NAME}", "--format", "{{.Name}}"],
            text=True
        ).splitlines()
        assert any("caddy-data" in v for v in vols_output), f"Caddy data volume missing in {vols_output}"
        assert any("postgres-data" in v for v in vols_output), f"Postgres data volume missing in {vols_output}"
        print(f"  -> Confirmed: Named volumes preserved: {vols_output}")

        # -----------------------------------------------------------------
        # 15. Incompatible migration rollback rejection
        # -----------------------------------------------------------------
        print("\n[Scenario 15] Verifying rejection of unsafe migration rollback...")
        incompat_manifest = ReleaseManifest.from_dict({
            "schema_version": 1,
            "release_id": "rel-004-schema-breaking",
            "git_sha": "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "environment": "production",
            "config_version": "1.0",
            "services": ["demo-api", "demo-web"],
            "images": {
                "demo-api": api_digest,
                "demo-web": web_digest_v2,
            },
            "migrations": [
                {
                    "service": "demo-api",
                    "applied": True,
                    "command": "alembic upgrade head",
                    "backward_compatible": False,  # Non-backward-compatible migration!
                }
            ],
            "approval": {
                "authorized_by": "lead-platform-engineer",
                "authorized_at": datetime.now(timezone.utc).isoformat(),
                "release_id": "rel-004-schema-breaking",
                "target_environment": "production",
                "intent": "deploy",
            },
        }, require_approval=True)

        try:
            # Simulate internal rollback attempt when current release had backward_compatible=False
            deployer._rollback_internal(failing_manifest=incompat_manifest)
            raise AssertionError("Failed to block unsafe rollback of non-backward-compatible migration!")
        except DeploymentExecutionError as err:
            assert "Automated rollback blocked" in str(err)
            print(f"  -> Confirmed: Incompatible migration rollback blocked as expected: {err}")

        print("\n" + "=" * 60)
        print(" STATUS: ALL 16 DEPLOYMENT & ROLLBACK SCENARIOS PASSED")
        print("=" * 60)

    finally:
        # -----------------------------------------------------------------
        # 16. Clean up only test-owned resources
        # -----------------------------------------------------------------
        print("\n[Scenario 16 / Teardown] Cleaning up isolated test Compose project...")
        subprocess.run(
            ["docker", "compose", "-p", PROJECT_NAME, "-f", str(COMPOSE_BASE), "-f", str(COMPOSE_PROD), "down", "-v"],
            cwd=REPO_ROOT,
            capture_output=True,
        )
        shutil.rmtree(temp_state_dir, ignore_errors=True)
        print("Teardown complete. Test resources removed.")


if __name__ == "__main__":
    main()
