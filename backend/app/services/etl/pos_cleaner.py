"""
POS CSV Data Extraction and Sanitization Engine using Pandas
"""
import io
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd

from app.models.sale import PaymentMethod, PaymentStatus
from app.schemas.etl import ETLRowError, ETLWarning


# Alias dictionary for flexible POS header matching
COLUMN_ALIASES: Dict[str, List[str]] = {
    "invoice_number": [
        "invoice_number", "invoice_no", "invoiceno", "bill_number", "bill_no",
        "billno", "invoice", "bill", "receipt_no", "receipt", "inv_no",
        "invoice_id", "invoiceid", "inv_id", "invid", "bill_id", "billid",
        "transaction_id", "transactionid", "trans_id", "tid", "order_id", "orderid"
    ],
    "sku": [
        "sku", "item_code", "itemcode", "product_code", "productcode",
        "code", "barcode", "item_id"
    ],
    "product_name": [
        "product_name", "productname", "item_name", "itemname", "product",
        "item", "description", "particulars", "item_description", "product_title",
        "title", "product_line", "productline", "line"
    ],
    "category": [
        "category", "dept", "department", "item_category", "group", "product_group",
        "product_category", "productcategory", "cat", "product_line", "productline", "line",
        "category_name", "categoryname"
    ],
    "quantity": [
        "quantity", "qty", "count", "units", "pcs", "volume", "pieces"
    ],
    "unit_price": [
        "unit_price", "unitprice", "price", "rate", "selling_price",
        "unit_rate", "mrp", "item_price", "price_per_unit", "priceperunit"
    ],
    "discount_amount": [
        "discount_amount", "discount", "disc", "disc_amount", "item_discount"
    ],
    "tax_amount": [
        "tax_amount", "tax", "vat_amount", "vat", "gst", "item_vat",
        "tax_5%", "tax_5", "tax5%", "tax5", "tax_13%", "tax_13", "vat_13%"
    ],
    "subtotal": [
        "subtotal", "total", "line_total", "linetotal", "amount", "net_amount",
        "total_amount", "totalamount", "grand_total", "bill_amount"
    ],
    "payment_method": [
        "payment_method", "payment_mode", "paymentmode", "pay_mode", "mode",
        "payment_type", "payment"
    ],
    "customer_name": [
        "customer_name", "customername", "customer", "client", "buyer"
    ],
    "customer_phone": [
        "customer_phone", "customerphone", "phone", "mobile", "contact"
    ],
    "customer_pan": [
        "customer_pan", "customerpan", "pan", "pan_number", "buyer_pan", "vat_no",
        "customer_id", "customerid"
    ],
    "date": [
        "date", "sale_date", "saledate", "bill_date", "billdate",
        "invoice_date", "timestamp", "datetime", "created_at", "trans_date"
    ],
}


def _clean_currency_or_number(val: Any, default: float = 0.0) -> float:
    """
    Cleans dirty POS numeric entries such as 'Rs. 1,200.50', 'NPR 500', ' 2,400 ', or NaN.
    """
    if pd.isna(val) or val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)

    s = str(val).strip()
    if not s:
        return default

    is_negative = "-" in s

    # Strip currency letters (e.g. 'Rs.', 'NPR', '$') and whitespace
    cleaned = re.sub(r"[a-zA-Z$\s]", "", s)
    cleaned = cleaned.replace(",", "").replace("-", "").strip(". ")
    if not cleaned:
        return default

    # If multiple dots remain, keep only the last one as the decimal point
    parts = cleaned.split(".")
    if len(parts) > 2:
        cleaned = "".join(parts[:-1]) + "." + parts[-1]

    try:
        res = float(cleaned)
        return -res if is_negative else res
    except ValueError:
        return default



def _parse_pos_date(val: Any) -> datetime:
    """
    Flexible date parser supporting multiple POS date formats.
    Falls back to current UTC time if missing or corrupt.
    """
    if pd.isna(val) or val is None or str(val).strip() == "":
        return datetime.now(timezone.utc)

    if isinstance(val, (pd.Timestamp, datetime)):
        dt = val.to_pydatetime() if hasattr(val, "to_pydatetime") else val
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt

    s = str(val).strip()
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y",
        "%d-%m-%Y",
        "%Y/%m/%d",
    ]
    for fmt in formats:
        try:
            parsed = datetime.strptime(s, fmt)
            return parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    # Fallback to dateutil or current time
    try:
        parsed = pd.to_datetime(s).to_pydatetime()
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    except Exception:
        return datetime.now(timezone.utc)


def _normalize_payment_method(val: Any) -> PaymentMethod:
    """
    Maps raw payment mode strings to the PaymentMethod enum (Nepal localization).
    """
    if pd.isna(val) or val is None:
        return PaymentMethod.CASH

    s = str(val).strip().lower()
    if "esewa" in s:
        return PaymentMethod.ESEWA
    elif "khalti" in s:
        return PaymentMethod.KHALTI
    elif "fonepay" in s or "qr" in s or "connectips" in s:
        return PaymentMethod.FONEPAY
    elif "card" in s or "pos" in s or "visa" in s or "master" in s:
        return PaymentMethod.BANK_CARD
    elif "credit" in s or "udharo" in s or "due" in s or "unpaid" in s:
        return PaymentMethod.CREDIT
    else:
        return PaymentMethod.CASH


