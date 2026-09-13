"""
Tenant Scoped User Model
"""
import enum
import uuid
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, Enum, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, TenantMixin

if TYPE_CHECKING:
    from app.models.business import Business
    from app.models.sale import Sale


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    CASHIER = "cashier"


class User(Base, TimestampMixin, TenantMixin):
    """
    User entity strictly bound to a tenant via business_id.
    """
    __tablename__ = "users"

    __table_args__ = (
        UniqueConstraint("business_id", "email", name="uq_users_business_email"),
        Index("ix_users_business_role", "business_id", "role"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role_enum", native_enum=False),
        default=UserRole.CASHIER,
        nullable=False,
    )
    phone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    is_business_owner: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Relationships
    business: Mapped["Business"] = relationship(
        "Business",
        back_populates="users",
    )
    sales_processed: Mapped[List["Sale"]] = relationship(
        "Sale",
        back_populates="cashier",
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}', business_id={self.business_id})>"
