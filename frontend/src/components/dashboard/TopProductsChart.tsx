"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Award, Package } from "lucide-react";

interface TopProduct {
  name: string;
  sku: string;
  category: string;
  unitsSold: number;
  revenue: number;
  stockLeft?: number;
}

const TOP_PRODUCTS_DATA: TopProduct[] = [
  {
    name: "Aanadi Basmati Rice 25kg",
    sku: "BAS-RICE-25KG",
    category: "Grains",
    unitsSold: 95,
    revenue: 270750,
    stockLeft: 8,
  },
  {
    name: "Ilam Orthodox CTC Tea 500g",
    sku: "CTM-TEA-500G",
    category: "Beverages",
    unitsSold: 820,
    revenue: 262400,
    stockLeft: 38,
  },
  {
    name: "DDC Pure Cow Ghee 1L",
    sku: "DDC-GHEE-1L",
    category: "Dairy",
    unitsSold: 210,
    revenue: 241500,
    stockLeft: 12,
  },
  {
    name: "Current Dairy Butter 500g",
    sku: "CUR-BUTTER-500G",
    category: "Dairy",
    unitsSold: 340,
    revenue: 153000,
    stockLeft: 25,
  },
  {
    name: "Wai Wai Quick 75g (Box)",
    sku: "WAI-NOOD-75G",
    category: "Instant Food",
    unitsSold: 4250,
    revenue: 106250,
    stockLeft: 142,
  },
];

const COLORS = ["#059669", "#10b981", "#34d399", "#6ee7b7", "#a7f3d0"];

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data: TopProduct = payload[0].payload;
    return (
      <div className="rounded-xl border border-slate-200 bg-white/95 p-3.5 shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 text-xs">
        <p className="font-bold text-slate-900 dark:text-white">{data.name}</p>
        <p className="text-slate-400 font-mono text-[11px]">{data.sku} • {data.category}</p>
        <div className="mt-2 space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Sales Volume:</span>
            <span className="font-semibold text-slate-900 dark:text-white">{data.unitsSold.toLocaleString()} units</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Gross Revenue:</span>
            <span className="font-bold text-emerald-600">Rs. {data.revenue.toLocaleString("en-NP")}</span>
          </div>
          <div className="flex justify-between gap-4 pt-1 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">Available Stock:</span>
            <span className={`font-semibold ${(data.stockLeft ?? 0) <= 15 ? "text-amber-600" : "text-slate-700"}`}>
              {data.stockLeft ?? 0} units {(data.stockLeft ?? 0) <= 15 ? "(Reorder Soon)" : ""}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

interface TopProductsChartProps {
  products?: TopProduct[] | null;
}

export function TopProductsChart({ products }: TopProductsChartProps) {
  const hasData = Boolean(products && products.length > 0);
  const chartData = products || [];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-6 shadow-xl w-full">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-400">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Top Categories & Items by Revenue
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              धेरै बिक्री भएका मुख्य सामान तथा वर्गहरू {hasData ? "(कारोबार अनुसार)" : "(डाटा अपलोड आवश्यक)"}
            </p>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center h-[300px] text-center p-6 text-slate-400">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-500 mb-3">
            <Package className="h-7 w-7 text-amber-500/60" />
          </div>
          <h4 className="text-sm font-bold text-slate-200">कुनै सामान बिक्री डाटा छैन (No Products Data)</h4>
          <p className="text-xs text-slate-400 max-w-sm mt-1.5">
            बिक्री कारोबार विवरण अपलोड गरेपछि धेरै बिकेका र नाफा दिने मुख्य उत्पादनहरू यहाँ देखिनेछन्।
          </p>
        </div>
      ) : (
        <div className="mt-6 h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickFormatter={(v) => `Rs. ${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#64748b", fontSize: 11 }}
                width={120}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === 0 ? "#f59e0b" : index === 1 ? "#10b981" : "#6366f1"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
