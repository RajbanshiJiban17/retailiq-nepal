"""
Automated Test Suite for Weekly Performance Reports & PDF Background Tasks
Validates Jinja2 template rendering, WeasyPrint/ReportLab dual-engine PDF compilation,
and asynchronous task lifecycle states.
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Configure stdout for UTF-8 on Windows PowerShell
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.schemas.report import (
    ReportStatus,
    WeeklyReportData,
    StoreProfile,
    FinancialSummary,
    TopProductItem,
    PaymentChannelBreakdown,
    InventoryRiskSummary,
)
from app.services.reports.pdf_generator import PDFReportGenerator
from app.services.reports.scheduler import ReportSchedulerService


def create_sample_report_data() -> WeeklyReportData:
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=7)
    report_id = f"TEST-REP-{now.strftime('%Y%m%d')}-001"
    tenant_id = str(uuid.uuid4())

    return WeeklyReportData(
        report_id=report_id,
        business_id=tenant_id,
        generated_at=now,
        nepali_date="२०८३ भाद्र २५, बिहीबार",
        week_label=f"{start.strftime('%Y-%m-%d')} देखि {now.strftime('%Y-%m-%d')}",
        store=StoreProfile(
            name="पशुपति किराना तथा सुपरस्टोर (Pashupati Kirana)",
            pan_vat_number="301234567",
            address="नयाँ बानेश्वर, काठमाडौं (Baneshwor, Kathmandu)",
            city="Kathmandu",
            phone="+977-9801234567",
            currency="NPR",
        ),
        finance=FinancialSummary(
            gross_revenue_npr=Decimal("248500.00"),
            net_profit_npr=Decimal("54670.00"),
            profit_margin_pct=22.0,
            total_invoices=482,
            average_order_value_npr=Decimal("515.56"),
        ),
        top_products=[
            TopProductItem(
                sku="SKU-NDL-001",
                name="Wai Wai Chicken Noodles 75g",
                category="Instant Noodles",
                quantity_sold=620,
                revenue_npr=Decimal("15500.00"),
                profit_npr=Decimal("3100.00"),
            ),
            TopProductItem(
                sku="SKU-OIL-002",
                name="Fortune Refined Sunflower Oil 1L",
                category="Cooking Essentials",
                quantity_sold=140,
                revenue_npr=Decimal("36400.00"),
                profit_npr=Decimal("5600.00"),
            ),
            TopProductItem(
                sku="SKU-TEA-003",
                name="Tokla CTC Tea 500g",
                category="Beverages",
                quantity_sold=85,
                revenue_npr=Decimal("28900.00"),
                profit_npr=Decimal("5100.00"),
            ),
        ],
        payments=[
            PaymentChannelBreakdown(
                method="Fonepay / QR",
                method_nepali="फोनपे / QR",
                volume_npr=Decimal("104370.00"),
                percentage=42.0,
            ),
            PaymentChannelBreakdown(
                method="Cash (नगद)",
                method_nepali="नगद",
                volume_npr=Decimal("79520.00"),
                percentage=32.0,
            ),
            PaymentChannelBreakdown(
                method="eSewa / Khalti",
                method_nepali="ईसेवा / खल्ती",
                volume_npr=Decimal("44730.00"),
                percentage=18.0,
            ),
        ],
        inventory=InventoryRiskSummary(
            dead_stock_count=2,
            dead_capital_trapped_npr=Decimal("31460.00"),
            low_stock_count=3,
            out_of_stock_count=1,
            estimated_restock_needed_npr=Decimal("21920.00"),
        ),
        ai_strategic_advice=(
            "१. फोनपे तथा डिजिटल भुक्तानी ४२% पुगेको छ, जसले नगद कारोबार जोखिम घटाएको छ।\n"
            "२. Wai Wai चाउचाउ पूर्ण सकिएको हुँदा तुरुन्त १०० प्याकेट खरिद आदेश (PO) जारी गर्नुहोस्।"
        ),
    )


async def run_pdf_report_tests():
    print("=" * 65)
    print("[INFO] STARTING WEEKLY PDF REPORT & BACKGROUND TASK VALIDATION")
    print("=" * 65)

    sample_data = create_sample_report_data()
    generator = PDFReportGenerator()

    # 1. Test HTML Template Rendering
    print("\n1. Testing Jinja2 Template Rendering...")
    html_output = generator.render_html(sample_data)
    assert "RetailIQ Nepal" in html_output
    assert "साप्ताहिक व्यापार कार्यसम्पादन प्रतिवेदन" in html_output
    assert "Pashupati Kirana" in html_output
    assert "248,500.00" in html_output
    assert "Wai Wai Chicken Noodles" in html_output
    assert len(html_output) > 2000
    print(f"  [PASS] HTML rendered successfully ({len(html_output):,} characters).")

    # 2. Test PDF Compilation (Dual Engine: WeasyPrint / ReportLab)
    print("\n2. Testing PDF Compilation...")
    engine_used, pdf_path, html_path = generator.generate_pdf(sample_data)
    print(f"  Engine Used: {engine_used}")
    print(f"  PDF Generated: {pdf_path}")
    print(f"  HTML Companion: {html_path}")

    assert os.path.exists(pdf_path), f"PDF file not found at {pdf_path}"
    assert os.path.exists(html_path), f"HTML file not found at {html_path}"

    file_size_bytes = os.path.getsize(pdf_path)
    print(f"  PDF File Size: {file_size_bytes:,} bytes")
    assert file_size_bytes > 1000, f"Generated PDF is suspiciously small ({file_size_bytes} bytes)"
    print("  [PASS] PDF and companion HTML files compiled and verified on disk.")

    # 3. Test Background Task Scheduler
    print("\n3. Testing Background Task Scheduler...")
    task = ReportSchedulerService.register_task(sample_data.business_id)
    assert task.status == ReportStatus.PENDING
    print(f"  Task Created: {task.report_id} (Status: {task.status})")

    # Run processing
    await ReportSchedulerService.process_report_task(
        report_id=task.report_id,
        business_id=sample_data.business_id,
        custom_data=sample_data,
    )

    updated_task = ReportSchedulerService.get_task(task.report_id)
    assert updated_task is not None
    assert updated_task.status == ReportStatus.COMPLETED
    print(f"  Task Processed: Status = {updated_task.status}, Engine = {updated_task.engine_used}")
    print(f"  Download URL: {updated_task.download_url}")

    file_record = ReportSchedulerService.get_report_file(task.report_id)
    assert file_record is not None
    assert os.path.exists(file_record["pdf_path"])
    print("  [PASS] Background task lifecycle and persistence verified.")

    print("\n" + "=" * 65)
    print("[SUCCESS] ALL WEEKLY PDF REPORTING & BACKGROUND TASK TESTS PASSED!")
    print("=" * 65)


if __name__ == "__main__":
    asyncio.run(run_pdf_report_tests())
