"""
Database Session and Engine Management Module
"""
from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from app.core.config import settings

engine: Optional[AsyncEngine] = None
AsyncSessionLocal: Optional[async_sessionmaker[AsyncSession]] = None
_init_error: Optional[Exception] = None

# Engine configuration tailored for cloud serverless/container PostgreSQL pools (Render/Neon/Supabase)
try:
    engine = create_async_engine(
        settings.ASYNC_DATABASE_URL,
        echo=settings.DEBUG,
        future=True,
        pool_size=5,          # Low connection footprint for free-tier databases
        max_overflow=10,
        pool_pre_ping=True,   # Verify connection health before issuing queries
        pool_recycle=300,     # Recycle connection every 5 mins to prevent stale drops
    )

    AsyncSessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )
except Exception as err:
    # Allows app (health probe, docs) to start even if asyncpg is not yet installed in local dev
    engine = None
    AsyncSessionLocal = None
    _init_error = err


import time
import socket
from urllib.parse import urlparse

_db_offline_until: float = 0.0


def _is_db_reachable() -> bool:
    """Lightweight 80ms TCP probe to test if PostgreSQL port is listening before asyncpg binds."""
    try:
        url_clean = str(settings.ASYNC_DATABASE_URL).replace("postgresql+asyncpg://", "http://").replace("postgresql://", "http://")
        parsed = urlparse(url_clean)
        host = parsed.hostname or "127.0.0.1"
        port = parsed.port or 5432
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.08)
        s.connect((host, port))
        s.close()
        return True
    except Exception:
        return False


async def get_db() -> AsyncGenerator[Optional[AsyncSession], None]:
    """
    FastAPI dependency that provides an asynchronous database session.
    Automatically commits on success or rolls back on unhandled exceptions.
    Yields None instantly if database is unreachable (enables seamless offline demo mode).
    """
    global _db_offline_until
    if AsyncSessionLocal is None:
        yield None
        return

    now = time.time()
    if now < _db_offline_until:
        # PostgreSQL was recently confirmed offline; yield None immediately with zero latency
        yield None
        return

    if not _is_db_reachable():
        _db_offline_until = time.time() + 30.0  # Cache offline status for 30 seconds
        yield None
        return

    session = None
    try:
        session = AsyncSessionLocal()
        yield session
        await session.commit()
    except Exception:
        if session:
            await session.rollback()
        raise
    finally:
        if session:
            await session.close()
