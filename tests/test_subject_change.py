import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from main import app
from schemas import SubjectChangeRequestCreate


def test_subject_request_requires_meaningful_reason():
    with pytest.raises(ValidationError):
        SubjectChangeRequestCreate(targetSubject="Python", reason="short")


def test_subject_request_endpoints_require_authentication():
    client = TestClient(app)
    assert client.get("/api/subject-change-requests/my").status_code == 401
    assert client.get("/api/admin/subject-change-requests").status_code == 401


def test_dashboard_api_contract_is_registered():
    client = TestClient(app)
    for path in ("/api/profiles/me", "/api/reports/me/scorecards", "/api/career-twin/me"):
        assert client.get(path).status_code == 401
