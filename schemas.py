from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Any
from datetime import datetime

class StudentRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)

class StudentLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleLoginRequest(BaseModel):
    id_token: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6, max_length=128)

class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str

class AdminVerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)

class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    isTestUser: Optional[bool] = False
    isPreProductionUser: Optional[bool] = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "student"
    user: UserResponse

class AdminResponse(BaseModel):
    id: str
    email: EmailStr
    role: str = "admin"
    created_at: datetime

    class Config:
        from_attributes = True

class AdminLoginResponse(BaseModel):
    message: str
    requires_otp: bool
    email: EmailStr

class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "admin"
    admin: AdminResponse

class MessageResponse(BaseModel):
    message: str

class VerifyEmailRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)

class RegisterResponse(BaseModel):
    message: str
    requires_verification: bool
    email: EmailStr
