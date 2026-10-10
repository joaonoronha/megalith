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
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
COMPOSE_FILE = REPO_ROOT / "platform" / "deploy" / "compose.yaml"


def run_cmd(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    print(f"--> Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=REPO_ROOT, text=True, capture_output=True)
    if check and result.returncode != 0:
        print(f"FAILED (exit code {result.returncode}):\n{result.stderr}\n{result.stdout}")
        sys.exit(result.returncode)
    return result


def wait_for_healthy(service_name: str, timeout: float = 30.0) -> bool:
    start = time.time()
    print(f"Waiting for {service_name} to reach healthy status...")
    while time.time() - start < timeout:
        res = run_cmd(
            ["docker", "compose", "-f", str(COMPOSE_FILE), "ps", service_name, "--format", "json"],
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

    # 1. Ensure bridge forwarding is enabled (handling Docker-in-Docker / Codespaces legacy iptables)
    subprocess.run(
        ["sudo", "iptables-legacy", "-I", "FORWARD", "1", "-i", "br+", "-o", "br+", "-j", "ACCEPT"],
        check=False,
        capture_output=True,
    )

    try:
        # 2. Config validation
        print("\n[1/7] Validating Compose configuration syntax...")
        run_cmd(["docker", "compose", "-f", str(COMPOSE_FILE), "config"])

        # 3. Build images
        print("\n[2/7] Building container images...")
        run_cmd(["docker", "compose", "-f", str(COMPOSE_FILE), "build"])

        # 4. Start stack
        print("\n[3/7] Starting Compose stack...")
        run_cmd(["docker", "compose", "-f", str(COMPOSE_FILE), "up", "-d"])

        # 5. Check health
        if not wait_for_healthy("demo-api") or not wait_for_healthy("demo-web"):
            print("ERROR: One or more containers failed health check.")
            sys.exit(1)

        # 6. Verify non-root users
        print("\n[4/7] Verifying non-root runtime users...")
        api_user = run_cmd(
            ["docker", "compose", "-f", str(COMPOSE_FILE), "exec", "demo-api", "id", "-u"]
        ).stdout.strip()
        web_user = run_cmd(
            ["docker", "compose", "-f", str(COMPOSE_FILE), "exec", "demo-web", "id", "-u"]
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
        print("\n[6/7] Verifying HTTP endpoints via frontend proxy (port 8080)...")
        # Frontend root
        with urllib.request.urlopen("http://localhost:8080/", timeout=5.0) as resp:
            assert resp.status == 200
            html = resp.read().decode()
            assert "Megalith Demo" in html or 'id="root"' in html
            print("  -> GET http://localhost:8080/ returned frontend HTML (HTTP 200)")

        # Proxied backend message
        with urllib.request.urlopen("http://localhost:8080/api/message", timeout=5.0) as resp:
            assert resp.status == 200
            data = json.loads(resp.read().decode())
            assert data == {"message": "Hello from Megalith API", "service": "demo/api"}
            print("  -> GET http://localhost:8080/api/message returned expected JSON payload:", data)

        # 9. Verify outage resilience and recovery
        print("\n[7/7] Verifying backend outage resilience and recovery...")
        print("  -> Stopping demo-api...")
        run_cmd(["docker", "compose", "-f", str(COMPOSE_FILE), "stop", "demo-api"])

        # Frontend should still serve static files
        with urllib.request.urlopen("http://localhost:8080/", timeout=5.0) as resp:
            assert resp.status == 200
            print("  -> Frontend continues serving static HTML while API is down.")

        # Proxied request should fail with 502 Bad Gateway or 504 Gateway Timeout
        try:
            urllib.request.urlopen("http://localhost:8080/api/message", timeout=10.0)
            print("ERROR: Expected request to fail with 502/504 while API is down")
            sys.exit(1)
        except urllib.error.HTTPError as e:
            assert e.code in (502, 504), f"Expected 502 or 504 gateway failure, got {e.code}"
            print(f"  -> Proxied request failed with HTTP {e.code} as expected.")

        # Restart backend
        print("  -> Restarting demo-api...")
        run_cmd(["docker", "compose", "-f", str(COMPOSE_FILE), "start", "demo-api"])
        assert wait_for_healthy("demo-api")

        # Verify recovery
        with urllib.request.urlopen("http://localhost:8080/api/message", timeout=5.0) as resp:
            assert resp.status == 200
            recovered_data = json.loads(resp.read().decode())
            assert recovered_data == {"message": "Hello from Megalith API", "service": "demo/api"}
            print("  -> Proxied request successfully recovered (HTTP 200):", recovered_data)

    finally:
        print("\n[Teardown] Stopping and removing Compose resources...")
        run_cmd(["docker", "compose", "-f", str(COMPOSE_FILE), "down"])
        print("Stack teardown complete.")

    print("\n============================================================")
    print(" STATUS: ALL CONTAINER CHECKS PASSED")
    print("============================================================")


if __name__ == "__main__":
    main()
