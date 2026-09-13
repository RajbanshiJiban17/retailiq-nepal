"""
Tenant Scoped Sale and SaleItem Models
"""
import enum
import uuid
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import (
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, TenantMixin

if TYPE_CHECKING:
    from app.models.business import Business
    from app.models.user import User
    from app.models.product import Product


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    ESEWA = "esewa"
    KHALTI = "khalti"
    FONEPAY = "fonepay"
    BANK_CARD = "bank_card"
    CREDIT = "credit"


class PaymentStatus(str, enum.Enum):
    PAID = "paid"
    PARTIAL = "partial"
    UNPAID = "unpaid"
    REFUNDED = "refunded"


class Sale(Base, TimestampMixin, TenantMixin):
    """
    Sale transaction record strictly partitioned by business_id.
    """
    __tablename__ = "sales"

    __table_args__ = (
        # Enforce unique invoice number per tenant business
        UniqueConstraint("business_id", "invoice_number", name="uq_sales_business_invoice"),
        # Speed up date-range sales queries per business
        Index("ix_sales_business_created", "business_id", "created_at"),
        Index("ix_sales_business_payment", "business_id", "payment_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    invoice_number: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        comment="Sequential or formatted bill number unique per tenant",
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Staff member / Cashier who created this sale",
    )

    # Customer Information
    customer_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    customer_phone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    customer_pan: Mapped[Optional[str]] = mapped_column(
        String(30),
        nullable=True,
        comment="Customer PAN required in Nepal for B2B/VAT bills",
    )

    # Financial Totals in NPR
    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0.00"),
        nullable=False,
        comment="VAT amount in NPR",
    )
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )

    # Payment Details
    payment_method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod, name="payment_method_enum", native_enum=False),
        default=PaymentMethod.CASH,
        nullable=False,
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status_enum", native_enum=False),
        default=PaymentStatus.PAID,
        nullable=False,
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    business: Mapped["Business"] = relationship(
        "Business",
        back_populates="sales",
    )
    cashier: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="sales_processed",
    )
    items: Mapped[List["SaleItem"]] = relationship(
        "SaleItem",
        back_populates="sale",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Sale(id={self.id}, invoice='{self.invoice_number}', total={self.total_amount}, business_id={self.business_id})>"


class SaleItem(Base, TimestampMixin, TenantMixin):
    """
    Individual line item in a sale transaction.
    Enforces business_id for direct tenant-scoped analytical aggregation.
    """
    __tablename__ = "sale_items"

    __table_args__ = (
        Index("ix_sale_items_business_sale", "business_id", "sale_id"),
        Index("ix_sale_items_business_product", "business_id", "product_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    sale_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sales.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Historical Snapshots (Immune to future product renaming or price updates)
    product_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    product_sku: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        comment="Unit price charged at time of sale",
    )
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    tax_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        default=Decimal("13.00"),
        nullable=False,
    )
    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )

    # Relationships
    business: Mapped["Business"] = relationship(
        "Business",
        back_populates="sale_items",
    )
    sale: Mapped["Sale"] = relationship(
        "Sale",
        back_populates="items",
    )
    product: Mapped[Optional["Product"]] = relationship(
        "Product",
        back_populates="sale_items",
    )

    def __repr__(self) -> str:
        return f"<SaleItem(id={self.id}, sale_id={self.sale_id}, product='{self.product_name}', qty={self.quantity})>"
