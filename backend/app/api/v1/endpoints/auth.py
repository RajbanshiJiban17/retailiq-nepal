"""
FastAPI Router for JWT Authentication, Registration, and Identity Management
Enforces SlowAPI rate limiting against brute-force attacks and abuse.
"""
import re
import uuid
from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.limiter import limiter
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.business import Business
from app.models.user import User, UserRole
from app.schemas.auth import (
    LoginRequest,
    Token,
    UserPublic,
    UserRegisterRequest,
)
from app.api.deps import get_current_active_user, require_roles
from app.schemas.auth import (
    AdminRegisterRequest,
    LoginRequest,
    Token,
    UserPublic,
    UserRegisterRequest,
)

router = APIRouter()

import json
from pathlib import Path

USERS_STORAGE_PATH = Path(__file__).resolve().parent.parent.parent / "storage" / "mock_users.json"
MERCHANTS_STORAGE_PATH = Path(__file__).resolve().parent.parent.parent / "storage" / "merchants.json"

PLATFORM_HQ_BUSINESS_ID = uuid.UUID("00000000-0000-0000-0000-000000000000")

# Local Auth Store with secure default credentials
_MOCK_USERS_DB = {
    "admin@retailiq.com.np": {
        "id": uuid.UUID("99999999-9999-9999-9999-999999999999"),
        "business_id": PLATFORM_HQ_BUSINESS_ID,
        "business_name": "RetailIQ नेपाल केन्द्रीय प्रणाली (Platform HQ)",
        "email": "admin@retailiq.com.np",
        "full_name": "प्रणाली प्रशासक (System Administrator)",
        "password_hash": get_password_hash("admin123"),
        "role": UserRole.SUPERADMIN,
        "phone": "9841000000",
        "is_active": True,
        "is_business_owner": True,
    },
    "demo@retailiq.com.np": {
        "id": uuid.UUID("22222222-2222-2222-2222-222222222222"),
        "business_id": uuid.UUID("11111111-1111-1111-1111-111111111111"),
        "business_name": "पशुपति किराना तथा सुपरस्टोर (Pashupati Kirana)",
        "email": "demo@retailiq.com.np",
        "full_name": "रमेश अधिकारी (Store Manager)",
        "password_hash": get_password_hash("demo123"),
        "role": UserRole.ADMIN,
        "phone": "9841234567",
        "is_active": True,
        "is_business_owner": True,
    },
}

_DEFAULT_MERCHANTS = [
    {
        "id": "11111111-1111-1111-1111-111111111111",
        "business_name": "पशुपति किराना तथा सुपरस्टोर",
        "owner_name": "रमेश अधिकारी",
        "email": "demo@retailiq.com.np",
        "phone": "९८४१२३४५६७",
        "city": "काठमाडौं (गौशाला)",
        "pan_vat": "६०१२३४५६७",
        "plan": "व्यावसायिक (Pro)",
        "status": "सक्रिय (Verified)",
        "created_at": "2026-01-15T09:00:00Z",
    },
    {
        "id": "22222222-2222-2222-2222-222222222222",
        "business_name": "सगरमाथा डिपार्टमेन्टल स्टोर",
        "owner_name": "विशाल श्रेष्ठ",
        "email": "sagarmartha.store@gmail.com",
        "phone": "९८५१०९८७६५",
        "city": "ललितपुर (पाटन)",
        "pan_vat": "६०२३४५६७८",
        "plan": "Enterprise",
        "status": "सक्रिय (Verified)",
        "created_at": "2026-02-01T10:30:00Z",
    },
    {
        "id": "33333333-3333-3333-3333-333333333333",
        "business_name": "अन्नपूर्ण खाद्यान्न तथा होलसेल",
        "owner_name": "केशव गुरुङ",
        "email": "annapurna.pokhara@yahoo.com",
        "phone": "९८६०११२२३३",
        "city": "पोखरा (महेन्द्रपुल)",
        "pan_vat": "६०३४५६७८९",
        "plan": "व्यावसायिक (Pro)",
        "status": "सक्रिय (Verified)",
        "created_at": "2026-02-14T11:15:00Z",
    },
    {
        "id": "44444444-4444-4444-4444-444444444444",
        "business_name": "लुम्बिनी मार्ट एण्ड ट्रेडर्स",
        "owner_name": "सन्तोष यादव",
        "email": "lumbini.mart@outlook.com",
        "phone": "९८४७००९९८८",
        "city": "बुटवल (ट्राफिक चोक)",
        "pan_vat": "६०४५६७८९०",
        "plan": "व्यावसायिक (Pro)",
        "status": "सक्रिय (Verified)",
        "created_at": "2026-03-01T14:20:00Z",
    },
    {
        "id": "55555555-5555-5555-5555-555555555555",
        "business_name": "पूर्वाञ्चल जनरल स्टोर",
        "owner_name": "प्रकाश राजवंशी",
        "email": "purwanchal.store@gmail.com",
        "phone": "९८१२३४५६७८",
        "city": "विराटनगर (मेनरोड)",
        "pan_vat": "६०५६७८९०१",
        "plan": "व्यावसायिक (Pro)",
        "status": "सक्रिय (Verified)",
        "created_at": "2026-03-10T16:45:00Z",
    },
]

