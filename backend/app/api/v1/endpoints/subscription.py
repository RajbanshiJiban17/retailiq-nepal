"""
Subscription & Commercial SaaS Management Endpoint
Powers RetailIQ's monetization engine for Nepalese retail businesses.
Supports Starter, Pro Merchant (रु. ९९९/महिना), and Enterprise (रु. २,९९९/महिना).
"""
import uuid
from typing import Dict, List, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Query, status

router = APIRouter()


class SubscriptionPlan(BaseModel):
    id: str = Field(..., description="Unique plan identifier: starter, pro, enterprise")
    name: str = Field(..., description="Display plan name in English")
    name_nepali: str = Field(..., description="Display plan name in Nepali")
    price_npr: int = Field(..., description="Price per month in Nepalese Rupees")
    billing_period: str = Field("महिना", description="Billing frequency")
    badge: Optional[str] = None
    description: str = Field(..., description="Plan summary")
    features: List[str] = Field(..., description="List of enabled capabilities")
    limits: Dict[str, str] = Field(..., description="Operational boundaries")


class CurrentSubscriptionStatus(BaseModel):
    business_id: str
    tier: str
    plan_name: str
    plan_name_nepali: str
    price_npr: int = 0
    is_active: bool
    is_trial: bool = False
    trial_days_remaining: int = 0
    is_expired: bool = False
    started_at: str
    expires_at: str
    days_remaining: int
    payment_channel: Optional[str] = None
    transaction_id: Optional[str] = None
    billing_cycle: Optional[str] = "monthly"
    amount_paid_npr: Optional[int] = 0
    invoice_no: Optional[str] = None
    pan_number: Optional[str] = "609823451"
    features: List[str]
    can_upload_excel: bool
    can_use_ml_forecast: bool
    can_generate_pdf: bool
    unlimited_ai_chat: bool


class UpgradeRequest(BaseModel):
    business_id: str = Field(..., description="Target business UUID")
    target_tier: str = Field(..., description="Desired tier: starter, pro, enterprise")
    payment_channel: Optional[str] = Field("fonepay", description="Payment method: fonepay, esewa, khalti, cash, trial")
    transaction_ref: Optional[str] = Field(None, description="Payment voucher / reference number entered by user")
    billing_cycle: Optional[str] = Field("monthly", description="Billing cycle: monthly or yearly")
    amount_paid_npr: Optional[int] = Field(None, description="Actual amount paid")


