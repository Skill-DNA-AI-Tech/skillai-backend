import hashlib
import random
import logging
from datetime import datetime, timedelta
import requests

from fastapi import APIRouter, HTTPException, status, Depends, Request
from fastapi.concurrency import run_in_threadpool

from database import users_collection, otp_logs_collection, login_logs_collection
from schemas import (
    StudentRegister,
    StudentLogin,
    GoogleLoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
    MessageResponse
)
from auth_handler import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user
)
from email_handler import send_otp_email
from config import settings

router = APIRouter(prefix="/auth", tags=["Student Authentication"])
logger = logging.getLogger(__name__)

# Secure random generator for OTP
sys_random = random.SystemRandom()

@router.post("/register", response_model=TokenResponse)
async def register(payload: StudentRegister, request: Request):
    """
    Register a new student with Name, Email, and Password.
    Hashes password using bcrypt, stores user, and returns JWT token.
    """
    email = payload.email.lower()
    
    # Check if user already exists
    existing_user = await users_collection.find_one({"email": email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    # Hash the password and save
    hashed_password = get_password_hash(payload.password)
    new_user = {
        "name": payload.name,
        "email": email,
        "hashed_password": hashed_password,
        "google_id": None,
        "role": "student",
        "created_at": datetime.utcnow()
    }
    
    result = await users_collection.insert_one(new_user)
    new_user["_id"] = result.inserted_id

    # Generate JWT
    token_data = {
        "sub": email,
        "role": "student",
        "name": payload.name
    }
    access_token = create_access_token(data=token_data)

    # Log successful registration login
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await login_logs_collection.insert_one({
        "email": email,
        "role": "student",
        "ip_address": ip_address,
        "user_agent": user_agent,
        "status": "success",
        "created_at": datetime.utcnow()
    })

    user_response = UserResponse(
        id=str(new_user["_id"]),
        name=new_user["name"],
        email=new_user["email"],
        role=new_user["role"],
        created_at=new_user["created_at"]
    )
    return TokenResponse(access_token=access_token, user=user_response)

@router.post("/login", response_model=TokenResponse)
async def login(payload: StudentLogin, request: Request):
    """
    Authenticate student via Email and Password.
    Returns JWT token upon successful credentials verification.
    """
    email = payload.email.lower()
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    user = await users_collection.find_one({"email": email})
    
    if not user or not user.get("hashed_password") or not verify_password(payload.password, user["hashed_password"]):
        # Log failure
        await login_logs_collection.insert_one({
            "email": email,
            "role": "student",
            "ip_address": ip_address,
            "user_agent": user_agent,
            "status": "failed",
            "created_at": datetime.utcnow()
        })
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    # Generate JWT
    token_data = {
        "sub": email,
        "role": "student",
        "name": user["name"]
    }
    access_token = create_access_token(data=token_data)

    # Log success
    await login_logs_collection.insert_one({
        "email": email,
        "role": "student",
        "ip_address": ip_address,
        "user_agent": user_agent,
        "status": "success",
        "created_at": datetime.utcnow()
    })

    user_response = UserResponse(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        role=user["role"],
        created_at=user["created_at"]
    )
    return TokenResponse(access_token=access_token, user=user_response)

@router.post("/google", response_model=TokenResponse)
async def google_login(payload: GoogleLoginRequest, request: Request):
    """
    Authenticate student via Google OAuth ID token.
    Creates account automatically if user does not exist, then issues JWT.
    """
    id_token = payload.id_token
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Verify ID token with Google API
    google_verify_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
    try:
        response = await run_in_threadpool(requests.get, google_verify_url, timeout=10)
        if response.status_code != 200:
            logger.error(f"Google token validation returned {response.status_code}: {response.text}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google OAuth token."
            )
        token_info = response.json()
    except Exception as e:
        logger.error(f"Exception during Google token verification: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to verify Google login token."
        )

    # Verify audience matches client ID
    aud = token_info.get("aud")
    if aud != settings.google_client_id:
        logger.error(f"Google token aud mismatch: expected {settings.google_client_id}, got {aud}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token audience verification failed."
        )

    email = token_info.get("email").lower()
    name = token_info.get("name", email.split("@")[0])
    google_id = token_info.get("sub")

    # Find or create user
    user = await users_collection.find_one({"email": email})
    
    if not user:
        # Create user automatically
        user = {
            "name": name,
            "email": email,
            "google_id": google_id,
            "hashed_password": None,
            "role": "student",
            "created_at": datetime.utcnow()
        }
        result = await users_collection.insert_one(user)
        user["_id"] = result.inserted_id
        logger.info(f"Automatically registered Google user: {email}")
    else:
        # User exists; verify or link Google ID
        if not user.get("google_id"):
            await users_collection.update_one(
                {"_id": user["_id"]},
                {"$set": {"google_id": google_id}}
            )
            user["google_id"] = google_id
            logger.info(f"Linked Google account for existing user: {email}")

    # Generate JWT
    token_data = {
        "sub": email,
        "role": "student",
        "name": user["name"]
    }
    access_token = create_access_token(data=token_data)

    # Log success
    await login_logs_collection.insert_one({
        "email": email,
        "role": "student",
        "ip_address": ip_address,
        "user_agent": user_agent,
        "status": "success",
        "created_at": datetime.utcnow()
    })

    user_response = UserResponse(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        role=user["role"],
        created_at=user["created_at"]
    )
    return TokenResponse(access_token=access_token, user=user_response)

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(payload: ForgotPasswordRequest):
    """
    Generate an OTP for password reset, log it, and dispatch via Resend.
    """
    email = payload.email.lower()
    
    # Check if student exists
    user = await users_collection.find_one({"email": email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account associated with this email address was found."
        )

    # Generate 6-digit OTP
    otp = f"{sys_random.randint(100000, 999999)}"
    otp_hash = hashlib.sha256(otp.encode("utf-8")).hexdigest()
    
    # Set expiration (10 minutes)
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    # Store OTP Log
    await otp_logs_collection.insert_one({
        "email": email,
        "otp_hash": otp_hash,
        "purpose": "reset_password",
        "expires_at": expires_at,
        "verified": False,
        "created_at": datetime.utcnow()
    })

    # Dispatch email via Resend
    email_sent = await send_otp_email(to_email=email, otp=otp, purpose="reset_password")
    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send OTP verification email. Please try again later."
        )

    return MessageResponse(message="Verification OTP code has been sent to your email address.")

@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(payload: ResetPasswordRequest):
    """
    Verify OTP log and reset the user's password.
    """
    email = payload.email.lower()
    otp = payload.otp
    otp_hash = hashlib.sha256(otp.encode("utf-8")).hexdigest()

    # Search for valid unverified, unexpired OTP log
    otp_log = await otp_logs_collection.find_one({
        "email": email,
        "otp_hash": otp_hash,
        "purpose": "reset_password",
        "verified": False,
        "expires_at": {"$gt": datetime.utcnow()}
    })

    if not otp_log:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The verification code is invalid, expired, or has already been used."
        )

    # Mark OTP as verified
    await otp_logs_collection.update_one(
        {"_id": otp_log["_id"]},
        {"$set": {"verified": True}}
    )

    # Hash new password
    hashed_password = get_password_hash(payload.new_password)

    # Update user password
    update_result = await users_collection.update_one(
        {"email": email},
        {"$set": {"hashed_password": hashed_password}}
    )

    if update_result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update password. Please try again."
        )

    return MessageResponse(message="Your password has been successfully reset. You can now log in.")

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """
    Fetch information about the currently logged-in student.
    Uses JWT verification dependency.
    """
    email = current_user.get("sub")
    user = await users_collection.find_one({"email": email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
        
    return UserResponse(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        role=user["role"],
        created_at=user["created_at"]
    )
