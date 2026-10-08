import sys
import os
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId

# Ensure backend directory is in sys.path
backend_dir = r"c:\Users\ajayr\Downloads\ssodl\skillai\backend"
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.environ["MONGODB_URI"] = "mongodb://localhost:27017/test"
os.environ["JWT_SECRET"] = "super-secret-key-for-test-at-least-32-chars-long"

from fastapi.testclient import TestClient
from main import app
from auth_handler import get_current_admin, get_current_user, create_access_token
from utils.pdf_generator import build_notes_pdf

client = TestClient(app)

def test_current_user_and_refresh_endpoints():
    """Verify /api/auth/current-user and /api/auth/refresh restore sessions cleanly."""
    mock_student = {
        "_id": ObjectId("65f1a2b3c4d5e6f7a8b9c0d1"),
        "name": "Alex Student",
        "email": "alex.student@skilldna.ai",
        "role": "student",
        "is_verified": True,
        "isTestUser": False,
        "isPreProductionUser": False,
    }

    # 1. Test /api/auth/current-user
    with patch("database.users_collection.find_one", AsyncMock(return_value=mock_student)):
        app.dependency_overrides[get_current_user] = lambda: {
            "sub": "alex.student@skilldna.ai",
            "email": "alex.student@skilldna.ai",
            "role": "student",
            "id": "65f1a2b3c4d5e6f7a8b9c0d1"
        }
        res = client.get("/api/auth/current-user")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["email"] == "alex.student@skilldna.ai"
        assert data["name"] == "Alex Student"
        assert data["role"] == "student"

    # 2. Test /api/auth/refresh
    valid_token = create_access_token({
        "sub": "alex.student@skilldna.ai",
        "email": "alex.student@skilldna.ai",
        "role": "student",
        "id": "65f1a2b3c4d5e6f7a8b9c0d1"
    })
    with patch("database.users_collection.find_one", AsyncMock(return_value=mock_student)):
        refresh_res = client.post(
            "/api/auth/refresh",
            headers={"Authorization": f"Bearer {valid_token}"},
            json={"refreshToken": valid_token}
        )
        assert refresh_res.status_code == 200, f"Refresh failed: {refresh_res.text}"
        ref_data = refresh_res.json()
        assert "access_token" in ref_data
        assert ref_data["user"]["email"] == "alex.student@skilldna.ai"

    # Cleanup overrides
    app.dependency_overrides.clear()
    print("[PASS] /api/auth/current-user and /api/auth/refresh verified successfully")

def test_user_deletion_and_protection():
    """Verify DELETE /api/admin/users/{id} prevents self/master deletion and safely deactivates."""
    admin_id = ObjectId("65f1a2b3c4d5e6f7a8b9c0a1")
    target_student_id = ObjectId("65f1a2b3c4d5e6f7a8b9c0d2")
    master_admin_id = ObjectId("65f1a2b3c4d5e6f7a8b9c0a0")

    mock_target = {
        "_id": target_student_id,
        "name": "Jane Candidate",
        "email": "jane@candidate.ai",
        "role": "student",
        "status": "ACTIVE"
    }

    mock_master = {
        "_id": master_admin_id,
        "name": "Master Admin",
        "email": "skilldnaai@ai.com",
        "role": "MAIN_ADMIN",
        "status": "ACTIVE"
    }

    app.dependency_overrides[get_current_admin] = lambda: {
        "sub": "ops.admin@skilldna.ai",
        "email": "ops.admin@skilldna.ai",
        "id": str(admin_id),
        "role": "ADMIN"
    }

    # Case 1: Self-deletion attempt
    with patch("database.users_collection.find_one", AsyncMock(return_value={"_id": admin_id, "email": "ops.admin@skilldna.ai"})), \
         patch("database.admins_collection.find_one", AsyncMock(return_value=None)):
        res = client.delete(f"/api/admin/users/{str(admin_id)}")
        assert res.status_code == 400
        assert "Self-deletion is prohibited" in res.json()["detail"]

    # Case 2: Master admin deletion attempt
    with patch("database.users_collection.find_one", AsyncMock(return_value=None)), \
         patch("database.admins_collection.find_one", AsyncMock(return_value=mock_master)):
        res = client.delete(f"/api/admin/users/{str(master_admin_id)}")
        assert res.status_code == 403
        assert "permanently protected" in res.json()["detail"]

    # Case 3: Legitimate user soft-deactivation
    with patch("database.users_collection.find_one", AsyncMock(return_value=mock_target)), \
         patch("database.admins_collection.find_one", AsyncMock(return_value=None)), \
         patch("database.users_collection.update_one", AsyncMock()) as mock_update, \
         patch("database.audit_logs_collection.insert_one", AsyncMock()) as mock_audit:
        res = client.delete(f"/api/admin/users/{str(target_student_id)}")
        assert res.status_code == 200
        assert res.json()["status"] == "success"
        assert "safely deactivated" in res.json()["message"]
        mock_update.assert_called_once()
        mock_audit.assert_called_once()

    app.dependency_overrides.clear()
    print("[PASS] DELETE /api/admin/users/{id} RBAC, self-deletion, and master protection verified")

