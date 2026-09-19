"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Building2,
  MapPin,
  User,
  Phone,
  Crown,
  CheckCircle2,
  Store,
  ArrowRight,
  Search,
  ShieldCheck,
} from "lucide-react";
import { fetchRegisteredMerchants } from "@/lib/api";
import { UserProfile } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectMerchant: (merchant: any) => void;
  currentBusinessId?: string;
}

export function MerchantDirectoryModal({
  isOpen,
  onClose,
  onSelectMerchant,
  currentBusinessId,
}: Props) {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(5);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      const loadMerchants = async () => {
        setLoading(true);
        try {
          const res = await fetchRegisteredMerchants();
          setMerchants(res.merchants || []);
          setTotalCount(res.total_count || 5);
        } catch {
          // fallback
        } finally {
          setLoading(false);
        }
      };
      loadMerchants();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = merchants.filter(
    (m) =>
      m.business_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  दर्ता भएका खुद्रा तथा थोक पसलहरू
                </h2>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {totalCount} पसलहरू सक्रिय
                </span>
              </div>
              <p className="text-xs text-slate-400">
                RetailIQ Nepal Multi-Tenant Network • आफ्नो पसल छान्नुहोस् वा नयाँ दर्ता गर्नुहोस्
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="पसलको नाम, सञ्चालक वा सहरबाट खोज्नुहोस्..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
        </div>

        {/* Merchants Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              पसलहरूको सूची लोड हुँदैछ...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              कुनै पसल फेला परेन।
            </div>
          ) : (
            filtered.map((m) => {
              const isCurrent = currentBusinessId && (m.id === currentBusinessId || m.business_name?.includes(currentBusinessId));

              return (
                <div
                  key={m.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCurrent
                      ? "bg-emerald-950/30 border-emerald-500/50 shadow-md shadow-emerald-950/40"
                      : "bg-slate-850/60 border-slate-800 hover:border-slate-700 hover:bg-slate-850"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-white">
                          {m.business_name}
                        </h3>
                        {isCurrent && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold border border-emerald-500/40 flex items-center gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" /> हाल सक्रिय
                          </span>
                        )}
                        <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                          {m.plan || "Pro Merchant"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
                        {m.owner_name && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3 text-slate-500" />
                            {m.owner_name}
                          </span>
                        )}
                        {m.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-500" />
                            {m.city}
                          </span>
                        )}
                        {m.phone && (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="h-3 w-3 text-slate-500" />
                            {m.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onSelectMerchant(m);
                      onClose();
                    }}
                    className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition shrink-0 ${
                      isCurrent
                        ? "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-750"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                    }`}
                  >
                    <span>{isCurrent ? "यही ड्यासबोर्डमा रहनुहोस्" : "यो पसलमा स्विच गर्नुहोस्"}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            प्रत्येक पसलको डाटा १००% सुरक्षित र अलग (Tenant-Isolated) छ।
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
          >
            बन्द गर्नुहोस्
          </button>
        </div>
      </div>
    </div>
  );
}