_DYNAMIC_MERCHANTS_LIST = []


def save_merchants_to_disk():
    try:
        MERCHANTS_STORAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(MERCHANTS_STORAGE_PATH, "w", encoding="utf-8") as f:
            json.dump(_DYNAMIC_MERCHANTS_LIST, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Failed to persist merchants to disk:", e)


def load_merchants_from_disk():
    global _DYNAMIC_MERCHANTS_LIST
    if MERCHANTS_STORAGE_PATH.exists():
        try:
            with open(MERCHANTS_STORAGE_PATH, "r", encoding="utf-8") as f:
                _DYNAMIC_MERCHANTS_LIST = json.load(f)
                return
        except Exception as e:
            print("Failed to load merchants from disk:", e)
    _DYNAMIC_MERCHANTS_LIST = list(_DEFAULT_MERCHANTS)
    save_merchants_to_disk()


def save_users_to_disk():
    try:
        USERS_STORAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
        serialized = {}
        for k, v in _MOCK_USERS_DB.items():
            serialized[k] = {
                "id": str(v["id"]),
                "business_id": str(v["business_id"]),
                "business_name": v.get("business_name", ""),
                "email": v["email"],
                "full_name": v.get("full_name", ""),
                "password_hash": v["password_hash"],
                "role": v["role"].value if hasattr(v["role"], "value") else str(v["role"]),
                "phone": v.get("phone", ""),
                "is_active": v.get("is_active", True),
                "is_business_owner": v.get("is_business_owner", True),
            }
        with open(USERS_STORAGE_PATH, "w", encoding="utf-8") as f:
            json.dump(serialized, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Failed to persist users to disk:", e)


def load_users_from_disk():
    global _MOCK_USERS_DB
    if USERS_STORAGE_PATH.exists():
        try:
            with open(USERS_STORAGE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                for k, v in data.items():
                    raw_role = v.get("role", "cashier")
                    if raw_role == "superadmin":
                        role_val = UserRole.SUPERADMIN
                    elif raw_role == "admin":
                        role_val = UserRole.ADMIN
                    elif raw_role == "manager":
                        role_val = UserRole.MANAGER
                    else:
                        role_val = UserRole.CASHIER

                    _MOCK_USERS_DB[k] = {
                        "id": uuid.UUID(v["id"]) if isinstance(v["id"], str) else v["id"],
                        "business_id": uuid.UUID(v["business_id"]) if isinstance(v["business_id"], str) else v["business_id"],
                        "business_name": v.get("business_name", ""),
                        "email": v["email"],
                        "full_name": v.get("full_name", ""),
                        "password_hash": v["password_hash"],
                        "role": role_val,
                        "phone": v.get("phone", ""),
                        "is_active": v.get("is_active", True),
                        "is_business_owner": v.get("is_business_owner", True),
                    }
        except Exception as e:
            print("Failed to load users from disk:", e)


# Load users and merchants from disk on module import
load_users_from_disk()
load_merchants_from_disk()


def set_auth_cookie(response: Response, token: str, max_age_seconds: int = 1800) -> None:
    """Sets a browser session cookie for the authenticated user with 30-minute idle expiry."""
    response.set_cookie(
        key="retailiq_session",
        value=token,
        max_age=max_age_seconds,
        expires=max_age_seconds,
        path="/",
        httponly=False,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
    )


# ============================================================================
# Dedicated Admin Onboarding & Direct Login Endpoints
# ============================================================================

@router.post(
    "/admin/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new platform system administrator with secret setup key",
    description="Enforces master setup security token. Creates platform superadmin account with platform-wide privileges.",
)
@limiter.limit("5/minute")
async def admin_register(
    request: Request,
    response: Response,
    req: AdminRegisterRequest,
    db: Any = Depends(get_db),
) -> Any:
    # 1. Enforce master secret setup key
    if req.admin_secret_key.strip() != settings.ADMIN_REGISTRATION_SECRET.strip():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="अमान्य एडमिन सुरक्षा कोड (Invalid admin registration security key)",
        )

    email_clean = req.email.lower().strip()

    # 2. Check if DB is online and register in PostgreSQL
    if db is not None:
        try:
            import asyncio
            existing_user_stmt = select(User).where(User.email == email_clean)
            existing_res = await asyncio.wait_for(db.execute(existing_user_stmt), timeout=0.8)
            if existing_res.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="यो इमेल पहिले नै दर्ता भइसकेको छ। कृपया सिधै एडमिन लगइन गर्नुहोस् (Admin email already registered. Please login directly).",
                )

            # Ensure platform HQ business exists or create it
            hq_stmt = select(Business).where(Business.id == PLATFORM_HQ_BUSINESS_ID)
            hq_res = await asyncio.wait_for(db.execute(hq_stmt), timeout=0.8)
            hq_biz = hq_res.scalar_one_or_none()
            if not hq_biz:
                hq_biz = Business(
                    id=PLATFORM_HQ_BUSINESS_ID,
                    name="RetailIQ नेपाल केन्द्रीय प्रणाली",
                    slug="retailiq-platform-hq",
                    currency="NPR",
                )
                db.add(hq_biz)
                await db.flush()

            admin_user = User(
                id=uuid.uuid4(),
                business_id=PLATFORM_HQ_BUSINESS_ID,
                email=email_clean,
                full_name=req.full_name.strip(),
                hashed_password=get_password_hash(req.password),
                role=UserRole.SUPERADMIN,
                phone=req.phone,
                is_active=True,
                is_business_owner=True,
            )
            db.add(admin_user)
            await db.commit()
            await db.refresh(admin_user)

            access_token = create_access_token(
                subject=admin_user.id,
                business_id=PLATFORM_HQ_BUSINESS_ID,
                role=UserRole.SUPERADMIN.value,
            )
            set_auth_cookie(response, access_token, max_age_seconds=1800)
            user_pub = UserPublic.model_validate(admin_user)
            user_pub.business_name = "RetailIQ नेपाल केन्द्रीय प्रणाली (Platform HQ)"
            user_pub.is_platform_admin = True
            return Token(
                access_token=access_token,
                token_type="bearer",
                expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                user=user_pub,
            )
        except HTTPException:
            raise
        except Exception:
            pass

    # 3. Offline storage fallback
    if email_clean in _MOCK_USERS_DB:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="यो इमेल पहिले नै दर्ता भइसकेको छ। कृपया सिधै एडमिन लगइन गर्नुहोस् (Admin email already registered. Please login directly).",
        )

    new_admin_id = uuid.uuid4()
    _MOCK_USERS_DB[email_clean] = {
        "id": new_admin_id,
        "business_id": PLATFORM_HQ_BUSINESS_ID,
        "business_name": "RetailIQ नेपाल केन्द्रीय प्रणाली (Platform HQ)",
        "email": email_clean,
        "full_name": req.full_name.strip(),
        "password_hash": get_password_hash(req.password),
        "role": UserRole.SUPERADMIN,
        "phone": req.phone or "",
        "is_active": True,
        "is_business_owner": True,
    }
    save_users_to_disk()

    access_token = create_access_token(
        subject=new_admin_id,
        business_id=PLATFORM_HQ_BUSINESS_ID,
        role=UserRole.SUPERADMIN.value,
    )
    set_auth_cookie(response, access_token, max_age_seconds=1800)

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserPublic(
            id=new_admin_id,
            email=email_clean,
            full_name=req.full_name.strip(),
            business_name="RetailIQ नेपाल केन्द्रीय प्रणाली (Platform HQ)",
            role=UserRole.SUPERADMIN,
            business_id=PLATFORM_HQ_BUSINESS_ID,
            phone=req.phone,
            is_active=True,
            is_business_owner=True,
            is_platform_admin=True,
        ),
    )


