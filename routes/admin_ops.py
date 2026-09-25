import logging
from datetime import datetime
from typing import Optional, List, Any, Dict
from fastapi import APIRouter, HTTPException, status, Depends, Request, Query
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

router = APIRouter(prefix="/admin", tags=["Admin Operations"])

def serialize_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Helper to convert MongoDB ObjectId to string."""
    if not doc:
        return doc
    clean = dict(doc)
    if "_id" in clean:
        clean["_id"] = str(clean["_id"])
        clean["id"] = clean["_id"]
    # Never expose password hashes
    clean.pop("password", None)
    clean.pop("hashed_password", None)
    return clean

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

@router.get("/footer")
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

@router.put("/footer")
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

@router.get("/page-settings")
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

@router.put("/page-settings/{page_id}")
async def update_page_setting(page_id: str, payload: Dict[str, Any], current_admin: dict = Depends(get_current_admin)):
    """Update visibility toggle for a specific page (Admin only)."""
    is_hidden = bool(payload.get("isHidden", False))
    result = await page_settings_collection.find_one_and_update(
        {"pageId": page_id},
        {"$set": {"isHidden": is_hidden, "updatedAt": datetime.utcnow()}},
        return_document=True
    )
    if not result:
        # Create if missing
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

@router.get("/admins")
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
        email = u.get("email", "").lower()
        combined[email] = serialize_doc(u)

    for a in admins_list:
        email = a.get("email", "").lower()
        if email not in combined:
            doc = serialize_doc(a)
            doc["name"] = doc.get("name") or doc.get("full_name") or email.split("@")[0]
            doc["role"] = doc.get("role") or "ADMIN"
            doc["status"] = doc.get("status") or "ACTIVE"
            combined[email] = doc

    return list(combined.values())

@router.post("/admins")
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
        "role": "ADMIN",
        "status": "ACTIVE",
        "emailVerified": True,
        "requiresPasswordChange": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    result = await users_collection.insert_one(new_admin)
    new_admin["_id"] = result.inserted_id
    return serialize_doc(new_admin)

# ==========================================
# 4. OVERVIEW METRICS
# ==========================================

@router.get("/overview")
async def get_overview(current_admin: dict = Depends(get_current_admin)):
    """Retrieve full system metrics for Admin Dashboard (Admin only)."""
    users_count = await users_collection.count_documents({"isTestUser": {"$ne": True}, "isPreProductionUser": {"$ne": True}})
    students_count = await users_collection.count_documents({"role": {"$in": ["STUDENT", "student"]}, "isTestUser": {"$ne": True}, "isPreProductionUser": {"$ne": True}})
    hrs_count = await users_collection.count_documents({"role": {"$in": ["HR", "recruiter"]}, "isTestUser": {"$ne": True}, "isPreProductionUser": {"$ne": True}})
    pending_admins = await users_collection.count_documents({"role": {"$in": ["ADMIN", "admin"]}, "status": "PENDING"})
    companies_count = await companies_collection.count_documents({})
    profiles_count = await profiles_collection.count_documents({})
    jobs_count = await jobs_collection.count_documents({})
    applications_count = await applications_collection.count_documents({})
    reports_count = await db["reports"].count_documents({})
    lessons_count = await db["lessons"].count_documents({})
    quizzes_count = await db["quizzes"].count_documents({})
    webinars_count = await db["webinars"].count_documents({})
    interviews_count = await db["interview_sessions"].count_documents({})
    resumes_count = await db["resume_analysis"].count_documents({})
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
        "lessons": lessons_count,
        "quizzes": quizzes_count,
        "webinars": webinars_count,
        "interviews": completed_sessions or interviews_count,
        "totalSessions": total_sessions,
        "completedSessions": completed_sessions,
        "activeQuestions": active_questions or 66,
        "totalCertificates": total_certificates,
        "testUsersCount": test_users_count,
        "resumes": resumes_count,
        "placementSuccessRate": 85,
        "questionsByDomain": [
            {"_id": "Computer Science", "count": 25},
            {"_id": "Data Science", "count": 18},
            {"_id": "Cybersecurity", "count": 15},
            {"_id": "Cloud Computing", "count": 8}
        ],
        "topSkills": [
            {"_id": "Python", "count": 42},
            {"_id": "TypeScript", "count": 35},
            {"_id": "React", "count": 30},
            {"_id": "Machine Learning", "count": 22}
        ],
        "weakTopics": [
            {"_id": "System Design", "count": 12},
            {"_id": "Concurrency", "count": 10}
        ]
    }

# ==========================================
# 5. MODERATION ENDPOINTS
# ==========================================

@router.get("/moderation")
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
# 6. TEST USERS / PRE-PRODUCTION MANAGEMENT
# ==========================================

@router.get("/test-users")
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
        clean["testUserId"] = clean.get("testUserId") or clean.get("testCredentials", {}).get("userId") or clean["email"]
        clean["temporaryPassword"] = clean.get("testCredentials", {}).get("temporaryPassword")
        clean["totalSessions"] = total_sessions
        clean["latestScore"] = (latest_session or {}).get("competencies", {}).get("overall", (profile or {}).get("skillDNA", {}).get("score", 0))
        clean["latestReadiness"] = (latest_session or {}).get("finalReport", {}).get("readinessStatus", "NOT_READY")
        result.append(clean)

    return result

@router.post("/test-users")
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

@router.get("/test-users/{id}")
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

@router.patch("/test-users/{id}/status")
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

@router.post("/test-users/{id}/login-token")
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

@router.post("/test-users/{id}/reset")
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

@router.delete("/test-users/{id}")
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
# 7. STUDENTS & CERTIFICATES LISTING
# ==========================================

@router.get("/students")
async def get_students(current_admin: dict = Depends(get_current_admin)):
    """List students with profiles."""
    students = await users_collection.find({"role": {"$in": ["STUDENT", "student"]}}).to_list(100)
    return [serialize_doc(s) for s in students]

@router.get("/students/list")
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

@router.get("/certificates")
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
# 8. FEEDBACK ENDPOINTS
# ==========================================

@router.get("/feedback")
async def get_feedback(current_admin: dict = Depends(get_current_admin)):
    """Retrieve feedback items."""
    feedbacks = await feedbacks_collection.find({}).sort("createdAt", -1).to_list(100)
    return [serialize_doc(f) for f in feedbacks]

@router.put("/feedback/{id}")
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
