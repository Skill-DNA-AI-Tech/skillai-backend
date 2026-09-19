import logging
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

logger = logging.getLogger(__name__)

# Initialize MongoDB Async Client
client = AsyncIOMotorClient(settings.mongodb_uri)

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

async def init_db():
    """
    Initialize database indexes:
    - Unique index on user and admin emails
    - TTL index on otp_logs (expires_at) for automatic garbage collection of expired OTPs
    - Verify super admin account exists without deleting real users or existing admins
    """
    try:
        # User unique email index
        await users_collection.create_index("email", unique=True)
        # Admin unique email index
        await admins_collection.create_index("email", unique=True)
        # OTP logs TTL index (expires_at)
        # expireAfterSeconds=0 means the document expires at the exact datetime of expires_at
        await otp_logs_collection.create_index("expires_at", expireAfterSeconds=0)
        logger.info("MongoDB indexes created successfully on unified database: %s", db_name)

        from auth_handler import get_password_hash
        from datetime import datetime
        super_email = settings.super_admin_email
        super_pass = settings.super_admin_password
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
            # Ensure the password and role are correct
            await admins_collection.update_one(
                {"email": super_email},
                {"$set": {"hashed_password": hashed_pass, "role": "MAIN_ADMIN"}}
            )
            logger.info(f"Verified and updated super admin credentials: {super_email}")
    except Exception as e:
        logger.error(f"Error initializing database indexes / seeding super admin: {e}")