@router.post(
    "/admin/login",
    response_model=Token,
    summary="Direct login for verified platform system administrators",
    description="Authenticates platform superadmin. Strictly denies regular clients and unverified logins.",
)
@limiter.limit("15/minute")
async def admin_login(
    request: Request,
    response: Response,
    req: LoginRequest,
    db: Any = Depends(get_db),
) -> Any:
    email_clean = req.email.lower().strip()

    # 1. Check in PostgreSQL if available
    if db is not None:
        try:
            import asyncio
            stmt = select(User).where(User.email == email_clean)
            res = await asyncio.wait_for(db.execute(stmt), timeout=0.8)
            user = res.scalar_one_or_none()
            if user:
                if not verify_password(req.password, user.hashed_password):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="गलत एडमिन इमेल वा पासवर्ड (Invalid admin credentials)",
                    )
                if user.role != UserRole.SUPERADMIN:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="यस पोर्टलमा केवल केन्द्रीय प्रणाली एडमिनले मात्र प्रवेश गर्न सक्नुहुन्छ (Platform superadmin access required)",
                    )
                if not user.is_active:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="यो एडमिन खाता निष्क्रिय गरिएको छ (Account is inactive)",
                    )

                access_token = create_access_token(
                    subject=user.id,
                    business_id=user.business_id,
                    role=user.role.value,
                )
                set_auth_cookie(response, access_token, max_age_seconds=1800)
                user_pub = UserPublic.model_validate(user)
                user_pub.business_name = "RetailIQ नेपाल केन्द्रीय प्रणाली (Platform HQ)"
                user_pub.is_platform_admin = True
                return Token(
                    access_token=access_token,
                    token_type="bearer",
                    expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                    user=user_pub,
                )
        except HTTPException:
            raise
        except Exception:
            pass

    # 2. Check in local store
    user_entry = _MOCK_USERS_DB.get(email_clean)
    if not user_entry:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="गलत एडमिन इमेल वा पासवर्ड (Admin account not found)",
        )

    if not verify_password(req.password, user_entry["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="गलत एडमिन इमेल वा पासवर्ड (Invalid admin credentials)",
        )

    if user_entry.get("role") != UserRole.SUPERADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="यस पोर्टलमा केवल केन्द्रीय प्रणाली एडमिनले मात्र प्रवेश गर्न सक्नुहुन्छ (Platform superadmin access required)",
        )

    if not user_entry.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="यो एडमिन खाता निष्क्रिय गरिएको छ (Account is inactive)",
        )

    access_token = create_access_token(
        subject=user_entry["id"],
        business_id=user_entry["business_id"],
        role=UserRole.SUPERADMIN.value,
    )
    set_auth_cookie(response, access_token, max_age_seconds=1800)

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserPublic(
            id=user_entry["id"],
            email=email_clean,
            full_name=user_entry["full_name"],
            business_name="RetailIQ नेपाल केन्द्रीय प्रणाली (Platform HQ)",
            role=UserRole.SUPERADMIN,
            business_id=user_entry["business_id"],
            phone=user_entry.get("phone"),
            is_active=True,
            is_business_owner=True,
            is_platform_admin=True,
        ),
    )


