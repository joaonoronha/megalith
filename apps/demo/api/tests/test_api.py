"""
Automated unit tests for Megalith Demo API endpoints.
"""

from fastapi.testclient import TestClient

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
