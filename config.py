from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    mongodb_uri: str
    jwt_secret: str
    google_client_id: str
    resend_api_key: str
    port: int = 8001
    host: str = "0.0.0.0"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
