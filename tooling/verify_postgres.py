#!/usr/bin/env python3
"""
Automated end-to-end verification script for Megalith PostgreSQL persistence,
role isolation, durability across restarts, atomic concurrency, and backup/restore.

Used locally and in CI to guarantee compliance with Task 007 requirements and ADR-007.
"""

from __future__ import annotations

import concurrent.futures
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
COMPOSE_FILE = REPO_ROOT / "platform" / "deploy" / "compose.yaml"
BACKUP_SCRIPT = REPO_ROOT / "platform" / "deploy" / "postgres" / "backup.py"
RESTORE_SCRIPT = REPO_ROOT / "platform" / "deploy" / "postgres" / "restore.py"

PROJECT_NAME = "megalith-pg-verify"
COMPOSE_CMD = ["docker", "compose", "-p", PROJECT_NAME, "-f", str(COMPOSE_FILE)]


def run_cmd(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    print(f"--> Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=REPO_ROOT, text=True, capture_output=True)
    if check and result.returncode != 0:
        print(f"FAILED (exit code {result.returncode}):\n{result.stderr}\n{result.stdout}", file=sys.stderr)
        sys.exit(result.returncode)
    return result


def compose_exec_psql(service: str, user: str, dbname: str, sql: str) -> subprocess.CompletedProcess[str]:
    """Executes a SQL snippet inside the running PostgreSQL container."""
    cmd = COMPOSE_CMD + [
        "exec", "-T", service,
        "psql", "-U", user, "-d", dbname, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql
    ]
    return subprocess.run(cmd, cwd=REPO_ROOT, text=True, capture_output=True)


def wait_for_healthy(service_name: str, timeout: float = 45.0) -> bool:
    start = time.time()
    print(f"Waiting for {service_name} to reach healthy status...")
    while time.time() - start < timeout:
        res = run_cmd(COMPOSE_CMD + ["ps", service_name, "--format", "json"], check=False)
        if res.returncode == 0 and res.stdout.strip():
            try:
                for line in res.stdout.strip().splitlines():
                    data = json.loads(line)
                    health = data.get("Health", "")
                    status = data.get("Status", "")
                    if health == "healthy" or "healthy" in status:
                        print(f"  -> {service_name} is healthy!")
                        return True
            except Exception:
                pass
        time.sleep(1.0)
    print(f"ERROR: Timed out waiting for {service_name} to become healthy.", file=sys.stderr)
    return False


def wait_for_one_shot(service_name: str, timeout: float = 30.0) -> bool:
    start = time.time()
    print(f"Waiting for one-shot service {service_name} to finish successfully...")
    while time.time() - start < timeout:
        res = run_cmd(COMPOSE_CMD + ["ps", "-a", service_name, "--format", "json"], check=False)
        if res.returncode == 0 and res.stdout.strip():
            try:
                for line in res.stdout.strip().splitlines():
                    data = json.loads(line)
                    state = data.get("State", "")
                    exit_code = data.get("ExitCode", 0)
                    if state == "exited" and exit_code == 0:
                        print(f"  -> {service_name} completed successfully (exit code 0)!")
                        return True
            except Exception:
                pass
        time.sleep(1.0)
    print(f"ERROR: Timed out waiting for {service_name} to complete successfully.", file=sys.stderr)
    return False


def http_get(url: str, timeout: float = 5.0) -> tuple[int, dict]:
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            return response.status, json.loads(body)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        try:
            return exc.code, json.loads(body)
        except Exception:
            return exc.code, {"raw": body}
    except Exception as exc:
        return 0, {"error": str(exc)}


def http_post(url: str, timeout: float = 5.0) -> tuple[int, dict]:
    try:
        req = urllib.request.Request(url, data=b"", method="POST")
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            return response.status, json.loads(body)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        try:
            return exc.code, json.loads(body)
        except Exception:
            return exc.code, {"raw": body}
    except Exception as exc:
        return 0, {"error": str(exc)}


def test_role_isolation():
    """Verifies that role_demo_app and role_demo_migrate strictly adhere to ADR-007."""
    print("\n[Verification: Database and Role Isolation]")

    # 1. Verify role_demo_app CANNOT create databases
    res = compose_exec_psql("postgres", "role_demo_app", "db_demo", "CREATE DATABASE test_forbidden_db;")
    assert res.returncode != 0 and "permission denied" in res.stderr.lower(), (
        f"Security violation: role_demo_app was able to create databases! {res.stderr}"
    )
    print("  -> Confirmed: role_demo_app cannot CREATE DATABASE (permission denied).")

    # 2. Verify role_demo_app CANNOT create roles
    res = compose_exec_psql("postgres", "role_demo_app", "db_demo", "CREATE ROLE test_forbidden_role;")
    assert res.returncode != 0 and "permission denied" in res.stderr.lower(), (
        f"Security violation: role_demo_app was able to create roles! {res.stderr}"
    )
    print("  -> Confirmed: role_demo_app cannot CREATE ROLE (permission denied).")

    # 3. Verify role_demo_app CANNOT modify schema (CREATE TABLE in public)
    res = compose_exec_psql("postgres", "role_demo_app", "db_demo", "CREATE TABLE forbidden_table (id INT);")
    assert res.returncode != 0 and "permission denied" in res.stderr.lower(), (
        f"Security violation: role_demo_app was able to CREATE TABLE! {res.stderr}"
    )
    print("  -> Confirmed: role_demo_app cannot execute DDL CREATE TABLE (permission denied).")

    # 4. Verify role_demo_app CANNOT connect to db_isolation_test
    res = compose_exec_psql("postgres", "role_demo_app", "db_isolation_test", "SELECT 1;")
    assert res.returncode != 0 and "permission denied" in res.stderr.lower(), (
        f"Security violation: role_demo_app was able to connect to unrelated db_isolation_test! {res.stderr}"
    )
    print("  -> Confirmed: role_demo_app cannot access unrelated product database db_isolation_test.")

    # 5. Verify role_demo_migrate is NOT a superuser
    res = compose_exec_psql("postgres", "postgres", "postgres", "SELECT rolsuper FROM pg_roles WHERE rolname = 'role_demo_migrate';")
    assert res.stdout.strip() == "f", f"Security violation: role_demo_migrate is superuser! {res.stdout}"
    print("  -> Confirmed: role_demo_migrate is not a superuser (rolsuper=f).")

    # 6. Verify role_demo_app is NOT a superuser
    res = compose_exec_psql("postgres", "postgres", "postgres", "SELECT rolsuper FROM pg_roles WHERE rolname = 'role_demo_app';")
    assert res.stdout.strip() == "f", f"Security violation: role_demo_app is superuser! {res.stdout}"
    print("  -> Confirmed: role_demo_app is not a superuser (rolsuper=f).")


def main():
    print("============================================================")
    print(" Megalith PostgreSQL Persistence & Recovery Verification")
    print("============================================================")

    # Preflight Docker check
    if not shutil.which("docker"):
        print("ERROR: docker CLI not found.")
        sys.exit(1)

    try:
        # Step 1: Validate Compose syntax and build images
        print("\n[1/9] Validating Compose syntax and building images...")
        run_cmd(COMPOSE_CMD + ["config"])
        run_cmd(COMPOSE_CMD + ["build"])

        # Step 2: Start stack
        print("\n[2/9] Starting isolated Compose stack...")
        run_cmd(COMPOSE_CMD + ["up", "-d"])

        # Step 3: Wait for dependencies and health checks
        print("\n[3/9] Waiting for PostgreSQL health and migration execution...")
        if not wait_for_healthy("postgres", timeout=30.0):
            sys.exit(1)

        if not wait_for_one_shot("demo-migrate", timeout=30.0):
            sys.exit(1)

        if not wait_for_healthy("demo-api", timeout=30.0):
            sys.exit(1)

        # Step 4: Verify role isolation
        print("\n[4/9] Verifying database and role isolation...")
        test_role_isolation()

        # Step 5: Verify API readiness & counter operations via demo-api
        print("\n[5/9] Testing persistent API endpoints...")
        # Query ready endpoint
        exec_ready = run_cmd(
            COMPOSE_CMD + ["exec", "-T", "demo-api", "python3", "-c",
                           "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/ready').read().decode())"]
        )
        ready_data = json.loads(exec_ready.stdout)
        assert ready_data["status"] == "ready", f"Unexpected readiness data: {ready_data}"
        print(f"  -> /ready: {ready_data}")

        # Query initial counter
        exec_counter = run_cmd(
            COMPOSE_CMD + ["exec", "-T", "demo-api", "python3", "-c",
                           "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/counter').read().decode())"]
        )
        initial_val = json.loads(exec_counter.stdout)["value"]
        print(f"  -> Initial counter value: {initial_val}")

        # Increment counter
        exec_inc = run_cmd(
            COMPOSE_CMD + ["exec", "-T", "demo-api", "python3", "-c",
                           "import urllib.request; print(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8000/api/counter/increment', data=b'', method='POST')).read().decode())"]
        )
        new_val = json.loads(exec_inc.stdout)["value"]
        assert new_val == initial_val + 1, f"Expected counter {initial_val + 1}, got {new_val}"
        print(f"  -> Incremented counter: {new_val}")

        # Step 6: Verify Concurrency / Atomic Increments
        print("\n[6/9] Verifying atomic counter increments under concurrency...")
        increment_script = """
import urllib.request
import concurrent.futures

def inc():
    req = urllib.request.Request('http://127.0.0.1:8000/api/counter/increment', data=b'', method='POST')
    with urllib.request.urlopen(req) as resp:
        return resp.status

with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
    futures = [executor.submit(inc) for _ in range(10)]
    results = [f.result() for f in futures]
    assert all(r == 200 for r in results)
"""
        run_cmd(COMPOSE_CMD + ["exec", "-T", "demo-api", "python3", "-c", increment_script])
        exec_counter_after = run_cmd(
            COMPOSE_CMD + ["exec", "-T", "demo-api", "python3", "-c",
                           "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/counter').read().decode())"]
        )
        val_after_concurrency = json.loads(exec_counter_after.stdout)["value"]
        expected_concurrency_val = new_val + 10
        assert val_after_concurrency == expected_concurrency_val, (
            f"Atomic race condition detected! Expected {expected_concurrency_val}, got {val_after_concurrency}"
        )
        print(f"  -> Counter after 10 concurrent increments: {val_after_concurrency} (Exact match)")

        # Step 7: Verify Backup and Isolated Restore
        print("\n[7/9] Verifying backup creation and isolated database restoration...")
        # Create backup inside postgres container using pg_dump
        run_cmd(
            COMPOSE_CMD + [
                "exec", "-T", "postgres",
                "pg_dump", "-U", "postgres", "-d", "db_demo", "-F", "c", "-f", "/tmp/db_demo_test.dump"
            ]
        )
        print("  -> Logical backup archive created: /tmp/db_demo_test.dump")

        # Create isolated temporary restore database
        res = compose_exec_psql("postgres", "postgres", "postgres", "DROP DATABASE IF EXISTS db_demo_restore_test;")
        assert res.returncode == 0, f"Failed to drop db_demo_restore_test: {res.stderr}"
        res = compose_exec_psql("postgres", "postgres", "postgres", "CREATE DATABASE db_demo_restore_test OWNER role_demo_migrate;")
        assert res.returncode == 0, f"Failed to create db_demo_restore_test: {res.stderr}"
        res = compose_exec_psql("postgres", "postgres", "postgres", "GRANT ALL PRIVILEGES ON DATABASE db_demo_restore_test TO role_demo_migrate; GRANT CONNECT ON DATABASE db_demo_restore_test TO role_demo_app;")
        assert res.returncode == 0, f"Failed to grant privileges on db_demo_restore_test: {res.stderr}"
        print("  -> Temporary restore database 'db_demo_restore_test' created.")

        # Restore into temporary database
        run_cmd(
            COMPOSE_CMD + [
                "exec", "-T", "postgres",
                "pg_restore", "-U", "postgres", "-d", "db_demo_restore_test", "--no-owner", "--no-privileges", "/tmp/db_demo_test.dump"
            ]
        )
        print("  -> Restore into 'db_demo_restore_test' completed.")

        # Grant read privileges to role_demo_app on restored tables so it can verify the snapshot
        res = compose_exec_psql("postgres", "postgres", "db_demo_restore_test", "GRANT USAGE ON SCHEMA public TO role_demo_app; GRANT SELECT ON ALL TABLES IN SCHEMA public TO role_demo_app;")
        assert res.returncode == 0, f"Failed to grant select to role_demo_app on restored tables: {res.stderr}"

        # Query restored database directly to verify counter matches exactly
        res_restored = compose_exec_psql("postgres", "role_demo_app", "db_demo_restore_test", "SELECT value FROM counter WHERE id = 1;")
        assert res_restored.returncode == 0, f"Query to db_demo_restore_test failed: {res_restored.stderr}"
        restored_val = int(res_restored.stdout.strip())
        assert restored_val == val_after_concurrency, (
            f"Data integrity mismatch in restored database! Expected {val_after_concurrency}, got {restored_val}"
        )
        print(f"  -> Confirmed: Restored counter value ({restored_val}) matches original snapshot value ({val_after_concurrency})!")

        # Clean up temporary restore database only
        res = compose_exec_psql("postgres", "postgres", "postgres", "DROP DATABASE db_demo_restore_test;")
        assert res.returncode == 0, f"Failed to drop db_demo_restore_test: {res.stderr}"
        print("  -> Cleaned up temporary restore database 'db_demo_restore_test'.")

        # Step 8: Verify Durability Across Container Restart
        print("\n[8/9] Verifying data durability across container restart...")
        run_cmd(COMPOSE_CMD + ["restart", "postgres"])
        wait_for_healthy("postgres", timeout=20.0)

        # Confirm counter survives postgres container restart
        exec_after_restart = run_cmd(
            COMPOSE_CMD + ["exec", "-T", "demo-api", "python3", "-c",
                           "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/counter').read().decode())"]
        )
        survived_val = json.loads(exec_after_restart.stdout)["value"]
        assert survived_val == val_after_concurrency, (
            f"Data loss across restart! Expected {val_after_concurrency}, got {survived_val}"
        )
        print(f"  -> Confirmed: Counter value ({survived_val}) survived PostgreSQL restart without data loss.")

        # Step 9: Verify Durability Across Compose Down (without -v)
        print("\n[9/9] Verifying durability across Compose stack teardown and recreate (no volume removal)...")
        run_cmd(COMPOSE_CMD + ["down"])
        run_cmd(COMPOSE_CMD + ["up", "-d"])
        wait_for_healthy("postgres", timeout=30.0)
        wait_for_one_shot("demo-migrate", timeout=30.0)
        wait_for_healthy("demo-api", timeout=30.0)

        exec_after_stop_start = run_cmd(
            COMPOSE_CMD + ["exec", "-T", "demo-api", "python3", "-c",
                           "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/counter').read().decode())"]
        )
        persisted_val = json.loads(exec_after_stop_start.stdout)["value"]
        assert persisted_val == val_after_concurrency, (
            f"Data loss across stop/start! Expected {val_after_concurrency}, got {persisted_val}"
        )
        print(f"  -> Confirmed: Counter value ({persisted_val}) persisted through stack stop and restart.")

        print("\n============================================================")
        print(" STATUS: SUCCESS - All Persistence & Recovery Tests Passed!")
        print("============================================================")

    finally:
        print("\n[Teardown] Cleaning up isolated verification Compose project...")
        subprocess.run(COMPOSE_CMD + ["down", "-v"], cwd=REPO_ROOT, check=False)
        print("Teardown complete.")


if __name__ == "__main__":
    main()
