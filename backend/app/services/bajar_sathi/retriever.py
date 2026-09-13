"""
Multi-Tenant Database Fact Retriever for Bajar ko Sathi
Extracts live inventory, sales performance, and tenant facts strictly scoped by business_id.
"""
import uuid
from decimal import Decimal
from typing import Dict, List, Tuple
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.business import Business
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.schemas.bajar_sathi import ContextFactSummary


class TenantContextRetriever:
    """
    Pulls structured factual context from PostgreSQL strictly for a single tenant business.
    Guarantees no cross-tenant information is ever retrieved.
    """

    @classmethod
    async def retrieve(
        cls,
        session: AsyncSession,
        business_id: uuid.UUID,
    ) -> Tuple[str, ContextFactSummary, Business]:
        # 1. Fetch Tenant Business
        biz_stmt = select(Business).where(Business.id == business_id)
        biz_res = await session.execute(biz_stmt)
        business = biz_res.scalar_one_or_none()
        if not business:
            raise ValueError(f"Business with ID '{business_id}' does not exist.")

        # 2. Fetch Active Products & Inventory
        prod_stmt = select(Product).where(
            Product.business_id == business_id,
            Product.is_active == True,
        ).order_by(Product.name)
        prod_res = await session.execute(prod_stmt)
        products = prod_res.scalars().all()

        low_stock_items: List[Product] = []
        catalog_lines: List[str] = []
        for p in products:
            is_low = p.stock_quantity <= p.reorder_level
            if is_low:
                low_stock_items.append(p)
            status_text = "⚠️ स्टक सकिन लाग्यो (Reorder Needed)" if is_low else "पर्याप्त स्टक (In Stock)"
            catalog_lines.append(
                f"- SKU: {p.sku} | सामान: {p.name} | वर्ग: {p.category} | "
                f"मूल्य: रु. {p.selling_price:,.2f} | मौज्दात: {p.stock_quantity} {p.unit} "
                f"(न्यूनतम थ्रेसहोल्ड: {p.reorder_level}) | अवस्था: {status_text}"
            )

        # 3. Fetch Sales Performance Aggregates
        sales_stmt = select(
            func.count(Sale.id),
            func.coalesce(func.sum(Sale.total_amount), 0.0),
        ).where(Sale.business_id == business_id)
        sales_res = await session.execute(sales_stmt)
        total_invoices, total_revenue = sales_res.one()

        # Payment Methods breakdown
        pay_stmt = select(
            Sale.payment_method,
            func.count(Sale.id),
            func.coalesce(func.sum(Sale.total_amount), 0.0),
        ).where(Sale.business_id == business_id).group_by(Sale.payment_method)
        pay_res = await session.execute(pay_stmt)
        payment_lines = [
            f"- {row[0].upper()}: {row[1]} पटक बिल (जम्मा रकम: रु. {row[2]:,.2f})"
            for row in pay_res.all()
        ]

        # Top 5 Selling Products by Quantity
        top_items_stmt = select(
            SaleItem.product_name,
            SaleItem.product_sku,
            func.sum(SaleItem.quantity).label("total_qty"),
            func.sum(SaleItem.subtotal).label("total_rev"),
        ).where(
            SaleItem.business_id == business_id
        ).group_by(
            SaleItem.product_name,
            SaleItem.product_sku,
        ).order_by(desc("total_qty")).limit(5)
        top_items_res = await session.execute(top_items_stmt)
        top_sellers = [
            f"- {r[0]} ({r[1]}): {r[2]} वटा बिक्री (रकम: रु. {r[3]:,.2f})"
            for r in top_items_res.all()
        ]

        # 4. Construct Structured Prompt Grounding Context
        low_stock_names = [p.name for p in low_stock_items]
        
        context_text = f"""=== पसलको आधिकारिक डाटाबेस विवरण (STORE FACTS) ===
पसलको नाम: {business.name}
ठेगाना/सहर: {business.address or 'उपलब्ध छैन'}, {business.city or 'Kathmandu'}
आधिकारिक मुद्रा: {business.currency}
पान/भ्याट (PAN/VAT): {business.pan_vat_number or 'दर्ता नभएको'}

--- [१. इन्भेन्टरी र सामानहरूको स्टक विवरण (INVENTORY)] ---
कुल सक्रिय सामानहरू: {len(products)} प्रकार
स्टक सकिन लागेका सामानहरू संख्या: {len(low_stock_items)} वटा
सामानहरूको सूची:
{chr(10).join(catalog_lines) if catalog_lines else "हाल कुनै सामान दर्ता भएको छैन।"}

--- [२. बिक्री र आम्दानी विवरण (SALES & REVENUE)] ---
कुल बिक्री बिलहरू: {total_invoices} वटा
कुल बिक्री आम्दानी: रु. {float(total_revenue):,.2f}

भुक्तानी माध्यमहरू:
{chr(10).join(payment_lines) if payment_lines else "- हालसम्म कुनै बिक्री कारोबार भएको छैन।"}

धेरै बिक्री भएका मुख्य सामानहरू (Top Movers):
{chr(10).join(top_sellers) if top_sellers else "- कुनै कारोबार रेकर्ड छैन।"}
"""

        summary = ContextFactSummary(
            business_name=business.name,
            total_active_products=len(products),
            low_stock_items_count=len(low_stock_items),
            total_sales_invoices=int(total_invoices),
            total_revenue_npr=float(total_revenue),
            sample_low_stock_items=low_stock_names[:5],
        )

        return context_text, summary, business
