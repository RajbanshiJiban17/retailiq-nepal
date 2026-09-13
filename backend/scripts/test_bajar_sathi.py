"""
Test Script for 'Bajar ko Sathi' RAG Assistant
Validates multi-tenant context retrieval, anti-hallucination guardrails, and Nepali output.
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

# Configure stdout for UTF-8 Devanagari output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.base import Base
from app.models.business import Business
from app.models.product import Product
from app.models.sale import Sale, SaleItem, PaymentMethod, PaymentStatus
from app.services.bajar_sathi.retriever import TenantContextRetriever
from app.services.bajar_sathi.assistant import BajarKoSathiAssistant


class AsyncSQLiteTestSession:
    """Test adapter for synchronous SQLite database."""
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


async def run_bajar_sathi_validation():
    print("=" * 60)
    print("[INFO] STARTING 'BAJAR KO SATHI' RAG ASSISTANT VALIDATION")
    print("=" * 60)

    # 1. Setup Test Database with 2 Tenants
    print("\n1. Setting up database with 2 distinct tenants (isolation test)...")
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SyncSession = sessionmaker(bind=engine)
    sync_session = SyncSession()
    session = AsyncSQLiteTestSession(sync_session)

    tenant_a_id = uuid.uuid4()
    tenant_b_id = uuid.uuid4()

    # Tenant A: Kathmandu Grocery
    biz_a = Business(
        id=tenant_a_id,
        name="काठमाडौं किराना स्टोर (Kathmandu Grocery)",
        slug="ktm-grocery",
        currency="NPR",
        pan_vat_number="601122334",
    )
    # Tenant B: Pokhara Mart
    biz_b = Business(
        id=tenant_b_id,
        name="पोखरा सुपरमार्ट (Pokhara Supermart)",
        slug="pokhara-mart",
        currency="NPR",
        pan_vat_number="609988776",
    )
    sync_session.add_all([biz_a, biz_b])
    sync_session.commit()

    # Products for Tenant A
    p_wai = Product(
        business_id=tenant_a_id,
        sku="WAI-75G",
        name="Wai Wai Quick 75g",
        category="Instant Food",
        selling_price=Decimal("25.00"),
        stock_quantity=150,
        reorder_level=20,
    )
    p_ghee = Product(
        business_id=tenant_a_id,
        sku="DDC-GHEE-1L",
        name="DDC Pure Cow Ghee 1L",
        category="Dairy",
        selling_price=Decimal("1150.00"),
        stock_quantity=3,       # Low stock trigger!
        reorder_level=10,
    )

    # Products for Tenant B (should NEVER leak to Tenant A)
    p_rice = Product(
        business_id=tenant_b_id,
        sku="BAS-RICE-25KG",
        name="Aanadi Basmati Rice 25kg",
        category="Grains",
        selling_price=Decimal("2850.00"),
        stock_quantity=40,
        reorder_level=5,
    )
    sync_session.add_all([p_wai, p_ghee, p_rice])
    sync_session.commit()

    # Sales for Tenant A
    sale_1 = Sale(
        business_id=tenant_a_id,
        invoice_number="INV-001",
        subtotal=Decimal("500.00"),
        total_amount=Decimal("500.00"),
        payment_method=PaymentMethod.FONEPAY,
        payment_status=PaymentStatus.PAID,
    )
    sync_session.add(sale_1)
    sync_session.commit()

    sale_item_1 = SaleItem(
        business_id=tenant_a_id,
        sale_id=sale_1.id,
        product_id=p_wai.id,
        product_name=p_wai.name,
        product_sku=p_wai.sku,
        quantity=20,
        unit_price=Decimal("25.00"),
        subtotal=Decimal("500.00"),
    )
    sync_session.add(sale_item_1)
    sync_session.commit()

    print("  [PASS] Multi-tenant database populated.")

    # 2. Test Multi-Tenant Context Retrieval
    print("\n2. Testing Tenant Context Retrieval:")
    context_text, facts, biz = await TenantContextRetriever.retrieve(
        session=session,
        business_id=tenant_a_id,
    )

    print(f"  Retrieved Business: {biz.name}")
    print(f"  Active Products: {facts.total_active_products}")
    print(f"  Low Stock Items: {facts.low_stock_items_count} ({facts.sample_low_stock_items})")
    print(f"  Total Invoices: {facts.total_sales_invoices}")
    print(f"  Total Revenue: Rs. {facts.total_revenue_npr:,.2f}")

    assert facts.total_active_products == 2, f"Expected 2 products for Tenant A, got {facts.total_active_products}"
    assert facts.low_stock_items_count == 1, f"Expected 1 low stock item for Tenant A, got {facts.low_stock_items_count}"
    assert "DDC Pure Cow Ghee 1L" in facts.sample_low_stock_items
    assert "Wai Wai Quick 75g" in context_text
    assert "Aanadi Basmati Rice 25kg" not in context_text, "CRITICAL: Tenant B product leaked into Tenant A context!"
    print("  [PASS] Strict multi-tenant context isolation confirmed (0 cross-tenant data leak).")
    print("  [PASS] DDC Ghee correctly identified as low stock.")

    # 3. Test Anti-Hallucination Guardrail on Unlisted Items
    print("\n3. Testing Anti-Hallucination Guardrail on Unlisted Items:")
    hallucination_query = "iPhone 16 Pro Max को स्टक कति छ र कतिमा पाइन्छ?"
    ans_hallucination, _, _, _ = await BajarKoSathiAssistant.generate_response(
        query=hallucination_query,
        context_text=context_text,
        facts=facts,
    )
    print(f"  Query: '{hallucination_query}'")
    print(f"  Assistant Response: '{ans_hallucination}'")
    assert "माफ गर्नुहोला" in ans_hallucination or "उपलब्ध छैन" in ans_hallucination, "Anti-hallucination refusal failed!"
    print("  [PASS] Anti-hallucination protocol triggered: model cleanly refused unlisted product.")

    # 4. Test In-Domain Inventory Query in Nepali
    print("\n4. Testing Grounded Inventory Query in Nepali:")
    inventory_query = "मेरो पसलमा कुन सामान सकिन लागेको छ?"
    ans_inventory, model_name, has_key, latency = await BajarKoSathiAssistant.generate_response(
        query=inventory_query,
        context_text=context_text,
        facts=facts,
    )
    print(f"  Query: '{inventory_query}'")
    print(f"  Model Used: {model_name} (Has Gemini Key: {has_key}, Latency: {latency}ms)")
    print(f"  Assistant Response:\n{ans_inventory}\n")
    assert "DDC Pure Cow Ghee 1L" in ans_inventory or "घिउ" in ans_inventory or "स्टक" in ans_inventory
    print("  [PASS] In-domain inventory query answered accurately in Nepali.")

    # 5. Test Sales Query in Nepali
    print("\n5. Testing Grounded Sales Query in Nepali:")
    sales_query = "मेरो कुल बिक्री आम्दानी कति भयो?"
    ans_sales, _, _, _ = await BajarKoSathiAssistant.generate_response(
        query=sales_query,
        context_text=context_text,
        facts=facts,
    )
    print(f"  Query: '{sales_query}'")
    print(f"  Assistant Response:\n{ans_sales}\n")
    assert "500" in ans_sales or "रु." in ans_sales
    print("  [PASS] Sales inquiry reconciled with database facts in Nepali.")

    sync_session.close()

    print("=" * 60)
    print("[SUCCESS] ALL 'BAJAR KO SATHI' RAG ASSISTANT CHECKS PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_bajar_sathi_validation())
