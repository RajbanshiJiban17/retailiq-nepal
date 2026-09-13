import uuid
from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class ForecastMetrics(BaseModel):
    mae: float = Field(..., description="Mean Absolute Error on test split")
    rmse: float = Field(..., description="Root Mean Squared Error on test split")
    r2_score: float = Field(..., description="Coefficient of Determination (R²) on test split")
    train_samples_count: int = Field(..., description="Number of daily samples used for training")
    test_samples_count: int = Field(..., description="Number of daily samples used for testing")


class DailyForecastPoint(BaseModel):
    date: str = Field(..., description="Forecast date (YYYY-MM-DD)")
    day_of_week: str = Field(..., description="Day name (e.g. Sunday, Monday)")
    predicted_demand_units: float = Field(..., ge=0.0, description="Projected demand in units")


class ProductDemandForecast(BaseModel):
    sku: str = Field(..., description="Product SKU")
    product_name: str = Field(..., description="Product Name")
    category: str = Field(..., description="Product Category")
    current_stock: int = Field(..., description="Current available inventory stock")
    projected_demand: float = Field(..., description="Total projected demand over forecast horizon")
    suggested_reorder_qty: int = Field(..., ge=0, description="Recommended restocking quantity")
    stockout_risk: Literal["low", "medium", "high", "critical"] = Field(
        ..., description="Risk assessment of running out of stock during horizon"
    )
    model_used: str = Field(..., description="Algorithm used (e.g. Ridge, RandomForestRegressor)")
    metrics: Optional[ForecastMetrics] = Field(None, description="Evaluation metrics on holdout test data")
    daily_predictions: List[DailyForecastPoint] = Field(
        default_factory=list, description="Day-by-day projected demand points"
    )


class ForecastRequest(BaseModel):
    business_id: uuid.UUID = Field(..., description="Target Tenant Business ID")
    sku: Optional[str] = Field(None, description="Optional single product SKU to forecast; if omitted, forecasts all active catalog products")
    forecast_days: int = Field(default=7, ge=1, le=30, description="Forecast horizon in days (1 to 30)")
    model_type: Literal["ridge", "random_forest"] = Field(
        default="ridge", description="Scikit-learn regressor to train"
    )


class ForecastResponse(BaseModel):
    business_id: uuid.UUID = Field(..., description="Tenant Business ID")
    forecast_horizon_days: int = Field(..., description="Number of forecast days projected")
    total_products_analyzed: int = Field(..., description="Count of products forecasted")
    high_risk_products_count: int = Field(..., description="Products at critical or high stockout risk")
    generated_at: str = Field(..., description="UTC ISO timestamp of generation")
    forecasts: List[ProductDemandForecast] = Field(..., description="List of product demand forecasts")
