"""
Inventory Alerts and Dead Stock Analytics Package
"""
from app.services.inventory_alerts.dead_stock import DeadStockService
from app.services.inventory_alerts.low_stock import LowStockAlertService
from app.services.inventory_alerts.health_analyzer import InventoryHealthAnalyzer

__all__ = [
    "DeadStockService",
    "LowStockAlertService",
    "InventoryHealthAnalyzer",
]
