import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ETLRowError(BaseModel):
    row_number: int = Field(..., description="1-indexed row number in the uploaded CSV")
    invoice_number: Optional[str] = Field(None, description="Invoice or bill number if identifiable")
    reason: str = Field(..., description="Explanation of why the row was rejected")
    raw_data: Optional[Dict[str, Any]] = Field(None, description="Raw input values of the failed row")


class ETLWarning(BaseModel):
    row_number: int = Field(..., description="1-indexed row number in the uploaded CSV")
    invoice_number: Optional[str] = Field(None, description="Invoice or bill number if identifiable")
    message: str = Field(..., description="Warning description (e.g. defaulted price or auto-generated SKU)")


class ETLUploadSummary(BaseModel):
    status: str = Field(..., description="'success' (all valid), 'partial' (some rows skipped), or 'failed'")
    business_id: uuid.UUID = Field(..., description="Tenant business ID records were loaded into")
    file_name: str = Field(..., description="Original name of the uploaded CSV file")
    total_rows_processed: int = Field(..., description="Total data rows parsed from the CSV")
    valid_rows_count: int = Field(..., description="Number of rows successfully sanitized and loaded")
    invalid_rows_count: int = Field(..., description="Number of rejected or corrupt rows")
    invoices_created: int = Field(..., description="Unique sales invoices successfully recorded")
    items_recorded: int = Field(..., description="Individual line items inserted")
    products_auto_created: int = Field(..., description="New products automatically provisioned during load")
    total_revenue_npr: float = Field(..., description="Total sales volume loaded in NPR")
    errors: List[ETLRowError] = Field(default_factory=list, description="Detailed list of row errors")
    warnings: List[ETLWarning] = Field(default_factory=list, description="List of warnings and auto-corrections")
    category_breakdown: Optional[Dict[str, float]] = Field(default_factory=dict, description="Revenue by category")
    top_products: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Top selling products in this batch")
    monthly_trend: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Monthly aggregated sales trend")
    payment_breakdown: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Payment method breakdown")