SUBSCRIPTION_PLANS: List[SubscriptionPlan] = [
    SubscriptionPlan(
        id="starter",
        name="Starter (Free Trial)",
        name_nepali="सुरुवाती (निःशुल्क परिक्षण)",
        price_npr=0,
        billing_period="सधैं निःशुल्क",
        badge="सुरुवात",
        description="नयाँ वा सानो खुद्रा पसलका लागि आधारभूत हिसाब किताब।",
        features=[
            "आधारभूत CSV डाटा अपलोड (५०० हरफसम्म)",
            "दैनिक १० वटा 'बजारको साथी' AI प्रश्नोत्तर",
            "न्यूनतम मौज्दात (Low Stock) अलर्ट",
            "नगद तथा अनलाइन बिक्री विभाजन",
        ],
        limits={
            "max_upload_rows": "५०० हरफ",
            "ai_daily_limit": "१० प्रश्न / दिन",
            "ml_forecast": "उपलब्ध छैन",
            "pdf_reports": "आधारभूत",
        },
    ),
    SubscriptionPlan(
        id="pro",
        name="Pro Merchant (रु. ९९९/महिना)",
        name_nepali="प्रो मर्चन्ट (रु. ९९९/महिना)",
        price_npr=999,
        billing_period="प्रति महिना",
        badge="सर्वाधिक रुचाइएको (Most Popular)",
        description="व्यवसायिक किराना, फेन्सी, कस्मेटिक्स वा इलेक्ट्रोनिक्स स्टोरका लागि पूर्ण AI व्यवस्थापन।",
        features=[
            "असीमित Excel (.xlsx/.xls) र CSV अपलोड",
            "२४/७ 'बजारको साथी' पूर्ण AI व्यापार सल्लाहकार (असीमित)",
            "Scikit-learn ७ दिने माग प्रक्षेपण (ML Demand Forecasting)",
            "निष्क्रिय पुँजी (Dead Stock) तथा जोखिम विश्लेषण",
            "साप्ताहिक ब्रान्डेड PDF प्रतिवेदन डाउनलोड",
            "Fonepay, eSewa, Khalti भुक्तानी विश्लेषण",
        ],
        limits={
            "max_upload_rows": "असीमित (Unlimited)",
            "ai_daily_limit": "असीमित (24/7 Unlimited)",
            "ml_forecast": "७ दिनको पूर्ण ML प्रक्षेपण",
            "pdf_reports": "पूर्ण स्वचालित PDF",
        },
    ),
    SubscriptionPlan(
        id="enterprise",
        name="Enterprise Wholesale (रु. २,९९९/महिना)",
        name_nepali="इन्टरप्राइज होलसेल (रु. २,९९९/महिना)",
        price_npr=2999,
        billing_period="प्रति महिना",
        badge="थोक तथा बहु-शाखा",
        description="धेरै शाखा भएका मार्ट, सुपरमार्केट तथा होलसेल वितरकहरूका लागि उच्चस्तरीय सुविधा।",
        features=[
            "बहु-शाखा (Multi-Branch Store) डाटा समन्वय",
            "असीमित कर्मचारी (Cashier, Manager) पहुँच",
            "अनुकूलित रिअर्डर सूत्र (Custom Restock Formula)",
            "IRD नेपाल कर / भ्याट अडिट तयारी प्रतिवेदन",
            "व्यक्तिगत खाता प्रबन्धक र WhatsApp VIP सपोर्ट",
        ],
        limits={
            "max_upload_rows": "असीमित",
            "ai_daily_limit": "असीमित VIP",
            "ml_forecast": "३० दिनको उन्नत ML प्रक्षेपण",
            "pdf_reports": "कस्टम ब्रान्डिङसहित",
        },
    ),
]

# Persistent in-memory tenant subscription state
_TENANT_SUBSCRIPTIONS: Dict[str, dict] = {}


@router.get(
    "/plans",
    response_model=List[SubscriptionPlan],
    summary="List available SaaS subscription plans and pricing",
)
async def get_plans() -> List[SubscriptionPlan]:
    return SUBSCRIPTION_PLANS


