"""
Feature Engineering Pipeline for Retail Demand Forecasting
Transforms sales transaction history into daily product demand features.
"""
from datetime import datetime, timedelta
from typing import List, Tuple
import numpy as np
import pandas as pd


FEATURE_COLUMNS = [
    "day_of_week",
    "is_saturday",
    "is_weekend",
    "day_of_month",
    "month",
    "lag_1",
    "lag_2",
    "lag_7",
    "rolling_mean_7",
]


class DemandFeatureEngineer:
    """
    Transforms raw transactional line-item records into structured feature matrices for Scikit-learn.
    """

    @classmethod
    def build_daily_series(cls, df: pd.DataFrame, sku: str) -> pd.DataFrame:
        """
        Filters transactions for a specific SKU, resamples daily, and fills missing days with 0 demand.
        """
        sku_df = df[df["sku"] == sku].copy()
        if sku_df.empty:
            return pd.DataFrame()

        sku_df["date"] = pd.to_datetime(sku_df["date"]).dt.date

        # Sum quantities per day
        daily = sku_df.groupby("date")["quantity"].sum().reset_index()
        daily["date"] = pd.to_datetime(daily["date"])

        # Create continuous date range to fill days with zero sales
        min_date = daily["date"].min()
        max_date = daily["date"].max()

        # Need at least 10 days of span
        if (max_date - min_date).days < 7:
            min_date = max_date - timedelta(days=14)

        full_range = pd.date_range(start=min_date, end=max_date, freq="D", name="date")
        daily = daily.set_index("date").reindex(full_range, fill_value=0).reset_index()
        daily["quantity"] = daily["quantity"].astype(float)
        return daily

    @classmethod
    def generate_features(cls, daily_df: pd.DataFrame) -> pd.DataFrame:
        """
        Builds calendar, lag, and rolling window features.
        """
        if len(daily_df) < 10:
            return pd.DataFrame()

        df = daily_df.sort_values("date").copy()

        # Calendar features (Day of week: Monday=0, Saturday=5, Sunday=6)
        df["day_of_week"] = df["date"].dt.dayofweek
        # In Nepal, Saturday is the primary weekly holiday (peak grocery/retail shopping day)
        df["is_saturday"] = (df["day_of_week"] == 5).astype(int)
        df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)
        df["day_of_month"] = df["date"].dt.day
        df["month"] = df["date"].dt.month

        # Autoregressive Lag Features
        df["lag_1"] = df["quantity"].shift(1)
        df["lag_2"] = df["quantity"].shift(2)
        df["lag_7"] = df["quantity"].shift(7)

        # Rolling Window Statistics
        df["rolling_mean_7"] = df["quantity"].shift(1).rolling(window=7, min_periods=1).mean()

        # Backfill any remaining NaN from early shifts to prevent data drop
        df["lag_1"] = df["lag_1"].bfill().fillna(0)
        df["lag_2"] = df["lag_2"].bfill().fillna(0)
        df["lag_7"] = df["lag_7"].bfill().fillna(0)
        df["rolling_mean_7"] = df["rolling_mean_7"].bfill().fillna(0)

        return df

    @classmethod
    def prepare_dataset(cls, df: pd.DataFrame, sku: str) -> Tuple[pd.DataFrame, pd.Series, pd.DataFrame]:
        """
        Creates (X, y, full_featured_df) for a given product SKU.
        """
        daily = cls.build_daily_series(df, sku)
        if daily.empty:
            return pd.DataFrame(), pd.Series(dtype=float), pd.DataFrame()

        featured = cls.generate_features(daily)
        if featured.empty:
            return pd.DataFrame(), pd.Series(dtype=float), pd.DataFrame()

        X = featured[FEATURE_COLUMNS].copy()
        y = featured["quantity"].copy()
        return X, y, featured
