import logging
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

logger = logging.getLogger(__name__)

# Initialize MongoDB Async Client
client = AsyncIOMotorClient(settings.mongodb_uri)

# Select Database
# Extract database name from URI if present, default to 'skilldna_auth'
db_name = client.get_default_database().name if client.get_default_database() else 'skilldna_auth'
if db_name == 'admin' or not db_name:
    db_name = 'skilldna_auth'

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
    - Seed a default admin if no admins exist
    """
    try:
        # User unique email index
        await users_collection.create_index("email", unique=True)
        # Admin unique email index
        await admins_collection.create_index("email", unique=True)
        # OTP logs TTL index (expires_at)
        # expireAfterSeconds=0 means the document expires at the exact datetime of expires_at
        await otp_logs_collection.create_index("expires_at", expireAfterSeconds=0)
        logger.info("MongoDB indexes created successfully.")

        # Ensure only the specified super admin exists: delete other admins
        delete_result = await admins_collection.delete_many({"email": {"$ne": "team.lcoding@gmail.com"}})
        if delete_result.deleted_count > 0:
            logger.info(f"Deleted {delete_result.deleted_count} other admin accounts to maintain super admin exclusivity.")

        from auth_handler import get_password_hash
        from datetime import datetime
        super_email = "team.lcoding@gmail.com"
        super_pass = "Admin@123"
        hashed_pass = get_password_hash(super_pass)

        super_admin = await admins_collection.find_one({"email": super_email})
        if not super_admin:
            await admins_collection.insert_one({
                "email": super_email,
                "hashed_password": hashed_pass,
                "created_at": datetime.utcnow()
            })
            logger.info(f"Seeded super admin account: {super_email}")
        else:
            # Ensure the password is correct
            await admins_collection.update_one(
                {"email": super_email},
                {"$set": {"hashed_password": hashed_pass}}
            )
            logger.info(f"Verified and updated super admin password: {super_email}")
    except Exception as e:
        logger.error(f"Error initializing database / seeding admin: {e}")
