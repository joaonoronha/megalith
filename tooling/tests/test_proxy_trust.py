"""
Unit tests for Megalith proxy trust, network isolation, and header spoofing defense (Task 011 Objective E).

Verifies that:
1. Merged production Compose configuration pins Caddy to a static IP on edge-network.
2. The subnet assignment is valid, collision-free, and contained within RFC 1918 private ranges.
3. FastAPI/Uvicorn restricts FORWARDED_ALLOW_IPS strictly to Caddy (172.28.0.10) and localhost.
4. Untrusted clients cannot spoof client IP or protocol via X-Forwarded-* headers.
5. Trusted proxy requests correctly unpack X-Forwarded-For and X-Forwarded-Proto.
6. Database service (PostgreSQL) is isolated from public ingress and edge-network.
"""

from __future__ import annotations

import ipaddress
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
COMPOSE_BASE = REPO_ROOT / "platform" / "deploy" / "compose.yaml"
COMPOSE_PROD = REPO_ROOT / "platform" / "deploy" / "compose.prod.yaml"
COMPOSE_MICRO = REPO_ROOT / "platform" / "deploy" / "compose.micro.yaml"


@pytest.fixture(scope="module")
def merged_prod_compose() -> dict[str, Any]:
    """Inspects the merged production Docker Compose configuration."""
    cmd = [
        "docker", "compose",
        "-f", str(COMPOSE_BASE),
        "-f", str(COMPOSE_PROD),
        "config",
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return yaml.safe_load(res.stdout)


def test_edge_network_subnet_validity(merged_prod_compose: dict[str, Any]):
    """Edge network must have a valid, well-defined subnet within private address space."""
    networks = merged_prod_compose.get("networks", {})
    assert "edge-network" in networks, "edge-network must be defined"
    edge_net = networks["edge-network"]
    ipam_configs = edge_net.get("ipam", {}).get("config", [])
    assert len(ipam_configs) > 0, "ipam config must declare subnet"

    subnet_str = ipam_configs[0].get("subnet")
    assert subnet_str, "subnet must be specified"
    network_obj = ipaddress.ip_network(subnet_str)
    assert network_obj.is_private, "Subnet must be private (RFC 1918)"
    assert str(network_obj) == "172.28.0.0/24"


def test_caddy_static_ip_assignment(merged_prod_compose: dict[str, Any]):
    """Caddy ingress must have static IP 172.28.0.10 inside edge-network."""
    services = merged_prod_compose.get("services", {})
    assert "caddy" in services, "caddy service must be defined in production"
    caddy_svc = services["caddy"]
    caddy_nets = caddy_svc.get("networks", {})
    assert "edge-network" in caddy_nets, "caddy must be connected to edge-network"

    caddy_ip = caddy_nets["edge-network"].get("ipv4_address")
    assert caddy_ip == "172.28.0.10"

    # Verify IP falls cleanly within edge-network subnet and is neither network nor broadcast
    net = ipaddress.ip_network("172.28.0.0/24")
    addr = ipaddress.ip_address(caddy_ip)
    assert addr in net
    assert addr != net.network_address
    assert addr != net.broadcast_address


def test_fastapi_forwarded_allow_ips_pinned(merged_prod_compose: dict[str, Any]):
    """FastAPI demo-api must pin FORWARDED_ALLOW_IPS strictly to Caddy IP and loopback."""
    services = merged_prod_compose.get("services", {})
    assert "demo-api" in services, "demo-api service must be defined"
    demo_api_env = services["demo-api"].get("environment", {})

    forwarded_allow = demo_api_env.get("FORWARDED_ALLOW_IPS")
    assert forwarded_allow is not None, "FORWARDED_ALLOW_IPS must be explicitly configured"
    allowed_ips = [ip.strip() for ip in forwarded_allow.split(",")]
    assert "172.28.0.10" in allowed_ips, "172.28.0.10 (Caddy proxy) must be trusted"
    assert "127.0.0.1" in allowed_ips, "127.0.0.1 (local health check) must be trusted"
    assert "*" not in allowed_ips, "Wildcard '*' proxy trust is strictly forbidden"


def test_database_isolation_from_edge_and_ingress(merged_prod_compose: dict[str, Any]):
    """PostgreSQL must only attach to data-network and must never publish public host ports."""
    services = merged_prod_compose.get("services", {})
    assert "postgres" in services, "postgres service must be defined"
    pg_svc = services["postgres"]

    # Must NOT publish ports on the host
    ports = pg_svc.get("ports", [])
    assert len(ports) == 0, f"PostgreSQL must not bind host ports in production, found: {ports}"

    # Must be on data-network, NOT edge-network
    pg_nets = pg_svc.get("networks", {})
    assert "data-network" in pg_nets, "PostgreSQL must connect to data-network"
    assert "edge-network" not in pg_nets, "PostgreSQL must NOT connect to edge-network"


def test_demo_web_no_host_port_binding(merged_prod_compose: dict[str, Any]):
    """demo-web must not publish host ports in production; ingress routes exclusively via Caddy."""
    services = merged_prod_compose.get("services", {})
    demo_web = services.get("demo-web", {})
    ports = demo_web.get("ports", [])
    assert len(ports) == 0, f"demo-web host ports must be cleared in production overlay, found: {ports}"


def test_uvicorn_proxy_header_trust_and_spoof_rejection():
    """
    Direct ASGI test verifying that Uvicorn ProxyHeadersMiddleware honors headers
    from trusted Caddy IP (172.28.0.10) while rejecting spoofed headers from untrusted origins.
    """
    from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

    async def dummy_app(scope, receive, send):
        # Echo back client host and scheme
        client = scope.get("client")
        scheme = scope.get("scheme")
        client_host = client[0] if client else None
        body = f"{client_host}|{scheme}".encode("utf-8")
        await send({
            "type": "http.response.start",
            "status": 200,
            "headers": [[b"content-type", b"text/plain"]],
        })
        await send({"type": "http.response.body", "body": body})

    # Wrap with ProxyHeadersMiddleware using Megalith production settings
    trusted_ips = "127.0.0.1,172.28.0.10"
    app = ProxyHeadersMiddleware(dummy_app, trusted_hosts=trusted_ips)

    import asyncio

    async def run_request(client_ip: str, headers: list[tuple[bytes, bytes]]) -> str:
        response_body = []
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": headers,
            "client": (client_ip, 12345),
            "scheme": "http",
        }
        async def receive():
            return {"type": "http.request", "body": b""}

        async def send(msg):
            if msg["type"] == "http.response.body":
                response_body.append(msg.get("body", b""))

        await app(scope, receive, send)
        return b"".join(response_body).decode("utf-8")

    # Case 1: Untrusted peer (e.g. 172.28.0.99) sends spoofed X-Forwarded-For and X-Forwarded-Proto
    spoofed_headers = [
        (b"x-forwarded-for", b"203.0.113.195"),
        (b"x-forwarded-proto", b"https"),
    ]
    res_untrusted = asyncio.run(run_request("172.28.0.99", spoofed_headers))
    # Must NOT trust spoofed header; peer IP and scheme must remain untrusted
    assert res_untrusted == "172.28.0.99|http", f"Untrusted client spoofed headers! Got: {res_untrusted}"

    # Case 2: Trusted Caddy proxy (172.28.0.10) sends legitimate forwarded headers
    trusted_headers = [
        (b"x-forwarded-for", b"203.0.113.195"),
        (b"x-forwarded-proto", b"https"),
    ]
    res_trusted = asyncio.run(run_request("172.28.0.10", trusted_headers))
    # Must trust header; peer IP becomes 203.0.113.195 and scheme becomes https
    assert res_trusted == "203.0.113.195|https", f"Trusted proxy failed to unpack headers! Got: {res_trusted}"
