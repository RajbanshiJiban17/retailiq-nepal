"""
PDF Generation Service
Renders Jinja2 HTML templates and compiles them to PDF using WeasyPrint,
with a seamless ReportLab fallback if native GTK C-libraries are absent.
"""
import os
import sys
from pathlib import Path
from typing import Tuple
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.schemas.report import WeeklyReportData


class PDFReportGenerator:
    def __init__(self):
        # Locate templates directory
        backend_dir = Path(__file__).resolve().parent.parent.parent
        template_dir = backend_dir / "templates" / "reports"
        
        self.env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=select_autoescape(["html", "xml"]),
        )
        
        # Ensure reports output directory exists
        self.storage_dir = backend_dir / "storage" / "reports"
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def render_html(self, report_data: WeeklyReportData) -> str:
        """Renders the Jinja2 HTML template with structured report data."""
        template = self.env.get_template("weekly_performance.html")
        return template.render(
            report_id=report_data.report_id,
            generated_at=report_data.generated_at,
            nepali_date=report_data.nepali_date,
            week_label=report_data.week_label,
            store=report_data.store,
            finance=report_data.finance,
            top_products=report_data.top_products,
            payments=report_data.payments,
            inventory=report_data.inventory,
            ai_strategic_advice=report_data.ai_strategic_advice,
        )

    def generate_pdf(self, report_data: WeeklyReportData) -> Tuple[str, str, str]:
        """
        Compiles the weekly report into a publication-ready PDF.
        Returns (engine_used, pdf_file_path, html_file_path).
        """
        rendered_html = self.render_html(report_data)

        tenant_storage = self.storage_dir / str(report_data.business_id)
        tenant_storage.mkdir(parents=True, exist_ok=True)

        filename_base = f"weekly_report_{report_data.report_id}"
        pdf_path = tenant_storage / f"{filename_base}.pdf"
        html_path = tenant_storage / f"{filename_base}.html"

        # Always save HTML version for instant browser preview and inspection
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(rendered_html)

        # 1. Attempt Primary Engine: WeasyPrint
        try:
            from weasyprint import HTML
            HTML(string=rendered_html).write_pdf(str(pdf_path))
            return "WeasyPrint", str(pdf_path), str(html_path)
        except (ImportError, OSError, Exception) as err:
            print(f"[PDF_GENERATOR] WeasyPrint native libraries not available ({err}). Falling back to ReportLab...")

        # 2. Resilient Fallback Engine: ReportLab
        try:
            self._generate_reportlab_pdf(report_data, pdf_path)
            return "ReportLab (Fallback)", str(pdf_path), str(html_path)
        except Exception as rl_err:
            raise RuntimeError(f"Both WeasyPrint and ReportLab failed to generate PDF: {rl_err}")

    def _generate_reportlab_pdf(self, report_data: WeeklyReportData, output_path: Path):
        """Builds a high quality clean PDF using ReportLab as a zero-dependency fallback."""
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors

        doc = SimpleDocTemplate(
            str(output_path),
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "ReportTitle",
            parent=styles["Heading1"],
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#0f172a"),
        )
        subtitle_style = ParagraphStyle(
            "ReportSubtitle",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#059669"),
            fontName="Helvetica-Bold",
        )
        meta_style = ParagraphStyle(
            "MetaStyle",
            parent=styles["Normal"],
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#475569"),
        )
        section_style = ParagraphStyle(
            "SectionStyle",
            parent=styles["Heading2"],
            fontSize=11,
            leading=15,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=10,
            spaceAfter=6,
        )
        normal_style = ParagraphStyle(
            "NormalStyle",
            parent=styles["Normal"],
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#1e293b"),
        )

        story = []

        # Header Block
        story.append(Paragraph("RetailIQ Nepal", title_style))
        story.append(Paragraph("Weekly Business Performance Report (साप्ताहिक व्यापार प्रतिवेदन)", subtitle_style))
        story.append(Spacer(1, 4))
        
        header_table_data = [
            [
                Paragraph(f"Period: <b>{report_data.week_label}</b><br/>Nepali Date: <b>{report_data.nepali_date}</b>", meta_style),
                Paragraph(f"<b>{report_data.store.name}</b><br/>PAN: {report_data.store.pan_vat_number or 'N/A'}<br/>Report ID: {report_data.report_id}", meta_style),
            ]
        ]
        h_table = Table(header_table_data, colWidths=[260, 260])
        h_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
        story.append(h_table)
        story.append(Spacer(1, 8))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0f172a"), spaceBefore=4, spaceAfter=8))

        # Financial Summary Cards Table
        fin = report_data.finance
        kpi_data = [
            ["Gross Revenue (कुल बिक्री)", "Net Profit (खुद नाफा)", "Invoices (बिलहरू)", "AOV (औसत बिल)"],
            [
                f"Rs. {fin.gross_revenue_npr:,.2f}",
                f"Rs. {fin.net_profit_npr:,.2f}",
                f"{fin.total_invoices}",
                f"Rs. {fin.average_order_value_npr:,.2f}",
            ],
            [
                "Trailing 7 Days",
                f"Margin: {fin.profit_margin_pct}%",
                "Customer Transactions",
                "Per Order Average",
            ],
        ]
        kpi_table = Table(kpi_data, colWidths=[130, 130, 130, 130])
        kpi_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#e2e8f0")),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 8),
            ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor("#64748b")),
            ('FONTNAME', (0,1), (-1,1), 'Helvetica-Bold'),
            ('FONTSIZE', (0,1), (-1,1), 12),
            ('TEXTCOLOR', (0,1), (-1,1), colors.HexColor("#0f172a")),
            ('TEXTCOLOR', (1,1), (1,1), colors.HexColor("#059669")),
            ('FONTSIZE', (0,2), (-1,2), 7),
            ('TEXTCOLOR', (0,2), (-1,2), colors.HexColor("#059669")),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(kpi_table)
        story.append(Spacer(1, 10))

        # Top Selling Products
        story.append(Paragraph("Top-Selling Products (सर्वोकृष्ट बिक्री भएका सामानहरू)", section_style))
        top_data = [["Product (सामान)", "Category", "Qty Sold", "Revenue (NPR)", "Profit (NPR)"]]
        for p in report_data.top_products:
            top_data.append([
                p.name,
                p.category,
                str(p.quantity_sold),
                f"Rs. {p.revenue_npr:,.2f}",
                f"Rs. {p.profit_npr:,.2f}",
            ])
        if len(report_data.top_products) == 0:
            top_data.append(["No sales recorded in period", "-", "-", "-", "-"])

        top_table = Table(top_data, colWidths=[180, 110, 60, 90, 80])
        top_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f1f5f9")),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('ALIGN', (2,0), (2,-1), 'CENTER'),
            ('ALIGN', (3,0), (-1,-1), 'RIGHT'),
            ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
            ('FONTSIZE', (0,1), (-1,-1), 8),
        ]))
        story.append(top_table)
        story.append(Spacer(1, 10))

        # Payment Methods & Inventory Alerts
        story.append(Paragraph("Payment Channels & Inventory Risk Summary", section_style))
        inv = report_data.inventory
        split_data = [
            [
                Paragraph("<b>Payment Methods (भुक्तानी)</b>", normal_style),
                Paragraph("<b>Inventory Risk Alerts (मौज्दात जोखिम)</b>", normal_style),
            ],
            [
                Paragraph(
                    "<br/>".join([f"• {p.method} ({p.method_nepali}): <b>{p.percentage}%</b> (Rs. {p.volume_npr:,.0f})" for p in report_data.payments]),
                    normal_style,
                ),
                Paragraph(
                    f"• <b>Out of Stock:</b> {inv.out_of_stock_count} SKUs<br/>"
                    f"• <b>Low Stock Items:</b> {inv.low_stock_count} SKUs<br/>"
                    f"• <b>Dead Stock (निष्क्रिय पुँजी):</b> {inv.dead_stock_count} items (Rs. {inv.dead_capital_trapped_npr:,.2f})<br/>"
                    f"• <b>Restock Needed:</b> Rs. {inv.estimated_restock_needed_npr:,.2f}",
                    normal_style,
                ),
            ],
        ]
        split_table = Table(split_data, colWidths=[260, 260])
        split_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('PADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(split_table)
        story.append(Spacer(1, 10))

        # AI Strategic Advice
        if report_data.ai_strategic_advice:
            story.append(Paragraph("Strategic AI Insights (बजारको साथी - रणनीतिक सल्लाह)", section_style))
            ai_data = [[Paragraph(f"<b>Business Advice:</b><br/>{report_data.ai_strategic_advice.replace(chr(10), '<br/>')}", normal_style)]]
            ai_table = Table(ai_data, colWidths=[520])
            ai_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0fdf4")),
                ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#86efac")),
                ('PADDING', (0,0), (-1,-1), 8),
            ]))
            story.append(ai_table)
            story.append(Spacer(1, 12))

        # Footer
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceBefore=8, spaceAfter=6))
        story.append(Paragraph("Generated by RetailIQ Nepal Engine • Publication-Ready Business Report", meta_style))

        doc.build(story)
