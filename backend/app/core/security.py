import bcrypt
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional, Union
from jose import JWTError, jwt

from app.core.config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies that a plain text password matches a salted bcrypt hash."""
    try:
        pwd_bytes = plain_password.encode("utf-8")
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Generates a secure salted bcrypt hash for a password."""
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def create_access_token(
    subject: Union[str, Any],
    business_id: Union[str, Any],
    role: str = "cashier",
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Encodes a signed JWT access token embedding multi-tenant claims.
    Payload includes 'sub' (User ID), 'business_id', 'role', and expiry.
    """
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": str(subject),
        "business_id": str(business_id),
        "role": role,
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
    }

    if extra_claims:
        to_encode.update(extra_claims)

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decodes and verifies a JWT token. Raises JWTError if invalid or expired.
    """
    payload = jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )
    return payload
