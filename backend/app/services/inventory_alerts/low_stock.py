"""
Low Stock Alerts Service
Evaluates inventory quantities against predefined reorder levels,
classifies deficit severities, and calculates replenishment budgets in NPR.
"""
import uuid
from decimal import Decimal
from typing import List, Optional, Union
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.schemas.inventory_alerts import (
    LowStockAlertItem,
    LowStockAlertResponse,
    LowStockSeverity,
)


class LowStockAlertService:
    @staticmethod
    async def get_low_stock_alerts(
        db: AsyncSession,
        business_id: Union[uuid.UUID, str],
        severity_filter: Optional[LowStockSeverity] = None,
    ) -> LowStockAlertResponse:
        """
        Retrieves all active products where stock_quantity <= reorder_level
        strictly partitioned by business_id.
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
            return LowStockAlertResponse(
                business_id=uuid.uuid4(),
                total_alerts=0,
                out_of_stock_count=0,
                critical_count=0,
                warning_count=0,
                total_replenishment_budget_npr=Decimal("0.00"),
                alerts=[],
            )

        stmt = (
            select(Product)
            .where(
                Product.business_id == biz_uuid,
                Product.is_active.is_(True),
                Product.stock_quantity <= Product.reorder_level,
            )
            .order_by(Product.stock_quantity.asc())
        )

        result = await db.execute(stmt)
        products = result.scalars().all()

        alert_items: List[LowStockAlertItem] = []
        out_of_stock_count = 0
        critical_count = 0
        warning_count = 0

        for product in products:
            stock = product.stock_quantity
            threshold = product.reorder_level

            # Determine severity
            if stock <= 0:
                severity = LowStockSeverity.OUT_OF_STOCK
                status_np = "स्टक सकियो (तुरुन्त मगाउनुहोस्)"
                out_of_stock_count += 1
            elif stock <= int(threshold * 0.3):
                severity = LowStockSeverity.CRITICAL
                status_np = "अत्यन्त न्यून मौज्दात (१-२ दिनमा सकिने)"
                critical_count += 1
            else:
                severity = LowStockSeverity.WARNING
                status_np = "न्यून मौज्दात (रिअर्डर सीमा मुनि)"
                warning_count += 1

            if severity_filter and severity != severity_filter:
                continue

            deficit = max(0, threshold - stock)
            # Reorder quantity to restore a comfortable 2x buffer above threshold
            suggested_qty = max(threshold, (threshold * 2) - stock)
            restock_cost = Decimal(str(suggested_qty)) * Decimal(str(product.unit_cost))

            alert_items.append(
                LowStockAlertItem(
                    product_id=product.id,
                    sku=product.sku,
                    name=product.name,
                    category=product.category,
                    unit=product.unit,
                    stock_quantity=stock,
                    reorder_level=threshold,
                    deficit_units=deficit,
                    suggested_reorder_qty=suggested_qty,
                    unit_cost=Decimal(str(product.unit_cost)),
                    estimated_restock_cost_npr=restock_cost.quantize(Decimal("0.01")),
                    severity=severity,
                    status_nepali=status_np,
                )
            )

        # Sort: Out of stock first, then Critical, then Warning
        severity_order = {
            LowStockSeverity.OUT_OF_STOCK: 0,
            LowStockSeverity.CRITICAL: 1,
            LowStockSeverity.WARNING: 2,
            LowStockSeverity.HEALTHY: 3,
        }
        alert_items.sort(key=lambda x: (severity_order.get(x.severity, 99), x.stock_quantity))

        total_budget = sum((item.estimated_restock_cost_npr for item in alert_items), Decimal("0.00"))

        return LowStockAlertResponse(
            business_id=business_id,
            total_alerts=len(alert_items),
            out_of_stock_count=out_of_stock_count,
            critical_count=critical_count,
            warning_count=warning_count,
            total_restock_budget_npr=total_budget.quantize(Decimal("0.01")),
            items=alert_items,
        )
