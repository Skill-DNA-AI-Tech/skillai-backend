from pydantic import BaseModel, Field, BeforeValidator
from typing import Annotated, Optional
from datetime import datetime

# Helper to map MongoDB ObjectId to string
PyObjectId = Annotated[str, BeforeValidator(str)]

class MongoBaseModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

class User(MongoBaseModel):
    name: str
    email: str
    hashed_password: Optional[str] = None
    google_id: Optional[str] = None
    role: str = "student"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Admin(MongoBaseModel):
    email: str
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class OTPLog(MongoBaseModel):
    email: str
    otp_hash: str
    purpose: str  # 'reset_password' | 'admin_login'
    expires_at: datetime
    verified: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class LoginLog(MongoBaseModel):
    email: str
    role: str  # 'student' | 'admin'
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    status: str  # 'success' | 'failed'
    created_at: datetime = Field(default_factory=datetime.utcnow)
