import hashlib
import random
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, status, Depends, Request

from database import admins_collection, otp_logs_collection, login_logs_collection
from schemas import (
    AdminLoginRequest,
    AdminVerifyOTPRequest,
    AdminLoginResponse,
    AdminTokenResponse,
    AdminResponse
)
from auth_handler import (
    verify_password,
    create_access_token,
    get_current_admin
)
from email_handler import send_otp_email

router = APIRouter(prefix="/auth/admin", tags=["Admin Authentication"])
logger = logging.getLogger(__name__)

# Secure random generator for OTP
sys_random = random.SystemRandom()

@router.post("/login", response_model=AdminLoginResponse)
async def admin_password_login(payload: AdminLoginRequest, request: Request):
    """
    Step 1 of Admin Login:
    Validate email and password. If correct, generate and send OTP via Resend.
    """
    email = payload.email.lower()
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    admin = await admins_collection.find_one({"email": email})
    
    if not admin or not verify_password(payload.password, admin["hashed_password"]):
        # Log failure
        await login_logs_collection.insert_one({
            "email": email,
            "role": "admin",
            "ip_address": ip_address,
            "user_agent": user_agent,
            "status": "failed",
            "created_at": datetime.utcnow()
        })
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect admin credentials."
        )

    # Credentials valid, generate OTP
    otp = f"{sys_random.randint(100000, 999999)}"
    otp_hash = hashlib.sha256(otp.encode("utf-8")).hexdigest()
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    # Store OTP Log
    await otp_logs_collection.insert_one({
        "email": email,
        "otp_hash": otp_hash,
        "purpose": "admin_login",
        "expires_at": expires_at,
        "verified": False,
        "created_at": datetime.utcnow()
    })

    # Dispatch OTP email via Resend
    email_sent = await send_otp_email(to_email=email, otp=otp, purpose="admin_login")
    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send admin login verification OTP. Please try again."
        )

    logger.info(f"Admin login step 1 success. OTP sent to {email}")
    return AdminLoginResponse(
        message="Credentials verified. Security verification code sent to your email.",
        requires_otp=True,
        email=email
    )

@router.post("/verify", response_model=AdminTokenResponse)
async def admin_otp_verify(payload: AdminVerifyOTPRequest, request: Request):
    """
    Step 2 of Admin Login:
    Verify the sent OTP. If correct, issue final JWT token.
    """
    email = payload.email.lower()
    otp = payload.otp
    otp_hash = hashlib.sha256(otp.encode("utf-8")).hexdigest()
    
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Search for valid unverified, unexpired OTP log
    otp_log = await otp_logs_collection.find_one({
        "email": email,
        "otp_hash": otp_hash,
        "purpose": "admin_login",
        "verified": False,
        "expires_at": {"$gt": datetime.utcnow()}
    })

    if not otp_log:
        # Log failure
        await login_logs_collection.insert_one({
            "email": email,
            "role": "admin",
            "ip_address": ip_address,
            "user_agent": user_agent,
            "status": "failed",
            "created_at": datetime.utcnow()
        })
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The verification code is invalid, expired, or has already been used."
        )

    # Fetch admin details
    admin = await admins_collection.find_one({"email": email})
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin account not found."
        )

    # Mark OTP as verified
    await otp_logs_collection.update_one(
        {"_id": otp_log["_id"]},
        {"$set": {"verified": True}}
    )

    # Generate Admin JWT
    token_data = {
        "sub": email,
        "role": "admin"
    }
    access_token = create_access_token(data=token_data)

    # Log login success
    await login_logs_collection.insert_one({
        "email": email,
        "role": "admin",
        "ip_address": ip_address,
        "user_agent": user_agent,
        "status": "success",
        "created_at": datetime.utcnow()
    })

    admin_response = AdminResponse(
        id=str(admin["_id"]),
        email=admin["email"],
        role="admin",
        created_at=admin["created_at"]
    )
    logger.info(f"Admin verified successfully. JWT issued for {email}")
    return AdminTokenResponse(access_token=access_token, admin=admin_response)

@router.get("/me", response_model=AdminResponse)
async def get_admin_me(current_admin: dict = Depends(get_current_admin)):
    """
    Fetch information about the currently logged-in admin.
    Uses JWT verification dependency.
    """
    email = current_admin.get("sub")
    admin = await admins_collection.find_one({"email": email})
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found."
        )
        
    return AdminResponse(
        id=str(admin["_id"]),
        email=admin["email"],
        role="admin",
        created_at=admin["created_at"]
    )
