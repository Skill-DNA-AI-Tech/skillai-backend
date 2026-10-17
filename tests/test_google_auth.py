from fastapi.testclient import TestClient

from config import settings
from main import app


def test_google_login_fails_honestly_when_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "")
    response = TestClient(app).post("/api/auth/google", json={"id_token": "not-a-token"})
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]
