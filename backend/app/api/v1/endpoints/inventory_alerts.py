"""
FastAPI Router for Inventory Alerts, Dead Stock Detection, and Health Overview
"""
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.inventory_alerts import (
    DeadStockItem,
    DeadStockResponse,
    DeadStockRiskLevel,
    LowStockAlertItem,
    LowStockAlertResponse,
    LowStockSeverity,
    InventoryHealthOverview,
)
from app.services.inventory_alerts.dead_stock import DeadStockService
from app.services.inventory_alerts.low_stock import LowStockAlertService
from app.services.inventory_alerts.health_analyzer import InventoryHealthAnalyzer

router = APIRouter()


@router.get(
    "/dead-stock",
    response_model=DeadStockResponse,
    summary="Detect dead stock items unsold for months",
    description=(
        "Scans all active products for a given business_id. "
        "Flags products with stock > 0 that have had zero sales for >= days_threshold. "
        "Calculates trapped working capital in NPR and provides liquidation recommendations in Nepali."
    ),
)
async def get_dead_stock(
    business_id: str = Query(..., description="Multi-tenant business identifier"),
    days_threshold: int = Query(60, ge=7, le=365, description="Inactivity window in days (default: 60 days)"),
    category: Optional[str] = Query(None, description="Optional filter by product category"),
    db: AsyncSession = Depends(get_db),
):
    return await DeadStockService.detect_dead_stock(
        db=db,
        business_id=business_id,
        days_threshold=days_threshold,
        category=category,
    )


@router.get(
    "/low-stock",
    response_model=LowStockAlertResponse,
    summary="Generate low-stock alerts based on reorder thresholds",
    description=(
        "Identifies products where stock_quantity <= reorder_level. "
        "Categorizes alerts into OUT_OF_STOCK, CRITICAL, and WARNING. "
        "Calculates replenishment deficit and required restock budget in NPR."
    ),
)
async def get_low_stock_alerts(
    business_id: str = Query(..., description="Multi-tenant business identifier"),
    severity: Optional[LowStockSeverity] = Query(None, description="Filter by severity level"),
    db: AsyncSession = Depends(get_db),
):
    return await LowStockAlertService.get_low_stock_alerts(
        db=db,
        business_id=business_id,
        severity_filter=severity,
    )


@router.get(
    "/health-overview",
    response_model=InventoryHealthOverview,
    summary="Get 360-degree inventory health and valuation score",
    description=(
        "Aggregates total catalog valuation at cost and retail prices, calculates "
        "inventory health score (0-100%), and summarizes dead-to-healthy asset ratios."
    ),
)
async def get_inventory_health_overview(
    business_id: str = Query(..., description="Multi-tenant business identifier"),
    dead_stock_threshold_days: int = Query(60, ge=7, le=365, description="Dead stock threshold in days"),
    db: AsyncSession = Depends(get_db),
):
    return await InventoryHealthAnalyzer.get_health_overview(
        db=db,
        business_id=business_id,
        dead_stock_threshold_days=dead_stock_threshold_days,
    )


