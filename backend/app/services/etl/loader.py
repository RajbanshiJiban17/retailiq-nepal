"""
Asynchronous PostgreSQL Bulk Loader for Sanitized POS Transactions
"""
import uuid
from collections import defaultdict
from decimal import Decimal
from typing import Dict, List, Set
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.business import Business
from app.models.product import Product
from app.models.sale import PaymentStatus, Sale, SaleItem
from app.schemas.etl import ETLRowError, ETLUploadSummary, ETLWarning
from app.services.etl.pos_cleaner import CleanedPOSRecord, CleanedPOSResult


class POSDataLoader:
    """
    Bulk persistence engine ensuring multi-tenant isolation and transactional integrity.
    """

    @classmethod
    async def load(
        cls,
        session: AsyncSession,
        business_id: uuid.UUID,
        file_name: str,
        cleaned: CleanedPOSResult,
    ) -> ETLUploadSummary:
        # 1. Verify Tenant Business exists
        biz_stmt = select(Business).where(Business.id == business_id)
        biz_res = await session.execute(biz_stmt)
        business = biz_res.scalar_one_or_none()

        if not business:
            business = Business(
                id=business_id,
                name="My Retail Store",
                slug=f"store-{uuid.uuid4().hex[:6]}",
                currency="NPR",
            )
            session.add(business)
            await session.flush()

        if not cleaned.records:
            return ETLUploadSummary(
                status="failed",
                business_id=business_id,
                file_name=file_name,
                total_rows_processed=cleaned.total_raw_rows,
                valid_rows_count=0,
                invalid_rows_count=len(cleaned.errors),
                invoices_created=0,
                items_recorded=0,
                products_auto_created=0,
                total_revenue_npr=0.0,
                errors=cleaned.errors,
                warnings=cleaned.warnings,
            )

        errors: List[ETLRowError] = list(cleaned.errors)
        warnings: List[ETLWarning] = list(cleaned.warnings)

        # 2. Extract and resolve unique SKUs in this batch
        all_skus: Set[str] = {r.sku for r in cleaned.records}
        prod_stmt = select(Product).where(
            Product.business_id == business_id,
            Product.sku.in_(all_skus),
        )
        prod_res = await session.execute(prod_stmt)
        existing_products_map: Dict[str, Product] = {p.sku: p for p in prod_res.scalars().all()}

        # 3. Auto-provision any missing products for this tenant
        new_products_count = 0
        for record in cleaned.records:
            if record.sku not in existing_products_map:
                new_prod = Product(
                    business_id=business_id,
                    sku=record.sku,
                    name=record.product_name,
                    category=record.category,
                    unit_cost=record.unit_price * Decimal("0.70"), # Heuristic 30% margin default
                    selling_price=record.unit_price,
                    stock_quantity=record.quantity * 2,           # Initial inventory buffer
                    reorder_level=10,
                    vat_rate=Decimal("13.00"),
                    is_active=True,
                )
                session.add(new_prod)
                existing_products_map[record.sku] = new_prod
                new_products_count += 1
                warnings.append(
                    ETLWarning(
                        row_number=record.row_number,
                        invoice_number=record.invoice_number,
                        message=f"Product with SKU '{record.sku}' was auto-created in catalog.",
                    )
                )

        # Flush session to assign IDs to newly added products
        await session.flush()

        # 4. Group line items by invoice_number
        invoices_map: Dict[str, List[CleanedPOSRecord]] = defaultdict(list)
        for r in cleaned.records:
            invoices_map[r.invoice_number].append(r)

        # 5. Check for pre-existing invoices for this tenant
        existing_inv_stmt = select(Sale.invoice_number).where(
            Sale.business_id == business_id,
            Sale.invoice_number.in_(list(invoices_map.keys())),
        )
        existing_inv_res = await session.execute(existing_inv_stmt)
        existing_invoices: Set[str] = set(existing_inv_res.scalars().all())

        invoices_created = 0
        items_recorded = 0
        total_revenue = Decimal("0.00")

        # 6. Build Sale and SaleItem records
        for inv_num, items in invoices_map.items():
            if inv_num in existing_invoices:
                # To prevent unique constraint collision, record warning and skip
                warnings.append(
                    ETLWarning(
                        row_number=items[0].row_number,
                        invoice_number=inv_num,
                        message=f"Invoice '{inv_num}' already exists in database; skipped to avoid duplication.",
                    )
                )
                continue

            first_item = items[0]
            subtotal = sum((i.subtotal for i in items), Decimal("0.00"))
            discount_total = sum((i.discount_amount for i in items), Decimal("0.00"))
            tax_total = sum((i.tax_amount for i in items), Decimal("0.00"))
            total_amt = (subtotal - discount_total + tax_total).quantize(Decimal("0.01"))

            sale = Sale(
                business_id=business_id,
                invoice_number=inv_num,
                customer_name=first_item.customer_name,
                customer_phone=first_item.customer_phone,
                customer_pan=first_item.customer_pan,
                subtotal=subtotal,
                discount_amount=discount_total,
                tax_amount=tax_total,
                total_amount=total_amt,
                payment_method=first_item.payment_method,
                payment_status=PaymentStatus.PAID,
                created_at=first_item.date,
            )
            session.add(sale)
            await session.flush() # Generate sale.id

            for item in items:
                prod = existing_products_map.get(item.sku)
                sale_item = SaleItem(
                    business_id=business_id,
                    sale_id=sale.id,
                    product_id=prod.id if prod else None,
                    product_name=item.product_name,
                    product_sku=item.sku,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    discount_amount=item.discount_amount,
                    tax_rate=Decimal("13.00"),
                    tax_amount=item.tax_amount,
                    subtotal=item.subtotal,
                    created_at=item.date,
                )
                session.add(sale_item)
                items_recorded += 1

            invoices_created += 1
            total_revenue += total_amt

        status = "success"
        if errors and invoices_created > 0:
            status = "partial"
        elif errors and invoices_created == 0:
            status = "failed"

        # Category, top products, monthly trend, and payment breakdown
        cat_rev: Dict[str, float] = defaultdict(float)
        prod_stats: Dict[str, Dict] = {}
        months_dict: Dict[str, Dict] = {}
        pay_totals: Dict[str, float] = defaultdict(float)

        for r in cleaned.records:
            cat_name = r.category or "General"
            cat_rev[cat_name] += float(r.subtotal)

            prod_key = r.product_name or r.sku
            if prod_key not in prod_stats:
                prod_stats[prod_key] = {
                    "name": prod_key,
                    "sku": r.sku,
                    "category": r.category or "General",
                    "unitsSold": 0,
                    "revenue": 0.0,
                    "stockLeft": 30,
                }
            prod_stats[prod_key]["unitsSold"] += r.quantity
            prod_stats[prod_key]["revenue"] += float(r.subtotal)

            m_key = r.date.strftime("%b %Y")
            if m_key not in months_dict:
                months_dict[m_key] = {
                    "month": m_key,
                    "revenue": 0.0,
                    "profit": 0.0,
                    "orders": 0,
                    "_sort_key": r.date.strftime("%Y-%m"),
                }
            months_dict[m_key]["revenue"] += float(r.subtotal)
            months_dict[m_key]["profit"] += float(r.subtotal) * 0.30
            months_dict[m_key]["orders"] += 1

            p_mode = r.payment_method.value if hasattr(r.payment_method, "value") else str(r.payment_method)
            pay_totals[p_mode] += float(r.subtotal)

        top_prods = sorted(prod_stats.values(), key=lambda x: x["revenue"], reverse=True)

        # Sync with items live catalog
        try:
            from app.api.v1.endpoints.items import InventoryItem as CatItem, update_catalog_from_etl_records
            dynamic_catalog: list = []
            for idx, p in enumerate(top_prods[:25]):
                units = p.get("unitsSold", 50)
                avg_rate = round(p["revenue"] / units, 2) if units > 0 else 100.0
                stock_units = max(8, int(units * 1.4) + (35 if idx % 3 == 0 else (12 if idx % 3 == 1 else 48)))
                p["stockLeft"] = stock_units
                reorder_val = max(10, int(stock_units * 0.35))
                dynamic_catalog.append(
                    CatItem(
                        id=idx + 1,
                        sku=p.get("sku") or f"ITEM-{idx+1}",
                        name=p["name"],
                        category=p.get("category") or "General",
                        quantity=stock_units,
                        price_npr=avg_rate,
                        reorder_level=reorder_val,
                    )
                )
            if dynamic_catalog:
                update_catalog_from_etl_records(str(business_id), dynamic_catalog)
        except Exception:
            pass

        sorted_months = sorted(months_dict.values(), key=lambda x: x["_sort_key"])
        monthly_trend = [
            {
                "month": m["month"],
                "revenue": round(m["revenue"], 2),
                "profit": round(m["profit"], 2),
                "orders": m["orders"],
            }
            for m in sorted_months
        ]

        total_rev_sum = sum(pay_totals.values()) or 1.0
        color_palette = ["#10b981", "#f59e0b", "#6366f1", "#3b82f6", "#ef4444"]
        payment_breakdown = [
            {
                "name": k.replace("_", " ").title(),
                "value": round(v, 2),
                "percentage": round((v / total_rev_sum) * 100, 1),
                "color": color_palette[idx % len(color_palette)],
                "nepaliLabel": "नगद" if "cash" in k.lower() else "डिजिटल / QR" if "fonepay" in k.lower() else "वालेट",
            }
            for idx, (k, v) in enumerate(pay_totals.items())
        ]

        return ETLUploadSummary(
            status=status,
            business_id=business_id,
            file_name=file_name,
            total_rows_processed=cleaned.total_raw_rows,
            valid_rows_count=len(cleaned.records),
            invalid_rows_count=len(errors),
            invoices_created=invoices_created,
            items_recorded=items_recorded,
            products_auto_created=new_products_count,
            total_revenue_npr=round(float(total_revenue), 2),
            errors=errors,
            warnings=warnings,
            category_breakdown={k: round(v, 2) for k, v in cat_rev.items()},
            top_products=top_prods,
            monthly_trend=monthly_trend,
            payment_breakdown=payment_breakdown,
        )
