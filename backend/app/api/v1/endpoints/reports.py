"""
FastAPI Router for Weekly Performance Reports & PDF Generation
"""
import os
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.report import (
    GenerateReportRequest,
    ReportStatus,
    ReportTaskResponse,
    WeeklyReportData,
    StoreProfile,
    FinancialSummary,
    TopProductItem,
    PaymentChannelBreakdown,
    InventoryRiskSummary,
)
from app.services.reports.data_collector import ReportDataCollector
from app.services.reports.pdf_generator import PDFReportGenerator
from app.services.reports.scheduler import ReportSchedulerService

router = APIRouter()


@router.post(
    "/weekly/generate",
    response_model=ReportTaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue background task to generate weekly PDF business report",
    description=(
        "Initiates an asynchronous background job using WeasyPrint to aggregate "
        "trailing 7-day sales, compute gross profit, identify top movers, and format "
        "a print-ready A4 PDF report with Nepali business intelligence."
    ),
)
@limiter.limit("5/minute")
async def generate_weekly_report(
    request: Request,
    req: GenerateReportRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    task = ReportSchedulerService.register_task(req.business_id)

    # Dispatch background worker
    background_tasks.add_task(
        ReportSchedulerService.process_report_task,
        report_id=task.report_id,
        business_id=req.business_id,
        reporting_days=req.reporting_days,
        include_ai_insights=req.include_ai_insights,
        db_session=db,
    )

    return task


@router.get(
    "/weekly/status/{report_id}",
    response_model=ReportTaskResponse,
    summary="Check background report generation progress",
    description="Polls the status (PENDING, PROCESSING, COMPLETED, FAILED) of a queued PDF report task.",
)
async def get_report_status(report_id: str):
    task = ReportSchedulerService.get_task(report_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report task with ID '{report_id}' was not found.",
        )
    return task


@router.get(
    "/weekly/download/{report_id}",
    summary="Download compiled PDF report",
    description="Streams the generated weekly business performance PDF document.",
)
async def download_report_pdf(report_id: str):
    file_info = ReportSchedulerService.get_report_file(report_id)
    if not file_info or not os.path.exists(file_info["pdf_path"]):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Compiled PDF report '{report_id}' is not yet available or has expired.",
        )

    return FileResponse(
        path=file_info["pdf_path"],
        filename=f"weekly_report_{report_id}.pdf",
        media_type="application/pdf",
    )


@router.get(
    "/weekly/preview-html/{business_id}",
    response_class=HTMLResponse,
    summary="Instant browser preview of report layout",
    description="Renders the Jinja2 HTML layout directly in the browser for verification or direct printing.",
)
async def preview_report_html(
    business_id: str,
    db: AsyncSession = Depends(get_db),
):
    report_data = await ReportDataCollector.collect_weekly_data(
        db=db,
        business_id=business_id,
        reporting_days=7,
        include_ai_insights=True,
    )
    generator = PDFReportGenerator()
    html_content = generator.render_html(report_data)
    return HTMLResponse(content=html_content)


@router.get(
    "/weekly/demo-pdf",
    summary="Instant zero-database demonstration PDF download",
    description="Generates and returns an instant weekly performance report PDF populated with realistic Kathmandu supermarket data.",
)
async def download_demo_pdf():
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=7)

    from app.utils.nepali_date import get_current_nepali_date_str

    demo_data = WeeklyReportData(
        report_id=f"DEMO-{now.strftime('%Y%m%d')}-001",
        business_id="demo-pashupati-001",
        generated_at=now,
        nepali_date=get_current_nepali_date_str(now),
        week_label=f"{start.strftime('%Y-%m-%d')} देखि {now.strftime('%Y-%m-%d')}",
        store=StoreProfile(
            name="पशुपति किराना तथा जनरल स्टोर (Pashupati Kirana)",
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
            TopProductItem(sku="SKU-NDL-001", name="Wai Wai Chicken Noodles 75g", category="Instant Noodles", quantity_sold=620, revenue_npr=Decimal("15500.00"), profit_npr=Decimal("3100.00")),
            TopProductItem(sku="SKU-OIL-002", name="Fortune Refined Sunflower Oil 1L", category="Cooking Essentials", quantity_sold=140, revenue_npr=Decimal("36400.00"), profit_npr=Decimal("5600.00")),
            TopProductItem(sku="SKU-TEA-003", name="Tokla CTC Tea 500g", category="Beverages", quantity_sold=85, revenue_npr=Decimal("28900.00"), profit_npr=Decimal("5100.00")),
            TopProductItem(sku="SKU-ATT-004", name="Aashirvaad Atta 5kg", category="Grains", quantity_sold=60, revenue_npr=Decimal("28800.00"), profit_npr=Decimal("4800.00")),
            TopProductItem(sku="SKU-GHE-005", name="DDC Pure Cow Ghee 1L", category="Dairy", quantity_sold=22, revenue_npr=Decimal("28600.00"), profit_npr=Decimal("3740.00")),
        ],
        payments=[
            PaymentChannelBreakdown(method="Fonepay / QR", method_nepali="फोनपे / QR", volume_npr=Decimal("104370.00"), percentage=42.0),
            PaymentChannelBreakdown(method="Cash (नगद)", method_nepali="नगद", volume_npr=Decimal("79520.00"), percentage=32.0),
            PaymentChannelBreakdown(method="eSewa / Khalti", method_nepali="ईसेवा / खल्ती", volume_npr=Decimal("44730.00"), percentage=18.0),
            PaymentChannelBreakdown(method="Cards", method_nepali="कार्ड", volume_npr=Decimal("12425.00"), percentage=5.0),
            PaymentChannelBreakdown(method="Udharo (उधारो)", method_nepali="उधारो", volume_npr=Decimal("7455.00"), percentage=3.0),
        ],
        inventory=InventoryRiskSummary(
            dead_stock_count=2,
            dead_capital_trapped_npr=Decimal("31460.00"),
            low_stock_count=3,
            out_of_stock_count=1,
            estimated_restock_needed_npr=Decimal("21920.00"),
        ),
        ai_strategic_advice=(
            "१. नगद प्रवाह (Cash Flow): यस हप्ता फोनपे र क्यूआर भुक्तानी ४२% पुगेको छ, जसले नगद काउन्टरको सुरक्षा बढाएको छ।\n"
            "२. अत्यावश्यक खरिद: Wai Wai चाउचाउ पूर्ण सकिएको हुँदा आगामी शनिबारको भीड अगावै कम्तीमा १०० प्याकेट अर्डर गर्नुहोस्।\n"
            "३. पुँजी मोबिलाइजेसन: भान्साका विद्युतीय सामग्रीमा रु. ३१,४६०/- पुँजी अड्किएको हुँदा २५% छुट सहित क्लियरेन्स अफर राख्न सुझाव दिइन्छ।"
        ),
    )

    generator = PDFReportGenerator()
    engine, pdf_path, _ = generator.generate_pdf(demo_data)

    return FileResponse(
        path=pdf_path,
        filename=f"retailiq_weekly_report_{demo_data.report_id}.pdf",
        media_type="application/pdf",
        headers={"X-Engine-Used": engine},
    )
