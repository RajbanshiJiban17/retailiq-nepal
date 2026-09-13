"""
Tenant Scoped Product Model
"""
import uuid
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, TenantMixin

if TYPE_CHECKING:
    from app.models.business import Business
    from app.models.sale import SaleItem


class Product(Base, TimestampMixin, TenantMixin):
    """
    Product inventory catalog entity strictly partitioned by business_id.
    """
    __tablename__ = "products"

    __table_args__ = (
        # Enforce SKU uniqueness per tenant business
        UniqueConstraint("business_id", "sku", name="uq_products_business_sku"),
        Index("ix_products_business_category", "business_id", "category"),
        Index("ix_products_business_active", "business_id", "is_active"),
        Index("ix_products_business_stock", "business_id", "stock_quantity"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    sku: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        comment="Stock Keeping Unit (Unique per business)",
    )
    barcode: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    category: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="General",
        index=True,
    )
    unit: Mapped[str] = mapped_column(
        String(50),
        default="piece",
        nullable=False,
        comment="Unit of measure: piece, kg, packet, litre, box",
    )
    unit_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
        comment="Purchase cost in NPR",
    )
    selling_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        comment="Standard retail selling price in NPR",
    )
    stock_quantity: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    reorder_level: Mapped[int] = mapped_column(
        Integer,
        default=10,
        nullable=False,
        comment="Low stock alert trigger threshold",
    )
    vat_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        default=Decimal("13.00"),
        nullable=False,
        comment="Standard Nepal VAT 13.00% or 0.00% for exempt items",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # Relationships
    business: Mapped["Business"] = relationship(
        "Business",
        back_populates="products",
    )
    sale_items: Mapped[List["SaleItem"]] = relationship(
        "SaleItem",
        back_populates="product",
    )

    def __repr__(self) -> str:
        return f"<Product(id={self.id}, sku='{self.sku}', name='{self.name}', business_id={self.business_id})>"
