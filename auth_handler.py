import os
import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Set
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from config import settings

# Password hashing setup using passlib + bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT configuration
JWT_SECRET = settings.jwt_secret
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Security scheme for FastAPI dependencies and OpenAPI/Swagger documentation
# scheme_name="JWTBearer" ensures Swagger displays "Authorize (JWTBearer)"
security_scheme = HTTPBearer(
    scheme_name="JWTBearer",
    description="Enter your JWT Bearer token (obtained from /api/auth/login or /api/auth/admin/verify)",
    auto_error=False
)

# Legitimate platform roles
ADMIN_ROLES: Set[str] = {"ADMIN", "MAIN_ADMIN", "SUPER_ADMIN", "SUPPORT_TEAM", "EMPLOYEE", "STAFF"}
HR_ROLES: Set[str] = {"HR", "RECRUITER"}
STUDENT_ROLES: Set[str] = {"STUDENT", "USER"}

def get_known_secrets() -> list:
    """Retrieve configured JWT secrets from environment without hardcoded strings in code."""
    secrets = []
    if settings.jwt_secret:
        secrets.append(settings.jwt_secret)
    sec_env = getattr(settings, "secondary_jwt_secrets", None) or os.getenv("SECONDARY_JWT_SECRETS", "")
    if sec_env:
        for s in sec_env.split(","):
            s_clean = s.strip()
            if s_clean and s_clean not in secrets:
                secrets.append(s_clean)
    return secrets

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
    """Create a standard JWT access token containing the provided payload data."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decode a JWT access token and return the payload if valid."""
    if not token or not isinstance(token, str):
        return None

    clean_token = token.strip()
    if clean_token.lower().startswith("bearer "):
        clean_token = clean_token[7:].strip()

    # 1. Attempt to decode using Supabase client secret if present
    supabase_secret = getattr(settings, "supabase_client_secret", None)
    if supabase_secret:
        try:
            payload = jwt.decode(clean_token, supabase_secret, algorithms=["HS256"], options={"verify_aud": False})
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

    # 2. Attempt with known platform JWT secrets
    known_secrets = get_known_secrets()
    for secret in known_secrets:
        if not secret:
            continue
        try:
            payload = jwt.decode(clean_token, secret, algorithms=[ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except Exception:
            continue

    return None

def extract_token_from_request(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = None) -> Optional[str]:
    """Extract token from HTTPBearer credentials, Authorization header, or x-access-token."""
    if credentials and credentials.credentials:
        return credentials.credentials.strip()

    auth_header = request.headers.get("Authorization") or request.headers.get("authorization") or ""
    if auth_header:
        if auth_header.lower().startswith("bearer "):
            return auth_header[7:].strip()
        return auth_header.strip()

    alt_token = request.headers.get("x-access-token") or request.headers.get("X-Access-Token")
    if alt_token:
        return alt_token.strip()

    return None

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)
) -> dict:
    """
    FastAPI dependency to extract and verify JWT for any authenticated user (Student, HR, or Admin).
    Returns the enriched user token payload.
    Raises 401 if missing, invalid, or expired.
    """
    token = extract_token_from_request(request, credentials)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated: token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials or token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Reconcile user identity & role
    raw_role = payload.get("role")
    normalized_role = str(raw_role).strip().upper() if raw_role else "STUDENT"
    payload["role"] = normalized_role

    sub = str(payload.get("sub") or "").strip()
    user_id = str(payload.get("id") or payload.get("userId") or "").strip()
    email = str(payload.get("email") or "").strip()
    if not email and "@" in sub:
        email = sub
    payload["email"] = email
    payload["id"] = user_id or sub

    return payload

async def get_current_admin(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)
) -> dict:
    """
    FastAPI dependency to extract and verify JWT for an admin.
    Returns the token payload if valid and role is admin.
    Validates token claims, normalizes roles, and cross-checks with database if required.
    """
    token = extract_token_from_request(request, credentials)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated: token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials or token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 1. Direct role check from JWT claims
    raw_role = payload.get("role")
    normalized_role = str(raw_role).strip().upper() if raw_role else ""

    if normalized_role in ADMIN_ROLES:
        payload["role"] = normalized_role
        return payload

    # 2. Database cross-check by email or ID if role is missing or needs reconciliation
    from database import admins_collection, users_collection
    from bson import ObjectId

    sub = str(payload.get("sub") or "").strip()
    user_id = str(payload.get("id") or payload.get("userId") or "").strip()
    email = str(payload.get("email") or "").strip()

    if not email and "@" in sub:
        email = sub
    elif not user_id and sub and "@" not in sub:
        user_id = sub

    # Check in admins_collection
    admin_doc = None
    if email:
        admin_doc = await admins_collection.find_one({"email": email.lower()})
    if not admin_doc and user_id:
        try:
            admin_doc = await admins_collection.find_one({"_id": ObjectId(user_id)})
        except Exception:
            admin_doc = await admins_collection.find_one({"_id": user_id})

    if admin_doc:
        resolved_role = str(admin_doc.get("role") or "MAIN_ADMIN").strip().upper()
        payload["role"] = resolved_role
        payload["sub"] = admin_doc.get("email") or payload.get("sub")
        payload["email"] = admin_doc.get("email") or payload.get("email")
        payload["name"] = admin_doc.get("name") or admin_doc.get("full_name") or payload.get("name", "Administrator")
        return payload

    # Check in users_collection for users with admin roles
    user_doc = None
    if email:
        user_doc = await users_collection.find_one({"email": email.lower()})
    if not user_doc and user_id:
        try:
            user_doc = await users_collection.find_one({"_id": ObjectId(user_id)})
        except Exception:
            user_doc = await users_collection.find_one({"_id": user_id})

    if user_doc:
        db_role = str(user_doc.get("role") or "").strip().upper()
        if db_role in ADMIN_ROLES:
            payload["role"] = db_role
            payload["sub"] = user_doc.get("email") or payload.get("sub")
            payload["email"] = user_doc.get("email") or payload.get("email")
            payload["name"] = user_doc.get("name") or payload.get("name", "Administrator")
            return payload

    # 3. User is authenticated, but does not possess an admin role
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Forbidden: Admin role required",
    )

async def get_current_hr_or_admin(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)
) -> dict:
    """
    FastAPI dependency to extract and verify JWT for an HR recruiter or administrator.
    """
    user = await get_current_user(request, credentials)
    role = str(user.get("role", "")).upper()
    if role in HR_ROLES or role in ADMIN_ROLES:
        return user
    
    # Check DB in case role needs reconciliation
    from database import users_collection
    email = user.get("email") or user.get("sub")
    if email:
        doc = await users_collection.find_one({"email": email.lower()})
        if doc:
            db_role = str(doc.get("role", "")).upper()
            if db_role in HR_ROLES or db_role in ADMIN_ROLES:
                user["role"] = db_role
                return user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Forbidden: HR or Admin role required",
    )
