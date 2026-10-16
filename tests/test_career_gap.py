


def test_career_gap_endpoint_persists_authenticated_analysis(monkeypatch):
    from types import SimpleNamespace
    from fastapi.testclient import TestClient
    from main import app
    from auth_handler import get_current_user
    import routes.admin_ops as admin_ops

    class Cursor:
        async def to_list(self, _limit):
            return []

    class Collection:
        def find(self, *_args, **_kwargs):
            return Cursor()

        async def find_one(self, *_args, **_kwargs):
            return None

        async def insert_one(self, _document):
            return SimpleNamespace(inserted_id="analysis-1")

    monkeypatch.setattr(admin_ops, "get_authenticated_user_doc", lambda _user: _async_user())
    monkeypatch.setattr(admin_ops, "profiles_collection", Collection())
    monkeypatch.setattr(admin_ops, "assessments_collection", Collection())
    monkeypatch.setattr(admin_ops, "student_answers_collection", Collection())
    monkeypatch.setattr(admin_ops, "career_gap_analyses_collection", Collection())
    app.dependency_overrides[get_current_user] = lambda: {"email": "student@example.com", "role": "student"}
    try:
        response = TestClient(app).post("/api/career-gap/analyze", json={"targetCareer": "data-scientist", "currentSkills": ["Data preparation and SQL"]})
        assert response.status_code == 200
        body = response.json()
        assert body["analysisId"] == "analysis-1"
        assert body["targetCareer"]["title"] == "Data Scientist"
        assert any(item["classification"] == "PARTIALLY_DEVELOPED" for item in body["competencies"])
    finally:
        app.dependency_overrides.pop(get_current_user, None)


async def _async_user():
    return {"_id": "student-1", "email": "student@example.com", "role": "student"}