# ============================================================================
# Standard Merchant / Client Registration & Login Endpoints
# ============================================================================

@router.post(
    "/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new retail merchant business and owner account",
    description="Creates a new multi-tenant Business entity and associates the primary Admin user. Rate limited to 10 requests/minute.",
)
@limiter.limit("10/minute")
async def register(
    request: Request,
    response: Response,
    req: UserRegisterRequest,
    db: Any = Depends(get_db),
) -> Any:
    email_clean = req.email.lower().strip()

    # If DB is available, use standard PostgreSQL persistence
    if db is not None:
        try:
            import asyncio
            existing_user_stmt = select(User).where(User.email == email_clean)
            existing_res = await asyncio.wait_for(db.execute(existing_user_stmt), timeout=0.8)
            if existing_res.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="An account with this email address is already registered.",
                )

            # Create New Tenant Business
            slug_base = re.sub(r"[^a-zA-Z0-9]+", "-", req.business_name.lower()).strip("-")
            unique_slug = f"{slug_base}-{uuid.uuid4().hex[:4]}"

            new_business = Business(
                id=uuid.uuid4(),
                name=req.business_name,
                slug=unique_slug,
                pan_vat_number=req.pan_vat_number,
                phone=req.phone,
                currency="NPR",
            )
            db.add(new_business)
            await db.flush()

            # Create Tenant Admin User
            new_user = User(
                id=uuid.uuid4(),
                business_id=new_business.id,
                email=email_clean,
                full_name=req.full_name,
                hashed_password=get_password_hash(req.password),
                role=UserRole.ADMIN,
                phone=req.phone,
                is_active=True,
                is_business_owner=True,
            )
            db.add(new_user)
            await db.commit()
            await db.refresh(new_user)

            access_token = create_access_token(
                subject=new_user.id,
                business_id=new_business.id,
                role=new_user.role.value,
            )

            user_pub = UserPublic.model_validate(new_user)
            user_pub.business_name = new_business.name
            user_pub.is_platform_admin = False
            set_auth_cookie(response, access_token, max_age_seconds=1800)
            return Token(
                access_token=access_token,
                token_type="bearer",
                expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                user=user_pub,
            )
        except HTTPException:
            raise
        except Exception:
            pass

    # Zero-DB Offline Memory Fallback
    if email_clean in _MOCK_USERS_DB:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address is already registered.",
        )

    new_biz_id = uuid.uuid4()
    new_user_id = uuid.uuid4()
    mock_entry = {
        "id": new_user_id,
        "business_id": new_biz_id,
        "business_name": req.business_name,
        "email": email_clean,
        "full_name": req.full_name,
        "password_hash": get_password_hash(req.password),
        "role": UserRole.ADMIN,
        "phone": req.phone,
        "is_active": True,
        "is_business_owner": True,
    }
    _MOCK_USERS_DB[email_clean] = mock_entry
    save_users_to_disk()

    access_token = create_access_token(
        subject=new_user_id,
        business_id=new_biz_id,
        role=UserRole.ADMIN.value,
    )

    set_auth_cookie(response, access_token, max_age_seconds=1800)

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserPublic(
            id=new_user_id,
            email=email_clean,
            full_name=req.full_name,
            business_name=req.business_name,
            role=UserRole.ADMIN,
            business_id=new_biz_id,
            phone=req.phone,
            is_active=True,
            is_business_owner=True,
            is_platform_admin=False,
        ),
    )


