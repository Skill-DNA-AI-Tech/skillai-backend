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

class Settings(BaseSettings):
    mongodb_uri: str = Field(
        default_factory=lambda: os.getenv("MONGODB_URI", "")
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
