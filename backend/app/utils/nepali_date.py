"""
RetailIQ Nepal - Dynamic Nepali (Bikram Sambat) Date Utility for Backend
Converts datetime into Bikram Sambat (वि.सं.) strings with Devanagari digits.
"""

from datetime import date, datetime
from typing import Dict, Any

DEVANAGARI_DIGITS = {
    "0": "०", "1": "१", "2": "२", "3": "३", "4": "४",
    "5": "५", "6": "६", "7": "७", "8": "८", "9": "९"
}

def to_devanagari(num: Any) -> str:
    return "".join(DEVANAGARI_DIGITS.get(ch, ch) for ch in str(num))

NEPALI_MONTHS = [
    "बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज",
    "कात्तिक", "मंसिर", "पुस", "माघ", "फागुन", "चैत"
]

NEPALI_DAYS = [
    "सोमबार", "मंगलबार", "बुधबार", "बिहीबार", "शुक्रबार", "शनिबार", "आइतबार"
]

BS_CALENDAR_DATA = [
    {
        "bs_year": 2080,
        "ad_start": date(2023, 4, 14),
        "days_in_months": [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    },
    {
        "bs_year": 2081,
        "ad_start": date(2024, 4, 13),
        "days_in_months": [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    },
    {
        "bs_year": 2082,
        "ad_start": date(2025, 4, 14),
        "days_in_months": [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
    },
    {
        "bs_year": 2083,
        "ad_start": date(2026, 4, 14),
        "days_in_months": [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    },
    {
        "bs_year": 2084,
        "ad_start": date(2027, 4, 14),
        "days_in_months": [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
    },
]

def get_current_nepali_date_str(target_date: date = None, include_day_of_week: bool = True) -> str:
    """
    Returns dynamic Nepali Bikram Sambat date string, e.g. "२०८३ असोज ३, शनिबार"
    """
    if target_date is None:
        target_date = date.today()
    elif isinstance(target_date, datetime):
        target_date = target_date.date()

    matched_year = BS_CALENDAR_DATA[-1]
    for i, item in enumerate(BS_CALENDAR_DATA):
        start = item["ad_start"]
        next_start = BS_CALENDAR_DATA[i + 1]["ad_start"] if i + 1 < len(BS_CALENDAR_DATA) else date(2099, 1, 1)
        if start <= target_date < next_start:
            matched_year = item
            break

    day_offset = (target_date - matched_year["ad_start"]).days
    bs_month_idx = 0
    bs_day = 1

    for m, days_in_month in enumerate(matched_year["days_in_months"]):
        if day_offset < days_in_month:
            bs_month_idx = m
            bs_day = day_offset + 1
            break
        day_offset -= days_in_month

    bs_year = matched_year["bs_year"]
    month_name = NEPALI_MONTHS[bs_month_idx]
    dev_year = to_devanagari(bs_year)
    dev_day = to_devanagari(bs_day)

    if include_day_of_week:
        # target_date.weekday(): Monday is 0 and Sunday is 6
        day_name = NEPALI_DAYS[target_date.weekday()]
        return f"{dev_year} {month_name} {dev_day}, {day_name}"
    return f"{dev_year} {month_name} {dev_day}"


def get_fiscal_year_bs(target_date: date = None) -> str:
    """
    Returns the Nepali accounting Fiscal Year (आर्थिक वर्ष), e.g., "आ.व. २०८१/८२ (FY 2024/25)"
    Nepali fiscal year starts in Shrawan (Month index 3) and ends in Ashadh (Month index 2).
    """
    if target_date is None:
        target_date = date.today()
    elif isinstance(target_date, datetime):
        target_date = target_date.date()

    matched_year = BS_CALENDAR_DATA[-1]
    for i, item in enumerate(BS_CALENDAR_DATA):
        start = item["ad_start"]
        next_start = BS_CALENDAR_DATA[i + 1]["ad_start"] if i + 1 < len(BS_CALENDAR_DATA) else date(2099, 1, 1)
        if start <= target_date < next_start:
            matched_year = item
            break

    day_offset = (target_date - matched_year["ad_start"]).days
    bs_month_idx = 0

    for m, days_in_month in enumerate(matched_year["days_in_months"]):
        if day_offset < days_in_month:
            bs_month_idx = m
            break
        day_offset -= days_in_month

    bs_year = matched_year["bs_year"]
    if bs_month_idx >= 3:  # Shrawan to Chaitra
        fy_bs = f"आ.व. {to_devanagari(bs_year)}/{to_devanagari(bs_year + 1)[-2:]}"
        fy_ad = f"FY {target_date.year}/{str(target_date.year + 1)[-2:]}"
    else:  # Baisakh, Jestha, Ashadh
        fy_bs = f"आ.व. {to_devanagari(bs_year - 1)}/{to_devanagari(bs_year)[-2:]}"
        fy_ad = f"FY {target_date.year - 1}/{str(target_date.year)[-2:]}"

    return f"{fy_bs} ({fy_ad})"
