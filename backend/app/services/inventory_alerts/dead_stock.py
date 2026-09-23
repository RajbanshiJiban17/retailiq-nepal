"""
Dead Stock Detection Service
Identifies products sitting unsold for extended periods, calculates trapped capital,
and generates smart inventory liquidation recommendations in Nepali and English.
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Union
from collections import defaultdict
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.schemas.inventory_alerts import (
    DeadStockItem,
    DeadStockResponse,
    DeadStockRiskLevel,
)


class DeadStockService:
    @staticmethod
    async def detect_dead_stock(
        db: AsyncSession,
        business_id: Union[uuid.UUID, str],
        days_threshold: int = 60,
        category: Optional[str] = None,
    ) -> DeadStockResponse:
        """
        Scans all active products with stock > 0 for the specified business_id.
        Determines the most recent sale date and flags items unsold past the threshold.
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
            return DeadStockResponse(
                business_id=uuid.uuid4(),
                threshold_days=days_threshold,
                total_dead_stock_items=0,
                total_trapped_capital_npr=Decimal("0.00"),
                critical_dead_count=0,
                stagnant_count=0,
                dead_stock_items=[],
            )

        now = datetime.now(timezone.utc)

        # Query products with their latest sale timestamp strictly within the tenant boundary
        stmt = (
            select(
                Product,
                func.max(Sale.created_at).label("last_sale_date"),
            )
            .outerjoin(SaleItem, SaleItem.product_id == Product.id)
            .outerjoin(Sale, Sale.id == SaleItem.sale_id)
            .where(
                Product.business_id == biz_uuid,
                Product.is_active.is_(True),
                Product.stock_quantity > 0,
            )
            .group_by(Product.id)
        )

        if category:
            stmt = stmt.where(Product.category.ilike(f"%{category}%"))

        result = await db.execute(stmt)
        rows = result.all()

        dead_stock_items: List[DeadStockItem] = []
        category_capital: defaultdict[str, Decimal] = defaultdict(Decimal)

        for product, last_sale_date in rows:
            # If item was never sold, calculate age based on product creation timestamp
            if last_sale_date is not None:
                # Ensure timezone awareness for subtraction
                if last_sale_date.tzinfo is None:
                    last_sale_date = last_sale_date.replace(tzinfo=timezone.utc)
                delta_days = (now - last_sale_date).days
            else:
                prod_created = product.created_at
                if prod_created.tzinfo is None:
                    prod_created = prod_created.replace(tzinfo=timezone.utc)
                delta_days = (now - prod_created).days

            # Check if exceeds threshold
            if delta_days >= days_threshold:
                trapped_capital = Decimal(str(product.stock_quantity)) * Decimal(str(product.unit_cost))
                potential_revenue = Decimal(str(product.stock_quantity)) * Decimal(str(product.selling_price))

                category_capital[product.category] += trapped_capital

                # Determine Risk Level and Action Guidance
                if delta_days >= 90:
                    risk_level = DeadStockRiskLevel.CRITICAL_DEAD
                    rec_en = "Heavy Clearance: Offer 25-35% markdown or bundle as Buy-1-Get-1 with fast movers to release trapped cash."
                    rec_np = "अत्यधिक निष्क्रिय मौज्दात (Dead Stock): २५-३५% छुट दिएर क्लियरेन्स गर्ने वा चाउचाउ जस्ता छिटो बिक्ने सामानसँग बन्डल अफर राख्नुहोस्।"
                elif delta_days >= 60:
                    risk_level = DeadStockRiskLevel.STAGNANT
                    rec_en = "Active Promotion: Relocate to checkout counter and apply 10-15% promotional discount."
                    rec_np = "सुस्त बिक्री मौज्दात: काउन्टरको मुख्य ठाउँमा सजाउनुहोस् र १०-१५% प्रवर्द्धन छुट दिनुहोस्।"
                else:
                    risk_level = DeadStockRiskLevel.SLOW_MOVING
                    rec_en = "Stock Freeze: Pause upcoming purchase orders for this SKU until existing units clear."
                    rec_np = "ढिलो बिक्री: हालको मौज्दात नसकिउन्जेल यस सामानको थप खरिद आदेश (Purchase Order) रोक्नुहोस्।"

                dead_stock_items.append(
                    DeadStockItem(
                        product_id=product.id,
                        sku=product.sku,
                        name=product.name,
                        category=product.category,
                        unit=product.unit,
                        stock_quantity=product.stock_quantity,
                        unit_cost=Decimal(str(product.unit_cost)),
                        selling_price=Decimal(str(product.selling_price)),
                        trapped_capital_npr=trapped_capital.quantize(Decimal("0.01")),
                        potential_revenue_npr=potential_revenue.quantize(Decimal("0.01")),
                        last_sale_date=last_sale_date,
                        days_unsold=max(0, delta_days),
                        risk_level=risk_level,
                        recommendation_en=rec_en,
                        recommendation_np=rec_np,
                    )
                )

        # Sort dead stock by trapped capital descending (highest tied-up funds first)
        dead_stock_items.sort(key=lambda x: x.trapped_capital_npr, reverse=True)

        total_trapped = sum((item.trapped_capital_npr for item in dead_stock_items), Decimal("0.00"))
        total_revenue = sum((item.potential_revenue_npr for item in dead_stock_items), Decimal("0.00"))

        most_stagnant_cat = None
        if category_capital:
            most_stagnant_cat = max(category_capital.items(), key=lambda x: x[1])[0]

        return DeadStockResponse(
            business_id=business_id,
            threshold_days=days_threshold,
            total_dead_stock_items=len(dead_stock_items),
            total_trapped_capital_npr=total_trapped.quantize(Decimal("0.01")),
            total_potential_revenue_npr=total_revenue.quantize(Decimal("0.01")),
            most_stagnant_category=most_stagnant_cat,
            items=dead_stock_items,
        )
