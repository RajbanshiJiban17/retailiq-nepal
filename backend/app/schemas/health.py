from datetime import datetime
from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    status: str = Field(default="healthy", description="Operational status of backend service")
    project_name: str = Field(..., description="Application name")
    version: str = Field(..., description="Current API release version")
    environment: str = Field(..., description="Operating environment (dev/stage/prod)")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="UTC timestamp of response")
    uptime_seconds: float = Field(..., description="Number of seconds the service has been running")