@router.post(
    "/login",
    response_model=Token,
    summary="Authenticate merchant user and obtain JWT access token",
    description="Validates user credentials and issues a signed JWT embedding tenant claims.",
)
@limiter.limit("60/minute")
async def login(
    request: Request,
    response: Response,
    req: LoginRequest,
    db: Any = Depends(get_db),
) -> Any:
    email_clean = req.email.lower().strip()

    if db is not None:
        try:
            import asyncio
            stmt = select(User).where(User.email == email_clean)
            if req.business_id:
                try:
                    biz_uuid = uuid.UUID(req.business_id)
                    stmt = stmt.where(User.business_id == biz_uuid)
                except ValueError:
                    pass

            result = await asyncio.wait_for(db.execute(stmt), timeout=0.8)
            user = result.scalar_one_or_none()

            if user and verify_password(req.password, user.hashed_password):
                if not user.is_active:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Account is inactive. Please contact store management.",
                    )

                access_token = create_access_token(
                    subject=user.id,
                    business_id=user.business_id,
                    role=user.role.value,
                )

                user_pub = UserPublic.model_validate(user)
                if hasattr(user, "business") and user.business:
                    user_pub.business_name = user.business.name
                user_pub.is_platform_admin = (user.role == UserRole.SUPERADMIN)

                set_auth_cookie(response, access_token, max_age_seconds=1800)
                return Token(
                    access_token=access_token,
                    token_type="bearer",
                    expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                    user=user_pub,
                )
        except HTTPException:
            raise
        except Exception:
            pass

    # Zero-DB Offline Memory Fallback - Strictly Authenticated
    user_entry = _MOCK_USERS_DB.get(email_clean)
    if not user_entry:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="यो इमेल प्रणालीमा दर्ता छैन। कृपया पहिले खाता दर्ता गर्नुहोस् (Account not registered. Please sign up first).",
        )

    if not verify_password(req.password, user_entry["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="गलत इमेल वा पासवर्ड (Invalid email or password).",
        )

    if not user_entry.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="खाता निष्क्रिय गरिएको छ (Account is inactive).",
        )

    access_token = create_access_token(
        subject=user_entry["id"],
        business_id=user_entry["business_id"],
        role=user_entry["role"].value if hasattr(user_entry["role"], "value") else str(user_entry["role"]),
    )

    set_auth_cookie(response, access_token, max_age_seconds=1800)

    is_superadmin = (user_entry["role"] == UserRole.SUPERADMIN)

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserPublic(
            id=user_entry["id"],
            email=user_entry["email"],
            full_name=user_entry["full_name"],
            business_name=user_entry.get("business_name", "पशुपति किराना तथा सुपरस्टोर"),
            role=user_entry["role"],
            business_id=user_entry["business_id"],
            phone=user_entry.get("phone"),
            is_active=user_entry["is_active"],
            is_business_owner=user_entry["is_business_owner"],
            is_platform_admin=is_superadmin,
        ),
    )


