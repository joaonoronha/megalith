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


def test_unknown_route_returns_404():
    """Verify requesting an undefined endpoint returns HTTP 404."""
    response = client.get("/nonexistent")
    assert response.status_code == 404