@dataclass
class CleanedPOSRecord:
    row_number: int
    invoice_number: str
    date: datetime
    sku: str
    product_name: str
    category: str
    quantity: int
    unit_price: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    subtotal: Decimal
    payment_method: PaymentMethod
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_pan: Optional[str] = None


@dataclass
class CleanedPOSResult:
    records: List[CleanedPOSRecord] = field(default_factory=list)
    errors: List[ETLRowError] = field(default_factory=list)
    warnings: List[ETLWarning] = field(default_factory=list)
    total_raw_rows: int = 0


class POSDataCleaner:
    """
    Vectorized extraction and sanitization engine for POS CSV data.
    """

    @classmethod
    def read_file_bytes(cls, content: bytes, filename: Optional[str] = None) -> pd.DataFrame:
        """
        Reads CSV or Excel (.xlsx, .xls) bytes into a DataFrame.
        """
        is_excel = False
        if filename:
            fn = filename.lower()
            if fn.endswith(".xlsx") or fn.endswith(".xls"):
                is_excel = True
        
        # Check zip/ole magic bytes for xlsx / xls
        if not is_excel and len(content) >= 4:
            if content.startswith(b"PK\x03\x04") or content.startswith(b"\xd0\xcf\x11\xe0"):
                is_excel = True

        if is_excel:
            try:
                df = pd.read_excel(io.BytesIO(content), dtype=str)
                df = df.dropna(how="all")
                return df
            except Exception:
                pass

        return cls.read_csv_bytes(content)

    @classmethod
    def read_csv_bytes(cls, content: bytes) -> pd.DataFrame:
        """
        Reads CSV bytes into a DataFrame trying standard encodings.
        """
        encodings = ["utf-8", "utf-8-sig", "latin1", "cp1252"]
        last_err = None

        for enc in encodings:
            try:
                df = pd.read_csv(io.BytesIO(content), encoding=enc, dtype=str)
                # Drop rows that are completely blank
                df = df.dropna(how="all")
                return df
            except Exception as e:
                last_err = e
                continue

        raise ValueError(f"Failed to decode CSV with supported encodings: {last_err}")

    @classmethod
    def normalize_headers(cls, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, str]]:
        """
        Maps raw CSV column names to standardized canonical column names.
        """
        raw_cols = [str(c).strip() for c in df.columns]
        mapping: Dict[str, str] = {}
        matched_standards: set = set()

        for raw_col in raw_cols:
            clean_raw = raw_col.lower().replace(" ", "_").replace(".", "").replace("#", "")
            for canonical, aliases in COLUMN_ALIASES.items():
                if canonical in matched_standards:
                    continue
                if clean_raw in aliases or clean_raw == canonical:
                    mapping[raw_col] = canonical
                    matched_standards.add(canonical)
                    break

        renamed_df = df.rename(columns=mapping)
        return renamed_df, mapping

    @classmethod
    def sanitize(cls, raw_content: bytes, filename: Optional[str] = None) -> CleanedPOSResult:
        """
        Main pipeline method: reads bytes (Excel or CSV), normalizes headers, cleans and validates records.
        """
        df = cls.read_file_bytes(raw_content, filename=filename)
        total_rows = len(df)
        df, header_mapping = cls.normalize_headers(df)

        result = CleanedPOSResult(total_raw_rows=total_rows)

        # Check for absolute minimum required fields
        has_identifier = any(c in df.columns for c in ["product_name", "category", "sku"])
        if "invoice_number" not in df.columns or not has_identifier:
            result.errors.append(
                ETLRowError(
                    row_number=1,
                    reason=f"Dataset missing mandatory columns. Found: {list(df.columns)}. Needs transaction/invoice ID and product/category columns.",
                )
            )
            return result

        has_item_col = any(c in df.columns for c in ["product_name", "sku"])

        for idx, row in df.iterrows():
            row_num = idx + 2  # 1-indexed (account for 1 header row)
            row_dict = row.to_dict()

            # 1. Validate Invoice Number
            raw_invoice = row_dict.get("invoice_number")
            if pd.isna(raw_invoice) or str(raw_invoice).strip() == "":
                result.errors.append(
                    ETLRowError(
                        row_number=row_num,
                        invoice_number=None,
                        reason="Missing mandatory invoice/bill number.",
                        raw_data={k: str(v) for k, v in row_dict.items() if pd.notna(v)},
                    )
                )
                continue
            invoice_number = str(raw_invoice).strip().upper()

            # 2. Validate Product Name, SKU, and Category
            raw_name = row_dict.get("product_name")
            raw_sku = row_dict.get("sku")
            raw_cat = row_dict.get("category")

            name_empty = pd.isna(raw_name) or str(raw_name).strip() == ""
            sku_empty = pd.isna(raw_sku) or str(raw_sku).strip() == ""

            if name_empty and sku_empty:
                # If dataset genuinely lacks product/sku columns, use Category Item
                if not has_item_col and pd.notna(raw_cat) and str(raw_cat).strip():
                    product_name = f"{str(raw_cat).strip()} Item"
                else:
                    result.errors.append(
                        ETLRowError(
                            row_number=row_num,
                            invoice_number=invoice_number,
                            reason="Missing both product name and SKU. Record rejected.",
                            raw_data={k: str(v) for k, v in row_dict.items() if pd.notna(v)},
                        )
                    )
                    continue
            else:
                product_name = str(raw_name).strip() if pd.notna(raw_name) and str(raw_name).strip() else str(raw_sku).strip()
            
            # If SKU is missing, auto-generate slugified SKU from product name
            if pd.isna(raw_sku) or str(raw_sku).strip() == "":
                clean_slug = re.sub(r"[^\w\s-]", "", product_name).strip().upper()
                sku = re.sub(r"[-\s]+", "-", clean_slug)[:20]
                result.warnings.append(
                    ETLWarning(
                        row_number=row_num,
                        invoice_number=invoice_number,
                        message=f"Missing SKU; auto-generated '{sku}' from item name.",
                    )
                )
            else:
                sku = str(raw_sku).strip().upper()

            # 3. Clean Quantity
            raw_qty = _clean_currency_or_number(row_dict.get("quantity"), default=1.0)
            qty = int(round(raw_qty))
            if qty <= 0:
                result.errors.append(
                    ETLRowError(
                        row_number=row_num,
                        invoice_number=invoice_number,
                        reason=f"Invalid quantity: {raw_qty}. Must be greater than 0.",
                        raw_data={k: str(v) for k, v in row_dict.items() if pd.notna(v)},
                    )
                )
                continue

            # 4. Clean Unit Price and Subtotal
            raw_price = _clean_currency_or_number(row_dict.get("unit_price"), default=0.0)
            raw_subtotal = _clean_currency_or_number(row_dict.get("subtotal"), default=0.0)
            raw_disc = _clean_currency_or_number(row_dict.get("discount_amount"), default=0.0)
            raw_tax = _clean_currency_or_number(row_dict.get("tax_amount"), default=0.0)

            # Auto-reconcile price/subtotal
            if raw_price <= 0 and raw_subtotal > 0 and qty > 0:
                raw_price = raw_subtotal / qty
                result.warnings.append(
                    ETLWarning(
                        row_number=row_num,
                        invoice_number=invoice_number,
                        message=f"Unit price missing or 0; derived Rs. {raw_price:.2f} from subtotal / quantity.",
                    )
                )
            elif raw_subtotal <= 0:
                raw_subtotal = (raw_price * qty) - raw_disc + raw_tax

            if raw_price < 0 or raw_subtotal < 0:
                result.errors.append(
                    ETLRowError(
                        row_number=row_num,
                        invoice_number=invoice_number,
                        reason="Negative price or subtotal detected.",
                        raw_data={k: str(v) for k, v in row_dict.items() if pd.notna(v)},
                    )
                )
                continue

            # 5. Clean Category, Payment Method, Dates & Customer Info
            raw_category_val = str(row_dict.get("category") or "").strip()
            if not raw_category_val or raw_category_val.lower() == "general" or raw_category_val.lower() == "nan":
                category = product_name if len(product_name) < 35 else "General"
            else:
                category = raw_category_val
            payment_method = _normalize_payment_method(row_dict.get("payment_method"))
            sale_date = _parse_pos_date(row_dict.get("date"))

            customer_name = str(row_dict.get("customer_name")).strip() if pd.notna(row_dict.get("customer_name")) else None
            customer_phone = str(row_dict.get("customer_phone")).strip() if pd.notna(row_dict.get("customer_phone")) else None
            customer_pan = str(row_dict.get("customer_pan")).strip() if pd.notna(row_dict.get("customer_pan")) else None

            # Convert to Decimals for exact currency math
            try:
                record = CleanedPOSRecord(
                    row_number=row_num,
                    invoice_number=invoice_number,
                    date=sale_date,
                    sku=sku,
                    product_name=product_name,
                    category=category,
                    quantity=qty,
                    unit_price=Decimal(f"{raw_price:.2f}"),
                    discount_amount=Decimal(f"{raw_disc:.2f}"),
                    tax_amount=Decimal(f"{raw_tax:.2f}"),
                    subtotal=Decimal(f"{raw_subtotal:.2f}"),
                    payment_method=payment_method,
                    customer_name=customer_name,
                    customer_phone=customer_phone,
                    customer_pan=customer_pan,
                )
                result.records.append(record)
            except InvalidOperation as e:
                result.errors.append(
                    ETLRowError(
                        row_number=row_num,
                        invoice_number=invoice_number,
                        reason=f"Decimal conversion error: {str(e)}",
                    )
                )

        return result