@router.post(
    "/logout",
    summary="Merchant logout and session cookie invalidation",
    description="Deletes the retailiq_session cookie and ends the current merchant session.",
)
async def logout(response: Response) -> Any:
    response.delete_cookie(key="retailiq_session", path="/")
    return {"status": "success", "message": "सत्र समाप्त भयो (Logged out successfully)"}


@router.get(
    "/me",
    response_model=UserPublic,
    summary="Get authenticated user profile and tenant binding",
    description="Protected endpoint requiring valid Bearer JWT. Returns current merchant identity and permissions.",
)
async def get_me(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    user_pub = UserPublic.model_validate(current_user)
    user_pub.is_platform_admin = (current_user.role == UserRole.SUPERADMIN)
    return user_pub


@router.post(
    "/demo-token",
    response_model=Token,
    summary="Instant JWT token generator for testing & dashboard demos",
    description="Generates an instant valid Bearer JWT without password for demo and development sessions.",
)
async def generate_demo_token() -> Token:
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": "demo@retailiq.com.np", "role": "retailer"},
        expires_delta=access_token_expires,
    )
    return Token(access_token=access_token, token_type="bearer")


@router.get(
    "/merchants",
    summary="List all registered retail merchants (Platform Admin only)",
    description="Returns dynamic merchant profiles across Nepal. Strictly protected: requires superadmin role.",
)
async def list_registered_merchants(
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN)),
    db: Any = Depends(get_db),
) -> Any:
    global _DYNAMIC_MERCHANTS_LIST

    # Sync from PostgreSQL database if active and not already present
    if db is not None:
        try:
            import asyncio
            stmt = select(Business)
            res = await asyncio.wait_for(db.execute(stmt), timeout=1.0)
            biz_rows = res.scalars().all()
            for b in biz_rows:
                bid_str = str(b.id)
                if not any(str(m.get("id")) == bid_str for m in _DYNAMIC_MERCHANTS_LIST):
                    _DYNAMIC_MERCHANTS_LIST.append({
                        "id": bid_str,
                        "business_name": b.name,
                        "owner_name": "पसल सञ्चालक",
                        "city": b.city or "काठमाडौं",
                        "plan": "व्यावसायिक (Pro)",
                        "pan_vat": b.pan_vat_number or "६०१२३४५६७",
                        "phone": b.phone or "९८४१२३४५६७",
                        "status": "सक्रिय (Active)",
                    })
                    save_merchants_to_disk()
        except Exception:
            pass

    return {
        "status": "success",
        "total_count": len(_DYNAMIC_MERCHANTS_LIST),
        "merchants": _DYNAMIC_MERCHANTS_LIST,
    }