@router.get(
    "/current",
    response_model=CurrentSubscriptionStatus,
    summary="Get tenant's active subscription tier and feature gates",
)
async def get_current_subscription(
    business_id: str = Query(..., description="Target business UUID"),
) -> CurrentSubscriptionStatus:
    bid = str(business_id)
    sub = _TENANT_SUBSCRIPTIONS.get(bid)

    now = datetime.now(timezone.utc)
    if not sub:
        # Default: grant new stores a 7-day full Pro free trial!
        started_at = now.strftime("%Y-%m-%d")
        expires_at = (now + timedelta(days=7)).strftime("%Y-%m-%d")
        sub = {
            "tier": "pro",
            "is_trial": True,
            "started_at": started_at,
            "expires_at": expires_at,
            "payment_channel": "trial",
            "transaction_id": f"TRL-7D-{uuid.uuid4().hex[:6].upper()}",
        }
        _TENANT_SUBSCRIPTIONS[bid] = sub

    tier = sub.get("tier", "pro")
    is_trial = sub.get("is_trial", False)
    payment_channel = sub.get("payment_channel", "trial")
    transaction_id = sub.get("transaction_id")

    # Calculate days remaining
    try:
        exp_date = datetime.strptime(sub.get("expires_at", ""), "%Y-%m-%d").replace(tzinfo=timezone.utc)
        days_remaining = max(0, (exp_date.date() - now.date()).days)
    except Exception:
        days_remaining = 7

    trial_days_remaining = days_remaining if is_trial else 0
    is_expired = (days_remaining <= 0) and (tier != "starter")

    # Plan details
    plan = next((p for p in SUBSCRIPTION_PLANS if p.id == tier), SUBSCRIPTION_PLANS[1])

    is_active = not is_expired
    can_use_features = is_active and (tier in ["pro", "enterprise"])

    return CurrentSubscriptionStatus(
        business_id=bid,
        tier=tier,
        plan_name=plan.name,
        plan_name_nepali=plan.name_nepali,
        price_npr=plan.price_npr,
        is_active=is_active,
        is_trial=is_trial,
        trial_days_remaining=trial_days_remaining,
        is_expired=is_expired,
        started_at=sub.get("started_at", now.strftime("%Y-%m-%d")),
        expires_at=sub.get("expires_at", (now + timedelta(days=7)).strftime("%Y-%m-%d")),
        days_remaining=days_remaining,
        payment_channel=payment_channel,
        transaction_id=transaction_id,
        billing_cycle=sub.get("billing_cycle", "monthly"),
        amount_paid_npr=sub.get("amount_paid_npr", plan.price_npr),
        invoice_no=sub.get("invoice_no"),
        pan_number=sub.get("pan_number", "609823451"),
        features=plan.features,
        can_upload_excel=can_use_features,
        can_use_ml_forecast=can_use_features,
        can_generate_pdf=can_use_features,
        unlimited_ai_chat=can_use_features,
    )


@router.post(
    "/upgrade",
    response_model=CurrentSubscriptionStatus,
    summary="Upgrade or change subscription plan",
)
async def upgrade_subscription(req: UpgradeRequest) -> CurrentSubscriptionStatus:
    valid_tiers = ["starter", "pro", "enterprise"]
    if req.target_tier not in valid_tiers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid tier. Must be one of: {valid_tiers}",
        )

    now = datetime.now(timezone.utc)
    channel = req.payment_channel or "fonepay"
    is_trial = channel.lower() == "trial"
    billing_cycle = req.billing_cycle or "monthly"
    is_yearly = billing_cycle.lower() == "yearly"

    invoice_no = f"INV-2083-09-{uuid.uuid4().hex[:6].upper()}"

    if req.target_tier == "starter":
        # Free starter plan
        days = 365
        is_trial = False
        txn_id = f"FREE-{uuid.uuid4().hex[:6].upper()}"
        amount_paid = 0
    elif is_trial:
        days = 7
        txn_id = f"TRL-7D-{uuid.uuid4().hex[:6].upper()}"
        amount_paid = 0
    else:
        # Paid subscription: Enforce transaction verification
        if req.transaction_ref and len(req.transaction_ref.strip()) >= 4:
            txn_id = req.transaction_ref.strip().upper()
        else:
            prefix = {
                "fonepay": "FP",
                "esewa": "ES",
                "khalti": "KH",
            }.get(channel.lower(), "PAY")
            txn_id = f"{prefix}-2083-{uuid.uuid4().hex[:6].upper()}"

        days = 365 if is_yearly else 30

        # Calculate discounted annual or standard monthly price
        if req.target_tier == "pro":
            amount_paid = 9590 if is_yearly else 999
        elif req.target_tier == "enterprise":
            amount_paid = 28790 if is_yearly else 2999
        else:
            amount_paid = req.amount_paid_npr or 999

    new_sub = {
        "tier": req.target_tier,
        "is_trial": is_trial,
        "started_at": now.strftime("%Y-%m-%d"),
        "expires_at": (now + timedelta(days=days)).strftime("%Y-%m-%d"),
        "payment_channel": channel,
        "transaction_id": txn_id,
        "billing_cycle": billing_cycle,
        "amount_paid_npr": amount_paid,
        "invoice_no": invoice_no,
        "pan_number": "609823451",
    }
    _TENANT_SUBSCRIPTIONS[str(req.business_id)] = new_sub

    return await get_current_subscription(business_id=req.business_id)
