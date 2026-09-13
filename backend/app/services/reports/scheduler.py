"""
Background Task Service & Weekly Report Scheduler
Coordinates asynchronous generation of PDF reports and tracks lifecycle states.
"""
import uuid
import traceback
from datetime import datetime, timezone
from typing import Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.report import ReportStatus, ReportTaskResponse, WeeklyReportData
from app.services.reports.data_collector import ReportDataCollector
from app.services.reports.pdf_generator import PDFReportGenerator


class ReportSchedulerService:
    # In-memory registry for background tasks (persists across requests during runtime)
    _tasks: Dict[str, ReportTaskResponse] = {}
    _report_files: Dict[str, dict] = {}

    @classmethod
    def register_task(cls, business_id: str) -> ReportTaskResponse:
        """Initializes a new background reporting task in PENDING state."""
        report_id = f"REP-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        task = ReportTaskResponse(
            report_id=report_id,
            business_id=business_id,
            status=ReportStatus.PENDING,
            download_url=f"/api/v1/reports/weekly/download/{report_id}",
            preview_url=f"/api/v1/reports/weekly/preview-html/{business_id}",
            created_at=datetime.now(timezone.utc),
            message="Report generation task queued successfully.",
        )
        cls._tasks[report_id] = task
        return task

    @classmethod
    def get_task(cls, report_id: str) -> Optional[ReportTaskResponse]:
        """Looks up the current status of an asynchronous report task."""
        return cls._tasks.get(report_id)

    @classmethod
    def get_report_file(cls, report_id: str) -> Optional[dict]:
        """Retrieves file path information for a completed report."""
        return cls._report_files.get(report_id)

    @classmethod
    async def process_report_task(
        cls,
        report_id: str,
        business_id: str,
        reporting_days: int = 7,
        include_ai_insights: bool = True,
        db_session: Optional[AsyncSession] = None,
        custom_data: Optional[WeeklyReportData] = None,
    ):
        """
        Background execution worker. Compiles report data and executes PDF generation.
        """
        task = cls._tasks.get(report_id)
        if not task:
            return

        task.status = ReportStatus.PROCESSING
        task.message = "Collecting 7-day sales and inventory facts..."

        try:
            generator = PDFReportGenerator()

            # 1. Acquire Data (either from live DB or provided test model)
            if custom_data:
                report_data = custom_data
            elif db_session:
                report_data = await ReportDataCollector.collect_weekly_data(
                    db=db_session,
                    business_id=business_id,
                    reporting_days=reporting_days,
                    include_ai_insights=include_ai_insights,
                )
            else:
                raise ValueError("No active database session or report data provided for generation.")

            # Override report_id to match task identifier
            report_data.report_id = report_id

            # 2. Compile to PDF
            task.message = "Compiling PDF via WeasyPrint engine..."
            engine_used, pdf_path, html_path = generator.generate_pdf(report_data)

            # 3. Finalize Task State
            task.status = ReportStatus.COMPLETED
            task.engine_used = engine_used
            task.completed_at = datetime.now(timezone.utc)
            task.message = f"Weekly PDF report compiled successfully using {engine_used}."

            cls._report_files[report_id] = {
                "pdf_path": pdf_path,
                "html_path": html_path,
                "business_id": business_id,
                "generated_at": task.completed_at,
            }

        except Exception as e:
            traceback.print_exc()
            task.status = ReportStatus.FAILED
            task.completed_at = datetime.now(timezone.utc)
            task.message = f"Failed to generate report: {str(e)}"
