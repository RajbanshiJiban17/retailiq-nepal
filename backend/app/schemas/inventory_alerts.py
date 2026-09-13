"""
Pydantic Schemas for Inventory Alerts, Dead Stock, and Health Overview
"""
import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field


class DeadStockRiskLevel(str, enum.Enum):
    CRITICAL_DEAD = "CRITICAL_DEAD"  # Unsold > 90 days
    STAGNANT = "STAGNANT"            # Unsold 60 - 90 days
    SLOW_MOVING = "SLOW_MOVING"      # Unsold 30 - 60 days


class LowStockSeverity(str, enum.Enum):
    OUT_OF_STOCK = "OUT_OF_STOCK"    # stock == 0
    CRITICAL = "CRITICAL"            # 0 < stock <= reorder_level * 0.3
    WARNING = "WARNING"              # reorder_level * 0.3 < stock <= reorder_level
    HEALTHY = "HEALTHY"              # stock > reorder_level


class DeadStockItem(BaseModel):
    product_id: uuid.UUID
    sku: str
    name: str
    category: str
    unit: str
    stock_quantity: int
    unit_cost: Decimal
    selling_price: Decimal
    trapped_capital_npr: Decimal = Field(
        description="Purchase cost value of idle inventory (stock_quantity * unit_cost)"
    )
    potential_revenue_npr: Decimal = Field(
        description="Retail market value of idle inventory (stock_quantity * selling_price)"
    )
    last_sale_date: Optional[datetime] = Field(
        None, description="Datetime of the most recent sale line item"
    )
    days_unsold: int = Field(
        description="Days elapsed since the last sale, or days since product creation if never sold"
    )
    risk_level: DeadStockRiskLevel
    recommendation_en: str = Field(description="Actionable liquidation recommendation")
    recommendation_np: str = Field(description="Actionable guidance in Nepali for storekeeper")


class DeadStockResponse(BaseModel):
    business_id: str
    threshold_days: int
    total_dead_stock_items: int
    total_trapped_capital_npr: Decimal
    total_potential_revenue_npr: Decimal
    most_stagnant_category: Optional[str] = None
    items: List[DeadStockItem]


class LowStockAlertItem(BaseModel):
    product_id: uuid.UUID
    sku: str
    name: str
    category: str
    unit: str
    stock_quantity: int
    reorder_level: int
    deficit_units: int = Field(description="Units below reorder threshold (max(0, reorder_level - stock))")
    suggested_reorder_qty: int = Field(
        description="Target restock quantity to reach safe operating buffer (reorder_level * 2 - stock)"
    )
    unit_cost: Decimal
    estimated_restock_cost_npr: Decimal = Field(
        description="Estimated capital required in NPR (suggested_reorder_qty * unit_cost)"
    )
    severity: LowStockSeverity
    status_nepali: str = Field(description="Nepali urgency status label")


class LowStockAlertResponse(BaseModel):
    business_id: str
    total_alerts: int
    out_of_stock_count: int
    critical_count: int
    warning_count: int
    total_restock_budget_npr: Decimal
    items: List[LowStockAlertItem]


class InventoryHealthOverview(BaseModel):
    business_id: str
    total_active_skus: int
    total_stock_units: int
    total_inventory_cost_valuation_npr: Decimal
    total_inventory_retail_valuation_npr: Decimal
    health_score_percent: float = Field(
        description="Inventory Health Score from 0 to 100 based on healthy vs dead/low stock ratio"
    )
    healthy_items_count: int
    low_stock_items_count: int
    dead_stock_items_count: int
    dead_capital_ratio_percent: float = Field(
        description="Percentage of inventory capital trapped in dead stock"
    )
    top_dead_stock_category: Optional[str] = None
    estimated_restock_needed_npr: Decimal
