import logging
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings, sanitize_mongodb_uri

logger = logging.getLogger(__name__)

import os

# Initialize MongoDB Async Client with sanitized URI and safe fallback
_raw_uri = sanitize_mongodb_uri(settings.mongodb_uri) if settings.mongodb_uri else ""
is_prod = (
    os.getenv("RENDER") is not None
    or os.getenv("ENVIRONMENT", "").lower() == "production"
    or getattr(settings, "environment", "").lower() == "production"
)

if not _raw_uri:
    if is_prod:
        logger.critical(
            "CRITICAL: No MongoDB URI configured in production environment! "
            "Please check MONGODB_URI, MONGO_URI, or ATLAS_URI in Render dashboard."
        )
        raise RuntimeError(
            "Production MongoDB configuration missing. "
            "Ensure MONGODB_URI (or MONGO_URI, ATLAS_URI) is set in your Render environment variables."
        )
    logger.warning("No MongoDB URI configured in local environment; falling back to mongodb://localhost:27017/test")
    _raw_uri = "mongodb://localhost:27017/test"

client = AsyncIOMotorClient(_raw_uri)

# Select Database
# Extract database name from URI if present, fallback to 'test' (single unified database)
try:
    default_db = client.get_default_database()
    db_name = default_db.name if default_db else 'test'
except Exception:
    db_name = 'test'

if not db_name or db_name == 'admin':
    db_name = 'test'

db = client[db_name]

# Collections
users_collection = db["users"]
admins_collection = db["admins"]
otp_logs_collection = db["otp_logs"]
login_logs_collection = db["login_logs"]
footers_collection = db["footers"]
page_settings_collection = db["page_settings"]
feedbacks_collection = db["feedbacks"]
companies_collection = db["companies"]
jobs_collection = db["jobs"]
certificates_collection = db["certificates"]
profiles_collection = db["profiles"]
question_bank_collection = db["questionbanks"]
question_sessions_collection = db["questioninterviewsessions"]
applications_collection = db["applications"]
career_twin_memories_collection = db["career_twin_memories"]
student_answers_collection = db["studentanswers"]
audit_logs_collection = db["audit_logs"]
certificate_templates_collection = db["certificate_templates"]
reports_collection = db["reports"]
assessments_collection = db["assessments"]
helpdesk_tickets_collection = db["helpdesk_tickets"]
student_notes_collection = db["student_notes"]
career_change_requests_collection = db["career_change_requests"]
topic_notes_collection = db["topic_notes"]
content_requests_collection = db["contentrequests"]
pdf_watermark_settings_collection = db["pdf_watermark_settings"]


async def init_db():
    """
    Initialize database indexes:
    - Unique index on user and admin emails
    - TTL index on otp_logs (expires_at) for automatic garbage collection of expired OTPs
    - Unique index on helpdesk ticketId
    - Indexes on certificates for fast verification and versioning
    - Verify super admin account exists without deleting real users or existing admins
    """
    try:
        # User unique email index
        await users_collection.create_index("email", unique=True)
        # Admin unique email index
        await admins_collection.create_index("email", unique=True)
        # OTP logs TTL index (expires_at)
        await otp_logs_collection.create_index("expires_at", expireAfterSeconds=0)
        # Helpdesk ticketId index
        await helpdesk_tickets_collection.create_index("ticketId", unique=True)
        # Certificates lookup and versioning index
        await certificates_collection.create_index([("certificateId", 1), ("isCurrentVersion", -1)])
        # Topic notes lookup index
        await topic_notes_collection.create_index([("domain", 1), ("topic", 1), ("subtopic", 1)])
        logger.info("MongoDB indexes created successfully on unified database: %s", db_name)

        from auth_handler import get_password_hash
        from datetime import datetime
        super_email = (settings.super_admin_email or "").strip().lower()
        super_pass = (settings.super_admin_password or "").strip()
        if super_email and super_pass:
            hashed_pass = get_password_hash(super_pass)
            super_admin = await admins_collection.find_one({"email": super_email})
            if not super_admin:
                await admins_collection.insert_one({
                    "email": super_email,
                    "hashed_password": hashed_pass,
                    "role": "MAIN_ADMIN",
                    "created_at": datetime.utcnow()
                })
                logger.info(f"Seeded super admin account: {super_email}")
            else:
                # Preserve existing administrator password; only assign default MAIN_ADMIN role if missing
                if not super_admin.get("role"):
                    await admins_collection.update_one(
                        {"email": super_email},
                        {"$set": {"role": "MAIN_ADMIN"}}
                    )
                logger.info(f"Verified existing super admin account (credentials preserved): {super_email}")
    except Exception as e:
        logger.error(f"Error initializing database indexes / seeding super admin: {e}")
