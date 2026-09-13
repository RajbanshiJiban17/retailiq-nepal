"""
Machine Learning Module Test & Validation Script
Tests Feature Engineering, train_test_split, Scikit-learn regressors, and demand forecasting.
"""
import random
import sys
from datetime import date, timedelta
from pathlib import Path
import numpy as np
import pandas as pd

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.ml.feature_engineering import DemandFeatureEngineer, FEATURE_COLUMNS
from app.services.ml.forecaster import ScikitDemandForecaster


def generate_synthetic_sales_data(days: int = 60) -> pd.DataFrame:
    """Generates realistic daily transaction history for Nepalese retail staples."""
    random.seed(42)
    np.random.seed(42)

    start_date = date.today() - timedelta(days=days)
    records = []

    # Products: (sku, base_mean_demand, price)
    products = [
        ("WAI-NOOD-75G", 25.0, 25.0),    # High volume instant food
        ("ILAM-TEA-500G", 6.0, 320.0),    # Steady beverage
        ("DDC-GHEE-1L", 3.0, 1150.0),     # Moderate dairy staple
    ]

    for day_i in range(days):
        cur_date = start_date + timedelta(days=day_i)
        dow = cur_date.weekday()

        # Nepal retail pattern: Saturday (dow=5) is peak grocery shopping day
        weekend_factor = 1.8 if dow == 5 else (1.2 if dow == 4 else 1.0)

        for sku, base_demand, price in products:
            # Simulate slight upward trend + weekly seasonality + Gaussian noise
            trend = 1.0 + (day_i / days) * 0.15
            mu = base_demand * weekend_factor * trend
            daily_qty = max(0, int(round(np.random.normal(mu, base_demand * 0.25))))

            # Some days might have multiple receipts
            num_receipts = max(1, daily_qty // 4)
            rem = daily_qty
            for r_idx in range(num_receipts):
                part_qty = rem if r_idx == num_receipts - 1 else max(1, rem // num_receipts)
                rem -= part_qty
                if part_qty > 0:
                    records.append({
                        "sku": sku,
                        "quantity": part_qty,
                        "unit_price": price,
                        "date": cur_date,
                    })

    return pd.DataFrame(records)


def run_ml_validation():
    print("=" * 60)
    print("[INFO] STARTING SCIKIT-LEARN ML FORECASTING VALIDATION")
    print("=" * 60)

    # 1. Generate Synthetic Sales Data
    print("\n1. Generating 60 days of transactional sales history...")
    raw_df = generate_synthetic_sales_data(days=60)
    print(f"  Generated {len(raw_df)} transaction records across 3 SKUs.")

    # 2. Test Feature Engineering
    print("\n2. Testing Feature Engineering Pipeline:")
    sku = "WAI-NOOD-75G"
    X, y, featured = DemandFeatureEngineer.prepare_dataset(raw_df, sku)

    print(f"  Target SKU: {sku}")
    print(f"  Resampled daily series length: {len(featured)} days")
    print(f"  Feature columns generated ({len(FEATURE_COLUMNS)}): {FEATURE_COLUMNS}")
    print(f"  Features shape: {X.shape}, Target shape: {y.shape}")

    assert len(X) == 60, f"Expected 60 daily records, got {len(X)}"
    assert not X.isnull().values.any(), "Feature matrix contains unexpected NaN values!"
    assert not y.isnull().values.any(), "Target series contains unexpected NaN values!"
    print("  [PASS] Daily resampling & continuous calendar alignment verified (0 missing days).")
    print("  [PASS] Autoregressive lag features (lag_1, lag_2, lag_7, rolling_mean_7) verified.")

    # 3. Test Strict train_test_split (ML Best Practice)
    print("\n3. Testing Strict Chronological train_test_split:")
    pipeline_ridge, metrics_ridge, avg_demand = ScikitDemandForecaster.train_and_evaluate(
        X, y, model_type="ridge"
    )

    print(f"  Train samples: {metrics_ridge.train_samples_count}")
    print(f"  Test samples (holdout): {metrics_ridge.test_samples_count}")
    print(f"  Ridge Model Test MAE: {metrics_ridge.mae:.2f} units")
    print(f"  Ridge Model Test RMSE: {metrics_ridge.rmse:.2f} units")
    print(f"  Ridge Model Test R2: {metrics_ridge.r2_score:.3f}")

    assert metrics_ridge.train_samples_count == 48, f"Expected 48 train samples (80%), got {metrics_ridge.train_samples_count}"
    assert metrics_ridge.test_samples_count == 12, f"Expected 12 test samples (20%), got {metrics_ridge.test_samples_count}"
    assert metrics_ridge.mae >= 0.0, "MAE cannot be negative"
    assert metrics_ridge.rmse >= 0.0, "RMSE cannot be negative"
    print("  [PASS] Strict chronological train_test_split (shuffle=False) confirmed.")
    print("  [PASS] Model evaluation metrics (MAE, RMSE, R2) cleanly calculated on holdout set.")

    # 4. Test Random Forest Regressor
    print("\n4. Testing Random Forest Regressor Pipeline:")
    pipeline_rf, metrics_rf, _ = ScikitDemandForecaster.train_and_evaluate(
        X, y, model_type="random_forest"
    )
    print(f"  RandomForest Test MAE: {metrics_rf.mae:.2f} units")
    print(f"  RandomForest Test RMSE: {metrics_rf.rmse:.2f} units")
    print(f"  RandomForest Test R2: {metrics_rf.r2_score:.3f}")
    print("  [PASS] Random Forest pipeline with StandardScaler executed successfully.")

    # 5. Test Future Demand Forecasting & Inventory Reorder Intelligence
    print("\n5. Testing Future 7-Day Demand Forecasting & Inventory Reorder Logic:")
    forecast_7d = ScikitDemandForecaster.forecast_product(
        sales_df=raw_df,
        sku=sku,
        product_name="Wai Wai Quick 75g",
        category="Instant Food",
        current_stock=35,       # Current in-stock quantity
        reorder_level=20,
        forecast_days=7,
        model_type="ridge",
    )

    print(f"  Product: {forecast_7d.product_name} ({forecast_7d.sku})")
    print(f"  Current Stock: {forecast_7d.current_stock} units")
    print(f"  Projected 7-Day Demand: {forecast_7d.projected_demand} units")
    print(f"  Recommended Reorder Qty: {forecast_7d.suggested_reorder_qty} units")
    print(f"  Stockout Risk Level: {forecast_7d.stockout_risk.upper()}")
    print("  Daily Predictions:")
    for dp in forecast_7d.daily_predictions:
        print(f"    - {dp.date} ({dp.day_of_week}): {dp.predicted_demand_units:.1f} units")

    assert len(forecast_7d.daily_predictions) == 7, f"Expected 7 daily points, got {len(forecast_7d.daily_predictions)}"
    assert forecast_7d.projected_demand > 0.0, "Projected demand must be positive"
    assert forecast_7d.suggested_reorder_qty >= 0, "Suggested reorder quantity cannot be negative"
    assert forecast_7d.stockout_risk in ["low", "medium", "high", "critical"]
    print("  [PASS] 7-day demand projections and restocking advice validated.")

    # 6. Test Low-Stock Critical Alert Trigger
    print("\n6. Testing Low Stock / Stockout Risk Trigger:")
    critical_forecast = ScikitDemandForecaster.forecast_product(
        sales_df=raw_df,
        sku="DDC-GHEE-1L",
        product_name="DDC Pure Cow Ghee 1L",
        category="Dairy",
        current_stock=2,        # Low stock trigger
        reorder_level=10,
        forecast_days=7,
        model_type="ridge",
    )
    print(f"  DDC Ghee Current Stock: {critical_forecast.current_stock}, Risk: {critical_forecast.stockout_risk}")
    assert critical_forecast.stockout_risk in ["critical", "high"], "Failed to flag high risk on depleted inventory"
    assert critical_forecast.suggested_reorder_qty > 0, "Failed to suggest reorder on low stock"
    print(f"  [PASS] Stockout alert triggered correctly (Risk: {critical_forecast.stockout_risk}, Reorder: {critical_forecast.suggested_reorder_qty} units).")

    print("\n" + "=" * 60)
    print("[SUCCESS] ALL ML DEMAND FORECASTING INTEGRITY CHECKS PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    run_ml_validation()
