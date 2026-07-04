from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    mongodb_uri: str
    jwt_secret: str
    google_client_id: str = "849754791910-kvubjul5bnqi8un3c38on96bdengsn37.apps.googleusercontent.com"
    resend_api_key: str
    supabase_client_id: str = "14e38149-5272-429d-8391-579ac67918fd"
    supabase_client_secret: str = "y3Mn3RfqC07U5IWMX4tJHcBe2JR-i5zW9R0oCYVZQTI"
    super_admin_email: str = "team.lcoding@gmail.com"
    super_admin_password: str = "Admin@123"
    port: int = 8001
    host: str = "0.0.0.0"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
