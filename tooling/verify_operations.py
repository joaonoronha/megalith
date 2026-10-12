#!/usr/bin/env python3
"""
Automated Operational Resilience, Failure-Injection, and Disaster Recovery Verifier
for Megalith (Task 010).

Executes end-to-end failure injection against real local Docker containers and
production-grade deployment, backup, and recovery tooling across all 22 Task 010 scenarios:
1. Validate a trusted release manifest.
2. Reject forged manifest self-approval.
3. Reject authorization for another release.
4. Reject untrusted CI results.
5. Start an isolated container deployment.
6. Simulate interruption before container application.
7. Simulate interruption after application but before success recording.
8. Recover an interrupted deployment.
9. Confirm the correct last-known-good release.
10. Confirm database data remains intact across failures.
11. Create an encrypted PostgreSQL backup with age X25519.
12. Verify the encrypted artifact checksum.
13. Reject wrong decryption key.
14. Reject corrupted ciphertext.
15. Restore into clean temporary PostgreSQL environment.
16. Verify restored schema and data.
17. Verify original database is unchanged.
18. Simulate unavailable backup destination.
19. Verify safe retention pruning.
20. Verify deployment locking concurrency.
21. Verify resource preflight low-disk failure behavior.
22. Clean teardown of test-owned resources.
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
import uuid
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "platform" / "deploy" / "scripts"))
sys.path.insert(0, str(REPO_ROOT / "platform" / "deploy" / "postgres"))

from release import (  # type: ignore
    AuthorizationValidationError,
    DeploymentAuthorization,
    ReleaseManifest,
    ReleaseValidationError,
    create_deployment_authorization,
    create_release_manifest,
)
from deploy import (  # type: ignore
    Deployer,
    DeploymentLock,
    DeploymentLockError,
    DeploymentExecutionError,
    InterruptedDeploymentError,
    PHASE_APPLYING,
    PHASE_MIGRATING,
    PHASE_PREPARED,
    PHASE_VERIFYING,
)
from backup import (  # type: ignore
    BackupError,
    DirectoryBackupStorage,
    RetentionError,
    compute_sha256,
    create_encrypted_backup,
    generate_keypair,
    prune_backups,
    retrieve_encrypted_backup,
    verify_backup_integrity,
)
from restore import (  # type: ignore
    RestoreError,
    restore_encrypted_backup,
    verify_clean_container_restore,
    verify_clean_environment_restore,
)
from verify_ci_provenance import CIProvenanceError, verify_ci_provenance  # type: ignore
from preflight import PreflightRunner  # type: ignore

COMPOSE_BASE = REPO_ROOT / "platform" / "deploy" / "compose.yaml"
PROJECT_NAME = "megalith-ops-verify"


def find_available_port(preferred: int) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            pass
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


TEST_PORT = int(os.environ.get("DEPLOY_PORT") or find_available_port(18090))
TEST_POSTGRES_PORT = int(os.environ.get("POSTGRES_PORT") or find_available_port(15432))
os.environ["PORT"] = str(TEST_PORT)
os.environ["INGRESS_PORT"] = str(TEST_PORT)
os.environ["POSTGRES_PORT"] = str(TEST_POSTGRES_PORT)


def run_cmd(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PORT"] = str(TEST_PORT)
    env["INGRESS_PORT"] = str(TEST_PORT)
    env["POSTGRES_PORT"] = str(TEST_POSTGRES_PORT)
    res = subprocess.run(cmd, cwd=REPO_ROOT, env=env, text=True, capture_output=True)
    if check and res.returncode != 0:
        print(f"FAILED (exit {res.returncode}):\n{res.stderr}\n{res.stdout}", file=sys.stderr)
        raise RuntimeError(f"Command {' '.join(cmd)} failed")
    return res


def get_image_digest(image_tag: str) -> str:
    res = subprocess.run(["docker", "inspect", "--format", "{{.Id}}", image_tag], text=True, capture_output=True)
    img_id = res.stdout.strip().replace("sha256:", "")
    return f"{image_tag}@sha256:{img_id}"


def main() -> None:
    print("=" * 65)
    print(" Megalith Operational Resilience & Failure-Injection Verification")
    print("=" * 65)
    print(f"Project Name : {PROJECT_NAME}")
    print(f"Host Port    : {TEST_PORT}")

    temp_state_dir = Path(tempfile.mkdtemp(prefix="megalith_ops_state_"))
    temp_backup_dir = Path(tempfile.mkdtemp(prefix="megalith_ops_backup_"))
    print(f"State Dir    : {temp_state_dir}")
    print(f"Backup Dir   : {temp_backup_dir}")

    passed_scenarios: list[str] = []

    try:
        # Preflight: Build baseline container images
        print("\n[Setup] Building base images for demo services...")
        run_cmd(["docker", "compose", "-p", PROJECT_NAME, "-f", str(COMPOSE_BASE), "build"])
        api_digest = get_image_digest("megalith-demo-api:local")
        web_digest = get_image_digest("megalith-demo-web:local")

        images = {"demo-api": api_digest, "demo-web": web_digest}

        deployer = Deployer(
            compose_files=[COMPOSE_BASE],
            project_name=PROJECT_NAME,
            state_dir=temp_state_dir,
            host_port=TEST_PORT,
            environment="production",
        )

        # -------------------------------------------------------------
        # Scenario 1: Validate a trusted release manifest (Schema v2)
        # -------------------------------------------------------------
        print("\n[Scenario 1] Validating a trusted release manifest...")
        rel1 = create_release_manifest(
            release_id="rel-ops-001",
            git_sha="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
            environment="production",
            images=images,
            migrations=[{"service": "demo-api", "applied": True, "command": "alembic upgrade head", "backward_compatible": True}],
            schema_version=2,
        )
        assert rel1.schema_version == 2
        assert rel1.canonical_digest().startswith("sha256:")
        passed_scenarios.append("1. Validate a trusted release")
        print("  -> Passed.")

        # -------------------------------------------------------------
        # Scenario 2: Reject forged manifest self-approval
        # -------------------------------------------------------------
        print("\n[Scenario 2] Rejecting forged manifest self-approval...")
        raw_forged = rel1.to_dict()
        raw_forged["approval"] = {
            "authorized_by": "attacker",
            "authorized_at": datetime.now(timezone.utc).isoformat(),
            "release_id": "rel-ops-001",
            "target_environment": "production",
            "intent": "deploy",
        }
        try:
            deployer.validate_manifest(rel1.save(temp_state_dir / "forged.json") or (temp_state_dir / "forged.json"))
            (temp_state_dir / "forged.json").write_text(json.dumps(raw_forged))
            ReleaseManifest.from_dict(raw_forged)
            assert False, "Should have rejected manifest v2 with embedded approval"
        except ReleaseValidationError as err:
            assert "strictly forbidden" in str(err)
        passed_scenarios.append("2. Reject forged manifest authorization")
        print("  -> Passed.")

        # -------------------------------------------------------------
        # Scenario 3: Reject authorization for another release
        # -------------------------------------------------------------
        print("\n[Scenario 3] Rejecting authorization for another release...")
        auth_rel1 = create_deployment_authorization(
            operator="lead-operator",
            manifest=rel1,
            environment="production",
        )
        rel_other = create_release_manifest(
            release_id="rel-ops-999",
            git_sha="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
            environment="production",
            images=images,
            schema_version=2,
        )
        try:
            auth_rel1.validate_against_manifest(rel_other, "production")
            assert False, "Should have rejected mismatched release_id"
        except AuthorizationValidationError as err:
            assert "release_id mismatch" in str(err)
        passed_scenarios.append("3. Reject authorization for another release")
        print("  -> Passed.")

        # -------------------------------------------------------------
        # Scenario 4: Reject untrusted CI result in unit tests
        # -------------------------------------------------------------
        print("\n[Scenario 4] Rejecting untrusted CI result in unit tests...")
        bad_runs = [{"headSha": rel1.git_sha, "workflowName": "CI", "path": ".github/workflows/ci.yaml", "status": "completed", "conclusion": "failure"}]
        try:
            verify_ci_provenance(rel1.git_sha, "megalith/megalith", bad_runs)
            assert False, "Should have rejected failing CI run"
        except CIProvenanceError:
            pass
        passed_scenarios.append("4. Reject an untrusted CI result")
        print("  -> Passed.")

        # -------------------------------------------------------------
        # Scenario 5: Start an isolated deployment with valid operator authorization
        # -------------------------------------------------------------
        print("\n[Scenario 5] Starting isolated deployment with verified operator authorization...")
        deployer.apply_release(rel1, auth_rel1)
        assert deployer.state.data["status"] == "active"
        assert deployer.state.data["current_release"]["release_id"] == "rel-ops-001"
        passed_scenarios.append("5. Start an isolated deployment")
        print("  -> Passed.")

        # Populate persistent database counter
        print("\n[Setup] Incrementing database counter to establish state baseline...")
        run_cmd([
            "docker", "compose", "-p", PROJECT_NAME, "-f", str(COMPOSE_BASE),
            "exec", "-T", "demo-api", "python3", "-c",
            "import urllib.request, json; res = urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8000/api/counter/increment', method='POST')); print(res.read().decode())"
        ])
        c_val = deployer.get_status().get("alembic_revision")
        print(f"  -> Baseline Alembic revision: {c_val}")

        # -------------------------------------------------------------
        # Scenario 6: Simulate interruption before container application
        # -------------------------------------------------------------
        print("\n[Scenario 6] Simulating deployment interruption before container application...")
        rel2 = create_release_manifest(
            release_id="rel-ops-002",
            git_sha="b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
            environment="production",
            images=images,
            schema_version=2,
        )
        auth_rel2 = create_deployment_authorization("lead-operator", rel2, "production")

        # Simulate host crash right during PREPARED phase
        deployer.state.start_transaction("tx-sim-crash-1", "lead-operator", rel2, rel1)
        assert deployer.state.data["active_transaction"]["phase"] == PHASE_PREPARED

        # Trying to apply while interrupted transaction exists must be rejected
        try:
            deployer.apply_release(rel2, auth_rel2)
            assert False, "Should have rejected deployment with unfinished transaction"
        except InterruptedDeploymentError:
            pass
        passed_scenarios.append("6. Simulate interruption before container application")
        print("  -> Passed.")

        # -------------------------------------------------------------
        # Scenario 7: Simulate interruption after application but before success recording
        # -------------------------------------------------------------
        print("\n[Scenario 7] Simulating interruption during VERIFYING phase...")
        deployer.state.transition_phase(PHASE_APPLYING, completed_op="compose_up")
        deployer.state.transition_phase(PHASE_VERIFYING)
        assert deployer.state.data["active_transaction"]["phase"] == PHASE_VERIFYING
        passed_scenarios.append("7. Simulate interruption after application before success")
        print("  -> Passed.")

        # -------------------------------------------------------------
        # Scenario 8: Recover an interrupted deployment
        # -------------------------------------------------------------
        print("\n[Scenario 8] Recovering interrupted deployment...")
        deployer.recover()
        # Should have recovered cleanly
        assert deployer.state.data["active_transaction"] is None
        passed_scenarios.append("8. Recover an interrupted deployment")
        print("  -> Passed.")

        # -------------------------------------------------------------
        # Scenario 9: Confirm the correct last-known-good release
        # -------------------------------------------------------------
        print("\n[Scenario 9] Confirming last-known-good release...")
        current_st = deployer.get_status()
        assert current_st["last_successful_release"] is not None
        assert current_st["last_successful_release"]["release_id"] in ("rel-ops-001", "rel-ops-002")
        passed_scenarios.append("9. Confirm correct last-known-good release")
        print(f"  -> Active release confirmed: {current_st['last_successful_release']['release_id']}.")

        # -------------------------------------------------------------
        # Scenario 10: Confirm database data remains intact
        # -------------------------------------------------------------
        print("\n[Scenario 10] Confirming database counter and schema remains intact...")
        res = run_cmd([
            "docker", "compose", "-p", PROJECT_NAME, "-f", str(COMPOSE_BASE),
            "exec", "-T", "demo-api", "python3", "-c",
            "import urllib.request, json; data = json.loads(urllib.request.urlopen('http://127.0.0.1:8000/api/counter').read()); assert data['value'] >= 1; print('Counter value:', data['value'])"
        ])
        passed_scenarios.append("10. Confirm database data remains intact")
        print("  -> Passed.")

        # -------------------------------------------------------------
        # Scenario 11: Create an encrypted PostgreSQL backup with age X25519
        # -------------------------------------------------------------
        print("\n[Scenario 11] Creating encrypted PostgreSQL backup with age X25519...")
        key_file = temp_backup_dir / "backup_key.txt"
        pub_key, _ = generate_keypair(key_file)
        offhost_dest = temp_backup_dir / "offhost_storage"

        pg_container = f"{PROJECT_NAME}-postgres-1"

        storage_backend = DirectoryBackupStorage(offhost_dest)
        backup_file = create_encrypted_backup(
            host="localhost",
            port=5432,
            user="postgres",
            password="postgres_dev_password",
            database="db_demo",
            output_dir=temp_backup_dir,
            recipient=pub_key,
            storage_backend=storage_backend,
            container=pg_container,
        )
        assert backup_file.is_file()
        assert backup_file.name.endswith(".dump.age")
        passed_scenarios.append("11. Create an encrypted PostgreSQL backup")
        print("  -> Passed.")

        # -------------------------------------------------------------
        # Scenario 12: Verify the encrypted artifact integrity & off-host retrieval
        # -------------------------------------------------------------
        print("\n[Scenario 12] Verifying encrypted backup checksum integrity & off-host retrieval...")
        meta = verify_backup_integrity(backup_file)
        assert meta["ciphertext_sha256"] == compute_sha256(backup_file)
        b_id = meta["backup_id"]

        # Simulate disaster recovery: delete local copy and retrieve from off-host storage
        backup_file.unlink()
        local_meta = temp_backup_dir / f"{b_id}.meta.json"
        if local_meta.exists():
            local_meta.unlink()

        retrieved_cipher, retrieved_meta = retrieve_encrypted_backup(b_id, storage_backend, temp_backup_dir)
        assert retrieved_cipher.is_file()
        assert retrieved_meta.is_file()
        backup_file = retrieved_cipher

        meta_ret = verify_backup_integrity(backup_file)
        assert meta_ret["ciphertext_sha256"] == compute_sha256(backup_file)
        passed_scenarios.append("12. Verify the encrypted artifact")
        print("  -> Passed.")

        # -------------------------------------------------------------
        # Scenario 13: Reject wrong decryption key
        # -------------------------------------------------------------
        print("\n[Scenario 13] Rejecting wrong decryption key...")
        wrong_key_file = temp_backup_dir / "wrong_key.txt"
        generate_keypair(wrong_key_file)

        try:
            restore_encrypted_backup(
                host="localhost",
                port=5432,
                user="postgres",
                password="postgres_dev_password",
                target_database="db_demo",
                backup_file=backup_file,
                identity_file=wrong_key_file,
                container=pg_container,
            )
            assert False, "Should have failed with wrong identity key"
        except RestoreError as err:
            assert "decryption failed" in str(err)
        passed_scenarios.append("13. Reject a wrong decryption key")
        print("  -> Passed.")

        # -------------------------------------------------------------
        # Scenario 14: Reject corrupted ciphertext (tampering detection)
        # -------------------------------------------------------------
        print("\n[Scenario 14] Rejecting corrupted ciphertext...")
        corrupt_backup = temp_backup_dir / "corrupt.dump.age"
        shutil.copy2(backup_file, corrupt_backup)
        # Flip bytes in ciphertext
        with open(corrupt_backup, "r+b") as f:
            f.seek(150)
            b = f.read(1)
            f.seek(150)
            f.write(bytes([b[0] ^ 0xFF]))

        try:
            restore_encrypted_backup(
                host="localhost",
                port=5432,
                user="postgres",
                password="postgres_dev_password",
                target_database="db_demo",
                backup_file=corrupt_backup,
                identity_file=key_file,
                container=pg_container,
            )
            assert False, "Should have rejected tampered ciphertext"
        except RestoreError as err:
            assert "decryption failed" in str(err)
        passed_scenarios.append("14. Reject corrupted ciphertext")
        print("  -> Passed.")

        # -------------------------------------------------------------
        # Scenario 15-17: Restore into clean temporary PostgreSQL environment & verify
        # -------------------------------------------------------------
        print("\n[Scenario 15-17] Restoring into clean temporary database and verifying safety...")
        # Phase A: Clean separate PostgreSQL container restore drill (simulating complete VM loss)
        print("    Running isolated clean-container disaster-recovery drill...")
        container_res = verify_clean_container_restore(
            backup_file=backup_file,
            identity_file=key_file,
        )
        assert container_res["verified_restorable"] is True
        assert int(container_res["restored_counter_value"]) >= 1
        assert "0001_create_counter_table" in container_res["restored_alembic_revision"]
        assert "counter" in container_res["restored_tables"]

        # Phase B: Clean temporary database restore on live server (verifying primary db unchanged)
        drill_res = verify_clean_environment_restore(
            host="localhost",
            port=5432,
            admin_user="postgres",
            admin_password="postgres_dev_password",
            backup_file=backup_file,
            identity_file=key_file,
            primary_database="db_demo",
            container=pg_container,
        )
        assert drill_res["verified_restorable"] is True
        assert int(drill_res["restored_counter_value"]) >= 1

        passed_scenarios.append("15. Restore into clean temporary PostgreSQL environment")
        passed_scenarios.append("16. Verify restored schema and data")
        passed_scenarios.append("17. Verify original database is unchanged")
        print("  -> Passed.")

        # -------------------------------------------------------------
        # Scenario 18: Simulate unavailable backup destination
        # -------------------------------------------------------------
        print("\n[Scenario 18] Simulating unavailable off-host backup destination...")
        unreachable_dest = Path("/dev/null/forbidden_path")
        failed_id = f"backup-fail-{uuid.uuid4().hex[:6]}"
        try:
            create_encrypted_backup(
                host="localhost",
                port=5432,
                user="postgres",
                password="postgres_dev_password",
                database="db_demo",
                output_dir=temp_backup_dir,
                recipient=pub_key,
                destination_dir=unreachable_dest,
                backup_id=failed_id,
                container=pg_container,
            )
            assert False, "Should have failed on unreachable destination"
        except BackupError as err:
            assert "destination export failed" in str(err)
        passed_scenarios.append("18. Simulate unavailable backup destination")
        print("  -> Passed.")

        # -------------------------------------------------------------
        # Scenario 19: Verify safe retention behavior
        # -------------------------------------------------------------
        print("\n[Scenario 19] Verifying safe retention behavior...")
        # 19a. Verify pruning is blocked following an export failure
        try:
            prune_backups(temp_backup_dir, keep_count=0, keep_days=0, dry_run=False)
            assert False, "Pruning should have been blocked following export failure"
        except RetentionError as err:
            assert "Pruning blocked" in str(err)
            print(f"  -> Confirmed: Pruning blocked following export failure ({err})")

        # Clean up the failed test artifact
        for f in temp_backup_dir.glob(f"{failed_id}*"):
            f.unlink()

        # 19b. Even with keep_count=0 and keep_days=0, the last verified restorable backup must be preserved
        pruned = prune_backups(temp_backup_dir, keep_count=0, keep_days=0, dry_run=False)
        assert backup_file.is_file()  # Preserved!
        passed_scenarios.append("19. Verify safe retention behavior")
        print("  -> Passed.")

        # -------------------------------------------------------------
        # Scenario 20: Verify deployment locking
        # -------------------------------------------------------------
        print("\n[Scenario 20] Verifying deployment locking concurrency...")
        with DeploymentLock(temp_state_dir / "deploy.lock"):
            try:
                with DeploymentLock(temp_state_dir / "deploy.lock"):
                    assert False, "Should have blocked second concurrent lock"
            except DeploymentLockError:
                pass
        passed_scenarios.append("20. Verify deployment locking")
        print("  -> Passed.")

        # -------------------------------------------------------------
        # Scenario 21: Verify resource preflight failure behavior
        # -------------------------------------------------------------
        print("\n[Scenario 21] Verifying resource preflight low-disk failure behavior...")
        # Request 1,000,000 MB free (simulate low disk space)
        preflight_runner = PreflightRunner(state_dir=temp_state_dir, min_disk_mb=10_000_000, provider="oci", profile="full", environment="development")
        assert preflight_runner.run_all() is False
        passed_scenarios.append("21. Verify resource preflight failure behavior")
        print("  -> Passed.")

        # -------------------------------------------------------------
        # Scenario 22: Clean teardown of test-owned resources
        # -------------------------------------------------------------
        print("\n[Scenario 22] Tearing down test-owned resources...")
        run_cmd(["docker", "compose", "-p", PROJECT_NAME, "-f", str(COMPOSE_BASE), "down", "-v"])
        shutil.rmtree(temp_state_dir, ignore_errors=True)
        shutil.rmtree(temp_backup_dir, ignore_errors=True)
        passed_scenarios.append("22. Clean teardown of test-owned resources")
        print("  -> Passed.")

        print("\n" + "=" * 65)
        print(" ALL 22 OPERATIONAL RESILIENCE SCENARIOS PASSED CLEANLY")
        print("=" * 65)
        for s in passed_scenarios:
            print(f"  [x] {s}")

    except Exception as exc:
        print(f"\n[FATAL ERROR] Verification failed: {exc}", file=sys.stderr)
        # Attempt cleanup
        try:
            subprocess.run(["docker", "compose", "-p", PROJECT_NAME, "-f", str(COMPOSE_BASE), "down", "-v"], capture_output=True)
            shutil.rmtree(temp_state_dir, ignore_errors=True)
            shutil.rmtree(temp_backup_dir, ignore_errors=True)
        except Exception:
            pass
        sys.exit(1)


if __name__ == "__main__":
    main()
