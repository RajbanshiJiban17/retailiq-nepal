"""
Pydantic Schemas for JWT Authentication and User Registration
"""
import uuid
from typing import Optional
from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class UserPublic(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    business_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    is_business_owner: bool
    business_id: uuid.UUID

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int
    user: UserPublic


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    business_id: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Registered merchant user email")
    password: str = Field(..., min_length=6, description="User password")
    business_id: Optional[str] = Field(None, description="Optional tenant business UUID")


class UserRegisterRequest(BaseModel):
    email: EmailStr = Field(..., description="Store owner / admin email")
    password: str = Field(..., min_length=6, description="Password (minimum 6 characters)")
    full_name: str = Field(..., min_length=2, description="Full name in English or Devanagari")
    phone: Optional[str] = Field(None, description="Mobile contact number (+977)")
    business_name: str = Field(..., min_length=2, description="Store / Enterprise name in Nepal")
    pan_vat_number: Optional[str] = Field(None, description="9-digit IRD PAN or VAT number")