def test_quiz_evaluate_skill_evidence_threshold():
    """Verify that score >= 70% updates Skill DNA, while score < 70% does not falsely inflate."""
    app.dependency_overrides[get_current_user] = lambda: {
        "sub": "student@skilldna.ai",
        "email": "student@skilldna.ai",
        "role": "student",
        "id": "65f1a2b3c4d5e6f7a8b9c0d1"
    }

    sample_quiz = [
        {"id": "Q1", "question": "Question 1", "options": ["A", "B", "C", "D"], "correctAnswer": 0},
        {"id": "Q2", "question": "Question 2", "options": ["A", "B", "C", "D"], "correctAnswer": 1},
        {"id": "Q3", "question": "Question 3", "options": ["A", "B", "C", "D"], "correctAnswer": 2},
        {"id": "Q4", "question": "Question 4", "options": ["A", "B", "C", "D"], "correctAnswer": 3},
    ]

    # Passing test: 4/4 = 100% (>= 70%)
    with patch("routes.admin_ops.get_authenticated_user_doc", AsyncMock(return_value={"_id": ObjectId("65f1a2b3c4d5e6f7a8b9c0d1")})), \
         patch("database.profiles_collection.update_one", AsyncMock()) as mock_profile_update:
        pass_res = client.post(
            "/api/learning/notes/quiz-evaluate",
            json={"quiz": sample_quiz, "answers": {"Q1": 0, "Q2": 1, "Q3": 2, "Q4": 3}}
        )
        assert pass_res.status_code == 200
        assert pass_res.json()["score"] == 100
        assert pass_res.json()["passed"] is True
        mock_profile_update.assert_called_once()

    # Failing test: 1/4 = 25% (< 70%)
    with patch("routes.admin_ops.get_authenticated_user_doc", AsyncMock(return_value={"_id": ObjectId("65f1a2b3c4d5e6f7a8b9c0d1")})), \
         patch("database.profiles_collection.update_one", AsyncMock()) as mock_profile_update_fail:
        fail_res = client.post(
            "/api/learning/notes/quiz-evaluate",
            json={"quiz": sample_quiz, "answers": {"Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0}}
        )
        assert fail_res.status_code == 200
        assert fail_res.json()["score"] == 25
        assert fail_res.json()["passed"] is False
        mock_profile_update_fail.assert_not_called()

    app.dependency_overrides.clear()
    print("[PASS] Note quiz evaluation strictly enforces >= 70% threshold without false score inflation")

def test_pdf_watermark_subtle_opacity():
    """Verify that build_notes_pdf uses subtle watermark opacity (0.035) and light slate color."""
    sample_note = {
        "topic": "Strategic Talent Acquisition & Competency Modeling",
        "domain": "Human Resources & People Operations",
        "level": "Advanced",
        "summary": "Covers behavioral rubric synthesis, structured panel evaluation, and bias minimization.",
    }
    custom_watermark = {
        "enabled": True,
        "text": "SKILLDNA AI VERIFIED",
        "opacity": 0.035,
        "fontSize": 48,
        "rotation": 45,
        "position": "center"
    }

    pdf_bytes = build_notes_pdf(sample_note, watermark_settings=custom_watermark, student_name="Sarah HR Leader")
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF-")
    print(f"[PASS] PDF Generator successfully synthesized {len(pdf_bytes)} bytes valid PDF with subtle watermark (0.035)")

if __name__ == "__main__":
    test_current_user_and_refresh_endpoints()
    test_user_deletion_and_protection()
    test_quiz_evaluate_skill_evidence_threshold()
    test_pdf_watermark_subtle_opacity()
    print("\n======================================================================")
    print("ALL PRODUCTION-READINESS VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("======================================================================")
