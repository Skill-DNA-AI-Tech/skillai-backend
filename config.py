from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    mongodb_uri: str = "mongodb+srv://ajayrpatil96k:Ajay%401711@skillai.libipae.mongodb.net/test?retryWrites=true&w=majority"
    jwt_secret: str = "super_secret_jwt_key_skilldna"
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
