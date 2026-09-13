"""
Tenant Business Model
"""
import uuid
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.product import Product
    from app.models.sale import Sale, SaleItem


class Business(Base, TimestampMixin):
    """
    Business (Tenant) Entity.
    Acts as the parent root for all tenant-partitioned entities.
    """
    __tablename__ = "businesses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    slug: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )
    pan_vat_number: Mapped[Optional[str]] = mapped_column(
        String(30),
        nullable=True,
        index=True,
        comment="Inland Revenue Department (IRD) Nepal PAN/VAT Number",
    )
    email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    phone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    address: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    city: Mapped[Optional[str]] = mapped_column(
        String(100),
        default="Kathmandu",
    )
    currency: Mapped[str] = mapped_column(
        String(10),
        default="NPR",
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # Tenant Relationships (All strictly partitioned by business_id)
    users: Mapped[List["User"]] = relationship(
        "User",
        back_populates="business",
        cascade="all, delete-orphan",
    )
    products: Mapped[List["Product"]] = relationship(
        "Product",
        back_populates="business",
        cascade="all, delete-orphan",
    )
    sales: Mapped[List["Sale"]] = relationship(
        "Sale",
        back_populates="business",
        cascade="all, delete-orphan",
    )
    sale_items: Mapped[List["SaleItem"]] = relationship(
        "SaleItem",
        back_populates="business",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Business(id={self.id}, name='{self.name}', slug='{self.slug}')>"
