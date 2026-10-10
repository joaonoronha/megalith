"""
Automated unit tests for Megalith Demo API endpoints.
"""

import os

import pytest
from fastapi.testclient import TestClient
from uvicorn.middleware.proxy_headers import _TrustedHosts

from migrations import env
from src import db
from src.main import app

client = TestClient(app)


def test_health_endpoint_returns_ok_and_service_id():
    """Verify GET /health returns HTTP 200 with status 'ok' and service identifier 'demo/api'."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "demo/api"


def test_api_message_endpoint_returns_expected_payload():
    """Verify GET /api/message returns HTTP 200 with the expected structured JSON contract."""
    response = client.get("/api/message")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Hello from Megalith API"
    assert data["service"] == "demo/api"


def test_ready_endpoint_reports_503_when_database_unavailable():
    """Verify GET /ready returns HTTP 503 when the database is unreachable."""
    response = client.get("/ready")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "not_ready"
    assert data["service"] == "demo/api"
    assert "error" in data


def test_ready_endpoint_returns_200_when_database_and_schema_ready(monkeypatch):
    """Verify GET /ready returns HTTP 200 when database connectivity and schema check succeed."""
    monkeypatch.setattr(db, "check_readiness", lambda: (True, "Database and schema ready"))
    response = client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"


def test_ready_endpoint_returns_503_on_schema_or_privilege_error(monkeypatch):
    """Verify GET /ready returns HTTP 503 when the required schema or table permissions are missing."""
    monkeypatch.setattr(
        db, "check_readiness", lambda: (False, "Database or required schema unavailable")
    )
    response = client.get("/ready")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "not_ready"

    # Liveness must still return 200 even during schema or permission errors
    health_res = client.get("/health")
    assert health_res.status_code == 200


def test_counter_endpoints_return_503_gracefully_when_database_unavailable():
    """Verify counter endpoints return HTTP 503 without crashing when the database is unavailable."""
    get_res = client.get("/api/counter")
    assert get_res.status_code == 503
    assert get_res.json()["error"] == "Database unavailable"

    post_res = client.post("/api/counter/increment")
    assert post_res.status_code == 503
    assert post_res.json()["error"] == "Database unavailable"


def test_unknown_route_returns_404():
    """Verify requesting an undefined endpoint returns HTTP 404."""
    response = client.get("/nonexistent")
    assert response.status_code == 404


def test_migration_environment_strictly_requires_migrate_url(monkeypatch):
    """Verify Alembic migration env strictly requires DATABASE_MIGRATE_URL and rejects fallback to DATABASE_URL."""
    # Scenario 1: Neither is set -> RuntimeError
    monkeypatch.delenv("DATABASE_MIGRATE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(RuntimeError, match="DATABASE_MIGRATE_URL environment variable is required"):
        env.get_url()

    # Scenario 2: Only application DATABASE_URL is set -> must NOT fallback, must raise RuntimeError
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://role_demo_app:secret@localhost/db_demo")
    with pytest.raises(RuntimeError, match="DATABASE_MIGRATE_URL environment variable is required"):
        env.get_url()

    # Scenario 3: DATABASE_MIGRATE_URL is properly provided -> succeeds
    expected_url = "postgresql+psycopg://role_demo_migrate:secret@localhost/db_demo"
    monkeypatch.setenv("DATABASE_MIGRATE_URL", expected_url)
    assert env.get_url() == expected_url


def test_uvicorn_proxy_headers_narrow_trust(monkeypatch):
    """Verify Uvicorn proxy headers configuration correctly trusts edge-network CIDR and rejects untrusted peers."""
    narrow_ips = "127.0.0.1,172.28.0.0/24"
    monkeypatch.setenv("FORWARDED_ALLOW_IPS", narrow_ips)
    trusted = _TrustedHosts(os.environ["FORWARDED_ALLOW_IPS"])

    # Loopback trusted
    assert "127.0.0.1" in trusted
    # Edge network trusted (Caddy and authorized edge containers)
    assert "172.28.0.2" in trusted
    assert "172.28.0.254" in trusted
    # Outside subnets (arbitrary 10.x, 192.168.x, arbitrary 172.x) NOT trusted
    assert "10.0.0.1" not in trusted
    assert "192.168.1.1" not in trusted
    assert "172.16.0.1" not in trusted
    assert "172.29.0.2" not in trusted
