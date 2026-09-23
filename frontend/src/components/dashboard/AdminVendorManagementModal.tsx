"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Building2,
  MapPin,
  User,
  Phone,
  Mail,
  Crown,
  CheckCircle2,
  Store,
  ArrowRight,
  Search,
  ShieldCheck,
  Trash2,
  Eye,
  AlertTriangle,
  RefreshCw,
  FileText,
  BadgeAlert,
} from "lucide-react";
import { fetchRegisteredMerchants, deleteRegisteredMerchant } from "@/lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectMerchant?: (merchant: any) => void;
  currentBusinessId?: string;
  onVendorDeleted?: (deletedId: string) => void;
}

export function AdminVendorManagementModal({
  isOpen,
  onClose,
  onSelectMerchant,
  currentBusinessId,
  onVendorDeleted,
}: Props) {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // View Details Modal State
  const [viewingMerchant, setViewingMerchant] = useState<any | null>(null);

  // Delete Confirmation State
  const [vendorToDelete, setVendorToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadMerchants = async () => {
    try {
      const res = await fetchRegisteredMerchants();
      setMerchants(res.merchants || []);
      setTotalCount(res.total_count || (res.merchants ? res.merchants.length : 0));
    } catch (e) {
      console.error("Failed to load merchants", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setActionNotice(null);
      loadMerchants();
    }
  }, [isOpen]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setActionNotice(null);
    await loadMerchants();
  };

  const handleDeleteConfirm = async () => {
    if (!vendorToDelete) return;
    setDeleting(true);
    setActionNotice(null);

    try {
      const res = await deleteRegisteredMerchant(vendorToDelete.id);
      // Update local state immediately
      setMerchants((prev) => prev.filter((m) => m.id !== vendorToDelete.id));
      setTotalCount((prev) => Math.max(0, prev - 1));

      setActionNotice({
        type: "success",
        text: `पसल '${vendorToDelete.business_name}' सफलतापूर्वक हटाइयो। (Deleted)`,
      });

      if (onVendorDeleted) {
        onVendorDeleted(vendorToDelete.id);
      }
    } catch (err: any) {
      setActionNotice({
        type: "error",
        text: err?.message || "पसल हटाउन सकिएन। कृपया पुन: प्रयास गर्नुहोस्।",
      });
    } finally {
      setDeleting(false);
      setVendorToDelete(null);
    }
  };

  if (!isOpen) return null;

  const filtered = merchants.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.business_name?.toLowerCase().includes(q) ||
      m.owner_name?.toLowerCase().includes(q) ||
      m.city?.toLowerCase().includes(q) ||
      m.phone?.toLowerCase().includes(q) ||
      m.pan_vat?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  प्रशासक भेन्डर तथा पसल व्यवस्थापन (Vendor Management)
                </h2>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-400 font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  {totalCount} पसलहरू
                </span>
              </div>
              <p className="text-xs text-slate-400">
                सबै दर्ता भएका पसलहरूको प्रत्यक्ष विवरण अवलोकन (View) र व्यवस्थापन/हटाउने (Delete) नियन्त्रण कक्ष
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="ताजा गर्नुहोस् (Refresh)"
              className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-emerald-400" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Action Notice (Success / Error Toast) */}
        {actionNotice && (
          <div
            className={`px-4 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
              actionNotice.type === "success"
                ? "bg-emerald-950/60 border-emerald-800/80 text-emerald-300"
                : "bg-rose-950/60 border-rose-800/80 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {actionNotice.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <BadgeAlert className="h-4 w-4 shrink-0 text-rose-400" />
              )}
              <span>{actionNotice.text}</span>
            </div>
            <button
              onClick={() => setActionNotice(null)}
              className="text-slate-400 hover:text-white text-xs ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Search & Statistics Bar */}
        <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="पसलको नाम, सञ्चालक, PAN वा सहर..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 w-full sm:w-auto justify-end">
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
              देखाइएको: <strong className="text-white font-mono">{filtered.length}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
              कुल सक्रिय: <strong className="text-emerald-400 font-mono">{totalCount}</strong>
            </span>
          </div>
        </div>

        {/* Merchants List Table / Cards */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-emerald-500" />
              <span>पसलहरूको विवरण लोड हुँदैछ...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
              <Store className="h-8 w-8 text-slate-600" />
              <span>कुनै पसल फेला परेन। खोज शब्द परिवर्तन गर्नुहोस्।</span>
            </div>
          ) : (
            filtered.map((m) => {
              const isCurrent =
                currentBusinessId &&
                (m.id === currentBusinessId || m.business_name?.includes(currentBusinessId));

              return (
                <div
                  key={m.id}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCurrent
                      ? "bg-emerald-950/30 border-emerald-500/50 shadow-md shadow-emerald-950/40"
                      : "bg-slate-850/60 border-slate-800 hover:border-slate-700 hover:bg-slate-850"
                  }`}
                >
                  {/* Left: Info */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-white">{m.business_name}</h3>
                        {isCurrent && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold border border-emerald-500/40 flex items-center gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" /> हाल सक्रिय
                          </span>
                        )}
                        <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                          {m.plan || "Pro Merchant"}
                        </span>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                          {m.status || "सक्रिय"}
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
                        {m.pan_vat && (
                          <span className="flex items-center gap-1 font-mono text-[11px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">
                            PAN: {m.pan_vat}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions (View, Delete, Switch) */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {/* View Details Button */}
                    <button
                      onClick={() => setViewingMerchant(m)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                      title="विस्तृत विवरण हेर्नुहोस् (View Details)"
                    >
                      <Eye className="h-3.5 w-3.5 text-teal-400" />
                      <span>विवरण</span>
                    </button>

                    {/* Delete Vendor Button */}
                    <button
                      onClick={() => setVendorToDelete(m)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white text-xs font-semibold border border-rose-800/50 transition"
                      title="यो पसल मेटाउनुहोस् (Delete Vendor)"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                      <span>हटाउनुहोस्</span>
                    </button>

                    {/* Switch Store / Open Dashboard */}
                    {onSelectMerchant && (
                      <button
                        onClick={() => {
                          onSelectMerchant(m);
                          onClose();
                        }}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                          isCurrent
                            ? "bg-slate-800 text-slate-400 border border-slate-700"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
                        }`}
                      >
                        <span>{isCurrent ? "हालको" : "स्विच"}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            प्रत्येक पसलको डाटाबेस १००% सुरक्षित र स्वचालित रूपमा अलग (Tenant-Isolated) छ।
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
          >
            बन्द गर्नुहोस्
          </button>
        </div>
      </div>

      {/* View Details Sub-Modal */}
      {viewingMerchant && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{viewingMerchant.business_name}</h3>
                  <p className="text-[10px] text-slate-400">पसलको विस्तृत विवरण (Store Details)</p>
                </div>
              </div>
              <button
                onClick={() => setViewingMerchant(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">सञ्चालक (Owner):</span>
                  <span className="font-bold text-white">{viewingMerchant.owner_name || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">सहर / ठेगाना (City):</span>
                  <span className="font-bold text-white">{viewingMerchant.city || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">PAN / VAT नम्बर:</span>
                  <span className="font-mono text-emerald-400">{viewingMerchant.pan_vat || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">सम्पर्क फोन (Phone):</span>
                  <span className="font-mono text-white">{viewingMerchant.phone || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">इमेल (Email):</span>
                  <span className="font-mono text-slate-300">{viewingMerchant.email || "—"}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">सदस्यता योजना (Plan):</span>
                  <span className="font-bold text-amber-400">{viewingMerchant.plan || "Pro Merchant"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">स्थिति (Status):</span>
                  <span className="font-bold text-emerald-400">{viewingMerchant.status || "सक्रिय"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">सिस्टम ID:</span>
                  <span className="font-mono text-[10px] text-slate-500 break-all">{viewingMerchant.id}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setViewingMerchant(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
              >
                बन्द गर्नुहोस्
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Sub-Modal */}
      {vendorToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-rose-800/80 rounded-2xl w-full max-w-md p-5 shadow-2xl relative">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">पसल हटाउने पुष्टि (Confirm Deletion)</h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  के तपाईं पसल <strong className="text-white">'{vendorToDelete.business_name}'</strong> लाई प्रणालीबाट पूर्ण रूपमा हटाउन निश्चित हुनुहुन्छ?
                </p>
                <p className="text-[11px] text-rose-400 mt-2 bg-rose-950/40 p-2 rounded-lg border border-rose-900/40">
                  ⚠️ चेतावनी: यो कार्य गरेपछि यो पसलको डाटाबेस रेकर्ड र विवरण सधैँका लागि मेटिनेछ।
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setVendorToDelete(null)}
                disabled={deleting}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                रद्द गर्नुहोस् (Cancel)
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-rose-600/30 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{deleting ? "हटाइँदैछ..." : "निश्चित हटाउनुहोस्"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
