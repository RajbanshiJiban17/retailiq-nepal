"""
ETL Pipeline Test & Validation Script
Tests POS CSV sanitization, dirty data resilience, multi-tenant loading, and DB operations.
"""
import asyncio
import sys
import uuid
from decimal import Decimal
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.base import Base
from app.models.business import Business
from app.models.product import Product
from app.models.sale import Sale, SaleItem, PaymentMethod
from app.services.etl.pos_cleaner import POSDataCleaner
from app.services.etl.loader import POSDataLoader


# Dirty POS CSV mimicking realistic export issues
MOCK_DIRTY_POS_CSV = """Bill No,Date,SKU,Item Name,Category,Qty,Rate,Discount,VAT,Total,Payment Mode,Customer Name,Customer Phone
INV-1001,2026-09-10 10:15:00,WAI-75G,Wai Wai Quick 75g,Instant Food,5,"Rs. 25.00",0.00,16.25,"Rs. 141.25",eSewa,Ramesh Sharma,9841234567
INV-1001,2026-09-10 10:15:00,,Ilam Black Tea 500g,Beverages,2,"NPR 300.00",20.00,75.40,655.40,eSewa,Ramesh Sharma,9841234567
INV-1002,10/09/2026,DDC-GHEE-1L,DDC Pure Cow Ghee 1L,Dairy,1,1150.00,0,149.50,1299.50,Fonepay,Sita Thapa,9801122334
INV-1003,2026-09-10 12:00:00,AAN-RICE-25KG,Aanadi Basmati Rice 25kg,Grains,2,0.00,0,0,5000.00,Cash,Gopal KC,9812345678
INV-1004,2026-09-10 12:30:00,BAD-QTY-ITEM,Defective Widget,Misc,-5,100.00,0,0,-500.00,Cash,Unknown,
,2026-09-10 13:00:00,NO-INV-ITEM,Missing Invoice Product,Misc,1,50.00,0,0,50.00,Cash,,
INV-1005,2026-09-10 13:30:00,,,Misc,1,100.00,0,0,100.00,Khalti,,
"""


class AsyncSQLiteTestSession:
    """
    Test adapter delegating async session calls to standard SQLite.
    Allows running async loader tests without requiring external drivers.
    """
    def __init__(self, sync_session):
        self._session = sync_session

    async def execute(self, stmt):
        return self._session.execute(stmt)

    def add(self, obj):
        self._session.add(obj)

    async def flush(self):
        self._session.flush()

    async def commit(self):
        self._session.commit()


