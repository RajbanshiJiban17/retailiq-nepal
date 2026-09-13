"""
Base Model and Reusable Multi-Tenant Mixins
"""
import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    declared_attr,
    mapped_column,
    relationship,
)

if TYPE_CHECKING:
    from app.models.business import Business


class Base(DeclarativeBase):
    """Declarative base class for all SQLAlchemy 2.0 models."""
    pass


class TimestampMixin:
    """
    Mixin adding timezone-aware audit timestamps.
    Automatically managed by the database server.
    """
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class TenantMixin:
    """
    Multi-tenant mixin strictly enforcing business_id isolation.
    Every tenant-scoped entity inherits this mixin.
    """
    @declared_attr
    def business_id(cls) -> Mapped[uuid.UUID]:
        return mapped_column(
            UUID(as_uuid=True),
            ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )

    @declared_attr
    def business(cls) -> Mapped["Business"]:
        return relationship("Business")
