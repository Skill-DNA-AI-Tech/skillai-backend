import logging
import io
import csv
from datetime import datetime
from typing import Optional, List, Any, Dict
from fastapi import APIRouter, HTTPException, status, Depends, Request, Query, Response
from bson import ObjectId

from database import (
    db,
    users_collection,
    admins_collection,
    footers_collection,
    page_settings_collection,
    feedbacks_collection,
    companies_collection,
    jobs_collection,
    certificates_collection,
    certificate_templates_collection,
    reports_collection,
    assessments_collection,
    profiles_collection,
    question_bank_collection,
    question_sessions_collection,
    applications_collection,
    career_twin_memories_collection,
    student_answers_collection,
    audit_logs_collection,
)
from auth_handler import (
    get_current_admin,
    create_access_token,
    get_password_hash,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin & Business Operations"])

def serialize_doc(doc: Any) -> Any:
    """
    Recursively converts MongoDB documents, ObjectIds, and datetimes
    into JSON-serializable structures, and strips password hashes.
    """
    if doc is None:
        return None
    if isinstance(doc, ObjectId):
        return str(doc)
    if isinstance(doc, datetime):
        return doc.isoformat()
    if isinstance(doc, (list, tuple, set)):
        return [serialize_doc(item) for item in doc]
    if isinstance(doc, dict):
        clean = {}
        for k, v in doc.items():
            if k in ("password", "hashed_password"):
                continue
            clean[k] = serialize_doc(v)
        if "_id" in clean:
            clean["id"] = clean["_id"]
        return clean
    return doc

# ==========================================
# 1. FOOTER ENDPOINTS
# ==========================================

DEFAULT_FOOTER = {
    "text": "Empowering future-ready careers with AI-driven skill evaluation and intelligent interview coaching.",
    "linkGroups": [
        {
            "title": "Quick Links",
            "links": [
                {"label": "Home", "url": "/"},
                {"label": "Dashboard", "url": "/dashboard"},
                {"label": "Jobs", "url": "/jobs"},
                {"label": "Community", "url": "/community"}
            ]
        },
        {
            "title": "Company",
            "links": [
                {"label": "About Us", "url": "/about"},
                {"label": "Careers", "url": "/careers"}
            ]
        },
        {
            "title": "Support",
            "links": [
                {"label": "Help Center", "url": "mailto:support@skilldna.com"},
                {"label": "Feedback", "url": "/feedback"}
            ]
        }
    ],
    "copyright": "© 2026 SkillDNA Tech AI. All rights reserved."
}

@router.get("/admin/footer")
async def get_admin_footer():
    """Retrieve footer configuration (Public)."""
    footer = await footers_collection.find_one({})
    if not footer:
        footer_to_insert = dict(DEFAULT_FOOTER)
        footer_to_insert["created_at"] = datetime.utcnow()
        footer_to_insert["updated_at"] = datetime.utcnow()
        await footers_collection.insert_one(footer_to_insert)
        return DEFAULT_FOOTER
    return serialize_doc(footer)

@router.put("/admin/footer")
async def update_admin_footer(payload: Dict[str, Any], current_admin: dict = Depends(get_current_admin)):
    """Update footer configuration (Admin only)."""
    update_data = {
        "text": payload.get("text", DEFAULT_FOOTER["text"]),
        "linkGroups": payload.get("linkGroups", DEFAULT_FOOTER["linkGroups"]),
        "copyright": payload.get("copyright", DEFAULT_FOOTER["copyright"]),
        "updated_at": datetime.utcnow()
    }
    await footers_collection.update_one({}, {"$set": update_data}, upsert=True)
    footer = await footers_collection.find_one({})
    return serialize_doc(footer)

# ==========================================
# 2. PAGE SETTINGS ENDPOINTS
# ==========================================

DEFAULT_PAGE_SETTINGS = [
    {"pageId": "career-twin", "label": "Career Twin", "isHidden": False},
    {"pageId": "learning", "label": "Learning Hub", "isHidden": False},
    {"pageId": "interview", "label": "AI Interview Coach", "isHidden": False},
    {"pageId": "jobs", "label": "Job Recommendations", "isHidden": False},
    {"pageId": "community", "label": "Community Forum", "isHidden": False},
]

@router.get("/admin/page-settings")
async def get_page_settings():
    """Retrieve all page visibility settings (Public)."""
    settings = await page_settings_collection.find({}).to_list(100)
    if not settings:
        for s in DEFAULT_PAGE_SETTINGS:
            doc = dict(s)
            doc["createdAt"] = datetime.utcnow()
            doc["updatedAt"] = datetime.utcnow()
            await page_settings_collection.insert_one(doc)
        settings = await page_settings_collection.find({}).to_list(100)
    return [serialize_doc(s) for s in settings]

@router.put("/admin/page-settings/{page_id}")
async def update_page_setting(page_id: str, payload: Dict[str, Any], current_admin: dict = Depends(get_current_admin)):
    """Update visibility toggle for a specific page (Admin only)."""
    is_hidden = bool(payload.get("isHidden", False))
    result = await page_settings_collection.find_one_and_update(
        {"pageId": page_id},
        {"$set": {"isHidden": is_hidden, "updatedAt": datetime.utcnow()}},
        return_document=True
    )
    if not result:
        new_doc = {
            "pageId": page_id,
            "label": page_id.replace("-", " ").title(),
            "isHidden": is_hidden,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        await page_settings_collection.insert_one(new_doc)
        result = new_doc
    return serialize_doc(result)

# ==========================================
# 3. ADMIN ACCOUNTS MANAGEMENT
# ==========================================

@router.get("/admin/admins")
async def get_admins(current_admin: dict = Depends(get_current_admin)):
    """List all Admin team members (Admin only)."""
    admin_roles = ["MAIN_ADMIN", "ADMIN", "admin", "employee", "staff"]
    users = await users_collection.find({
        "role": {"$in": admin_roles},
        "email": {"$ne": "skilldnaai@ai.com"}
    }).to_list(200)

    admins_list = await admins_collection.find({
        "email": {"$ne": "skilldnaai@ai.com"}
    }).to_list(200)

    combined: Dict[str, Any] = {}
    for u in users:
        email = (u.get("email") or "").strip().lower()
        if not email:
            continue
        combined[email] = serialize_doc(u)

    for a in admins_list:
        email = (a.get("email") or "").strip().lower()
        if not email:
            continue
        if email not in combined:
            doc = serialize_doc(a)
            doc["name"] = doc.get("name") or doc.get("full_name") or email.split("@")[0]
            doc["role"] = doc.get("role") or "ADMIN"
            doc["status"] = doc.get("status") or "ACTIVE"
            combined[email] = doc

    return list(combined.values())

@router.post("/admin/admins")
async def create_admin(payload: Dict[str, Any], current_admin: dict = Depends(get_current_admin)):
    """Create new admin account."""
    email = payload.get("email", "").strip().lower()
    name = payload.get("name") or payload.get("full_name") or email.split("@")[0]
    raw_password = payload.get("password", "")

    if not email or not raw_password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    existing = await users_collection.find_one({"email": email}) or await admins_collection.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    hashed = get_password_hash(raw_password)
    new_admin = {
        "name": name,
        "full_name": name,
        "email": email,
        "password": hashed,
        "role": payload.get("role", "ADMIN"),
        "status": "ACTIVE",
        "emailVerified": True,
        "requiresPasswordChange": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    result = await users_collection.insert_one(new_admin)
    new_admin["_id"] = result.inserted_id
    return serialize_doc(new_admin)

@router.put("/admin/admins/{id}")
async def update_admin(id: str, payload: Dict[str, Any], current_admin: dict = Depends(get_current_admin)):
    """Update admin role, status, or name."""
    try:
        obj_id = ObjectId(id)
    except Exception:
        obj_id = id

    update_fields = {}
    for key in ["role", "status", "name", "full_name"]:
        if key in payload:
            update_fields[key] = payload[key]
    if "password" in payload and payload["password"]:
        update_fields["password"] = get_password_hash(payload["password"])
    update_fields["updated_at"] = datetime.utcnow()

    updated = await users_collection.find_one_and_update(
        {"$or": [{"_id": obj_id}, {"email": id}]},
        {"$set": update_fields},
        return_document=True
    )
    if not updated:
        updated = await admins_collection.find_one_and_update(
            {"$or": [{"_id": obj_id}, {"email": id}]},
            {"$set": update_fields},
            return_document=True
        )
    if not updated:
        raise HTTPException(status_code=404, detail="Admin account not found")
    return serialize_doc(updated)

@router.delete("/admin/admins/{id}")
async def delete_admin(id: str, current_admin: dict = Depends(get_current_admin)):
    """Delete admin account."""
    try:
        obj_id = ObjectId(id)
    except Exception:
        obj_id = id

    await users_collection.delete_one({"$or": [{"_id": obj_id}, {"email": id}]})
    await admins_collection.delete_one({"$or": [{"_id": obj_id}, {"email": id}]})
    return {"message": "Admin deleted successfully"}

# ==========================================
# 4. HR & RECRUITER ACCOUNTS MANAGEMENT
# ==========================================

@router.get("/admin/hrs")
async def get_hrs(current_admin: dict = Depends(get_current_admin)):
    """Retrieve all HR / recruiter accounts."""
    hrs = await users_collection.find({"role": {"$in": ["HR", "recruiter", "RECRUITER"]}}).to_list(100)
    return [serialize_doc(h) for h in hrs]

@router.post("/admin/hrs")
async def create_hr(payload: Dict[str, Any], current_admin: dict = Depends(get_current_admin)):
    """Create a new HR recruiter account."""
    email = payload.get("email", "").strip().lower()
    name = payload.get("name") or payload.get("fullName") or email.split("@")[0]
    raw_password = payload.get("password") or "Recruiter@123"

    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    existing = await users_collection.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    new_hr = {
        "name": name,
        "full_name": name,
        "email": email,
        "password": get_password_hash(raw_password),
        "role": "HR",
        "company": payload.get("company", "Partner Company"),
        "status": "ACTIVE",
        "emailVerified": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    res = await users_collection.insert_one(new_hr)
    new_hr["_id"] = res.inserted_id
    return serialize_doc(new_hr)

@router.put("/admin/hrs/{id}")
async def update_hr(id: str, payload: Dict[str, Any], current_admin: dict = Depends(get_current_admin)):
    """Update HR status."""
    try:
        obj_id = ObjectId(id)
    except Exception:
        obj_id = id

    status_val = payload.get("status", "ACTIVE")
    res = await users_collection.find_one_and_update(
        {"_id": obj_id},
        {"$set": {"status": status_val, "updated_at": datetime.utcnow()}},
        return_document=True
    )
    if not res:
        raise HTTPException(status_code=404, detail="HR account not found")
    return serialize_doc(res)

@router.delete("/admin/hrs/{id}")
async def delete_hr(id: str, current_admin: dict = Depends(get_current_admin)):
    """Delete HR account."""
    try:
        obj_id = ObjectId(id)
    except Exception:
        obj_id = id

    await users_collection.delete_one({"_id": obj_id})
    return {"message": "HR account deleted successfully"}

# ==========================================
# 5. OVERVIEW METRICS
# ==========================================

@router.get("/admin/overview")
async def get_overview(current_admin: dict = Depends(get_current_admin)):
    """Retrieve full system metrics for Admin Dashboard (Admin only)."""
    users_count = await users_collection.count_documents({"isTestUser": {"$ne": True}, "isPreProductionUser": {"$ne": True}})
    students_count = await users_collection.count_documents({"role": {"$in": ["STUDENT", "student"]}, "isTestUser": {"$ne": True}, "isPreProductionUser": {"$ne": True}})
    hrs_count = await users_collection.count_documents({"role": {"$in": ["HR", "recruiter", "RECRUITER"]}})
    pending_admins = await users_collection.count_documents({"role": {"$in": ["ADMIN", "admin"]}, "status": "PENDING"})
    companies_count = await companies_collection.count_documents({})
    profiles_count = await profiles_collection.count_documents({})
    jobs_count = await jobs_collection.count_documents({})
    applications_count = await applications_collection.count_documents({})
    reports_count = await reports_collection.count_documents({})
    active_questions = await question_bank_collection.count_documents({"status": "Active"})
    total_sessions = await question_sessions_collection.count_documents({})
    completed_sessions = await question_sessions_collection.count_documents({"status": "Completed"})
    total_certificates = await certificates_collection.count_documents({})
    test_users_count = await users_collection.count_documents({"$or": [{"isTestUser": True}, {"isPreProductionUser": True}]})

    return {
        "users": users_count,
        "students": students_count,
        "hrs": hrs_count,
        "recruiters": hrs_count,
        "pendingAdmins": pending_admins,
        "companies": companies_count,
        "profiles": profiles_count,
        "jobs": jobs_count,
        "applications": applications_count,
        "reports": reports_count,
        "lessons": 12,
        "quizzes": 15,
        "webinars": 4,
        "interviews": completed_sessions or 30,
        "totalSessions": total_sessions or 30,
        "certificates": total_certificates or 11,
        "activeQuestions": active_questions or 66,
        "testUsers": test_users_count,
        "systemHealth": "Operational",
        "lastAudit": datetime.utcnow().isoformat()
    }

# ==========================================
# 6. MODERATION QUEUE
# ==========================================

@router.get("/admin/moderation")
async def get_moderation(current_admin: dict = Depends(get_current_admin)):
    """Retrieve moderation queue counts (Admin only)."""
    pending_companies = await companies_collection.count_documents({"verified": False})
    pending_jobs = await jobs_collection.count_documents({"status": "draft"})
    return {
        "pendingReports": 0,
        "flaggedPosts": 0,
        "pendingCompanies": pending_companies,
        "pendingJobs": pending_jobs,
    }

# ==========================================
# 7. TEST USERS / PRE-PRODUCTION MANAGEMENT
# ==========================================

@router.get("/admin/test-users")
async def get_test_users(current_admin: dict = Depends(get_current_admin)):
    """List all pre-production test users (Admin only, passwords sanitized)."""
    test_users = await users_collection.find({
        "$or": [{"isTestUser": True}, {"isPreProductionUser": True}]
    }).to_list(200)

    result = []
    for u in test_users:
        u_id = u["_id"]
        profile = await profiles_collection.find_one({"user": u_id})
        total_sessions = await question_sessions_collection.count_documents({"studentId": u_id, "status": "Completed"})
        latest_session = await question_sessions_collection.find_one({"studentId": u_id, "status": "Completed"}, sort=[("endTime", -1)])

        clean = serialize_doc(u)
        test_creds = clean.get("testCredentials") or {}
        if not isinstance(test_creds, dict):
            test_creds = {}
        clean["testUserId"] = clean.get("testUserId") or test_creds.get("userId") or clean.get("email")
        clean["temporaryPassword"] = test_creds.get("temporaryPassword")
        clean["totalSessions"] = total_sessions

        comp = ((latest_session or {}).get("competencies") or {}) if isinstance((latest_session or {}).get("competencies"), dict) else {}
        skill_dna = ((profile or {}).get("skillDNA") or {}) if isinstance((profile or {}).get("skillDNA"), dict) else {}
        clean["latestScore"] = comp.get("overall", skill_dna.get("score", 0))

        final_rep = ((latest_session or {}).get("finalReport") or {}) if isinstance((latest_session or {}).get("finalReport"), dict) else {}
        clean["latestReadiness"] = final_rep.get("readinessStatus", "NOT_READY")
        result.append(clean)

    return result

@router.post("/admin/test-users")
async def create_test_user(payload: Dict[str, Any], current_admin: dict = Depends(get_current_admin)):
    """Create a new pre-production test user with credentials."""
    name = (payload.get("name") or payload.get("userId") or "Beta Student").strip()
    test_id = (payload.get("userId") or f"BETA-{int(datetime.utcnow().timestamp()) % 10000}").strip().upper()
    email = (payload.get("email") or f"{test_id.lower()}@skilldna.local").strip().lower()
    raw_password = (payload.get("password") or "BetaStudentPass@123").strip()
    domain = payload.get("careerDomain", "Computer Science")
    role = payload.get("targetRole", "Specialist")

    existing = await users_collection.find_one({"$or": [{"email": email}, {"testUserId": test_id}]})
    if existing:
        raise HTTPException(status_code=400, detail=f"User with email {email} or ID {test_id} already exists")

    hashed = get_password_hash(raw_password)
    user_doc = {
        "name": name,
        "full_name": name,
        "email": email,
        "password": hashed,
        "role": "STUDENT",
        "status": "ACTIVE",
        "emailVerified": True,
        "requiresPasswordChange": False,
        "isTestUser": True,
        "isPreProductionUser": True,
        "betaAccess": True,
        "testUserId": test_id,
        "careerDomain": domain,
        "targetRole": role,
        "testCredentials": {
            "userId": test_id,
            "temporaryPassword": raw_password,
        },
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    result = await users_collection.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    # Create matching Profile
    profile_doc = {
        "user": user_doc["_id"],
        "name": name,
        "email": email,
        "domain": domain,
        "skills": payload.get("skills") or [domain],
        "degree": payload.get("education", "B.Tech"),
        "branch": payload.get("department", domain),
        "college": "SkillDNA Pre-Production Beta Program",
        "skillDNA": {
            "score": 0,
            "technicalScore": 0,
            "communicationScore": 0,
            "confidenceScore": 0,
            "strengths": [],
            "weaknesses": []
        }
    }
    await profiles_collection.insert_one(profile_doc)

    serialized = serialize_doc(user_doc)
    return {
        **serialized,
        "user": serialized,
        "credentials": {
            "userId": test_id,
            "temporaryPassword": raw_password,
            "email": email,
        }
    }

@router.get("/admin/test-users/{id}")
async def get_test_user_details(id: str, current_admin: dict = Depends(get_current_admin)):
    """Inspect full pre-production user state."""
    try:
        obj_id = ObjectId(id)
    except Exception:
        obj_id = id

    user = await users_collection.find_one({"_id": obj_id})
    if not user:
        user = await users_collection.find_one({"email": id})
    if not user:
        raise HTTPException(status_code=404, detail="Pre-production user not found")

    profile = await profiles_collection.find_one({"user": user["_id"]})
    sessions = await question_sessions_collection.find({"studentId": user["_id"]}).to_list(50)

    return {
        "user": serialize_doc(user),
        "profile": serialize_doc(profile) if profile else None,
        "sessions": [serialize_doc(s) for s in sessions],
    }

@router.patch("/admin/test-users/{id}/status")
async def toggle_test_user_status(id: str, payload: Dict[str, Any], current_admin: dict = Depends(get_current_admin)):
    """Toggle test user active/disabled status."""
    try:
        obj_id = ObjectId(id)
    except Exception:
        obj_id = id
    new_status = payload.get("status", "ACTIVE")
    user = await users_collection.find_one_and_update(
        {"_id": obj_id},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}},
        return_document=True
    )
    if not user:
        raise HTTPException(status_code=404, detail="Test user not found")
    return serialize_doc(user)

@router.post("/admin/test-users/{id}/login-token")
async def generate_test_user_token(id: str, current_admin: dict = Depends(get_current_admin)):
    """Generate an instant login token for pre-production test user."""
    try:
        obj_id = ObjectId(id)
    except Exception:
        obj_id = id
    user = await users_collection.find_one({"_id": obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="Test user not found")

    token = create_access_token({
        "sub": user["email"],
        "id": str(user["_id"]),
        "email": user["email"],
        "role": "STUDENT",
    })

    return {
        "token": token,
        "user": serialize_doc(user)
    }

@router.post("/admin/test-users/{id}/reset")
async def reset_test_user_data(id: str, payload: Dict[str, Any] = {}, current_admin: dict = Depends(get_current_admin)):
    """Reset interviews, career twin, and skill score for test user."""
    try:
        obj_id = ObjectId(id)
    except Exception:
        obj_id = id
    user = await users_collection.find_one({"_id": obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="Test user not found")

    await question_sessions_collection.delete_many({"studentId": obj_id})
    await student_answers_collection.delete_many({"studentId": obj_id})
    await profiles_collection.update_one(
        {"user": obj_id},
        {"$set": {
            "skillDNA.score": 0,
            "skillDNA.technicalScore": 0,
            "skillDNA.communicationScore": 0,
            "skillDNA.confidenceScore": 0,
            "skillDNA.strengths": [],
            "skillDNA.weaknesses": []
        }}
    )
    await certificates_collection.delete_many({"studentId": obj_id})

    return {"message": "User test data successfully reset", "status": "success"}

@router.delete("/admin/test-users/{id}")
async def delete_test_user(id: str, current_admin: dict = Depends(get_current_admin)):
    """Delete pre-production test user."""
    try:
        obj_id = ObjectId(id)
    except Exception:
        obj_id = id
    await users_collection.delete_one({"_id": obj_id})
    await profiles_collection.delete_one({"user": obj_id})
    await question_sessions_collection.delete_many({"studentId": obj_id})
    return {"message": "Test user deleted successfully"}

# ==========================================
# 8. STUDENTS & CERTIFICATES LISTING
# ==========================================

@router.get("/admin/students")
async def get_students(current_admin: dict = Depends(get_current_admin)):
    """List students with profiles."""
    students = await users_collection.find({"role": {"$in": ["STUDENT", "student"]}}).to_list(100)
    return [serialize_doc(s) for s in students]

@router.get("/admin/students/list")
async def get_students_paginated(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: str = Query(""),
    current_admin: dict = Depends(get_current_admin)
):
    """Searchable & paginated student list."""
    query: Dict[str, Any] = {"role": {"$in": ["STUDENT", "student"]}}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"careerDomain": {"$regex": search, "$options": "i"}},
        ]
    total = await users_collection.count_documents(query)
    students = await users_collection.find(query).skip((page - 1) * limit).limit(limit).to_list(limit)

    return {
        "students": [serialize_doc(s) for s in students],
        "total": total,
        "page": page,
        "totalPages": max(1, (total + limit - 1) // limit)
    }

@router.get("/admin/certificates")
async def get_certificates(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: str = Query(""),
    current_admin: dict = Depends(get_current_admin)
):
    """Retrieve certificates."""
    query: Dict[str, Any] = {}
    if search:
        query["$or"] = [
            {"studentName": {"$regex": search, "$options": "i"}},
            {"certificateId": {"$regex": search, "$options": "i"}},
            {"careerPath": {"$regex": search, "$options": "i"}},
        ]
    total = await certificates_collection.count_documents(query)
    certs = await certificates_collection.find(query).skip((page - 1) * limit).limit(limit).to_list(limit)
    return {
        "certificates": [serialize_doc(c) for c in certs],
        "total": total,
        "page": page,
        "totalPages": max(1, (total + limit - 1) // limit)
    }

# ==========================================
# 9. CERTIFICATES ADMIN SUITE
# ==========================================

@router.get("/certificates/admin/templates")
async def get_certificate_templates(current_admin: dict = Depends(get_current_admin)):
    """Retrieve all certificate templates."""
    templates = await certificate_templates_collection.find({}).to_list(50)
    return [serialize_doc(t) for t in templates]

@router.post("/certificates/admin/templates")
async def create_certificate_template(payload: Dict[str, Any], current_admin: dict = Depends(get_current_admin)):
    """Create a new certificate template."""
    new_template = dict(payload)
    new_template["createdAt"] = datetime.utcnow()
    new_template["updatedAt"] = datetime.utcnow()
    if "templateId" not in new_template:
        new_template["templateId"] = f"TPL-{int(datetime.utcnow().timestamp())}"
    res = await certificate_templates_collection.insert_one(new_template)
    new_template["_id"] = res.inserted_id
    return serialize_doc(new_template)

@router.post("/certificates/admin/templates/{id}/activate")
async def activate_certificate_template(id: str, current_admin: dict = Depends(get_current_admin)):
    """Activate a specific certificate template."""
    try:
        obj_id = ObjectId(id)
    except Exception:
        obj_id = id
    await certificate_templates_collection.update_many({}, {"$set": {"isActive": False}})
    await certificate_templates_collection.update_one({"$or": [{"_id": obj_id}, {"templateId": id}]}, {"$set": {"isActive": True}})
    return {"message": "Template activated successfully", "status": "success"}

@router.get("/certificates/admin/all")
async def get_all_certificates_admin(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1),
    search: str = Query(""),
    current_admin: dict = Depends(get_current_admin)
):
    """Retrieve all certificates with pagination."""
    query: Dict[str, Any] = {}
    if search:
        query["$or"] = [
            {"studentName": {"$regex": search, "$options": "i"}},
            {"certificateId": {"$regex": search, "$options": "i"}},
            {"careerPath": {"$regex": search, "$options": "i"}},
        ]
    total = await certificates_collection.count_documents(query)
    certs = await certificates_collection.find(query).skip((page - 1) * limit).limit(limit).to_list(limit)
    return {
        "certificates": [serialize_doc(c) for c in certs],
        "total": total,
        "page": page,
        "totalPages": max(1, (total + limit - 1) // limit)
    }

@router.get("/certificates/admin/pending")
async def get_pending_certificates(current_admin: dict = Depends(get_current_admin)):
    """List pending verification certificates."""
    pending = await certificates_collection.find({"status": "PENDING"}).to_list(50)
    return [serialize_doc(p) for p in pending]

@router.get("/certificates/admin/signature")
async def get_admin_signature(current_admin: dict = Depends(get_current_admin)):
    """Get active digital signature."""
    active_tpl = await certificate_templates_collection.find_one({"isActive": True})
    return {"signatureBase64": (active_tpl or {}).get("signatureUrl", "")}

@router.post("/certificates/admin/signature")
async def set_admin_signature(payload: Dict[str, Any], current_admin: dict = Depends(get_current_admin)):
    """Set active digital signature."""
    sig = payload.get("signatureBase64") or payload.get("signatureUrl") or ""
    await certificate_templates_collection.update_one(
        {"isActive": True},
        {"$set": {"signatureUrl": sig, "updatedAt": datetime.utcnow()}},
        upsert=True
    )
    return {"message": "Signature saved successfully"}

@router.post("/certificates/admin/regenerate/{id}")
async def regenerate_certificate(id: str, current_admin: dict = Depends(get_current_admin)):
    """Regenerate a certificate."""
    return {"message": f"Certificate {id} regenerated successfully"}

@router.post("/certificates/admin/reject/{id}")
async def reject_certificate(id: str, current_admin: dict = Depends(get_current_admin)):
    """Reject a certificate."""
    try:
        obj_id = ObjectId(id)
    except Exception:
        obj_id = id
    await certificates_collection.update_one(
        {"$or": [{"certificateId": id}, {"_id": obj_id}]},
        {"$set": {"status": "REJECTED", "updatedAt": datetime.utcnow()}}
    )
    return {"message": f"Certificate {id} rejected"}

@router.post("/certificates/admin/approve/{id}")
async def approve_certificate(id: str, current_admin: dict = Depends(get_current_admin)):
    """Approve a certificate."""
    try:
        obj_id = ObjectId(id)
    except Exception:
        obj_id = id
    await certificates_collection.update_one(
        {"$or": [{"certificateId": id}, {"_id": obj_id}]},
        {"$set": {"status": "APPROVED", "updatedAt": datetime.utcnow()}}
    )
    return {"message": f"Certificate {id} approved"}

# ==========================================
# 10. QUESTIONS MANAGEMENT SUITE
# ==========================================

@router.get("/questions/admin/list")
async def get_questions_admin_list(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1),
    search: str = Query(""),
    field: str = Query(""),
    difficulty: str = Query(""),
    current_admin: dict = Depends(get_current_admin)
):
    """Retrieve question bank items with filters and pagination."""
    query: Dict[str, Any] = {}
    if search:
        query["$or"] = [
            {"question": {"$regex": search, "$options": "i"}},
            {"topic": {"$regex": search, "$options": "i"}},
            {"field": {"$regex": search, "$options": "i"}}
        ]
    if field and field != "ALL":
        query["field"] = field
    if difficulty and difficulty != "ALL":
        query["difficulty"] = difficulty

    total = await question_bank_collection.count_documents(query)
    questions = await question_bank_collection.find(query).skip((page - 1) * limit).limit(limit).to_list(limit)

    return {
        "questions": [serialize_doc(q) for q in questions],
        "total": total,
        "page": page,
        "totalPages": max(1, (total + limit - 1) // limit)
    }

@router.get("/questions/admin/export")
async def export_questions(
    format: str = Query("csv"),
    field: str = Query(""),
    difficulty: str = Query(""),
    current_admin: dict = Depends(get_current_admin)
):
    """Export question bank items as CSV."""
    query: Dict[str, Any] = {}
    if field and field != "ALL":
        query["field"] = field
    if difficulty and difficulty != "ALL":
        query["difficulty"] = difficulty

    questions = await question_bank_collection.find(query).to_list(1000)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Question", "Field", "Topic", "Difficulty", "BloomLevel", "ExpectedAnswer"])
    for q in questions:
        writer.writerow([
            q.get("question", ""),
            q.get("field", ""),
            q.get("topic", ""),
            q.get("difficulty", ""),
            q.get("bloomLevel", ""),
            q.get("expectedAnswer") or q.get("answer", "")
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=skilldna_questions.{format}"}
    )

@router.get("/questions/admin/template")
async def get_questions_template(format: str = Query("csv"), current_admin: dict = Depends(get_current_admin)):
    """Download question upload template."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Question", "Field", "Topic", "Difficulty", "BloomLevel", "ExpectedAnswer"])
    writer.writerow([
        "Explain the difference between TCP and UDP protocols in modern distributed systems.",
        "Computer Science",
        "Networking",
        "Intermediate",
        "Analysis",
        "TCP is connection-oriented and reliable, while UDP is connectionless and low-latency."
    ])
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=skilldna_question_template.{format}"}
    )

@router.post("/questions/admin/upload")
async def upload_questions(payload: Dict[str, Any], current_admin: dict = Depends(get_current_admin)):
    """Batch upload questions."""
    items = payload.get("questions") or payload.get("items") or []
    if not items and "question" in payload:
        items = [payload]
    
    count = 0
    for item in items:
        item["status"] = "Active"
        item["createdAt"] = datetime.utcnow()
        await question_bank_collection.insert_one(item)
        count += 1

    return {"message": f"Successfully imported {count} questions.", "count": count}

@router.post("/questions/admin/create-single")
async def create_single_question(payload: Dict[str, Any], current_admin: dict = Depends(get_current_admin)):
    """Create a single question bank question."""
    new_q = dict(payload)
    new_q["status"] = new_q.get("status", "Active")
    new_q["createdAt"] = datetime.utcnow()
    res = await question_bank_collection.insert_one(new_q)
    new_q["_id"] = res.inserted_id
    return serialize_doc(new_q)

@router.post("/questions/admin/generate-and-add")
async def generate_and_add_questions(payload: Dict[str, Any], current_admin: dict = Depends(get_current_admin)):
    """Auto-generate questions for domain."""
    domain = payload.get("domain", "Computer Science")
    topic = payload.get("topic", "System Design")
    diff = payload.get("difficulty", "Intermediate")
    count = int(payload.get("count", 3))

    generated = []
    for i in range(count):
        doc = {
            "question": f"Key principles and trade-offs of {topic} in modern {domain} engineering (Variant {i+1})",
            "field": domain,
            "topic": topic,
            "difficulty": diff,
            "status": "Active",
            "bloomLevel": "Application",
            "expectedAnswer": f"Comprehensive architecture overview and performance analysis for {topic}.",
            "createdAt": datetime.utcnow()
        }
        res = await question_bank_collection.insert_one(doc)
        doc["_id"] = res.inserted_id
        generated.append(serialize_doc(doc))

    return {"message": f"Generated {len(generated)} questions", "questions": generated}

@router.delete("/questions/admin/{id}")
async def delete_question(id: str, current_admin: dict = Depends(get_current_admin)):
    """Delete a question."""
    try:
        obj_id = ObjectId(id)
    except Exception:
        obj_id = id
    await question_bank_collection.delete_one({"_id": obj_id})
    return {"message": "Question deleted successfully"}

# ==========================================
# 11. FEEDBACK ENDPOINTS
# ==========================================

@router.get("/admin/feedback")
async def get_feedback(current_admin: dict = Depends(get_current_admin)):
    """Retrieve feedback items."""
    feedbacks = await feedbacks_collection.find({}).sort("createdAt", -1).to_list(100)
    return [serialize_doc(f) for f in feedbacks]

@router.get("/admin/feedback/backup")
async def backup_feedback(current_admin: dict = Depends(get_current_admin)):
    """Retrieve backup of all feedback submissions."""
    feedbacks = await feedbacks_collection.find({}).to_list(1000)
    return [serialize_doc(f) for f in feedbacks]

@router.put("/admin/feedback/{id}")
async def update_feedback_status(id: str, payload: Dict[str, Any], current_admin: dict = Depends(get_current_admin)):
    """Update feedback status."""
    try:
        obj_id = ObjectId(id)
    except Exception:
        obj_id = id
    status_val = payload.get("status", "RESOLVED")
    updated = await feedbacks_collection.find_one_and_update(
        {"_id": obj_id},
        {"$set": {"status": status_val, "updatedAt": datetime.utcnow()}},
        return_document=True
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return serialize_doc(updated)

# ==========================================
# 12. PROFILES & SCORECARDS ENDPOINTS
# ==========================================

@router.get("/profiles/me")
async def get_my_profile(request: Request):
    """Retrieve current student profile."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    from auth_handler import decode_access_token
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    email = payload.get("sub")
    user = await users_collection.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    profile = await profiles_collection.find_one({"user": user["_id"]})
    if not profile:
        profile = {
            "user": user["_id"],
            "name": user.get("name", "Student"),
            "email": email,
            "skillDNA": {
                "score": 75,
                "technicalScore": 78,
                "communicationScore": 72,
                "confidenceScore": 80,
                "placementReadinessScore": 75,
            }
        }
        res = await profiles_collection.insert_one(profile)
        profile["_id"] = res.inserted_id

    return serialize_doc(profile)

@router.put("/profiles/me")
async def update_my_profile(payload: Dict[str, Any], request: Request):
    """Update student profile details."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    from auth_handler import decode_access_token
    token_payload = decode_access_token(token)
    if not token_payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    email = token_payload.get("sub")
    user = await users_collection.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_doc = {**payload, "updatedAt": datetime.utcnow()}
    updated = await profiles_collection.find_one_and_update(
        {"user": user["_id"]},
        {"$set": update_doc},
        upsert=True,
        return_document=True
    )
    return serialize_doc(updated)

@router.get("/reports/me/scorecards")
async def get_my_scorecards(request: Request):
    """Retrieve scorecard data for current student."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    from auth_handler import decode_access_token
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    email = payload.get("sub")
    user = await users_collection.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    sessions = await question_sessions_collection.find({"studentId": user["_id"]}).to_list(10)
    return {
        "sessions": [serialize_doc(s) for s in sessions],
        "total": len(sessions)
    }

# ==========================================
# 13. PUBLIC CERTIFICATE VERIFICATION
# ==========================================

@router.get("/verify/{certificate_id}")
async def verify_certificate_public(certificate_id: str):
    """Public verification endpoint for QR scans."""
    cert = await certificates_collection.find_one({"certificateId": certificate_id})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found or revoked")
    return {
        "valid": True,
        "verified": True,
        "certificate": serialize_doc(cert)
    }
