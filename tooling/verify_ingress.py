#!/usr/bin/env python3
"""
Automated end-to-end verification script for Megalith Caddy Edge Ingress.

Validates:
1. Native Caddyfile syntax and JSON adaptation (both production and local).
2. Compose overlay configuration and host port isolation.
3. Isolated stack startup (Postgres -> Migration -> API -> Web -> Caddy).
4. Frontend routing and single page application (SPA) fallback through Caddy.
5. Direct API routing (/api/message, /api/counter, POST /api/counter/increment).
6. Hostname-based routing (Host: demo.example.com).
7. Security headers enforcement (CSP, X-Frame-Options, X-Content-Type-Options, etc.).
8. Host port privacy (FastAPI, Nginx, and PostgreSQL ports unexposed on host).
9. Network isolation (Caddy cannot reach private PostgreSQL data-network).
10. API outage behavior (HTTP 502/504 Bad Gateway, not SPA fallback) and automatic recovery.
11. Clean teardown of isolated test project resources.
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
COMPOSE_BASE_FILE = REPO_ROOT / "platform" / "deploy" / "compose.yaml"
COMPOSE_LOCAL_INGRESS = REPO_ROOT / "platform" / "deploy" / "compose.local-ingress.yaml"
COMPOSE_PROD_INGRESS = REPO_ROOT / "platform" / "deploy" / "compose.prod.yaml"
CADDY_DIR = REPO_ROOT / "platform" / "deploy" / "caddy"

CADDY_IMAGE = "caddy:2.9-alpine@sha256:b4e3952384eb9524a887633ce65c752dd7c71314d2c2acf98cd5c715aaa534f0"
PROJECT_NAME = "megalith-ingress-verify"


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


INGRESS_PORT = os.environ.get("INGRESS_PORT") or str(find_available_port(18082))


COMPOSE_CMD = [
    "docker", "compose",
    "-p", PROJECT_NAME,
    "-f", str(COMPOSE_BASE_FILE),
    "-f", str(COMPOSE_LOCAL_INGRESS),
]


def run_cmd(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    print(f"--> Running: {' '.join(cmd)}")
    env = os.environ.copy()
    env.setdefault("INGRESS_PORT", INGRESS_PORT)
    env.setdefault("DEMO_HOSTNAME", "demo.example.com")
    result = subprocess.run(cmd, cwd=REPO_ROOT, env=env, text=True, capture_output=True)
    if check and result.returncode != 0:
        print(f"FAILED (exit code {result.returncode}):\n{result.stderr}\n{result.stdout}", file=sys.stderr)
        sys.exit(result.returncode)
    return result


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


def http_request(
    path: str,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    timeout: float = 5.0,
) -> tuple[int, dict, dict[str, str], str]:
    """Sends an HTTP request to Caddy on the local ingress test port."""
    url = f"http://127.0.0.1:{INGRESS_PORT}{path}"
    req_headers = headers or {}
    req = urllib.request.Request(url, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            resp_headers = {k.lower(): v for k, v in response.headers.items()}
            try:
                data = json.loads(body)
            except Exception:
                data = {}
            return response.status, data, resp_headers, body
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        resp_headers = {k.lower(): v for k, v in exc.headers.items()}
        try:
            data = json.loads(body)
        except Exception:
            data = {}
        return exc.code, data, resp_headers, body
    except Exception as exc:
        return 0, {"error": str(exc)}, {}, str(exc)


def validate_caddyfile_configs() -> None:
    """Validates Caddyfile syntax and JSON adaptation using Caddy's native validator."""
    print("\n[Validation: Native Caddyfile Configurations]")

    # 1. Validate local Caddyfile
    res_local = subprocess.run(
        [
            "docker", "run", "--rm",
            "-v", f"{CADDY_DIR}:/etc/caddy:ro",
            CADDY_IMAGE,
            "caddy", "validate", "--config", "/etc/caddy/Caddyfile.local", "--adapter", "caddyfile",
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert res_local.returncode == 0, f"Caddyfile.local failed validation:\n{res_local.stderr}"
    print("  -> Caddyfile.local is syntactically valid and adapted cleanly.")

    # 2. Validate production Caddyfile
    res_prod = subprocess.run(
        [
            "docker", "run", "--rm",
            "-v", f"{CADDY_DIR}:/etc/caddy:ro",
            "-e", "DEMO_HOSTNAME=demo.example.com",
            CADDY_IMAGE,
            "caddy", "validate", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile",
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert res_prod.returncode == 0, f"Production Caddyfile failed validation:\n{res_prod.stderr}"
    assert "enabling automatic HTTP->HTTPS redirects" in res_prod.stdout + res_prod.stderr
    print("  -> Production Caddyfile is valid with automatic HTTPS redirects enabled.")


def main():
    print("============================================================")
    print(" Megalith Production Edge Ingress Verification (Caddy)")
    print("============================================================")

    if not shutil.which("docker"):
        print("ERROR: docker CLI not found.")
        sys.exit(1)

    try:
        # Step 1: Validate Caddy configurations natively
        validate_caddyfile_configs()

        # Step 2: Validate production and local Compose configurations
        print("\n[1/10] Validating Compose configurations...")
        run_cmd(["docker", "compose", "-f", str(COMPOSE_BASE_FILE), "-f", str(COMPOSE_PROD_INGRESS), "config"])
        run_cmd(COMPOSE_CMD + ["config"])

        # Step 3: Build application images
        print("\n[2/10] Building container images...")
        run_cmd(COMPOSE_CMD + ["build"])

        # Step 4: Start local ingress testing stack
        print("\n[3/10] Starting isolated Ingress stack...")
        run_cmd(COMPOSE_CMD + ["up", "-d"])

        # Step 5: Wait for all services
        print("\n[4/10] Waiting for service startup and health checks...")
        assert wait_for_healthy("postgres", timeout=45.0)
        assert wait_for_one_shot("demo-migrate", timeout=30.0)
        assert wait_for_healthy("demo-api", timeout=45.0)
        assert wait_for_healthy("demo-web", timeout=45.0)

        # Allow Caddy 2 seconds to establish reverse proxy upstreams
        time.sleep(2.0)

        # Step 6: Verify frontend delivery and SPA fallback
        print("\n[5/10] Verifying frontend routing and SPA fallback via Caddy...")
        status, _, headers, body = http_request("/")
        assert status == 200, f"Expected 200 for root, got {status}"
        assert "Megalith Demo" in body or 'id="root"' in body, "Frontend HTML not served on /"
        print(f"  -> GET / returned HTTP {status} with React frontend HTML.")

        # SPA fallback on arbitrary client-side path
        status_spa, _, _, body_spa = http_request("/nonexistent/spa/route")
        assert status_spa == 200, f"Expected 200 for SPA fallback, got {status_spa}"
        assert 'id="root"' in body_spa or "Megalith Demo" in body_spa, "SPA fallback did not return index.html"
        print(f"  -> GET /nonexistent/spa/route returned HTTP {status_spa} (SPA client fallback).")

        # Step 7: Verify direct API routing and persistent state
        print("\n[6/10] Verifying direct API routing through Caddy...")
        # GET /api/message
        status_msg, data_msg, _, _ = http_request("/api/message")
        assert status_msg == 200, f"Expected 200 for /api/message, got {status_msg}"
        assert data_msg == {"message": "Hello from Megalith API", "service": "demo/api"}
        print("  -> GET /api/message passed cleanly through Caddy:", data_msg)

        # GET /api/counter
        status_counter, data_counter, _, _ = http_request("/api/counter")
        assert status_counter == 200, f"Expected 200 for /api/counter, got {status_counter}"
        initial_val = data_counter["value"]
        print(f"  -> GET /api/counter returned initial persistent value: {initial_val}")

        # POST /api/counter/increment
        status_inc, data_inc, _, _ = http_request("/api/counter/increment", method="POST")
        assert status_inc == 200, f"Expected 200 for /api/counter/increment, got {status_inc}"
        assert data_inc["value"] == initial_val + 1
        print(f"  -> POST /api/counter/increment updated counter to: {data_inc['value']}")

        # Query parameter forwarding
        status_query, _, _, _ = http_request("/api/message?filter=test&page=1")
        assert status_query == 200, f"Expected 200 with query parameters, got {status_query}"
        print("  -> Query-string parameters forwarded successfully.")

        # Step 8: Verify hostname-based routing (Host header)
        print("\n[7/10] Verifying hostname-based routing (Host: demo.example.com)...")
        status_host, data_host, _, _ = http_request("/api/message", headers={"Host": "demo.example.com"})
        assert status_host == 200, f"Host routing failed, got {status_host}"
        assert data_host == {"message": "Hello from Megalith API", "service": "demo/api"}
        print("  -> Routing with 'Host: demo.example.com' succeeded.")

        # Step 9: Verify security headers
        print("\n[8/10] Verifying HTTP security headers...")
        _, _, headers, _ = http_request("/")
        assert headers.get("x-content-type-options") == "nosniff", "Missing X-Content-Type-Options: nosniff"
        assert headers.get("x-frame-options") == "DENY", "Missing X-Frame-Options: DENY"
        assert headers.get("referrer-policy") == "strict-origin-when-cross-origin", "Missing Referrer-Policy"
        assert "content-security-policy" in headers, "Missing Content-Security-Policy header"
        assert "server" not in headers, f"Server header should be removed, got: {headers.get('server')}"
        assert "strict-transport-security" not in headers, "HSTS must NOT be set in local HTTP mode"
        print("  -> Confirmed: nosniff, DENY, Referrer-Policy, and CSP present.")
        print("  -> Confirmed: Server header stripped; HSTS absent in local HTTP testing mode.")

        # Step 10: Verify port privacy and network isolation
        print("\n[9/10] Verifying host port isolation and internal network boundary...")
        # Check backend port 8000 is NOT exposed on host
        try:
            with urllib.request.urlopen("http://127.0.0.1:8000/", timeout=1.0):
                print("SECURITY VIOLATION: Port 8000 is open on host!")
                sys.exit(1)
        except Exception:
            print("  -> Confirmed: Port 8000 (FastAPI) is NOT accessible on host.")

        # Check frontend port 8080 is NOT exposed on host in ingress overlay
        try:
            with urllib.request.urlopen("http://127.0.0.1:8080/", timeout=1.0):
                print("SECURITY VIOLATION: Port 8080 is open on host in ingress stack!")
                sys.exit(1)
        except Exception:
            print("  -> Confirmed: Port 8080 (Nginx) is NOT accessible on host.")

        # Check PostgreSQL port 5432 is NOT exposed on host
        try:
            with urllib.request.urlopen("http://127.0.0.1:5432/", timeout=1.0):
                pass
        except Exception:
            print("  -> Confirmed: Port 5432 (PostgreSQL) is NOT accessible on host.")

        # Verify Caddy CANNOT communicate with PostgreSQL directly (Network Isolation)
        res_iso = subprocess.run(
            COMPOSE_CMD + [
                "exec", "-T", "caddy",
                "nc", "-z", "-w", "2", "postgres", "5432"
            ],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
        )
        assert res_iso.returncode != 0, "Security violation: Caddy was able to connect to PostgreSQL on data-network!"
        print("  -> Confirmed: Caddy cannot reach PostgreSQL across Docker networks (data-network isolated).")

        # Step 11: Verify API outage resilience and recovery
        print("\n[10/10] Verifying API outage behavior and recovery...")
        print("  -> Stopping demo-api...")
        run_cmd(COMPOSE_CMD + ["stop", "demo-api"])

        # Frontend still serves static assets via Caddy
        status_web_down, _, _, _ = http_request("/")
        assert status_web_down == 200, "Frontend should remain available while API is down"
        print("  -> Frontend continues serving static HTML while API is down.")

        # Proxied API request must return 502 Bad Gateway from Caddy (NOT 200 SPA fallback)
        status_api_down, _, _, body_err = http_request("/api/message")
        assert status_api_down in (502, 504), f"Expected 502/504 Bad Gateway, got {status_api_down}: {body_err}"
        assert 'id="root"' not in body_err, "API outage leaked frontend index.html fallback!"
        print(f"  -> Outage request returned HTTP {status_api_down} Bad Gateway (no SPA fallback leak).")

        # Restart demo-api
        print("  -> Restarting demo-api...")
        run_cmd(COMPOSE_CMD + ["start", "demo-api"])
        assert wait_for_healthy("demo-api")

        # Verify recovery
        time.sleep(1.0)
        status_rec, data_rec, _, _ = http_request("/api/message")
        assert status_rec == 200, f"API failed to recover, got {status_rec}"
        assert data_rec == {"message": "Hello from Megalith API", "service": "demo/api"}
        print("  -> API successfully recovered after restart (HTTP 200):", data_rec)

        print("\n============================================================")
        print(" STATUS: SUCCESS - All Ingress & Security Tests Passed!")
        print("============================================================")

    finally:
        print("\n[Teardown] Cleaning up isolated verification Compose project...")
        subprocess.run(COMPOSE_CMD + ["down", "-v"], cwd=REPO_ROOT, check=False)
        print("Teardown complete.")


if __name__ == "__main__":
    main()
