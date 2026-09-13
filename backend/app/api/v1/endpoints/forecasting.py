import uuid
from datetime import datetime, timezone
from typing import List
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.business import Business
from app.models.product import Product
from app.models.sale import SaleItem
from app.schemas.ml import ForecastRequest, ForecastResponse, ProductDemandForecast
from app.services.ml.forecaster import ScikitDemandForecaster

router = APIRouter()


@router.post(
    "/predict",
    response_model=ForecastResponse,
    summary="Execute demand forecasting and restock recommendations",
    description=(
        "Processes historical sales for a tenant's products, applies Scikit-learn regression "
        "(Ridge or RandomForest) with strict train_test_split validation, and projects upcoming demand."
    ),
)
async def predict_demand(
    request: ForecastRequest,
    db: AsyncSession = Depends(get_db),
) -> ForecastResponse:
    # 1. Verify Tenant Business
    biz_stmt = select(Business).where(Business.id == request.business_id)
    biz_res = await db.execute(biz_stmt)
    business = biz_res.scalar_one_or_none()
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business with ID '{request.business_id}' not found.",
        )

    # 2. Query target products
    prod_stmt = select(Product).where(
        Product.business_id == request.business_id,
        Product.is_active == True,
    )
    if request.sku:
        prod_stmt = prod_stmt.where(Product.sku == request.sku.upper())

    prod_res = await db.execute(prod_stmt)
    products = prod_res.scalars().all()
    if not products:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active products found for business '{request.business_id}'.",
        )

    # 3. Query sales history for this tenant
    target_skus = [p.sku for p in products]
    sales_stmt = select(
        SaleItem.product_sku,
        SaleItem.quantity,
        SaleItem.unit_price,
        SaleItem.created_at,
    ).where(
        SaleItem.business_id == request.business_id,
        SaleItem.product_sku.in_(target_skus),
    )
    sales_res = await db.execute(sales_stmt)
    raw_sales = sales_res.all()

    # Convert to DataFrame
    if raw_sales:
        sales_df = pd.DataFrame([
            {
                "sku": row[0],
                "quantity": row[1],
                "unit_price": float(row[2]),
                "date": row[3],
            }
            for row in raw_sales
        ])
    else:
        sales_df = pd.DataFrame(columns=["sku", "quantity", "unit_price", "date"])

    # 4. Generate forecasts per product
    forecast_results: List[ProductDemandForecast] = []
    for prod in products:
        f = ScikitDemandForecaster.forecast_product(
            sales_df=sales_df,
            sku=prod.sku,
            product_name=prod.name,
            category=prod.category,
            current_stock=prod.stock_quantity,
            reorder_level=prod.reorder_level,
            forecast_days=request.forecast_days,
            model_type=request.model_type,
        )
        forecast_results.append(f)

    high_risk_count = sum(1 for f in forecast_results if f.stockout_risk in ["high", "critical"])

    return ForecastResponse(
        business_id=request.business_id,
        forecast_horizon_days=request.forecast_days,
        total_products_analyzed=len(forecast_results),
        high_risk_products_count=high_risk_count,
        generated_at=datetime.now(timezone.utc).isoformat(),
        forecasts=forecast_results,
    )


@router.get(
    "/demo",
    response_model=ForecastResponse,
    summary="Interactive ML demand forecast demo",
    description="Executes Scikit-learn forecasting on 45 days of simulated sales data for instant testing.",
)
async def forecast_demo(
    forecast_days: int = 7,
    model_type: str = "ridge",
) -> ForecastResponse:
    # Build 45 days of synthetic retail sales
    import random
    from datetime import date, timedelta

    start_date = date.today() - timedelta(days=45)
    records = []

    mock_catalog = [
        ("WAI-75G", "Wai Wai Quick 75g", "Instant Food", 45, 12, 10),
        ("TEA-500G", "Ilam Orthodox Tea 500g", "Beverages", 18, 4, 8),
        ("DDC-GHEE-1L", "DDC Pure Cow Ghee 1L", "Dairy", 8, 2, 10),
    ]

    for day_offset in range(45):
        cur_date = start_date + timedelta(days=day_offset)
        dow = cur_date.weekday()
        # Weekend multiplier (Saturday peak shopping in Nepal)
        mult = 1.6 if dow == 5 else 1.0

        for sku, _, _, _, base_rate, _ in mock_catalog:
            daily_qty = max(0, int(round(random.gauss(base_rate * mult, 2.5))))
            records.append({
                "sku": sku,
                "quantity": daily_qty,
                "unit_price": 25.0,
                "date": cur_date,
            })

    sales_df = pd.DataFrame(records)
    selected_model = "random_forest" if model_type == "random_forest" else "ridge"

    forecasts: List[ProductDemandForecast] = []
    for sku, name, cat, stock, _, reorder in mock_catalog:
        fc = ScikitDemandForecaster.forecast_product(
            sales_df=sales_df,
            sku=sku,
            product_name=name,
            category=cat,
            current_stock=stock,
            reorder_level=reorder,
            forecast_days=forecast_days,
            model_type=selected_model,
        )
        forecasts.append(fc)

    high_risk_count = sum(1 for f in forecasts if f.stockout_risk in ["high", "critical"])

    return ForecastResponse(
        business_id=uuid.UUID("00000000-0000-0000-0000-000000000000"),
        forecast_horizon_days=forecast_days,
        total_products_analyzed=len(forecasts),
        high_risk_products_count=high_risk_count,
        generated_at=datetime.now(timezone.utc).isoformat(),
        forecasts=forecasts,
    )
