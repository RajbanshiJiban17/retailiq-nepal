from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.limiter import limiter
from app.api.v1.router import api_router
from app import __version__


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks (e.g. init DB connection pool, cache)
    print(f"Starting {settings.PROJECT_NAME} (v{__version__}) in {settings.ENVIRONMENT} mode...")
    try:
        from app.core.database import engine
        from app.models import Base
        if engine:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            print("[DB] All database tables verified and created successfully.")
    except Exception as e:
        print(f"[DB WARN] Database table auto-init skipped: {e}")
    yield
    # Shutdown tasks
    print(f"Gracefully shutting down {settings.PROJECT_NAME}...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=__version__,
    description="Intelligent Retail & Inventory Management Engine for Nepal.",
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.DEBUG else None,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Configure Cross-Origin Resource Sharing (CORS) - Must be added first so OPTIONS preflight is answered immediately
cors_origins = list(settings.BACKEND_CORS_ORIGINS) if settings.BACKEND_CORS_ORIGINS else []
for origin in ["https://retailiq-nepal.onrender.com", "https://retailiq-nepal.vercel.app", "http://localhost:3000"]:
    if origin not in cors_origins:
        cors_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach SlowAPI Rate Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


@app.get("/", tags=["Root"])
async def root():
    """
    Root entry point. Useful for sanity checking that the server is online.
    """
    return JSONResponse(
        content={
            "app": settings.PROJECT_NAME,
            "version": __version__,
            "status": "online",
            "environment": settings.ENVIRONMENT,
            "docs": "/docs" if settings.DEBUG else "Disabled in production",
            "health": f"{settings.API_V1_STR}/health",
            "api": f"{settings.API_V1_STR}",
        }
    )


# Mount versioned API routes
app.include_router(api_router, prefix=settings.API_V1_STR)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
