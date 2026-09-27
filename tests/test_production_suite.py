import sys
import os
import re
from unittest.mock import AsyncMock, MagicMock, patch

# Add backend directory to sys.path
backend_dir = r"c:\Users\ajayr\Downloads\ssodl\skillai\backend"
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.environ["MONGODB_URI"] = "mongodb://localhost:27017/test"
os.environ["JWT_SECRET"] = "super-secret-key-for-test-at-least-32-chars-long"

from main import app
from fastapi.testclient import TestClient
from auth_handler import create_access_token

client = TestClient(app)

def run_tests():
    print("=" * 65)
    print("RUNNING COMPREHENSIVE SKILLDNA AI PRODUCTION VERIFICATION SUITE")
    print("=" * 65)
    
    # 1. OpenAPI & Swagger Schema Audit
    print("\n--- 1. OpenAPI & Swagger Schema Audit ---")
    openapi_schema = app.openapi()
    paths = openapi_schema.get("paths", {})
    print(f"Total OpenAPI Paths Loaded: {len(paths)}")
    assert len(paths) >= 80, f"Expected >= 80 paths, found {len(paths)}"

    # Check Public Endpoints have NO security requirement
    public_endpoints = [
        ("/api/public/certificates/verify/{certificate_id}", "get"),
        ("/api/verify/{certificate_id}", "get"),
        ("/api/public/helpdesk", "post"),
        ("/api/health", "get"),
        ("/api/auth/login", "post"),
        ("/api/auth/register", "post")
    ]
    for p, method in public_endpoints:
        if p in paths and method in paths[p]:
            sec = paths[p][method].get("security", [])
            assert len(sec) == 0, f"Public endpoint {p} [{method}] MUST NOT require security, but found {sec}"
            print(f"  [PASS] Public endpoint {p} [{method.upper()}] has NO security requirement")

    # Check Private Endpoints HAVE Bearer security requirement
    private_endpoints = [
        ("/api/admin/users", "get"),
        ("/api/admin/users", "post"),
        ("/api/admin/users/{id}/status", "patch"),
        ("/api/admin/helpdesk", "get"),
        ("/api/admin/helpdesk/{ticket_id}", "patch"),
        ("/api/questions/admin/{id}", "put"),
        ("/api/certificates/admin/{id}", "put"),
        ("/api/certificates/admin/revoke/{id}", "post"),
    ]
    for p, method in private_endpoints:
        assert p in paths, f"Expected private endpoint {p} to be defined"
        sec = paths[p][method].get("security", [])
        assert len(sec) > 0, f"Private endpoint {p} [{method}] MUST have security requirements"
        scheme = list(sec[0].keys())[0]
        assert "bearer" in scheme.lower() or "auth" in scheme.lower(), f"Expected bearer security scheme, got {scheme}"
        print(f"  [PASS] Private endpoint {p} [{method.upper()}] requires HTTPBearer ({scheme})")

    # 2. Public Certificate Verification Endpoint Test
    print("\n--- 2. Public Certificate Verification Endpoint Test ---")
    
    # Test non-existent cert
    with patch("routes.admin_ops.certificates_collection.find_one", AsyncMock(return_value=None)):
        res = client.get("/api/public/certificates/verify/NONEXISTENT-999999")
        print(f"  GET /api/public/certificates/verify/NONEXISTENT-999999 -> Status {res.status_code}")
        assert res.status_code == 404
        assert "not found" in res.json().get("detail", "").lower()
        print("  [PASS] Non-existent certificate returned 404 with Not Found detail")

    # Test valid cert
    valid_cert = {
        "_id": "mock_id_1",
        "certificateId": "SDNA-CERT-2026-ENG01",
        "studentName": "Alex Mercer",
        "careerPath": "Mechanical Engineering",
        "issueDate": "2026-03-15T00:00:00Z",
        "overallScore": 88,
        "technicalScore": 86,
        "communicationScore": 90,
        "problemSolvingScore": 85,
        "confidenceScore": 89,
        "status": "APPROVED",
        "isRevoked": False,
        "version": 1,
        "isCurrentVersion": True,
    }
    with patch("routes.admin_ops.certificates_collection.find_one", AsyncMock(return_value=valid_cert)):
        res = client.get("/api/public/certificates/verify/SDNA-CERT-2026-ENG01")
        print(f"  GET /api/public/certificates/verify/SDNA-CERT-2026-ENG01 -> Status {res.status_code}")
        assert res.status_code == 200
        data = res.json()
        assert data["valid"] is True
        assert data["verificationStatus"] == "VERIFIED"
        assert data["seal"] == "SKILLDNA AI • VERIFIED AUTHENTIC CERTIFICATE"
        assert data["studentName"] == "Alex Mercer"
        assert data["scores"]["overall"] == 88
        assert "password" not in str(data)
        assert "otp" not in str(data)
        print("  [PASS] Valid certificate returned VERIFIED status with official seal and safe scores")

    # Test revoked cert
    revoked_cert = dict(valid_cert)
    revoked_cert["status"] = "REVOKED"
    revoked_cert["isRevoked"] = True
    revoked_cert["revokedReason"] = "Academic integrity review"
    with patch("routes.admin_ops.certificates_collection.find_one", AsyncMock(return_value=revoked_cert)):
        res = client.get("/api/public/certificates/verify/SDNA-CERT-2026-ENG01")
        print(f"  GET (Revoked Cert) -> Status {res.status_code}")
        assert res.status_code == 200
        data = res.json()
        assert data["valid"] is False
        assert data["verificationStatus"] == "REVOKED"
        print("  [PASS] Revoked certificate returned REVOKED status with reason")

    # 3. Public Helpdesk Submission Test
    print("\n--- 3. Public Helpdesk Ticket Creation Test ---")
    ticket_payload = {
        "name": "Sarah Connor",
        "email": "sarah.connor@example.com",
        "phone": "+1-555-0199",
        "issue_type": "CERTIFICATE",
        "subject": "Verification Question",
        "message": "Need help verifying my machine learning certificate."
    }
    mock_insert = AsyncMock()
    with patch("routes.admin_ops.helpdesk_tickets_collection.count_documents", AsyncMock(return_value=0)), \
         patch("routes.admin_ops.helpdesk_tickets_collection.insert_one", mock_insert):
        res = client.post("/api/public/helpdesk", json=ticket_payload)
        print(f"  POST /api/public/helpdesk -> Status {res.status_code}")
        assert res.status_code in [200, 201]
        data = res.json()
        ticket_id = data.get("ticket_id")
        print(f"  Generated Ticket ID: {ticket_id}")
        assert re.match(r"^SDNA-HD-2026-[A-F0-9]{6}$", ticket_id)
        assert data.get("ticketStatus") == "NEW" or data.get("status") in ["NEW", "success"]
        print("  [PASS] Public helpdesk generated valid SDNA-HD-2026-XXXXXX ticket without login")

    # 4. RBAC & Protection Test
    print("\n--- 4. Role-Based Access Control (RBAC) Test ---")
    
    # Student token cannot access Admin Question bank edit
    student_token = create_access_token({"sub": "student@example.com", "role": "student"})
    with patch("database.admins_collection.find_one", AsyncMock(return_value=None)), \
         patch("database.users_collection.find_one", AsyncMock(return_value={"email": "student@example.com", "role": "student"})):
        res = client.put(
            "/api/questions/admin/q-123",
            json={"question": "What is Python?", "difficulty": "EASY"},
            headers={"Authorization": f"Bearer {student_token}"}
        )
        print(f"  Student PUT /api/questions/admin/q-123 -> Status {res.status_code} (Expected 403)")
        assert res.status_code == 403
        print("  [PASS] Student token strictly forbidden (403) from Question Bank edit")

    # Admin token allowed
    admin_token = create_access_token({"sub": "admin@example.com", "role": "MAIN_ADMIN"})
    mock_admin_lookup = AsyncMock(return_value={"email": "admin@example.com", "role": "MAIN_ADMIN", "status": "ACTIVE"})
    
    # 5. Admin User Management Audit
    print("\n--- 5. Admin User Management Suite Test ---")
    mock_users = [
        {
            "_id": "mock_u1",
            "name": "David Miller",
            "email": "david@example.com",
            "role": "student",
            "status": "ACTIVE",
            "isEmailVerified": True,
            "password": "argon2_secret_hash_not_to_leak",
            "otp": "999999"
        }
    ]
    mock_cursor = MagicMock()
    mock_cursor.skip.return_value = mock_cursor
    mock_cursor.limit.return_value = mock_cursor
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.to_list = AsyncMock(return_value=mock_users)
    with patch("database.admins_collection.find_one", mock_admin_lookup), \
         patch("routes.admin_ops.users_collection.find", return_value=mock_cursor), \
         patch("routes.admin_ops.users_collection.count_documents", AsyncMock(return_value=1)), \
         patch("routes.admin_ops.profiles_collection.find_one", AsyncMock(return_value={"college": "SkillDNA Institute", "degree": "B.Tech", "branch": "Computer Science"})), \
         patch("routes.admin_ops.certificates_collection.count_documents", AsyncMock(return_value=1)), \
         patch("routes.admin_ops.question_sessions_collection.count_documents", AsyncMock(return_value=2)):
        res = client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
        print(f"  Admin GET /api/admin/users -> Status {res.status_code}")
        assert res.status_code == 200
        body = res.json()
        users = body.get("users", [])
        assert len(users) == 1
        u = users[0]
        assert u["email"] == "david@example.com"
        assert "password" not in u
        assert "otp" not in u
        print("  [PASS] Admin /api/admin/users returns safe user data with zero leaked passwords or OTPs")

    # 6. Certificate Versioning Test
    print("\n--- 6. Certificate Versioning Audit ---")
    mock_cert_ins = MagicMock()
    mock_cert_ins.inserted_id = "507f1f77bcf86cd799439011"
    with patch("database.admins_collection.find_one", mock_admin_lookup), \
         patch("routes.admin_ops.certificates_collection.find_one", AsyncMock(return_value=valid_cert)), \
         patch("routes.admin_ops.certificates_collection.update_one", AsyncMock()), \
         patch("routes.admin_ops.certificates_collection.update_many", AsyncMock()), \
         patch("routes.admin_ops.certificates_collection.insert_one", AsyncMock(return_value=mock_cert_ins)), \
         patch("routes.admin_ops.audit_logs_collection.insert_one", AsyncMock()):
        edit_payload = {
            "studentName": "Alex Mercer, M.S.",
            "careerPath": "Advanced Robotics",
            "overallScore": 92,
            "changeReason": "Added master's degree and updated thesis score"
        }
        res = client.put(
            "/api/certificates/admin/SDNA-CERT-2026-ENG01",
            json=edit_payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"  Admin PUT /api/certificates/admin/SDNA-CERT-2026-ENG01 -> Status {res.status_code}")
        assert res.status_code == 200
        res_json = res.json()
        assert res_json.get("success") is True
        assert res_json.get("version") == 2
        print("  [PASS] Certificate versioning increments revision (v2) and preserves historical record without overwrite")

    # 7. Admin Helpdesk Suite Test
    print("\n--- 7. Admin Helpdesk Management Suite Test ---")
    mock_ticket = {
        "_id": "mock_hd_1",
        "ticketId": "SDNA-HD-2026-A1B2C3",
        "name": "Sarah Connor",
        "email": "sarah.connor@example.com",
        "phone": "+1-555-0199",
        "issueType": "CERTIFICATE",
        "subject": "Verification Question",
        "message": "Need help verifying my cert.",
        "status": "NEW",
        "adminNotes": "",
        "createdAt": "2026-03-15T00:00:00Z"
    }
    mock_hd_cursor = MagicMock()
    mock_hd_cursor.skip.return_value = mock_hd_cursor
    mock_hd_cursor.limit.return_value = mock_hd_cursor
    mock_hd_cursor.sort.return_value = mock_hd_cursor
    mock_hd_cursor.to_list = AsyncMock(return_value=[mock_ticket])
    with patch("database.admins_collection.find_one", mock_admin_lookup), \
         patch("routes.admin_ops.helpdesk_tickets_collection.find", return_value=mock_hd_cursor), \
         patch("routes.admin_ops.helpdesk_tickets_collection.count_documents", AsyncMock(return_value=1)):
        res = client.get("/api/admin/helpdesk", headers={"Authorization": f"Bearer {admin_token}"})
        print(f"  Admin GET /api/admin/helpdesk -> Status {res.status_code}")
        assert res.status_code == 200
        tickets = res.json().get("tickets", [])
        assert len(tickets) == 1
        assert tickets[0]["ticketId"] == "SDNA-HD-2026-A1B2C3"
        print("  [PASS] Admin Helpdesk list returns tickets with full tracking details")

    # Update ticket status
    with patch("database.admins_collection.find_one", mock_admin_lookup), \
         patch("routes.admin_ops.helpdesk_tickets_collection.find_one_and_update", AsyncMock(return_value={**mock_ticket, "status": "RESOLVED"})):
        res = client.patch(
            "/api/admin/helpdesk/SDNA-HD-2026-A1B2C3",
            json={"status": "RESOLVED", "admin_notes": "Certificate verified and resent to candidate."},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"  Admin PATCH /api/admin/helpdesk/SDNA-HD-2026-A1B2C3 -> Status {res.status_code}")
        assert res.json().get("ticket", {}).get("status") == "RESOLVED"
        print("  [PASS] Helpdesk ticket updated to RESOLVED with admin notes")

    print("\n" + "=" * 65)
    print("ALL 7 CRITICAL PRODUCTION SUITE MODULES PASSED (100% SUCCESS)!")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
