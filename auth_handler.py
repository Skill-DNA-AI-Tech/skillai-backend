import jwt
from datetime import datetime, timedelta
from typing import Optional, dict
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from config import settings

# Password hashing setup using passlib + bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT configuration
JWT_SECRET = settings.jwt_secret
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Security scheme for FastAPI dependencies
security_scheme = HTTPBearer()

def get_password_hash(password: str) -> str:
    """Hash a plain text password using bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its bcrypt hash."""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token containing the provided payload data."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decode a JWT access token and return the payload if valid."""
    # 1. Attempt to decode using Supabase client secret (HS256 key)
    supabase_secret = getattr(settings, "supabase_client_secret", None)
    if supabase_secret:
        try:
            # Supabase tokens are signed with client secret and have 'authenticated' or similar audience
            payload = jwt.decode(token, supabase_secret, algorithms=["HS256"], options={"verify_aud": False})
            
            # Map Supabase claims to the custom claims expected by backend
            user_metadata = payload.get("user_metadata", {})
            mapped_payload = {
                "sub": payload.get("email") or payload.get("sub"),
                "email": payload.get("email"),
                "role": user_metadata.get("role") or payload.get("role") or "student",
                "name": user_metadata.get("name")
            }
            if mapped_payload["role"] == "authenticated":
                mapped_payload["role"] = "student"
            return mapped_payload
        except Exception:
            pass

    # 2. Fallback to custom JWT secret
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return payload
    except Exception:
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> dict:
    """
    FastAPI dependency to extract and verify JWT for a student.
    Returns the token payload if valid and role is student.
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials or token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    role = payload.get("role")
    if role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Student role required",
        )
    return payload

async def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> dict:
    """
    FastAPI dependency to extract and verify JWT for an admin.
    Returns the token payload if valid and role is admin.
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials or token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    role = payload.get("role")
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Admin role required",
        )
    return payload