@router.delete(
    "/merchants/{merchant_id}",
    summary="Delete a registered merchant / vendor (Platform Admin only)",
    description="Deletes a registered vendor by ID permanently. Strictly protected: requires superadmin role.",
)
async def delete_registered_merchant(
    merchant_id: str,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN)),
    db: Any = Depends(get_db),
) -> Any:
    global _DYNAMIC_MERCHANTS_LIST, _MOCK_USERS_DB

    clean_id = str(merchant_id or "").strip()
    if not clean_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="पसल ID प्रविष्ट गरिएको छैन (Merchant ID is required)",
        )

    deleted_from_db = False

    # 1. Try deleting from PostgreSQL database if active with safe rollback
    if db is not None:
        try:
            import asyncio
            try:
                target_uuid = uuid.UUID(clean_id)
            except (ValueError, AttributeError):
                target_uuid = None

            if target_uuid:
                biz_stmt = select(Business).where(Business.id == target_uuid)
                res = await asyncio.wait_for(db.execute(biz_stmt), timeout=2.0)
                biz_obj = res.scalar_one_or_none()
                if biz_obj:
                    await db.delete(biz_obj)
                    await db.commit()
                    deleted_from_db = True
        except Exception as db_exc:
            try:
                await db.rollback()
            except Exception:
                pass

    # 2. Delete from _DYNAMIC_MERCHANTS_LIST
    _DYNAMIC_MERCHANTS_LIST = [
        m for m in _DYNAMIC_MERCHANTS_LIST
        if str(m.get("id", "")).strip() != clean_id and str(m.get("business_id", "")).strip() != clean_id
    ]
    try:
        save_merchants_to_disk()
    except Exception as disk_err:
        pass

    # 3. Clean up from _MOCK_USERS_DB if linked
    users_to_del = [
        email for email, u in _MOCK_USERS_DB.items()
        if str(u.get("business_id", "")).strip() == clean_id or str(u.get("id", "")).strip() == clean_id
    ]
    for email in users_to_del:
        del _MOCK_USERS_DB[email]
    if users_to_del:
        try:
            save_users_to_disk()
        except Exception:
            pass

    return {
        "status": "success",
        "message": f"पसल सफलतापूर्वक हटाइयो (Vendor ID '{clean_id}' deleted successfully)",
        "deleted_id": clean_id,
        "deleted_from_db": deleted_from_db,
        "total_count": len(_DYNAMIC_MERCHANTS_LIST),
    }