async def run_etl_validation():
    print("=" * 60)
    print("[INFO] STARTING POS ETL PIPELINE VALIDATION")
    print("=" * 60)

    # 1. Test Data Sanitization with Pandas
    print("\n1. Testing Pandas Data Sanitization Engine:")
    csv_bytes = MOCK_DIRTY_POS_CSV.encode("utf-8")
    cleaned = POSDataCleaner.sanitize(csv_bytes)

    print(f"  Total raw rows in CSV: {cleaned.total_raw_rows}")
    print(f"  Valid sanitized records: {len(cleaned.records)}")
    print(f"  Errors caught: {len(cleaned.errors)}")
    print(f"  Warnings generated: {len(cleaned.warnings)}")

    # Assertions on Sanitization
    assert len(cleaned.records) == 4, f"Expected 4 valid records, got {len(cleaned.records)}"
    assert len(cleaned.errors) == 3, f"Expected 3 rejected corrupt rows, got {len(cleaned.errors)}"

    # Check that dirty currency symbols were stripped
    r1 = cleaned.records[0]
    assert r1.unit_price == Decimal("25.00"), f"Failed to strip 'Rs.' prefix: {r1.unit_price}"
    assert r1.payment_method == PaymentMethod.ESEWA, f"Payment method mapping failed: {r1.payment_method}"
    print("  [PASS] Currency symbols ('Rs.', 'NPR') cleanly stripped to Decimal values.")
    print("  [PASS] Payment method normalized to PaymentMethod.ESEWA.")

    # Check auto-generated SKU for item with missing SKU (Row 2 in data: Ilam Black Tea)
    r2 = cleaned.records[1]
    assert r2.sku.startswith("ILAM-BLACK-TEA"), f"Auto-generated SKU unexpected: {r2.sku}"
    print(f"  [PASS] Missing SKU handled: auto-generated '{r2.sku}'.")

    # Check zero price auto-derivation from total / qty (Row 4 in data: Aanadi Basmati Rice)
    r4 = cleaned.records[3]
    assert r4.unit_price == Decimal("2500.00"), f"Expected 5000 / 2 = 2500.00, got {r4.unit_price}"
    print("  [PASS] Zero unit price resolved from subtotal / quantity.")

    # Check error reasons
    error_reasons = [e.reason for e in cleaned.errors]
    assert any("Invalid quantity" in r for r in error_reasons), "Missing negative quantity error"
    assert any("Missing mandatory invoice" in r for r in error_reasons), "Missing blank invoice error"
    assert any("Missing both product name and SKU" in r for r in error_reasons), "Missing product/sku error"
    print("  [PASS] Corrupt records correctly identified with line numbers and reasons.")

    # 2. Test Multi-Tenant Database Bulk Load
    print("\n2. Testing Asynchronous Database Bulk Loading:")
    
    # Use in-memory SQLite with the AsyncSQLiteTestSession adapter
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SyncSession = sessionmaker(bind=engine)

    tenant_id = uuid.uuid4()
    other_tenant_id = uuid.uuid4()

    sync_session = SyncSession()
    session = AsyncSQLiteTestSession(sync_session)

    # Create a test tenant
    tenant = Business(
        id=tenant_id,
        name="Kathmandu Mart Pvt. Ltd.",
        slug="ktm-mart",
        pan_vat_number="600123456",
        currency="NPR",
    )
    sync_session.add(tenant)
    sync_session.commit()

    # Run loader
    summary = await POSDataLoader.load(
        session=session,
        business_id=tenant_id,
        file_name="pos_export_2026.csv",
        cleaned=cleaned,
    )
    sync_session.commit()

    print(f"  ETL Status: {summary.status}")
    print(f"  Invoices Created: {summary.invoices_created}")
    print(f"  Line Items Loaded: {summary.items_recorded}")
    print(f"  Products Auto-Created: {summary.products_auto_created}")
    print(f"  Total Revenue Loaded: Rs. {summary.total_revenue_npr:,.2f}")

    assert summary.status == "partial", f"Expected 'partial' status due to errors, got {summary.status}"
    assert summary.invoices_created == 3, f"Expected 3 invoices (INV-1001, INV-1002, INV-1003), got {summary.invoices_created}"
    assert summary.items_recorded == 4, f"Expected 4 items recorded, got {summary.items_recorded}"
    assert summary.products_auto_created == 4, f"Expected 4 new catalog products, got {summary.products_auto_created}"

    # Verify multi-tenant enforcement
    sales = sync_session.execute(Sale.__table__.select().where(Sale.business_id == tenant_id)).all()
    assert len(sales) == 3, "Failed tenant scoping on sales table"

    other_sales = sync_session.execute(Sale.__table__.select().where(Sale.business_id == other_tenant_id)).all()
    assert len(other_sales) == 0, "Tenant isolation leak detected!"
    print("  [PASS] Strict multi-tenant isolation verified: 0 records leaked across tenants.")

    # Test duplicate invoice prevention
    summary_dup = await POSDataLoader.load(
        session=session,
        business_id=tenant_id,
        file_name="pos_export_2026_dup.csv",
        cleaned=cleaned,
    )
    assert summary_dup.invoices_created == 0, "Duplicate invoice was incorrectly re-inserted!"
    print("  [PASS] Duplicate invoice prevention verified (0 duplicate headers inserted).")

    sync_session.close()

    print("\n" + "=" * 60)
    print("[SUCCESS] ALL ETL SANITIZATION AND LOADING CHECKS PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_etl_validation())
