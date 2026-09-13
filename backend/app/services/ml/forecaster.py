"""
Baseline Demand Forecaster using Scikit-Learn
Trains regression pipelines, evaluates holdout performance, and projects inventory demand.
"""
from datetime import timedelta
from math import ceil
from typing import List, Literal, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.schemas.ml import DailyForecastPoint, ForecastMetrics, ProductDemandForecast
from app.services.ml.feature_engineering import DemandFeatureEngineer, FEATURE_COLUMNS


def _compute_rmse(y_true, y_pred) -> float:
    """Computes Root Mean Squared Error across Scikit-learn versions."""
    try:
        from sklearn.metrics import root_mean_squared_error
        return float(root_mean_squared_error(y_true, y_pred))
    except ImportError:
        return float(np.sqrt(mean_squared_error(y_true, y_pred)))


class ScikitDemandForecaster:
    """
    Scikit-learn based demand forecasting and inventory restock engine.
    """

    @classmethod
    def train_and_evaluate(
        cls,
        X: pd.DataFrame,
        y: pd.Series,
        model_type: Literal["ridge", "random_forest"] = "ridge",
    ) -> Tuple[Pipeline, ForecastMetrics, float]:
        """
        Executes strict time-series train_test_split (shuffle=False), fits pipeline,
        and computes test set evaluation metrics.
        """
        # Strict ML Best Practice: Split chronologically before fitting scalers
        test_size = 0.2 if len(X) >= 15 else 0.15
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, shuffle=False
        )

        # Build pipeline with scaler and regressor
        if model_type == "random_forest":
            regressor = RandomForestRegressor(
                n_estimators=50,
                max_depth=6,
                random_state=42,
                n_jobs=1,  # Single thread to keep memory low on free tier
            )
            pipeline = Pipeline([
                ("scaler", StandardScaler()),
                ("regressor", regressor),
            ])
        else:
            pipeline = Pipeline([
                ("scaler", StandardScaler()),
                ("regressor", Ridge(alpha=1.0)),
            ])

        # Fit exclusively on training partition
        pipeline.fit(X_train, y_train)

        # Evaluate exclusively on holdout test partition
        y_pred = pipeline.predict(X_test)
        y_pred = np.maximum(y_pred, 0.0)  # Demand cannot be negative

        mae = float(mean_absolute_error(y_test, y_pred))
        rmse = _compute_rmse(y_test, y_pred)
        r2 = float(r2_score(y_test, y_pred)) if len(y_test) > 1 else 1.0

        # Protect against extreme negative R2 on near-zero baseline variance
        r2 = max(-1.0, min(1.0, r2))

        metrics = ForecastMetrics(
            mae=round(mae, 2),
            rmse=round(rmse, 2),
            r2_score=round(r2, 3),
            train_samples_count=len(X_train),
            test_samples_count=len(X_test),
        )

        # Refit on full dataset for future projection
        pipeline.fit(X, y)
        return pipeline, metrics, float(y.mean())

    @classmethod
    def generate_future_forecast(
        cls,
        pipeline: Pipeline,
        featured_df: pd.DataFrame,
        forecast_days: int = 7,
    ) -> List[DailyForecastPoint]:
        """
        Generates day-by-day future demand predictions using recursive autoregression.
        """
        daily_points: List[DailyForecastPoint] = []
        last_date = featured_df["date"].max()

        # Copy recent quantity history to roll forward lag features
        history = featured_df[["date", "quantity"]].copy()

        for step in range(1, forecast_days + 1):
            next_date = last_date + timedelta(days=step)
            dow = next_date.weekday()

            # Dynamic lag lookup from history + previous predictions
            quantities = history["quantity"].values
            lag_1 = quantities[-1] if len(quantities) >= 1 else 0.0
            lag_2 = quantities[-2] if len(quantities) >= 2 else lag_1
            lag_7 = quantities[-7] if len(quantities) >= 7 else quantities[-1]
            rolling_7 = float(np.mean(quantities[-7:])) if len(quantities) >= 1 else 0.0

            row_features = pd.DataFrame([{
                "day_of_week": dow,
                "is_saturday": 1 if dow == 5 else 0,
                "is_weekend": 1 if dow in [5, 6] else 0,
                "day_of_month": next_date.day,
                "month": next_date.month,
                "lag_1": lag_1,
                "lag_2": lag_2,
                "lag_7": lag_7,
                "rolling_mean_7": rolling_7,
            }])[FEATURE_COLUMNS]

            pred_qty = float(pipeline.predict(row_features)[0])
            pred_qty = max(0.0, round(pred_qty, 1))

            daily_points.append(
                DailyForecastPoint(
                    date=next_date.strftime("%Y-%m-%d"),
                    day_of_week=next_date.strftime("%A"),
                    predicted_demand_units=pred_qty,
                )
            )

            # Append prediction to history for next recursive step
            history = pd.concat([
                history,
                pd.DataFrame([{"date": next_date, "quantity": pred_qty}]),
            ], ignore_index=True)

        return daily_points

    @classmethod
    def forecast_product(
        cls,
        sales_df: pd.DataFrame,
        sku: str,
        product_name: str,
        category: str,
        current_stock: int,
        reorder_level: int = 10,
        forecast_days: int = 7,
        model_type: Literal["ridge", "random_forest"] = "ridge",
    ) -> ProductDemandForecast:
        """
        Complete forecasting workflow for an inventory item.
        """
        X, y, featured_df = DemandFeatureEngineer.prepare_dataset(sales_df, sku)

        # If data is insufficient for regression (<10 days), use heuristic fallback
        if len(X) < 10:
            avg_daily = float(y.mean()) if not y.empty else 1.0
            avg_daily = max(0.5, avg_daily)
            daily_pts = []
            today = pd.to_datetime("today")
            for i in range(1, forecast_days + 1):
                f_date = today + timedelta(days=i)
                daily_pts.append(
                    DailyForecastPoint(
                        date=f_date.strftime("%Y-%m-%d"),
                        day_of_week=f_date.strftime("%A"),
                        predicted_demand_units=round(avg_daily, 1),
                    )
                )
            total_proj = round(avg_daily * forecast_days, 1)
            metrics = None
            algo_name = "Moving Average Fallback (Low Data)"
        else:
            pipeline, metrics, _ = cls.train_and_evaluate(X, y, model_type=model_type)
            daily_pts = cls.generate_future_forecast(pipeline, featured_df, forecast_days)
            total_proj = round(sum(p.predicted_demand_units for p in daily_pts), 1)
            algo_name = f"Scikit-learn {model_type.replace('_', ' ').title()}"

        # Reorder calculation: Projected Demand + Safety Buffer - Current Stock
        safety_buffer = max(reorder_level, ceil(total_proj * 0.2))
        needed = ceil(total_proj + safety_buffer - current_stock)
        suggested_reorder = max(0, needed)

        # Risk level determination
        if current_stock <= 0 or current_stock < (total_proj * 0.3):
            risk = "critical"
        elif current_stock < total_proj:
            risk = "high"
        elif current_stock < (total_proj * 1.3):
            risk = "medium"
        else:
            risk = "low"

        return ProductDemandForecast(
            sku=sku,
            product_name=product_name,
            category=category,
            current_stock=current_stock,
            projected_demand=total_proj,
            suggested_reorder_qty=suggested_reorder,
            stockout_risk=risk,
            model_used=algo_name,
            metrics=metrics,
            daily_predictions=daily_pts,
        )
