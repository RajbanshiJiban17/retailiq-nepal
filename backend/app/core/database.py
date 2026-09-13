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


async def get_db() -> AsyncGenerator[Optional[AsyncSession], None]:
    """
    FastAPI dependency that provides an asynchronous database session.
    Automatically commits on success or rolls back on unhandled exceptions.
    Yields None if database is unreachable (enables offline demo mode).
    """
    if AsyncSessionLocal is None:
        yield None
        return

    session = None
    try:
        session = AsyncSessionLocal()
        # Test connection ping before yielding to avoid mid-request connection failure
        await session.connection()
    except Exception:
        if session:
            try:
                await session.close()
            except Exception:
                pass
        yield None
        return

    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
