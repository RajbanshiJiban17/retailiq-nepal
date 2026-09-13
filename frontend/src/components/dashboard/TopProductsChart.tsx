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
  const chartData = products && products.length > 0 ? products : TOP_PRODUCTS_DATA;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Top Categories & Items by Revenue
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              धेरै बिक्री भएका मुख्य सामान तथा वर्गहरू (NPR Turnover)
            </p>
          </div>
        </div>
      </div>

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
              dataKey="sku"
              tickLine={false}
              axisLine={false}
              width={110}
              tick={{ fill: "#334155", fontSize: 11, fontWeight: 500 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Quick legend with units summary */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
        {chartData.slice(0, 4).map((item, idx) => (
          <div key={item.sku} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
            <span className="truncate max-w-[140px] font-medium text-slate-800 dark:text-slate-200">
              {idx + 1}. {item.name}
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              Rs. {(item.revenue / 1000).toFixed(1)}k
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
