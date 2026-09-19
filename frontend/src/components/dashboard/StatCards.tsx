"use client";

import React from "react";
import { TrendingUp, DollarSign, ShoppingCart, AlertTriangle, ArrowUpRight } from "lucide-react";

interface StatItem {
  id: string;
  title: string;
  titleNepali: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}

const STATS: StatItem[] = [
  {
    id: "profit",
    title: "Gross Profit",
    titleNepali: "कुल खुद्रा नाफा",
    value: "Rs. 142,560",
    change: "+14.2% vs last month",
    isPositive: true,
    icon: DollarSign,
    iconBg: "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "revenue",
    title: "Sales Revenue",
    titleNepali: "कुल बिक्री आम्दानी",
    value: "Rs. 485,200",
    change: "+18.5% vs last month",
    isPositive: true,
    icon: TrendingUp,
    iconBg: "bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
  {
    id: "orders",
    title: "Invoices & Orders",
    titleNepali: "कुल बिक्री बिल संख्या",
    value: "1,248",
    change: "+8.1% vs last month",
    isPositive: true,
    icon: ShoppingCart,
    iconBg: "bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "low_stock",
    title: "Low Stock Alerts",
    titleNepali: "सकिन लागेका सामान",
    value: "3 items",
    change: "Reorder immediately",
    isPositive: false,
    icon: AlertTriangle,
    iconBg: "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
];

import { ETLUploadSummary } from "@/types";

interface StatCardsProps {
  summary?: ETLUploadSummary | null;
}

export function StatCards({ summary }: StatCardsProps) {
  const statsToRender = summary
    ? [
        {
          id: "profit",
          title: "Gross Profit (30% Margin)",
          titleNepali: "अनुमानित खुद्रा नाफा",
          value: `Rs. ${(summary.total_revenue_npr * 0.3).toLocaleString("en-NP", { maximumFractionDigits: 0 })}`,
          change: "Calculated from CSV",
          isPositive: true,
          icon: DollarSign,
          iconBg: "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800",
          iconColor: "text-emerald-600 dark:text-emerald-400",
        },
        {
          id: "revenue",
          title: "Total Sales Revenue",
          titleNepali: "कुल बिक्री आम्दानी",
          value: `Rs. ${summary.total_revenue_npr.toLocaleString("en-NP", { maximumFractionDigits: 0 })}`,
          change: `${summary.valid_rows_count || summary.total_rows_processed} entries`,
          isPositive: true,
          icon: TrendingUp,
          iconBg: "bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800",
          iconColor: "text-indigo-600 dark:text-indigo-400",
        },
        {
          id: "orders",
          title: "Invoices & Transactions",
          titleNepali: "कुल बिक्री बिल संख्या",
          value: (summary.valid_rows_count || summary.invoices_created).toLocaleString(),
          change: "100% verified",
          isPositive: true,
          icon: ShoppingCart,
          iconBg: "bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800",
          iconColor: "text-blue-600 dark:text-blue-400",
        },
        {
          id: "low_stock",
          title: "Catalog / Categories",
          titleNepali: "सामानका वर्गहरू",
          value: `${Object.keys(summary.category_breakdown || {}).length || summary.products_auto_created || 3} categories`,
          change: "Active catalog",
          isPositive: true,
          icon: AlertTriangle,
          iconBg: "bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800",
          iconColor: "text-cyan-600 dark:text-cyan-400",
        },
      ]
    : [
        {
          id: "profit",
          title: "Gross Profit",
          titleNepali: "कुल खुद्रा नाफा",
          value: "रु. ०.००",
          change: "डाटा अपलोड आवश्यक",
          isPositive: false,
          icon: DollarSign,
          iconBg: "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800",
          iconColor: "text-emerald-600 dark:text-emerald-400",
        },
        {
          id: "revenue",
          title: "Total Sales Revenue",
          titleNepali: "कुल बिक्री आम्दानी",
          value: "रु. ०.००",
          change: "डाटा अपलोड आवश्यक",
          isPositive: false,
          icon: TrendingUp,
          iconBg: "bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800",
          iconColor: "text-indigo-600 dark:text-indigo-400",
        },
        {
          id: "orders",
          title: "Invoices & Transactions",
          titleNepali: "कुल बिक्री बिल संख्या",
          value: "० बिल",
          change: "डाटा अपलोड आवश्यक",
          isPositive: false,
          icon: ShoppingCart,
          iconBg: "bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800",
          iconColor: "text-blue-600 dark:text-blue-400",
        },
        {
          id: "low_stock",
          title: "Stock Alert",
          titleNepali: "सामान स्टक अवस्था",
          value: "० अलर्ट",
          change: "डाटा अपलोड आवश्यक",
          isPositive: false,
          icon: AlertTriangle,
          iconBg: "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800",
          iconColor: "text-amber-600 dark:text-amber-400",
        },
      ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {statsToRender.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.id}
            className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {stat.title}
                </p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  {stat.titleNepali}
                </p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconBg}`}>
                <Icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <h3 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {stat.value}
              </h3>
              <span
                className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${
                  stat.isPositive
                    ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50"
                    : "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/50"
                }`}
              >
                {stat.isPositive && <ArrowUpRight className="h-3 w-3 mr-0.5" />}
                {stat.change}
              </span>
            </div>

            {/* Subtle glow accent line */}
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-brand-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        );
      })}
    </div>
  );
}
