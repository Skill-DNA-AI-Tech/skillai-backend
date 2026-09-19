from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    mongodb_uri: str
    jwt_secret: str
    google_client_id: str = "849754791910-kvubjul5bnqi8un3c38on96bdengsn37.apps.googleusercontent.com"
    resend_api_key: str = ""
    supabase_client_id: str = ""
    supabase_client_secret: str = ""
    super_admin_email: str = ""
    super_admin_password: str = ""
    environment: str = "development"
    port: int = 8001
    host: str = "0.0.0.0"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
