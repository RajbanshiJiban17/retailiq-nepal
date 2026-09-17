import uuid
from typing import Any, List, Literal, Optional, Union
from pydantic import BaseModel, Field, field_validator


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"] = Field(..., description="Role of the speaker")
    content: str = Field(..., description="Message text")


class ContextFactSummary(BaseModel):
    business_name: str = Field(..., description="Store/Business name")
    total_active_products: int = Field(..., description="Number of products registered in inventory")
    low_stock_items_count: int = Field(..., description="Number of items at or below reorder threshold")
    total_sales_invoices: int = Field(..., description="Total completed sales transactions")
    total_revenue_npr: float = Field(..., description="Total sales volume in Nepalese Rupees")
    sample_low_stock_items: List[str] = Field(default_factory=list, description="Names of items needing restocking")


class BajarSathiChatRequest(BaseModel):
    business_id: Any = Field(default="00000000-0000-0000-0000-000000000001", description="Tenant Business UUID to ground queries")
    query: str = Field(..., min_length=1, max_length=1000, description="Business question asked in Nepali or English")
    business_name: Optional[str] = Field(None, description="Optional store name for personalized dynamic response")
    store_context: Optional[dict] = Field(None, description="Optional current uploaded dataset facts from frontend")
    conversation_history: List[ChatMessage] = Field(
        default_factory=list, description="Optional previous dialogue turns for multi-turn context"
    )

    @field_validator("business_id", mode="before")
    @classmethod
    def parse_business_id(cls, v: Any) -> uuid.UUID:
        if isinstance(v, uuid.UUID):
            return v
        if not v or not str(v).strip():
            return uuid.UUID("00000000-0000-0000-0000-000000000001")
        try:
            return uuid.UUID(str(v).strip())
        except (ValueError, AttributeError):
            return uuid.UUID("00000000-0000-0000-0000-000000000001")


class BajarSathiChatResponse(BaseModel):
    answer: str = Field(..., description="AI response in Nepali strictly grounded in database context")
    business_id: Union[uuid.UUID, str] = Field(..., description="Tenant Business ID")
    business_name: str = Field(..., description="Store name")
    grounding_facts: ContextFactSummary = Field(..., description="Summary of database facts passed to the model")
    model_used: str = Field(..., description="AI model (e.g. gemini-3.6-flash or Rule-Based Grounded Engine)")
    has_gemini_key: bool = Field(..., description="True if using live Gemini API key")
    latency_ms: float = Field(..., description="Execution latency in milliseconds")


class SampleQuery(BaseModel):
    id: int
    query_nepali: str
    category: str
    description: str
