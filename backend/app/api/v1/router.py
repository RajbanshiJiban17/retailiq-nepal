from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, items, etl, forecasting, bajar_sathi, inventory_alerts, reports

api_router = APIRouter()

# Include endpoint sub-routers
api_router.include_router(health.router, tags=["System Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["JWT Authentication & Access Control"])
api_router.include_router(items.router, prefix="/items", tags=["Inventory Items"])
api_router.include_router(etl.router, prefix="/etl", tags=["POS ETL Pipeline"])
api_router.include_router(forecasting.router, prefix="/forecasting", tags=["Demand Forecasting"])
api_router.include_router(bajar_sathi.router, prefix="/bajar-ko-sathi", tags=["Bajar ko Sathi (AI Assistant)"])
api_router.include_router(inventory_alerts.router, prefix="/inventory-alerts", tags=["Inventory Alerts & Dead Stock"])
api_router.include_router(reports.router, prefix="/reports", tags=["Business Performance Reports (PDF)"])



