"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface PaymentData {
  name: string;
  value: number;
  percentage: number;
  color: string;
  nepaliLabel: string;
}

const DEFAULT_PAYMENT_DATA: PaymentData[] = [
  { name: "Fonepay / QR", value: 367920, percentage: 42, color: "#10b981", nepaliLabel: "फोनपे / QR" },
  { name: "Cash (नगद)", value: 280320, percentage: 32, color: "#f59e0b", nepaliLabel: "नगद" },
  { name: "eSewa / Khalti", value: 157680, percentage: 18, color: "#6366f1", nepaliLabel: "ईसेवा / खल्ती" },
  { name: "Debit / Credit Card", value: 43800, percentage: 5, color: "#3b82f6", nepaliLabel: "कार्ड" },
  { name: "Credit / Udharo (उधारो)", value: 26280, percentage: 3, color: "#ef4444", nepaliLabel: "उधारो" },
];

export function PaymentBreakdownChart({ data = DEFAULT_PAYMENT_DATA }: { data?: PaymentData[] }) {
  const totalVolume = data.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            Payment Methods
            <span className="text-xs font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
              नेपाली भुक्तानी
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Breakdown across QR, Cash, Wallets & Credit
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400 block">Total Volume</span>
          <span className="text-sm font-semibold text-slate-200">
            Rs. {(totalVolume / 1000).toFixed(1)}k
          </span>
        </div>
      </div>

      <div className="h-64 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={88}
              paddingAngle={4}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload as PaymentData;
                  return (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-2xl text-xs space-y-1 z-50">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></span>
                        {d.name} ({d.nepaliLabel})
                      </div>
                      <div className="text-slate-300">
                        Amount: <span className="font-mono text-emerald-400 font-medium">Rs. {d.value.toLocaleString()}</span>
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        Share: <span className="text-slate-200 font-semibold">{d.percentage}%</span> of total sales
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] font-medium text-slate-400">Fonepay / QR</span>
          <span className="text-lg font-black text-emerald-400">42%</span>
          <span className="text-[10px] text-slate-400">Dominant</span>
        </div>
      </div>

      {/* Legend list */}
      <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
        {data.slice(0, 4).map((item) => (
          <div key={item.name} className="flex items-center justify-between text-slate-300 bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-slate-800/40">
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="truncate">{item.name}</span>
            </div>
            <span className="font-mono font-medium text-slate-400 shrink-0 ml-1">{item.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
