import os
import logging
from pydantic_settings import BaseSettings
from pydantic import Field
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Explicitly load .env from the backend directory and any parent directory
_backend_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_backend_dir, ".env")
if os.path.exists(_env_path):
    load_dotenv(_env_path)
load_dotenv()

def sanitize_mongodb_uri(uri: str) -> str:
    """
    Sanitize and clean MongoDB connection string.
    Removes quotes, trailing commas/semicolons, extra commas in host list,
    which prevents 'pymongo.errors.ConfigurationError: Empty host (or extra comma in host list)'.
    """
    if not uri or not isinstance(uri, str):
        return ""
    uri = uri.strip().strip("'\"").strip()
    while uri.endswith(",") or uri.endswith(";"):
        uri = uri[:-1].strip()
    if not uri.startswith("mongodb://") and not uri.startswith("mongodb+srv://"):
        return uri

    scheme, rest = uri.split("://", 1)

    slash_idx = rest.find("/")
    question_idx = rest.find("?")
    delims = [i for i in (slash_idx, question_idx) if i != -1]
    split_idx = min(delims) if delims else len(rest)

    authority = rest[:split_idx]
    path_and_query = rest[split_idx:].rstrip(",;").strip()

    if "@" in authority:
        userinfo, host_part = authority.rsplit("@", 1)
        userinfo_prefix = f"{userinfo}@"
    else:
        userinfo_prefix = ""
        host_part = authority

    hosts = [h.strip() for h in host_part.split(",") if h.strip()]
    if not hosts:
        return ""
    clean_host_part = ",".join(hosts)
    return f"{scheme}://{userinfo_prefix}{clean_host_part}{path_and_query}"


def resolve_mongodb_uri() -> str:
    """
    Check common environment variable names for MongoDB connection string:
    - MONGODB_URI
    - MONGO_URI
    - DATABASE_URL
    - MONGO_URL
    - MONGODB_URL
    - MONGODB_CONNECTION_STRING
    Sanitizes and cleans against malformed commas or quotes.
    """
    possible_keys = [
        "MONGODB_URI",
        "MONGO_URI",
        "DATABASE_URL",
        "MONGO_URL",
        "MONGODB_URL",
        "MONGODB_CONNECTION_STRING",
        "ATLAS_URI",
        "MONGODB_ATLAS_URI",
        "MONGO_ATLAS_URI",
        "MONGO_CONNECTION_STRING",
    ]
    for key in possible_keys:
        val = os.getenv(key)
        if val and val.strip():
            cleaned = sanitize_mongodb_uri(val)
            if cleaned:
                return cleaned
    return ""


class Settings(BaseSettings):
    mongodb_uri: str = Field(
        default_factory=resolve_mongodb_uri
    )
    jwt_secret: str = Field(
        default_factory=lambda: os.getenv("JWT_SECRET", "skilldna_default_jwt_secret_change_in_production")
    )
    secondary_jwt_secrets: str = Field(
        default_factory=lambda: os.getenv("SECONDARY_JWT_SECRETS", "")
    )
    google_client_id: str = Field(
        default_factory=lambda: os.getenv("GOOGLE_CLIENT_ID", "849754791910-kvubjul5bnqi8un3c38on96bdengsn37.apps.googleusercontent.com")
    )
    resend_api_key: str = Field(
        default_factory=lambda: os.getenv("RESEND_API_KEY", "")
    )
    supabase_client_id: str = Field(
        default_factory=lambda: os.getenv("SUPABASE_CLIENT_ID", "")
    )
    supabase_client_secret: str = Field(
        default_factory=lambda: os.getenv("SUPABASE_CLIENT_SECRET", "")
    )
    super_admin_email: str = Field(
        default_factory=lambda: os.getenv("SUPER_ADMIN_EMAIL", "")
    )
    super_admin_password: str = Field(
        default_factory=lambda: os.getenv("SUPER_ADMIN_PASSWORD", "")
    )
    environment: str = Field(
        default_factory=lambda: os.getenv("ENVIRONMENT", "development")
    )
    port: int = Field(
        default_factory=lambda: int(os.getenv("PORT", "8001"))
    )
    host: str = Field(
        default_factory=lambda: os.getenv("HOST", "0.0.0.0")
    )

    class Config:
        env_file = (_env_path, ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
