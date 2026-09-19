import hashlib
import random
import logging
from datetime import datetime, timedelta
import requests

from fastapi import APIRouter, HTTPException, status, Depends, Request
from fastapi.concurrency import run_in_threadpool

from database import users_collection, otp_logs_collection, login_logs_collection, admins_collection
from schemas import (
    StudentRegister,
    StudentLogin,
    GoogleLoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
    MessageResponse,
    VerifyEmailRequest,
    RegisterResponse
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

@router.post("/register", response_model=RegisterResponse)
async def register(payload: StudentRegister, request: Request):
    """
    Register a new student.
    Hashes password, saves user as unverified, generates verification OTP, and sends email.
    """
    email = payload.email.lower()
    
    # Check if this email is an admin
    is_admin = await admins_collection.find_one({"email": email})
    if is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account is registered as an administrator. Please log in through the Admin Portal."
        )
    
    # Check if user already exists
    existing_user = await users_collection.find_one({"email": email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    # Hash the password and save with is_verified = False
    hashed_password = get_password_hash(payload.password)
    new_user = {
        "name": payload.name,
        "full_name": payload.name,
        "email": email,
        "hashed_password": hashed_password,
        "password": hashed_password,
        "google_id": None,
        "role": "student",
        "is_verified": False,
        "isTestUser": False,
        "isPreProductionUser": False,
        "created_at": datetime.utcnow()
    }
    
    result = await users_collection.insert_one(new_user)
    new_user["_id"] = result.inserted_id

    # Generate 6-digit verification OTP
    otp = f"{sys_random.randint(100000, 999999)}"
    logger.info(f"Generated secure Student Registration OTP for {email}")
    otp_hash = hashlib.sha256(otp.encode("utf-8")).hexdigest()
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    # Store OTP Log
    otp_result = await otp_logs_collection.insert_one({
        "email": email,
        "otp_hash": otp_hash,
        "purpose": "email_verification",
        "expires_at": expires_at,
        "verified": False,
        "created_at": datetime.utcnow()
    })

    # Dispatch verification email via Resend
    email_sent = await send_otp_email(to_email=email, otp=otp, purpose="email_verification")
    if not email_sent:
        logger.error(f"Failed to dispatch registration verification email to {email}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification code email. Please check your email configuration or try again later."
        )

    return RegisterResponse(
        message="Registration successful. A verification code has been sent to your email.",
        requires_verification=True,
        email=email
    )

@router.post("/login", response_model=TokenResponse)
async def login(payload: StudentLogin, request: Request):
    """
    Authenticate student via Email and Password.
    Returns JWT token upon successful credentials verification.
    """
    email = payload.email.lower()
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Look up account in users or admins collection to support unified database
    user = await users_collection.find_one({"email": email})
    if not user:
        admin_doc = await admins_collection.find_one({"email": email})
        if admin_doc:
            user = {
                "_id": admin_doc["_id"],
                "name": admin_doc.get("name") or admin_doc.get("full_name") or "Administrator",
                "email": admin_doc["email"],
                "role": admin_doc.get("role", "MAIN_ADMIN"),
                "hashed_password": admin_doc.get("hashed_password"),
                "password": admin_doc.get("password"),
                "is_verified": True,
                "isTestUser": False,
                "isPreProductionUser": False,
                "created_at": admin_doc.get("created_at") or datetime.utcnow()
            }

    password_hash = (user.get("hashed_password") or user.get("password")) if user else None
    if not user or not password_hash or not verify_password(payload.password, password_hash):
        # Log failure
        await login_logs_collection.insert_one({
            "email": email,
            "role": user.get("role", "student") if user else "unknown",
            "ip_address": ip_address,
            "user_agent": user_agent,
            "status": "failed",
            "created_at": datetime.utcnow()
        })
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    user_role = user.get("role", "student")
    isAdminAccount = user_role in ["MAIN_ADMIN", "ADMIN", "admin", "SUPER_ADMIN", "SUPPORT_TEAM"]

    # Check verification (skip check for Google OAuth or Admin accounts)
    if not isAdminAccount and not user.get("is_verified", False) and not user.get("google_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your email address has not been verified yet. Please verify your email first."
        )

    # Generate JWT
    token_data = {
        "sub": email,
        "role": user_role,
        "name": user.get("name", "User")
    }
    access_token = create_access_token(data=token_data)

    # Log success
    await login_logs_collection.insert_one({
        "email": email,
        "role": user_role,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "status": "success",
        "created_at": datetime.utcnow()
    })

    user_response = UserResponse(
        id=str(user["_id"]),
        name=user.get("name", "User"),
        email=user["email"],
        role=user_role,
        isTestUser=bool(user.get("isTestUser", False)),
        isPreProductionUser=bool(user.get("isPreProductionUser", False)),
        created_at=user.get("created_at")
    )
    return TokenResponse(access_token=access_token, role=user_role, user=user_response)

@router.post("/verify-email", response_model=TokenResponse)
async def verify_email(payload: VerifyEmailRequest, request: Request):
    """
    Verify student email registration using the sent OTP code.
    Activates the account and issues a JWT token.
    """
    email = payload.email.lower()
    otp = payload.otp
    otp_hash = hashlib.sha256(otp.encode("utf-8")).hexdigest()

    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Query valid, unverified, unexpired OTP log
    otp_log = await otp_logs_collection.find_one({
        "email": email,
        "otp_hash": otp_hash,
        "purpose": "email_verification",
        "verified": False,
        "expires_at": {"$gt": datetime.utcnow()}
    })

    if not otp_log:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The verification code is invalid, expired, or has already been used."
        )

    # Fetch user
    user = await users_collection.find_one({"email": email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found."
        )

    # Mark OTP as verified
    await otp_logs_collection.update_one(
        {"_id": otp_log["_id"]},
        {"$set": {"verified": True}}
    )

    # Mark user as verified
    await users_collection.update_one(
        {"email": email},
        {"$set": {"is_verified": True}}
    )

    # Generate JWT
    token_data = {
        "sub": email,
        "role": "student",
        "name": user["name"]
    }
    access_token = create_access_token(data=token_data)

    # Log successful verification login
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
        name=user.get("name", "User"),
        email=user["email"],
        role=user.get("role", "student"),
        isTestUser=bool(user.get("isTestUser", False)),
        isPreProductionUser=bool(user.get("isPreProductionUser", False)),
        created_at=user.get("created_at")
    )
    return TokenResponse(access_token=access_token, role=user.get("role", "student"), user=user_response)

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
    admin_doc = await admins_collection.find_one({"email": email})
    
    if not user and not admin_doc:
        # Create user automatically
        user = {
            "name": name,
            "full_name": name,
            "email": email,
            "google_id": google_id,
            "hashed_password": None,
            "role": "student",
            "is_verified": True,
            "isTestUser": False,
            "isPreProductionUser": False,
            "created_at": datetime.utcnow()
        }
        result = await users_collection.insert_one(user)
        user["_id"] = result.inserted_id
        logger.info(f"Automatically registered Google user: {email}")
    elif not user and admin_doc:
        user = {
            "_id": admin_doc["_id"],
            "name": admin_doc.get("name") or admin_doc.get("full_name") or name,
            "email": admin_doc["email"],
            "role": admin_doc.get("role", "MAIN_ADMIN"),
            "is_verified": True,
            "isTestUser": False,
            "isPreProductionUser": False,
            "created_at": admin_doc.get("created_at") or datetime.utcnow()
        }
    else:
        # User exists; verify/link Google ID and ensure is_verified is True
        update_fields = {}
        if not user.get("google_id"):
            update_fields["google_id"] = google_id
            user["google_id"] = google_id
        if not user.get("is_verified", False):
            update_fields["is_verified"] = True
            user["is_verified"] = True
        
        if update_fields:
            await users_collection.update_one(
                {"_id": user["_id"]},
                {"$set": update_fields}
            )
            logger.info(f"Updated Google credentials/verification for user: {email}")

    user_role = user.get("role", "student")

    # Generate JWT
    token_data = {
        "sub": email,
        "role": user_role,
        "name": user.get("name", name)
    }
    access_token = create_access_token(data=token_data)

    # Log success
    await login_logs_collection.insert_one({
        "email": email,
        "role": user_role,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "status": "success",
        "created_at": datetime.utcnow()
    })

    user_response = UserResponse(
        id=str(user["_id"]),
        name=user.get("name", name),
        email=user["email"],
        role=user_role,
        isTestUser=bool(user.get("isTestUser", False)),
        isPreProductionUser=bool(user.get("isPreProductionUser", False)),
        created_at=user.get("created_at")
    )
    return TokenResponse(access_token=access_token, role=user_role, user=user_response)

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
    logger.info(f"Generated secure Student Reset Password OTP for {email}")
    otp_hash = hashlib.sha256(otp.encode("utf-8")).hexdigest()
    
    # Set expiration (10 minutes)
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    # Store OTP Log
    otp_result = await otp_logs_collection.insert_one({
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
        logger.error(f"Failed to dispatch forgot password email to {email}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send password reset verification code email. Please try again later."
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

    # Update user password in both hashed_password and password for cross-runtime compatibility
    update_result = await users_collection.update_one(
        {"email": email},
        {"$set": {"hashed_password": hashed_password, "password": hashed_password}}
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
        admin_doc = await admins_collection.find_one({"email": email})
        if admin_doc:
            user = {
                "_id": admin_doc["_id"],
                "name": admin_doc.get("name") or admin_doc.get("full_name") or "Administrator",
                "email": admin_doc["email"],
                "role": admin_doc.get("role", "MAIN_ADMIN"),
                "isTestUser": False,
                "isPreProductionUser": False,
                "created_at": admin_doc.get("created_at")
            }
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
        
    return UserResponse(
        id=str(user["_id"]),
        name=user.get("name", "User"),
        email=user["email"],
        role=user.get("role", "student"),
        isTestUser=bool(user.get("isTestUser", False)),
        isPreProductionUser=bool(user.get("isPreProductionUser", False)),
        created_at=user.get("created_at")
    )
