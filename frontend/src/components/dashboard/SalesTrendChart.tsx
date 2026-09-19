"use client";

import React, { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, Calendar } from "lucide-react";

interface MonthlyData {
  month: string;
  monthNepali?: string;
  revenue: number;
  profit: number;
  orders: number;
}

const MONTHLY_SALES_DATA: MonthlyData[] = [
  { month: "Baisakh", monthNepali: "बैशाख", revenue: 380000, profit: 114000, orders: 980 },
  { month: "Jestha", monthNepali: "जेठ", revenue: 410000, profit: 123000, orders: 1040 },
  { month: "Ashadh", monthNepali: "असार", revenue: 445000, profit: 133500, orders: 1120 },
  { month: "Shrawan", monthNepali: "साउन", revenue: 395000, profit: 118500, orders: 1010 },
  { month: "Bhadra", monthNepali: "भदौ", revenue: 460000, profit: 138000, orders: 1180 },
  { month: "Ashwin", monthNepali: "असोज", revenue: 530000, profit: 164300, orders: 1390 }, // Dashain shopping season
  { month: "Kartik", monthNepali: "कात्तिक", revenue: 565000, profit: 175150, orders: 1460 }, // Tihar shopping season
  { month: "Mangsir", monthNepali: "मंसिर", revenue: 485200, profit: 142560, orders: 1248 },
];

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const rev = payload.find((p: any) => p.dataKey === "revenue")?.value || 0;
    const prof = payload.find((p: any) => p.dataKey === "profit")?.value || 0;
    const margin = rev > 0 ? ((prof / rev) * 100).toFixed(1) : 0;

    return (
      <div className="rounded-xl border border-slate-200 bg-white/95 p-3.5 shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{label}</p>
        <div className="mt-2 space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Sales Revenue:
            </span>
            <span className="font-bold text-slate-900 dark:text-white">
              Rs. {rev.toLocaleString("en-NP")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-indigo-600 font-medium">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              Gross Profit:
            </span>
            <span className="font-bold text-slate-900 dark:text-white">
              Rs. {prof.toLocaleString("en-NP")}
            </span>
          </div>
          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-slate-500 text-[11px]">
            <span>Profit Margin:</span>
            <span className="font-semibold text-brand-600">{margin}%</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

interface SalesTrendChartProps {
  data?: MonthlyData[] | null;
}

export function SalesTrendChart({ data }: SalesTrendChartProps) {
  const [viewMetric, setViewMetric] = useState<"both" | "revenue" | "profit">("both");
  const hasData = Boolean(data && data.length > 0);
  const chartData = data || [];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Monthly Sales & Gross Profit Trends
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            मासिक बिक्री तथा खुद्रा नाफाको तुलनात्मक विश्लेषण {hasData ? "(अपलोड गरिएको डेटा)" : "(डाटा अपलोड आवश्यक)"}
          </p>
        </div>

        {/* Metric Toggles */}
        {hasData && (
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
            <button
              onClick={() => setViewMetric("both")}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                viewMetric === "both"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              All Metrics
            </button>
            <button
              onClick={() => setViewMetric("revenue")}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                viewMetric === "revenue"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Revenue Only
            </button>
            <button
              onClick={() => setViewMetric("profit")}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                viewMetric === "profit"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Profit Only
            </button>
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center h-[320px] text-center p-6 text-slate-400">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-500 mb-3">
            <TrendingUp className="h-7 w-7 text-emerald-500/60" />
          </div>
          <h4 className="text-sm font-bold text-slate-200">कुनै बिक्री डाटा उपलब्ध छैन (No Sales Data)</h4>
          <p className="text-xs text-slate-400 max-w-sm mt-1.5">
            तपाईंको पसलको वास्तविक आम्दानी, नाफा र मासिक ट्रेन्ड हेर्न कृपया बायाँ मेनुबाट POS CSV/Excel फाइल अपलोड गर्नुहोस्।
          </p>
        </div>
      ) : (
        <div className="mt-6 h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#64748b", fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#64748b", fontSize: 12 }}
              tickFormatter={(v) => `Rs. ${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: 15, fontSize: 12 }}
            />

            {(viewMetric === "both" || viewMetric === "revenue") && (
              <Area
                type="monotone"
                name="Sales Revenue"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
            )}

            {(viewMetric === "both" || viewMetric === "profit") && (
              <Area
                type="monotone"
                name="Gross Profit"
                dataKey="profit"
                stroke="#6366f1"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorProfit)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      )}
    </div>
  );
}
