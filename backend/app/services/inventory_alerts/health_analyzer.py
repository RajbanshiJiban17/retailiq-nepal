"""
Inventory Health Analyzer Service
Calculates high-level inventory valuation, turnover health scores (0-100),
and capital allocation metrics across healthy, low-stock, and dead-stock assets.
"""
import uuid
from decimal import Decimal
from typing import Union
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.schemas.inventory_alerts import InventoryHealthOverview
from app.services.inventory_alerts.dead_stock import DeadStockService
from app.services.inventory_alerts.low_stock import LowStockAlertService


class InventoryHealthAnalyzer:
    @staticmethod
    async def get_health_overview(
        db: AsyncSession,
        business_id: Union[uuid.UUID, str],
        dead_stock_threshold_days: int = 60,
    ) -> InventoryHealthOverview:
        """
        Synthesizes catalog valuation, low-stock deficits, and dead stock capital
        into a unified Inventory Health Overview.
        """
        if isinstance(business_id, str):
            try:
                biz_uuid = uuid.UUID(business_id.strip())
            except (ValueError, AttributeError):
                biz_uuid = None
        elif isinstance(business_id, uuid.UUID):
            biz_uuid = business_id
        else:
            biz_uuid = None

        if biz_uuid is None:
            return InventoryHealthOverview(
                business_id=uuid.uuid4(),
                total_skus=0,
                total_units_in_stock=0,
                catalog_valuation_cost_npr=Decimal("0.00"),
                catalog_valuation_retail_npr=Decimal("0.00"),
                unrealized_gross_margin_npr=Decimal("0.00"),
                dead_stock_capital_npr=Decimal("0.00"),
                replenishment_budget_needed_npr=Decimal("0.00"),
                health_score=100.0,
                health_grade="A",
            )

        # 1. Fetch all active products
        stmt = (
            select(Product)
            .where(
                Product.business_id == biz_uuid,
                Product.is_active.is_(True),
            )
        )
        result = await db.execute(stmt)
        products = result.scalars().all()

        total_skus = len(products)
        total_units = sum(p.stock_quantity for p in products)

        cost_val = sum((Decimal(str(p.stock_quantity)) * Decimal(str(p.unit_cost)) for p in products), Decimal("0.00"))
        retail_val = sum((Decimal(str(p.stock_quantity)) * Decimal(str(p.selling_price)) for p in products), Decimal("0.00"))

        # 2. Fetch Low Stock analysis
        low_stock_res = await LowStockAlertService.get_low_stock_alerts(db, business_id)
        low_stock_product_ids = {item.product_id for item in low_stock_res.items}

        # 3. Fetch Dead Stock analysis
        dead_stock_res = await DeadStockService.detect_dead_stock(db, business_id, days_threshold=dead_stock_threshold_days)
        dead_stock_product_ids = {item.product_id for item in dead_stock_res.items}

        # 4. Partition items
        dead_count = len(dead_stock_product_ids)
        low_count = len(low_stock_product_ids)
        healthy_count = max(0, total_skus - len(low_stock_product_ids.union(dead_stock_product_ids)))

        # 5. Dead capital ratio
        dead_capital_ratio = 0.0
        if cost_val > Decimal("0.00"):
            dead_capital_ratio = float((dead_stock_res.total_trapped_capital_npr / cost_val) * 100)

        # 6. Overall Health Score Calculation (0 - 100%)
        # Basis: Ratio of healthy SKUs penalized by stockout severity and dead capital ratio
        if total_skus > 0:
            sku_health_ratio = (healthy_count / total_skus) * 100.0
            stockout_penalty = (low_stock_res.out_of_stock_count / total_skus) * 25.0
            dead_capital_penalty = min(30.0, dead_capital_ratio * 0.5)
            health_score = max(5.0, min(100.0, sku_health_ratio - stockout_penalty - dead_capital_penalty + 15.0))
        else:
            health_score = 100.0

        return InventoryHealthOverview(
            business_id=business_id,
            total_active_skus=total_skus,
            total_stock_units=total_units,
            total_inventory_cost_valuation_npr=cost_val.quantize(Decimal("0.01")),
            total_inventory_retail_valuation_npr=retail_val.quantize(Decimal("0.01")),
            health_score_percent=round(health_score, 1),
            healthy_items_count=healthy_count,
            low_stock_items_count=low_count,
            dead_stock_items_count=dead_count,
            dead_capital_ratio_percent=round(dead_capital_ratio, 1),
            top_dead_stock_category=dead_stock_res.most_stagnant_category,
            estimated_restock_needed_npr=low_stock_res.total_restock_budget_npr,
        )
