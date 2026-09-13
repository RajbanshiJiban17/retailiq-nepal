import time
from fastapi import APIRouter
from app.core.config import settings
from app.schemas.health import HealthCheckResponse
from app import __version__

router = APIRouter()

# Service start timestamp for uptime calculation
_START_TIME = time.time()


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="Health check and keepalive probe",
    description="Returns operational health status, version, uptime, and system metadata. Optimized for Render health checks.",
)
async def health_check() -> HealthCheckResponse:
    uptime = round(time.time() - _START_TIME, 2)
    return HealthCheckResponse(
        status="healthy",
        project_name=settings.PROJECT_NAME,
        version=__version__,
        environment=settings.ENVIRONMENT,
        uptime_seconds=uptime,
    )
