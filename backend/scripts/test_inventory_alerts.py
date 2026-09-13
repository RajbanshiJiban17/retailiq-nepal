"""
Automated Test Suite for Inventory Alerts, Dead Stock Detection & Health Analyzer
Validates multi-tenant isolation, trapped capital calculations, and threshold alerting logic.
"""
import asyncio
import sys
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Configure stdout for UTF-8 output on Windows PowerShell
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.base import Base
from app.models.business import Business
from app.models.product import Product
from app.models.sale import Sale, SaleItem, PaymentMethod, PaymentStatus
from app.schemas.inventory_alerts import DeadStockRiskLevel, LowStockSeverity
from app.services.inventory_alerts.dead_stock import DeadStockService
from app.services.inventory_alerts.low_stock import LowStockAlertService
from app.services.inventory_alerts.health_analyzer import InventoryHealthAnalyzer


class AsyncSQLiteTestSession:
    """Test adapter for synchronous SQLite database to emulate async SQLAlchemy session."""
    def __init__(self, sync_session):
        self._s = sync_session

    async def execute(self, stmt):
        return self._s.execute(stmt)

    def add(self, obj):
        self._s.add(obj)

    async def flush(self):
        self._s.flush()

    async def commit(self):
        self._s.commit()


async def run_inventory_alerts_validation():
    print("=" * 65)
    print("[INFO] STARTING INVENTORY ALERTS & DEAD STOCK DETECTION VALIDATION")
    print("=" * 65)

    # 1. Setup Test Database
    print("\n1. Setting up in-memory multi-tenant database...")
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SyncSession = sessionmaker(bind=engine)
    sync_session = SyncSession()
    session = AsyncSQLiteTestSession(sync_session)

    now = datetime.now(timezone.utc)

    # Create Tenants
    tenant_a_id = uuid.uuid4()
    tenant_b_id = uuid.uuid4()

    biz_a = Business(
        id=tenant_a_id,
        name="पशुपति किराना स्टोर (Pashupati Kirana)",
        slug="pashupati-kirana",
        pan_vat_number="301234567",
        currency="NPR",
    )
    biz_b = Business(
        id=tenant_b_id,
        name="पोखरा सुपरमार्केट (Pokhara Supermarket)",
        slug="pokhara-supermarket",
        pan_vat_number="309876543",
        currency="NPR",
    )
    session.add(biz_a)
    session.add(biz_b)

    # Products for Tenant A
    # Prod 1: Dead Stock (CRITICAL_DEAD: sold 120 days ago)
    prod_kettle = Product(
        id=uuid.uuid4(),
        business_id=tenant_a_id,
        sku="SKU-KET-001",
        name="Electric Kettle 1.8L",
        category="Appliances",
        unit="piece",
        unit_cost=Decimal("1200.00"),
        selling_price=Decimal("1600.00"),
        stock_quantity=15,
        reorder_level=10,
        is_active=True,
    )
    # Prod 2: Dead Stock (STAGNANT: created 80 days ago, never sold)
    prod_caps = Product(
        id=uuid.uuid4(),
        business_id=tenant_a_id,
        sku="SKU-CAP-002",
        name="Winter Woolen Caps",
        category="Clothing",
        unit="piece",
        unit_cost=Decimal("300.00"),
        selling_price=Decimal("500.00"),
        stock_quantity=25,
        reorder_level=15,
        created_at=now - timedelta(days=80),
        is_active=True,
    )
    # Prod 3: Low Stock (OUT_OF_STOCK: stock = 0)
    prod_noodles = Product(
        id=uuid.uuid4(),
        business_id=tenant_a_id,
        sku="SKU-NDL-003",
        name="Wai Wai Chicken Noodles",
        category="Groceries",
        unit="packet",
        unit_cost=Decimal("20.00"),
        selling_price=Decimal("25.00"),
        stock_quantity=0,
        reorder_level=50,
        is_active=True,
    )
    # Prod 4: Low Stock (CRITICAL: stock = 4 <= 20 * 0.3 = 6)
    prod_oil = Product(
        id=uuid.uuid4(),
        business_id=tenant_a_id,
        sku="SKU-OIL-004",
        name="Fortune Sunflower Oil 1L",
        category="Groceries",
        unit="pouch",
        unit_cost=Decimal("220.00"),
        selling_price=Decimal("260.00"),
        stock_quantity=4,
        reorder_level=20,
        is_active=True,
    )
    # Prod 5: Low Stock (WARNING: stock = 12 <= reorder_level 15)
    prod_tea = Product(
        id=uuid.uuid4(),
        business_id=tenant_a_id,
        sku="SKU-TEA-005",
        name="Tokla Tea 500g",
        category="Beverages",
        unit="packet",
        unit_cost=Decimal("280.00"),
        selling_price=Decimal("340.00"),
        stock_quantity=12,
        reorder_level=15,
        is_active=True,
    )
    # Prod 6: Healthy SKU (stock = 50 > reorder_level 20, active sale)
    prod_atta = Product(
        id=uuid.uuid4(),
        business_id=tenant_a_id,
        sku="SKU-ATT-006",
        name="Aashirvaad Atta 5kg",
        category="Groceries",
        unit="bag",
        unit_cost=Decimal("400.00"),
        selling_price=Decimal("480.00"),
        stock_quantity=50,
        reorder_level=20,
        is_active=True,
    )

    # Products for Tenant B (Isolation Check)
    prod_rice_b = Product(
        id=uuid.uuid4(),
        business_id=tenant_b_id,
        sku="SKU-RICE-B01",
        name="Pokhara Mansuli Rice 25kg",
        category="Grains",
        unit="bag",
        unit_cost=Decimal("1800.00"),
        selling_price=Decimal("2200.00"),
        stock_quantity=40,
        reorder_level=10,
        is_active=True,
    )

    session.add(prod_kettle)
    session.add(prod_caps)
    session.add(prod_noodles)
    session.add(prod_oil)
    session.add(prod_tea)
    session.add(prod_atta)
    session.add(prod_rice_b)

    # Historic Sales for Tenant A
    # Old sale 120 days ago for Kettle
    sale_old = Sale(
        id=uuid.uuid4(),
        business_id=tenant_a_id,
        invoice_number="INV-OLD-001",
        subtotal=Decimal("1600.00"),
        total_amount=Decimal("1600.00"),
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PAID,
        created_at=now - timedelta(days=120),
    )
    sale_item_old = SaleItem(
        id=uuid.uuid4(),
        business_id=tenant_a_id,
        sale_id=sale_old.id,
        product_id=prod_kettle.id,
        product_name=prod_kettle.name,
        product_sku=prod_kettle.sku,
        quantity=1,
        unit_price=prod_kettle.selling_price,
        subtotal=prod_kettle.selling_price,
    )
    session.add(sale_old)
    session.add(sale_item_old)

    # Recent sales for other products
    sale_recent = Sale(
        id=uuid.uuid4(),
        business_id=tenant_a_id,
        invoice_number="INV-REC-002",
        subtotal=Decimal("1500.00"),
        total_amount=Decimal("1500.00"),
        payment_method=PaymentMethod.FONEPAY,
        payment_status=PaymentStatus.PAID,
        created_at=now - timedelta(days=2),
    )
    session.add(sale_recent)
    session.add(SaleItem(
        id=uuid.uuid4(),
        business_id=tenant_a_id,
        sale_id=sale_recent.id,
        product_id=prod_noodles.id,
        product_name=prod_noodles.name,
        product_sku=prod_noodles.sku,
        quantity=10,
        unit_price=prod_noodles.selling_price,
        subtotal=Decimal("250.00"),
    ))
    session.add(SaleItem(
        id=uuid.uuid4(),
        business_id=tenant_a_id,
        sale_id=sale_recent.id,
        product_id=prod_oil.id,
        product_name=prod_oil.name,
        product_sku=prod_oil.sku,
        quantity=2,
        unit_price=prod_oil.selling_price,
        subtotal=Decimal("520.00"),
    ))
    session.add(SaleItem(
        id=uuid.uuid4(),
        business_id=tenant_a_id,
        sale_id=sale_recent.id,
        product_id=prod_atta.id,
        product_name=prod_atta.name,
        product_sku=prod_atta.sku,
        quantity=1,
        unit_price=prod_atta.selling_price,
        subtotal=Decimal("480.00"),
    ))

    # Old sale for Tenant B (150 days ago)
    sale_b = Sale(
        id=uuid.uuid4(),
        business_id=tenant_b_id,
        invoice_number="INV-B-001",
        subtotal=Decimal("2200.00"),
        total_amount=Decimal("2200.00"),
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PAID,
        created_at=now - timedelta(days=150),
    )
    session.add(sale_b)
    session.add(SaleItem(
        id=uuid.uuid4(),
        business_id=tenant_b_id,
        sale_id=sale_b.id,
        product_id=prod_rice_b.id,
        product_name=prod_rice_b.name,
        product_sku=prod_rice_b.sku,
        quantity=1,
        unit_price=prod_rice_b.selling_price,
        subtotal=Decimal("2200.00"),
    ))

    await session.commit()
    print("  [PASS] Multi-tenant inventory & transaction fixtures committed.")

    # 2. Test Dead Stock Detection
    print("\n2. Testing Dead Stock Detection (threshold = 60 days)...")
    dead_res = await DeadStockService.detect_dead_stock(
        db=session,
        business_id=str(tenant_a_id),
        days_threshold=60,
    )
    print(f"  Detected Dead Items: {dead_res.total_dead_stock_items}")
    print(f"  Total Trapped Capital: Rs. {dead_res.total_trapped_capital_npr:,.2f}")
    print(f"  Total Potential Revenue: Rs. {dead_res.total_potential_revenue_npr:,.2f}")
    print(f"  Most Stagnant Category: {dead_res.most_stagnant_category}")

    assert dead_res.total_dead_stock_items == 2, f"Expected 2 dead items, got {dead_res.total_dead_stock_items}"
    # Expected trapped capital:
    # Kettle: 15 * 1200 = 18,000
    # Woolen Caps: 25 * 300 = 7,500
    # Total = 25,500.00
    expected_trapped = Decimal("25500.00")
    assert dead_res.total_trapped_capital_npr == expected_trapped, (
        f"Expected Rs. {expected_trapped}, got {dead_res.total_trapped_capital_npr}"
    )

    # Check risk levels
    item_map = {item.sku: item for item in dead_res.items}
    assert item_map["SKU-KET-001"].risk_level == DeadStockRiskLevel.CRITICAL_DEAD
    assert item_map["SKU-CAP-002"].risk_level == DeadStockRiskLevel.STAGNANT
    print("  [PASS] Trapped capital and risk tiers accurately computed.")

    # Check multi-tenant isolation (Tenant B product must NOT appear)
    assert "SKU-RICE-B01" not in item_map, "Multi-tenant violation: Tenant B item found in Tenant A dead stock!"
    print("  [PASS] Multi-tenant isolation verified (Zero cross-store data leakage).")

    # 3. Test Low Stock Alert Engine
    print("\n3. Testing Low Stock Alerts Engine...")
    low_res = await LowStockAlertService.get_low_stock_alerts(
        db=session,
        business_id=str(tenant_a_id),
    )
    print(f"  Total Low Stock Alerts: {low_res.total_alerts}")
    print(f"  Out of Stock Count: {low_res.out_of_stock_count}")
    print(f"  Critical Low Count: {low_res.critical_count}")
    print(f"  Warning Count: {low_res.warning_count}")
    print(f"  Total Restock Budget: Rs. {low_res.total_restock_budget_npr:,.2f}")

    assert low_res.total_alerts == 3, f"Expected 3 low stock alerts, got {low_res.total_alerts}"
    assert low_res.out_of_stock_count == 1, "Expected 1 OUT_OF_STOCK (Wai Wai Noodles)"
    assert low_res.critical_count == 1, "Expected 1 CRITICAL (Sunflower Oil)"
    assert low_res.warning_count == 1, "Expected 1 WARNING (Tokla Tea)"

    low_map = {item.sku: item for item in low_res.items}
    assert low_map["SKU-NDL-003"].severity == LowStockSeverity.OUT_OF_STOCK
    assert low_map["SKU-OIL-004"].severity == LowStockSeverity.CRITICAL
    assert low_map["SKU-TEA-005"].severity == LowStockSeverity.WARNING

    # Check Restock Budget:
    # Noodles: suggested = 100, cost = 100 * 20 = 2,000
    # Oil: suggested = 36, cost = 36 * 220 = 7,920
    # Tea: suggested = 18, cost = 18 * 280 = 5,040
    # Total = 14,960.00
    expected_budget = Decimal("14960.00")
    assert low_res.total_restock_budget_npr == expected_budget, (
        f"Expected Rs. {expected_budget}, got {low_res.total_restock_budget_npr}"
    )
    print("  [PASS] Severity classifications and replenishment budgets verified.")

    # 4. Test Inventory Health Overview
    print("\n4. Testing 360-Degree Inventory Health Overview...")
    health = await InventoryHealthAnalyzer.get_health_overview(
        db=session,
        business_id=str(tenant_a_id),
        dead_stock_threshold_days=60,
    )
    print(f"  Total Active SKUs: {health.total_active_skus}")
    print(f"  Total Stock Units: {health.total_stock_units}")
    print(f"  Total Cost Valuation: Rs. {health.total_inventory_cost_valuation_npr:,.2f}")
    print(f"  Total Retail Valuation: Rs. {health.total_inventory_retail_valuation_npr:,.2f}")
    print(f"  Inventory Health Score: {health.health_score_percent}%")
    print(f"  Healthy SKUs: {health.healthy_items_count}")
    print(f"  Low Stock SKUs: {health.low_stock_items_count}")
    print(f"  Dead Stock SKUs: {health.dead_stock_items_count}")
    print(f"  Dead Capital Ratio: {health.dead_capital_ratio_percent}%")

    assert health.total_active_skus == 6, f"Expected 6 SKUs, got {health.total_active_skus}"
    assert health.healthy_items_count == 1, "Only Atta is healthy (not low stock, not dead stock)"
    assert health.dead_stock_items_count == 2
    assert health.low_stock_items_count == 3
    print("  [PASS] 360-degree inventory health analysis synthesized successfully.")

    print("\n" + "=" * 65)
    print("[SUCCESS] ALL INVENTORY ALERTS & DEAD STOCK TESTS PASSED!")
    print("=" * 65)


if __name__ == "__main__":
    asyncio.run(run_inventory_alerts_validation())
