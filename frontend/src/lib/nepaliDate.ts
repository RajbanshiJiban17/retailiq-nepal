/**
 * RetailIQ Nepal - Dynamic Nepali (Bikram Sambat) Date Utility
 * Automatically converts Gregorian date into Nepali Bikram Sambat (वि.सं.)
 * with real-time day, month, year, and Devanagari numerals.
 */

// Devanagari digits mapping
const DEVANAGARI_DIGITS: Record<string, string> = {
  "0": "०",
  "1": "१",
  "2": "२",
  "3": "३",
  "4": "४",
  "5": "५",
  "6": "६",
  "7": "७",
  "8": "८",
  "9": "९",
};

export function toDevanagariNumerals(num: number | string): string {
  return String(num)
    .split("")
    .map((char) => DEVANAGARI_DIGITS[char] || char)
    .join("");
}

export const NEPALI_MONTHS = [
  "बैशाख",
  "जेठ",
  "असार",
  "साउन",
  "भदौ",
  "असोज",
  "कात्तिक",
  "मंसिर",
  "पुस",
  "माघ",
  "फागुन",
  "चैत",
];

export const NEPALI_DAYS = [
  "आइतबार",
  "सोमबार",
  "मंगलबार",
  "बुधबार",
  "बिहीबार",
  "शुक्रबार",
  "शनिबार",
];

// Reference calendar table for BS 2080 - 2086
interface BSCalendarYear {
  bsYear: number;
  adStartDate: string; // ISO date string of Baishakh 1
  daysInMonths: number[]; // 12 months length
}

const BS_CALENDAR_DATA: BSCalendarYear[] = [
  {
    bsYear: 2080,
    adStartDate: "2023-04-14",
    daysInMonths: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  },
  {
    bsYear: 2081,
    adStartDate: "2024-04-13",
    daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  },
  {
    bsYear: 2082,
    adStartDate: "2025-04-14",
    daysInMonths: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  },
  {
    bsYear: 2083,
    adStartDate: "2026-04-14",
    daysInMonths: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  },
  {
    bsYear: 2084,
    adStartDate: "2027-04-14",
    daysInMonths: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  },
  {
    bsYear: 2085,
    adStartDate: "2028-04-13",
    daysInMonths: [31, 32, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  },
];

export interface NepaliDateInfo {
  bsYear: number;
  bsMonth: number; // 1-indexed (1 = Baishakh)
  bsMonthName: string;
  bsDay: number;
  dayOfWeekNepali: string;
  devanagariYear: string;
  devanagariDay: string;
  fullNepaliString: string; // e.g. "२०८३ असोज ३, शनिबार"
  shortDateString: string; // e.g. "२०८३ असोज ३"
  adDateString: string; // e.g. "19 Sep 2026"
}

export function getNepaliDate(date: Date = new Date()): NepaliDateInfo {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const dayOfWeekIndex = targetDate.getDay();
  const dayOfWeekNepali = NEPALI_DAYS[dayOfWeekIndex] || "शनिबार";

  // Find corresponding BS year from data table
  let matchedYearData = BS_CALENDAR_DATA[BS_CALENDAR_DATA.length - 1];

  for (let i = 0; i < BS_CALENDAR_DATA.length; i++) {
    const start = new Date(BS_CALENDAR_DATA[i].adStartDate);
    start.setHours(0, 0, 0, 0);

    const nextStart =
      i + 1 < BS_CALENDAR_DATA.length
        ? new Date(BS_CALENDAR_DATA[i + 1].adStartDate)
        : new Date("2099-01-01");
    nextStart.setHours(0, 0, 0, 0);

    if (targetDate >= start && targetDate < nextStart) {
      matchedYearData = BS_CALENDAR_DATA[i];
      break;
    }
  }

  const startAd = new Date(matchedYearData.adStartDate);
  startAd.setHours(0, 0, 0, 0);

  const diffMs = targetDate.getTime() - startAd.getTime();
  let dayOffset = Math.floor(diffMs / (1000 * 60 * 60 * 24)); // 0-indexed days since Baishakh 1

  let bsMonthIndex = 0;
  let bsDay = 1;

  for (let m = 0; m < 12; m++) {
    const daysInThisMonth = matchedYearData.daysInMonths[m] || 30;
    if (dayOffset < daysInThisMonth) {
      bsMonthIndex = m;
      bsDay = dayOffset + 1;
      break;
    }
    dayOffset -= daysInThisMonth;
  }

  const bsYear = matchedYearData.bsYear;
  const bsMonth = bsMonthIndex + 1;
  const bsMonthName = NEPALI_MONTHS[bsMonthIndex] || "बैशाख";

  const devanagariYear = toDevanagariNumerals(bsYear);
  const devanagariDay = toDevanagariNumerals(bsDay);

  const fullNepaliString = `${devanagariYear} ${bsMonthName} ${devanagariDay}, ${dayOfWeekNepali}`;
  const shortDateString = `${devanagariYear} ${bsMonthName} ${devanagariDay}`;

  // Formatted AD date e.g. "19 Sep 2026"
  const adMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const adDateString = `${targetDate.getDate()} ${adMonths[targetDate.getMonth()]} ${targetDate.getFullYear()}`;

  return {
    bsYear,
    bsMonth,
    bsMonthName,
    bsDay,
    dayOfWeekNepali,
    devanagariYear,
    devanagariDay,
    fullNepaliString,
    shortDateString,
    adDateString,
  };
}

/**
 * Official Nepali Accounting Fiscal Year Months (साउन देखि असारसम्म)
 * In Nepal, all corporate accounting, tax filing, and fiscal records begin on Shrawan 1.
 */
export const NEPALI_FISCAL_MONTHS = [
  "साउन",   // Month 1 of Fiscal Year
  "भदौ",   // Month 2
  "असोज",   // Month 3
  "कात्तिक", // Month 4
  "मंसिर",  // Month 5
  "पुस",    // Month 6
  "माघ",    // Month 7
  "फागुन",  // Month 8
  "चैत",    // Month 9
  "बैशाख",  // Month 10
  "जेठ",    // Month 11
  "असार",   // Month 12 of Fiscal Year
];

export interface FiscalYearInfo {
  bsFiscalYear: string;         // e.g. "२०८१/८२"
  bsFiscalYearFull: string;     // e.g. "आ.व. २०८१/८२ (FY 2024/25)"
  adFiscalYear: string;         // e.g. "FY 2024/25"
  startYear: number;
  endYear: number;
}

export function getFiscalYear(date: Date = new Date()): FiscalYearInfo {
  const nepaliDate = getNepaliDate(date);
  const bsYear = nepaliDate.bsYear;
  const isPostShrawan = nepaliDate.bsMonth >= 4; // Month 4 is Shrawan in calendar (1=Baisakh, 2=Jestha, 3=Ashadh, 4=Shrawan)

  const startYear = isPostShrawan ? bsYear : bsYear - 1;
  const endYear = startYear + 1;

  const startDev = toDevanagariNumerals(startYear);
  const endDev = toDevanagariNumerals(endYear).slice(-2);

  const adYear = date.getFullYear();
  const adStartYear = isPostShrawan ? adYear : adYear - 1;
  const adEndYear = (adStartYear + 1).toString().slice(-2);

  return {
    bsFiscalYear: `${startDev}/${endDev}`,
    bsFiscalYearFull: `आ.व. ${startDev}/${endDev} (FY ${adStartYear}/${adEndYear})`,
    adFiscalYear: `FY ${adStartYear}/${adEndYear}`,
    startYear,
    endYear,
  };
}
