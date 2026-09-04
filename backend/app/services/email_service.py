import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from app.core.config import get_settings

logger = logging.getLogger("skill_passport.email")


def generate_password_reset_html(
    reset_url: str,
    recipient_name: str | None = None,
    expire_minutes: int = 30,
) -> str:
    greeting = f"Hello {recipient_name}," if recipient_name else "Hello,"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #F7F5F0;
      color: #111827;
      margin: 0;
      padding: 24px;
    }}
    .container {{
      max-width: 540px;
      margin: 0 auto;
      background: #FFFFFF;
      border: 1px solid #E5E1D8;
      border-radius: 12px;
      padding: 32px 28px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    }}
    .header {{
      font-size: 20px;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
    }}
    .badge {{
      display: inline-block;
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 600;
      background: #EEF2FF;
      color: #4F46E5;
      padding: 3px 8px;
      border-radius: 4px;
      margin-bottom: 12px;
      letter-spacing: 0.05em;
    }}
    .content {{
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 24px;
    }}
    .btn-container {{
      text-align: center;
      margin: 28px 0;
    }}
    .btn {{
      display: inline-block;
      background: linear-gradient(135deg, #111827 0%, #1E293B 100%);
      color: #FFFFFF !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      padding: 12px 28px;
      border-radius: 9999px;
      box-shadow: 0 2px 8px rgba(17, 24, 39, 0.2);
    }}
    .link-alt {{
      word-break: break-all;
      font-size: 12px;
      color: #6366F1;
    }}
    .footer {{
      margin-top: 32px;
      border-top: 1px solid #F1F5F9;
      padding-top: 16px;
      font-size: 12px;
      color: #94A3B8;
      line-height: 1.5;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">Security & Access</div>
    <div class="header">Lumina Intel · Password Reset Request</div>
    <div class="content">
      <p>{greeting}</p>
      <p>We received a request to reset the password for your Lumina Intel account. Click the button below to choose a new password:</p>
    </div>
    <div class="btn-container">
      <a href="{reset_url}" class="btn" target="_blank">Reset My Password</a>
    </div>
    <div class="content">
      <p style="font-size: 12px; color: #64748B;">This link is valid for <strong>{expire_minutes} minutes</strong>. If you did not request this password reset, please ignore this email or contact support; your account remains secure.</p>
      <p style="font-size: 12px; color: #64748B;">If the button above does not work, copy and paste this link into your browser:</p>
      <p class="link-alt">{reset_url}</p>
    </div>
    <div class="footer">
      © Lumina Intel Verifiable Skill Passport Platform. Automated security notification.
    </div>
  </div>
</body>
</html>"""


def _send_smtp_sync(
    to_email: str,
    subject: str,
    html_content: str,
    plain_content: str,
) -> None:
    settings = get_settings()
    if not settings.smtp_host:
        raise ValueError("SMTP host is not configured.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    msg["To"] = to_email

    msg.attach(MIMEText(plain_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    if settings.smtp_use_ssl:
        server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=10)
    else:
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
        if settings.smtp_use_tls:
            server.starttls()

    try:
        if settings.smtp_username and settings.smtp_password:
            server.login(settings.smtp_username, settings.smtp_password)
        server.sendmail(settings.smtp_from_email, [to_email], msg.as_string())
    finally:
        try:
            server.quit()
        except Exception:
            pass


async def send_password_reset_email(
    to_email: str,
    reset_token: str,
    recipient_name: str | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    base_frontend = settings.frontend_url.rstrip("/")
    reset_url = f"{base_frontend}/?mode=reset_password&token={reset_token}"
    subject = "Reset your Lumina Intel account password"
    html_content = generate_password_reset_html(
        reset_url=reset_url,
        recipient_name=recipient_name,
        expire_minutes=settings.password_reset_expire_minutes,
    )
    plain_content = (
        f"Reset your Lumina Intel password:\n\n"
        f"Click or copy this link into your browser (expires in {settings.password_reset_expire_minutes} minutes):\n"
        f"{reset_url}\n\n"
        f"If you did not request this, please disregard this email."
    )

    if settings.smtp_host:
        try:
            await asyncio.to_thread(
                _send_smtp_sync,
                to_email,
                subject,
                html_content,
                plain_content,
            )
            logger.info("Password reset email sent via SMTP to %s", to_email)
            return {
                "sent": True,
                "mode": "smtp",
                "reset_url": reset_url,
            }
        except Exception as exc:
            logger.error("Failed to send password reset email via SMTP: %s", exc)
            # In non-production, fall back to local logging
            if settings.environment != "production":
                logger.info(
                    "[LOCAL DEV PASSWORD RESET] Recipient: %s | URL: %s",
                    to_email,
                    reset_url,
                )
                return {
                    "sent": True,
                    "mode": "local_dev",
                    "reset_url": reset_url,
                    "smtp_error": str(exc),
                }
            raise

    # Local development / mock email delivery mode
    logger.info(
        "===========================================================\n"
        " [DEV EMAIL SERVICE] PASSWORD RESET EMAIL DISPATCHED\n"
        " To: %s\n"
        " Subject: %s\n"
        " Reset URL: %s\n"
        " Token Expiration: %d minutes\n"
        "===========================================================",
        to_email,
        subject,
        reset_url,
        settings.password_reset_expire_minutes,
    )
    return {
        "sent": True,
        "mode": "local_dev",
        "reset_url": reset_url,
    }
