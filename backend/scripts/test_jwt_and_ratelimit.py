"""
Automated Test Suite for JWT Authentication & SlowAPI Rate Limiting
Validates password hashing, token encoding/decoding, RBAC, and rate limit triggers.
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Configure stdout for UTF-8 on Windows PowerShell
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from jose import JWTError
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.business import Business
from app.models.user import User, UserRole
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token,
)
from app.core.config import settings


class AsyncSQLiteTestSession:
    """Test adapter for synchronous SQLite database."""
    def __init__(self, sync_session):
        self._s = sync_session

    async def execute(self, stmt):
        return self._s.execute(stmt)

    def add(self, obj):
        self._s.add(obj)

    async def flush(self):
        self._s.flush()

    async def commit(self):
        self._s.commit()

    async def refresh(self, obj):
        self._s.refresh(obj)


async def run_auth_and_ratelimit_tests():
    print("=" * 65)
    print("[INFO] STARTING JWT AUTHENTICATION & SLOWAPI RATE LIMITING VALIDATION")
    print("=" * 65)

    # 1. Test Password Hashing and Bcrypt Salt Verification
    print("\n1. Testing Bcrypt Password Hashing & Verification...")
    raw_password = "PashupatiSecure#2026"
    hashed = get_password_hash(raw_password)

    assert hashed != raw_password
    assert hashed.startswith("$2b$") or hashed.startswith("$2a$"), "Hash is not a valid bcrypt format"
    assert verify_password(raw_password, hashed) is True, "Password verification failed for valid password"
    assert verify_password("WrongPassword123", hashed) is False, "Password verification failed for invalid password"
    print("  [PASS] Salted Bcrypt hashing and verification verified.")

    # 2. Test JWT Token Creation, Claims Embedding, and Expiry
    print("\n2. Testing JWT Access Token Generation & Claims Verification...")
    test_user_id = uuid.uuid4()
    test_business_id = uuid.uuid4()
    test_role = "admin"

    token = create_access_token(
        subject=test_user_id,
        business_id=test_business_id,
        role=test_role,
        expires_delta=timedelta(hours=2),
    )

    assert isinstance(token, str) and len(token) > 20
    payload = decode_access_token(token)

    assert payload["sub"] == str(test_user_id)
    assert payload["business_id"] == str(test_business_id)
    assert payload["role"] == test_role
    assert "exp" in payload
    print(f"  Token Issued: {token[:25]}... (Role: {payload['role']}, Business: {payload['business_id'][:8]}...)")
    print("  [PASS] JWT embedded multi-tenant claims (sub, business_id, role) successfully.")

    # 3. Test Token Tampering Rejection
    print("\n3. Testing Tampered & Forged Token Rejection...")
    tampered_token = token[:-5] + "XXXXX"
    tamper_caught = False
    try:
        decode_access_token(tampered_token)
    except JWTError:
        tamper_caught = True

    assert tamper_caught is True, "Security vulnerability: Tampered JWT was not rejected!"
    print("  [PASS] Tampered JWT rejected with signature verification failure.")

    # 4. Test Multi-Tenant Database User Authentication
    print("\n4. Testing Multi-Tenant User Authentication in Database...")
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SyncSession = sessionmaker(bind=engine)
    sync_session = SyncSession()
    session = AsyncSQLiteTestSession(sync_session)

    # Setup Business & User
    tenant_id = uuid.uuid4()
    biz = Business(
        id=tenant_id,
        name="पशुपति किराना स्टोर (Pashupati Kirana)",
        slug="pashupati-kirana",
        pan_vat_number="301234567",
        currency="NPR",
    )
    session.add(biz)

    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        business_id=tenant_id,
        email="owner@pashupatikirana.com.np",
        full_name="पशुपति अधिकारी",
        hashed_password=get_password_hash("KiranaOwner@123"),
        role=UserRole.ADMIN,
        is_active=True,
        is_business_owner=True,
    )
    session.add(user)
    await session.commit()

    # Simulate Login Authentication
    stmt = select(User).where(User.email == "owner@pashupatikirana.com.np")
    res = await session.execute(stmt)
    fetched_user = res.scalar_one_or_none()

    assert fetched_user is not None
    assert verify_password("KiranaOwner@123", fetched_user.hashed_password) is True
    assert verify_password("WrongPassword", fetched_user.hashed_password) is False

    auth_token = create_access_token(
        subject=fetched_user.id,
        business_id=fetched_user.business_id,
        role=fetched_user.role.value,
    )
    auth_payload = decode_access_token(auth_token)
    assert auth_payload["business_id"] == str(tenant_id)
    print("  [PASS] Merchant authentication and tenant-scoped session verified.")

    # 5. Test SlowAPI Rate Limiter Engine
    print("\n5. Testing SlowAPI Rate Limiter Core Logic...")
    from app.core.limiter import limiter
    assert limiter is not None
    assert len(limiter._default_limits) > 0
    print(f"  Limiter initialized with key function: {limiter._key_func.__name__}")
    print(f"  Default rate limit groups configured: {len(limiter._default_limits)}")
    print("  [PASS] SlowAPI limiter configuration verified.")

    # 6. Test Live Endpoint Protection & Rate Limiting via HTTP
    print("\n6. Testing Live Endpoints via HTTP (Protected Routes & 429 Limit)...")
    import urllib.request
    import urllib.error
    import json

    # A. Demo Token Generation
    demo_req = urllib.request.Request("http://localhost:8000/api/v1/auth/demo-token", method="POST")
    demo_res = urllib.request.urlopen(demo_req)
    assert demo_res.status == 200
    demo_token_data = json.loads(demo_res.read().decode())
    assert "access_token" in demo_token_data
    access_token = demo_token_data["access_token"]
    print(f"  [PASS] Acquired demo JWT token: {access_token[:25]}...")

    # B. Test Accessing /auth/me Without Token -> Expect 401
    unauth_req = urllib.request.Request("http://localhost:8000/api/v1/auth/me")
    unauth_caught = False
    try:
        urllib.request.urlopen(unauth_req)
    except urllib.error.HTTPError as e:
        if e.code == 401:
            unauth_caught = True
    assert unauth_caught is True, "Security vulnerability: /auth/me accessible without JWT!"
    print("  [PASS] Protected endpoint /auth/me blocked unauthenticated access (401 Unauthorized).")

    # C. Test Rate Limiting on /auth/login (5/minute)
    print("  Triggering rapid login requests to verify 429 Too Many Requests...")
    rate_limit_triggered = False
    for attempt in range(1, 8):
        login_body = json.dumps({"email": "baduser@example.com", "password": "WrongPassword123"}).encode()
        login_req = urllib.request.Request(
            "http://localhost:8000/api/v1/auth/login",
            data=login_body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            urllib.request.urlopen(login_req)
        except urllib.error.HTTPError as err:
            if err.code == 429:
                rate_limit_triggered = True
                print(f"  [PASS] Rate limit successfully triggered on attempt {attempt}: HTTP 429 Too Many Requests!")
                break
            elif err.code == 401:
                # Expected credential failure before limit
                pass

    assert rate_limit_triggered is True, "SlowAPI failed to trigger 429 after exceeding limit!"

    print("\n" + "=" * 65)
    print("[SUCCESS] ALL JWT AUTHENTICATION & RATE LIMITING CHECKS PASSED!")
    print("=" * 65)


if __name__ == "__main__":
    asyncio.run(run_auth_and_ratelimit_tests())