@router.get(
    "/demo",
    summary="Instant zero-DB demonstration of dead stock and low stock alerts",
    description="Returns pre-computed Nepali retail inventory alert scenario for immediate client testing.",
)
async def get_alerts_demo():
    """
    Simulated demo payload representing a typical Kathmandu retail supermarket.
    """
    now = datetime.now(timezone.utc)

    mock_dead_items = [
        DeadStockItem(
            product_id=uuid.uuid4(),
            sku="SKU-APPL-092",
            name="Sujata Electric Kettle 1.8L",
            category="Kitchen Appliances",
            unit="piece",
            stock_quantity=18,
            unit_cost=Decimal("1250.00"),
            selling_price=Decimal("1650.00"),
            trapped_capital_npr=Decimal("22500.00"),
            potential_revenue_npr=Decimal("29700.00"),
            last_sale_date=now - timedelta(days=104),
            days_unsold=104,
            risk_level=DeadStockRiskLevel.CRITICAL_DEAD,
            recommendation_en="Heavy Clearance: Offer 25-35% markdown or bundle as Buy-1-Get-1 with fast movers to release trapped cash.",
            recommendation_np="अत्यधिक निष्क्रिय मौज्दात (Dead Stock): २५-३५% छुट दिएर क्लियरेन्स गर्ने वा चाउचाउ जस्ता छिटो बिक्ने सामानसँग बन्डल अफर राख्नुहोस्।",
        ),
        DeadStockItem(
            product_id=uuid.uuid4(),
            sku="SKU-COSM-014",
            name="Herbal Ayurvedic Hair Tonic 200ml",
            category="Personal Care",
            unit="bottle",
            stock_quantity=32,
            unit_cost=Decimal("280.00"),
            selling_price=Decimal("390.00"),
            trapped_capital_npr=Decimal("8960.00"),
            potential_revenue_npr=Decimal("12480.00"),
            last_sale_date=now - timedelta(days=78),
            days_unsold=78,
            risk_level=DeadStockRiskLevel.STAGNANT,
            recommendation_en="Active Promotion: Relocate to checkout counter and apply 10-15% promotional discount.",
            recommendation_np="सुस्त बिक्री मौज्दात: काउन्टरको मुख्य ठाउँमा सजाउनुहोस् र १०-१५% प्रवर्द्धन छुट दिनुहोस्।",
        ),
    ]

    mock_low_stock = [
        LowStockAlertItem(
            product_id=uuid.uuid4(),
            sku="SKU-NDL-001",
            name="Wai Wai Quick Chicken 75g",
            category="Instant Noodles",
            unit="packet",
            stock_quantity=0,
            reorder_level=50,
            deficit_units=50,
            suggested_reorder_qty=100,
            unit_cost=Decimal("22.00"),
            estimated_restock_cost_npr=Decimal("2200.00"),
            severity=LowStockSeverity.OUT_OF_STOCK,
            status_nepali="स्टक सकियो (तुरुन्त मगाउनुहोस्)",
        ),
        LowStockAlertItem(
            product_id=uuid.uuid4(),
            sku="SKU-OIL-002",
            name="Fortune Refined Sunflower Oil 1L",
            category="Cooking Essentials",
            unit="pouch",
            stock_quantity=4,
            reorder_level=25,
            deficit_units=21,
            suggested_reorder_qty=46,
            unit_cost=Decimal("240.00"),
            estimated_restock_cost_npr=Decimal("11040.00"),
            severity=LowStockSeverity.CRITICAL,
            status_nepali="अत्यन्त न्यून मौज्दात (१-२ दिनमा सकिने)",
        ),
        LowStockAlertItem(
            product_id=uuid.uuid4(),
            sku="SKU-TEA-003",
            name="Tokla CTC Tea 500g",
            category="Beverages",
            unit="packet",
            stock_quantity=12,
            reorder_level=20,
            deficit_units=8,
            suggested_reorder_qty=28,
            unit_cost=Decimal("310.00"),
            estimated_restock_cost_npr=Decimal("8680.00"),
            severity=LowStockSeverity.WARNING,
            status_nepali="न्यून मौज्दात (रिअर्डर सीमा मुनि)",
        ),
    ]

    return {
        "status": "success",
        "demo_business": "पशुपति किराना तथा सुपरस्टोर (Pashupati Kirana)",
        "currency": "NPR (रु.)",
        "health_score": 76.5,
        "dead_stock_summary": {
            "total_items": len(mock_dead_items),
            "total_trapped_capital_npr": sum(i.trapped_capital_npr for i in mock_dead_items),
            "total_potential_revenue_npr": sum(i.potential_revenue_npr for i in mock_dead_items),
            "items": mock_dead_items,
        },
        "low_stock_summary": {
            "total_alerts": len(mock_low_stock),
            "out_of_stock_count": 1,
            "critical_count": 1,
            "warning_count": 1,
            "total_restock_budget_npr": sum(i.estimated_restock_cost_npr for i in mock_low_stock),
            "items": mock_low_stock,
        },
    }
