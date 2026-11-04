"""Signed session tokens (HMAC-SHA256). Passwords are checked in Postgres with bcrypt via verify_login()."""
import base64
import hashlib
import hmac
import json
import os
import time

from app.core.config import SUPABASE_KEY

SECRET = (os.getenv("AUTH_SECRET") or hashlib.sha256(f"campusai::{SUPABASE_KEY}".encode()).hexdigest()).encode()
TTL_SECONDS = 7 * 24 * 3600


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def issue(user_id: str) -> str:
    body = _b64(json.dumps({"uid": user_id, "exp": int(time.time()) + TTL_SECONDS}).encode())
    sig = _b64(hmac.new(SECRET, body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def verify(token: str) -> str | None:
    try:
        body, sig = token.split(".", 1)
        expected = _b64(hmac.new(SECRET, body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        data = json.loads(_unb64(body))
        return data["uid"] if data.get("exp", 0) > time.time() else None
    except Exception:
        return None
