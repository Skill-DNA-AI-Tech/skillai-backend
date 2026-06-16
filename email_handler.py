import logging
import requests
from fastapi.concurrency import run_in_threadpool
from config import settings

logger = logging.getLogger(__name__)

# Resend API details
RESEND_API_URL = "https://api.resend.com/emails"
SENDER = "SkillDNA Tech AI <onboarding@resend.dev>"

def _send_email_sync(to_email: str, subject: str, html_content: str) -> bool:
    """Synchronous function to POST to Resend API."""
    headers = {
        "Authorization": f"Bearer {settings.resend_api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "from": SENDER,
        "to": [to_email],
        "subject": subject,
        "html": html_content
    }
    try:
        response = requests.post(RESEND_API_URL, json=payload, headers=headers, timeout=10)
        if response.status_code in [200, 201, 202]:
            logger.info(f"Successfully sent email to {to_email} via Resend. Response: {response.json()}")
            return True
        else:
            logger.error(f"Failed to send email to {to_email}. Resend API responded with {response.status_code}: {response.text}")
            return False
    except Exception as e:
        logger.error(f"Error occurred while sending email to {to_email}: {e}")
        return False

async def send_otp_email(to_email: str, otp: str, purpose: str) -> bool:
    """
    Asynchronously send an OTP email to the user.
    Executes the sync HTTP post in FastAPI's background thread pool.
    """
    if purpose == "reset_password":
        title_text = "Password Reset Request"
        instruction_text = "You requested to reset your password. Use the verification code below to proceed:"
    elif purpose == "admin_login":
        title_text = "Admin Secure Login"
        instruction_text = "A login attempt was made for your Admin account. Use the security code below to complete the authentication:"
    else:
        title_text = "Security Verification"
        instruction_text = "Use the verification code below to verify your identity:"

    # Sleek, premium HTML email design
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title_text}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; color: #f8fafc; -webkit-font-smoothing: antialiased;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="100%" max-width="500px" border="0" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5);">
                        
                        <!-- Header / Logo -->
                        <tr>
                            <td align="center" style="padding: 32px 32px 16px 32px; border-bottom: 1px solid #334155;">
                                <div style="font-size: 24px; font-weight: 800; letter-spacing: -0.025em; background: linear-gradient(135deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: #38bdf8; display: inline-block;">
                                    SkillDNA Tech AI
                                </div>
                            </td>
                        </tr>

                        <!-- Body Content -->
                        <tr>
                            <td style="padding: 32px 32px 24px 32px;">
                                <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #ffffff;">
                                    {title_text}
                                </h2>
                                <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">
                                    {instruction_text}
                                </p>
                                
                                <!-- OTP Display Container -->
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                                    <tr>
                                        <td align="center" style="background-color: #0f172a; border: 1px solid #475569; border-radius: 12px; padding: 18px; letter-spacing: 6px;">
                                            <span style="font-size: 32px; font-weight: 800; color: #38bdf8; font-family: 'Courier New', Courier, monospace;">
                                                {otp}
                                            </span>
                                        </td>
                                    </tr>
                                </table>

                                <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                                    * This code is valid for <strong>10 minutes</strong>.
                                </p>
                                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                                    * For security, do not share this code with anyone.
                                </p>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td style="padding: 24px 32px 32px 32px; border-top: 1px solid #334155; background-color: #1e293b;">
                                <p style="margin: 0 0 8px 0; font-size: 12px; line-height: 1.4; color: #475569; text-align: center;">
                                    If you did not request this code, you can safely ignore this email. Someone may have typed your email address by mistake.
                                </p>
                                <p style="margin: 0; font-size: 12px; line-height: 1.4; color: #475569; text-align: center;">
                                    &copy; 2026 SkillDNA Tech AI. All rights reserved.
                                </p>
                            </td>
                        </tr>

                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

    subject = f"SkillDNA Tech AI - {title_text} Verification"
    return await run_in_threadpool(_send_email_sync, to_email, subject, html_content)
