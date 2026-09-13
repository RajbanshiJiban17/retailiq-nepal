"""
FastAPI Authentication and Authorization Dependencies
"""
import uuid
from typing import List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserRole
from app.schemas.auth import TokenPayload

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Decodes the incoming Bearer JWT, validates multi-tenant claims,
    and returns the authenticated User entity from the database.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token has expired",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        business_id: str = payload.get("business_id")
        if user_id is None or business_id is None:
            raise credentials_exception
        token_data = TokenPayload(sub=user_id, business_id=business_id)
    except (JWTError, Exception):
        raise credentials_exception

    try:
        user_uuid = uuid.UUID(token_data.sub)
        biz_uuid = uuid.UUID(token_data.business_id)
    except ValueError:
        raise credentials_exception

    stmt = select(User).where(
        User.id == user_uuid,
        User.business_id == biz_uuid,
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account. Contact store administrator.",
        )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensures user account is active."""
    return current_user


def require_roles(*allowed_roles: UserRole):
    """
    Dependency factory enforcing Role-Based Access Control (RBAC).
    Usage: Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))
    """
    async def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required role: {[r.value for r in allowed_roles]}",
            )
        return current_user

    return role_checker
