#!/usr/bin/env python3
"""
Lightweight automated verification script for containerized Megalith services.

Validates:
1. Docker Compose configuration syntax.
2. Image builds for demo-api and demo-web.
3. Service startup and health-check readiness.
4. Non-root container runtime user identities.
5. Host port isolation (backend port 8000 is not exposed).
6. Frontend static asset delivery on port 8080.
7. End-to-end /api/message reverse proxying.
8. Backend outage (HTTP 502) and automatic recovery.
9. Clean stack teardown.
"""

from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
COMPOSE_FILE = REPO_ROOT / "platform" / "deploy" / "compose.yaml"


def find_available_port(preferred_port: int) -> int:
    """Check if preferred port is free on 127.0.0.1; if busy, allocate a free loopback port."""
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


TEST_PORT = os.environ.get("VERIFY_PORT") or str(find_available_port(18080))
COMPOSE_PROJECT = "megalith-verify"
COMPOSE_BASE = ["docker", "compose", "-p", COMPOSE_PROJECT, "-f", str(COMPOSE_FILE)]



def run_cmd(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    print(f"--> Running: {' '.join(cmd)}")
    env = os.environ.copy()
    env.setdefault("PORT", TEST_PORT)
    result = subprocess.run(cmd, cwd=REPO_ROOT, env=env, text=True, capture_output=True)
    if check and result.returncode != 0:
        print(f"FAILED (exit code {result.returncode}):\n{result.stderr}\n{result.stdout}")
        sys.exit(result.returncode)
    return result


def check_preflight_environment() -> None:
    """
    Verifies that the runtime environment meets container verification requirements
    without performing privileged host or firewall mutations.
    """
    print("[Preflight] Checking Docker availability and environment...")
    if not shutil.which("docker"):
        print("ERROR: 'docker' CLI not found on PATH. Docker is required for container verification.")
        sys.exit(1)

    daemon_res = subprocess.run(
        ["docker", "info"],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
    )
    if daemon_res.returncode != 0:
        print(
            "ERROR: Docker daemon is not running or the current user cannot access the Docker socket.\n"
            f"Details: {daemon_res.stderr.strip()}"
        )
        sys.exit(1)

    print("  -> Docker daemon is reachable.")
    print("  -> Host firewall policy: Unmodified (privileged host changes disabled).")
    print(
        "  -> Note: Container integration requires bridge forwarding. In nested DinD environments\n"
        "     where host firewall policies drop bridge traffic, consult docs/operations/container-verification.md."
    )


def wait_for_healthy(service_name: str, timeout: float = 30.0) -> bool:
    start = time.time()
    print(f"Waiting for {service_name} to reach healthy status...")
    while time.time() - start < timeout:
        res = run_cmd(
            COMPOSE_BASE + ["ps", service_name, "--format", "json"],
            check=False,
        )
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
    print(f"Timed out waiting for {service_name} to become healthy.")
    return False


def main():
    print("============================================================")
    print(" Megalith Container Stack Automated Verification")
    print("============================================================")

    # 1. Non-privileged preflight diagnostic
    check_preflight_environment()

    try:
        # 2. Config validation
        print("\n[1/7] Validating Compose configuration syntax...")
        run_cmd(COMPOSE_BASE + ["config"])

        # 3. Build images
        print("\n[2/7] Building container images...")
        run_cmd(COMPOSE_BASE + ["build"])

        # 4. Start stack
        print("\n[3/7] Starting Compose stack...")
        run_cmd(COMPOSE_BASE + ["up", "-d"])

        # 5. Check health
        if not wait_for_healthy("demo-api") or not wait_for_healthy("demo-web"):
            print("ERROR: One or more containers failed health check.")
            sys.exit(1)

        # 6. Verify non-root users
        print("\n[4/7] Verifying non-root runtime users...")
        api_user = run_cmd(
            COMPOSE_BASE + ["exec", "demo-api", "id", "-u"]
        ).stdout.strip()
        web_user = run_cmd(
            COMPOSE_BASE + ["exec", "demo-web", "id", "-u"]
        ).stdout.strip()
        print(f"  -> demo-api UID: {api_user} (expected non-root 10001)")
        print(f"  -> demo-web UID: {web_user} (expected non-root 101)")
        assert api_user == "10001", f"Unexpected API user UID: {api_user}"
        assert web_user == "101", f"Unexpected Web user UID: {web_user}"

        # 7. Verify host port isolation
        print("\n[5/7] Verifying backend port isolation from host...")
        try:
            with urllib.request.urlopen("http://localhost:8000/", timeout=1.0):
                print("ERROR: Port 8000 should NOT be accessible on the host!")
                sys.exit(1)
        except Exception as e:
            print(f"  -> Confirmed: Host access to port 8000 refused as expected ({e})")

        # 8. Verify HTTP endpoints
        print(f"\n[6/7] Verifying HTTP endpoints via frontend proxy (port {TEST_PORT})...")
        # Frontend root
        with urllib.request.urlopen(f"http://localhost:{TEST_PORT}/", timeout=5.0) as resp:
            assert resp.status == 200
            html = resp.read().decode()
            assert "Megalith Demo" in html or 'id="root"' in html
            print(f"  -> GET http://localhost:{TEST_PORT}/ returned frontend HTML (HTTP 200)")

        # Proxied backend message
        try:
            with urllib.request.urlopen(f"http://localhost:{TEST_PORT}/api/message", timeout=5.0) as resp:
                assert resp.status == 200
                data = json.loads(resp.read().decode())
                assert data == {"message": "Hello from Megalith API", "service": "demo/api"}
                print(f"  -> GET http://localhost:{TEST_PORT}/api/message returned expected JSON payload:", data)
        except urllib.error.HTTPError as e:
            if e.code in (502, 504):
                print(
                    f"\nERROR: Inter-container communication failed with HTTP {e.code} ({e.reason}).\n"
                    "This environment cannot support container-to-container bridge forwarding.\n"
                    "In nested container / DinD environments (such as Codespaces), host firewall rules\n"
                    "may drop bridge traffic. Consult docs/operations/container-verification.md\n"
                    "for manual administrative remediation."
                )
            else:
                print(f"\nERROR: Unexpected HTTP error from proxied endpoint: {e}")
            sys.exit(1)
        except Exception as e:
            print(f"\nERROR: Failed to contact proxied backend endpoint: {e}")
            sys.exit(1)

        # 9. Verify outage resilience and recovery
        print("\n[7/7] Verifying backend outage resilience and recovery...")
        print("  -> Stopping demo-api...")
        run_cmd(COMPOSE_BASE + ["stop", "demo-api"])

        # Frontend should still serve static files
        with urllib.request.urlopen(f"http://localhost:{TEST_PORT}/", timeout=5.0) as resp:
            assert resp.status == 200
            print("  -> Frontend continues serving static HTML while API is down.")

        # Proxied request should fail with 502 Bad Gateway or 504 Gateway Timeout
        try:
            urllib.request.urlopen(f"http://localhost:{TEST_PORT}/api/message", timeout=10.0)
            print("ERROR: Expected request to fail with 502/504 while API is down")
            sys.exit(1)
        except urllib.error.HTTPError as e:
            assert e.code in (502, 504), f"Expected 502 or 504 gateway failure, got {e.code}"
            print(f"  -> Proxied request failed with HTTP {e.code} as expected.")

        # Restart backend
        print("  -> Restarting demo-api...")
        run_cmd(COMPOSE_BASE + ["start", "demo-api"])
        assert wait_for_healthy("demo-api")

        # Verify recovery
        with urllib.request.urlopen(f"http://localhost:{TEST_PORT}/api/message", timeout=5.0) as resp:
            assert resp.status == 200
            recovered_data = json.loads(resp.read().decode())
            assert recovered_data == {"message": "Hello from Megalith API", "service": "demo/api"}
            print(f"  -> Proxied request successfully recovered (HTTP 200):", recovered_data)

    finally:
        print("\n[Teardown] Stopping and removing Compose resources...")
        run_cmd(COMPOSE_BASE + ["down", "-v"], check=False)
        print("Stack teardown complete.")

    print("\n============================================================")
    print(" STATUS: ALL CONTAINER CHECKS PASSED")
    print("============================================================")


if __name__ == "__main__":
    main()
