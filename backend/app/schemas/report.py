"""
Pydantic Schemas for Weekly Business Performance Reports & Background Tasks
"""
import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field


class ReportStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class GenerateReportRequest(BaseModel):
    business_id: str = Field(..., description="Multi-tenant business UUID")
    reporting_days: int = Field(7, ge=1, le=90, description="Trailing period in days (default: 7 days)")
    include_ai_insights: bool = Field(True, description="Whether to include grounded Nepali AI advice")


class ReportTaskResponse(BaseModel):
    report_id: str
    business_id: str
    status: ReportStatus
    download_url: Optional[str] = None
    preview_url: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    engine_used: Optional[str] = None
    message: str


class StoreProfile(BaseModel):
    name: str
    pan_vat_number: Optional[str] = None
    address: Optional[str] = None
    city: str = "Kathmandu"
    phone: Optional[str] = None
    currency: str = "NPR"


class FinancialSummary(BaseModel):
    gross_revenue_npr: Decimal
    net_profit_npr: Decimal
    profit_margin_pct: float
    total_invoices: int
    average_order_value_npr: Decimal


class TopProductItem(BaseModel):
    sku: str
    name: str
    category: str
    quantity_sold: int
    revenue_npr: Decimal
    profit_npr: Decimal


class PaymentChannelBreakdown(BaseModel):
    method: str
    method_nepali: str
    volume_npr: Decimal
    percentage: float


class InventoryRiskSummary(BaseModel):
    dead_stock_count: int
    dead_capital_trapped_npr: Decimal
    low_stock_count: int
    out_of_stock_count: int
    estimated_restock_needed_npr: Decimal


class WeeklyReportData(BaseModel):
    report_id: str
    business_id: str
    generated_at: datetime
    nepali_date: str
    week_label: str
    store: StoreProfile
    finance: FinancialSummary
    top_products: List[TopProductItem]
    payments: List[PaymentChannelBreakdown]
    inventory: InventoryRiskSummary
    ai_strategic_advice: Optional[str] = None
