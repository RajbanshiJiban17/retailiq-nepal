"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { HealthStatus } from "@/components/HealthStatus";
import { AuthModal } from "@/components/AuthModal";
import { PosUploadCard } from "@/components/PosUploadCard";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { fetchInventoryItems, fetchCurrentSubscription, API_BASE_URL } from "@/lib/api";
import { InventoryItem, UserProfile, CurrentSubscription } from "@/types";
import {
  Boxes,
  ExternalLink,
  Layers,
  Server,
  Zap,
  PackageCheck,
  AlertTriangle,
  RefreshCw,
  LogIn,
  UserCheck,
  LogOut,
  Building2,
  TrendingUp,
  BrainCircuit,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  ArrowRight,
  Crown,
} from "lucide-react";

export default function HomePage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);

  // Auth & Multi-tenant State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Subscription State
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);

  const loadItems = async () => {
    setLoadingItems(true);
    setItemsError(null);

    const savedUserStr = localStorage.getItem("retailiq_user");
    const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
    const bizId = savedUser?.business_id;

    // Read tenant-isolated uploaded ETL data first, fallback to retailiq_latest_etl
    let etlData: any = null;
    let savedEtl: string | null = null;
    if (bizId) {
      savedEtl = localStorage.getItem(`retailiq_etl_${bizId}`);
    }
    if (!savedEtl) {
      savedEtl = localStorage.getItem("retailiq_latest_etl");
    }

    if (savedEtl) {
      try {
        etlData = JSON.parse(savedEtl);
        if (etlData?.file_name) {
          setActiveFileName(etlData.file_name);
        }
      } catch {
        // ignore
      }
    } else {
      setActiveFileName(null);
    }

    // Fetch subscription
    try {
      const sub = await fetchCurrentSubscription(bizId);
      setCurrentSubscription(sub);
    } catch {
      // ignore
    }

    try {
      const savedUserStr = localStorage.getItem("retailiq_user");
      const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
      const bizId = savedUser?.business_id;

      const data = await fetchInventoryItems(bizId);

      // If user uploaded a CSV/Excel with products, prioritize displaying the store's uploaded items
      if (etlData?.top_products && etlData.top_products.length > 0) {
        const derived: InventoryItem[] = etlData.top_products.map((p: any, idx: number) => {
          const units = p.unitsSold || 50;
          const avgPrice = units > 0 ? parseFloat((p.revenue / units).toFixed(2)) : 100.0;
          const stock = p.stockLeft || Math.max(8, Math.round(units * 1.4) + (idx % 3 === 0 ? 35 : idx % 3 === 1 ? 14 : 48));
          const reorder = Math.max(10, Math.round(stock * 0.35));
          return {
            id: idx + 1,
            sku: p.sku || `ITEM-${idx + 1}`,
            name: p.name,
            category: p.category || "General",
            price_npr: avgPrice,
            quantity: stock,
            reorder_level: reorder,
          };
        });
        setItems(derived);
      } else {
        setItems(data);
      }
    } catch (err: any) {
      if (etlData?.top_products && etlData.top_products.length > 0) {
        const derived: InventoryItem[] = etlData.top_products.map((p: any, idx: number) => {
          const units = p.unitsSold || 50;
          const avgPrice = units > 0 ? parseFloat((p.revenue / units).toFixed(2)) : 100.0;
          const stock = p.stockLeft || Math.max(8, Math.round(units * 1.4) + (idx % 3 === 0 ? 35 : idx % 3 === 1 ? 14 : 48));
          return {
            id: idx + 1,
            sku: p.sku || `ITEM-${idx + 1}`,
            name: p.name,
            category: p.category || "General",
            price_npr: avgPrice,
            quantity: stock,
            reorder_level: Math.max(10, Math.round(stock * 0.35)),
          };
        });
        setItems(derived);
      } else {
        setItemsError(err.message || "Failed to load inventory items");
      }
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    loadItems();
    // Check local session
    const savedUser = localStorage.getItem("retailiq_user");
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch {
        // ignore
      }
    }

    const handleUpdate = () => loadItems();
    window.addEventListener("retailiq_data_updated", handleUpdate);
    window.addEventListener("retailiq_user_updated", handleUpdate);

    return () => {
      window.removeEventListener("retailiq_data_updated", handleUpdate);
      window.removeEventListener("retailiq_user_updated", handleUpdate);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("retailiq_token");
    localStorage.removeItem("retailiq_user");
    setCurrentUser(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-slate-950 font-black shadow-md shadow-emerald-500/20">
              IQ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-white sm:text-lg">
                  RetailIQ <span className="text-emerald-400">नेपाल</span>
                </span>
                <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                  Multi-Tenant AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                स्मार्ट इन्भेन्टरी, माग पूर्वानुमान तथा बजारको साथी (AI Assistant)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* SaaS Subscription Plans Button */}
            <button
              onClick={() => setSubscriptionModalOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition shadow-sm ${
                currentSubscription?.plan_id === "enterprise"
                  ? "bg-purple-950/60 border-purple-500/50 text-purple-300 hover:bg-purple-900/60"
                  : currentSubscription?.plan_id === "pro"
                  ? "bg-amber-950/60 border-amber-500/50 text-amber-300 hover:bg-amber-900/60"
                  : "bg-slate-900 border-amber-500/40 text-amber-300 hover:bg-amber-950/40"
              }`}
              title="SaaS सदस्यता योजनाहरू हेर्नुहोस् (Subscription Plans)"
            >
              <Crown className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden xs:inline">
                {currentSubscription?.plan_id === "enterprise"
                  ? "इन्टरप्राइज"
                  : currentSubscription?.plan_id === "pro"
                  ? "प्रो मर्चन्ट"
                  : "💰 योजना (Plans)"}
              </span>
            </button>

            {currentUser ? (
              <div className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs">
                <Building2 className="h-4 w-4 text-emerald-400" />
                <div className="text-left hidden md:block">
                  <span className="font-bold text-white block leading-tight">{currentUser.full_name}</span>
                  <span className="text-[10px] text-slate-400">Tenant: {currentUser.business_id.slice(0, 8)}...</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-1 p-1 text-slate-400 hover:text-rose-400 transition"
                  title="लगआउट गर्नुहोस् (Log Out)"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition shadow-sm"
              >
                <LogIn className="h-3.5 w-3.5 text-emerald-400" />
                पसल लगइन / दर्ता (Sign In)
              </button>
            )}

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-600/30"
            >
              📊 ड्यासबोर्ड (Dashboard)
            </Link>

            <a
              href={`${API_BASE_URL}/docs`}
              target="_blank"
              rel="noreferrer"
              className="hidden lg:inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
            >
              <Server className="h-3.5 w-3.5" />
              API Docs
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/60 border border-slate-800 p-8 sm:p-10 text-white shadow-2xl">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              नेपालका खुद्रा तथा होलसेल व्यापारीहरूका लागि स्मार्ट समाधान
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl text-white leading-tight">
              पसलको हिसाबकिताब, स्टक र बिक्री अब <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">AI मार्फत</span> स्वचालित
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              <strong>RetailIQ Nepal</strong> ले तपाईंको बिलिङ CSV/Excel बाट बिक्री विश्लेषण गर्छ, 
              चाडपर्व र शनिबारको माग पूर्वानुमान गर्छ, नबिकेको सामान (Dead Stock) औंल्याउँछ र 
              <strong>'बजारको साथी' AI</strong> मार्फत नेपालीमै व्यापार सल्लाह दिन्छ।
            </p>

            <div className="pt-3 flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 text-sm transition shadow-xl shadow-emerald-500/25"
              >
                📊 मुख्य ड्यासबोर्ड खोल्नुहोस् (Open Dashboard)
                <ArrowRight className="h-4 w-4" />
              </Link>
              {!currentUser && (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-200 font-semibold px-5 py-3 text-sm transition"
                >
                  <Building2 className="h-4 w-4 text-emerald-400" />
                  आफ्नो पसल दर्ता गर्नुहोस् (Register Store)
                </button>
              )}
            </div>
          </div>
          <div className="absolute -right-16 -bottom-16 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        </section>

        {/* Multi-Tenant Feature Badges Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
              <Building2 className="h-4 w-4" />
              Multi-Tenant Architecture
            </div>
            <p className="text-xs text-slate-400">
              प्रत्येक पसलको डाटा पूर्ण रूपमा सुरक्षित र अलग (Business ID Scoped Isolation)।
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold mb-1">
              <TrendingUp className="h-4 w-4" />
              Scikit-learn Forecasting
            </div>
            <p className="text-xs text-slate-400">
              विगतको बिक्री हेरेर अर्को ७ दिनमा कुन सामान कति बिक्री हुन्छ अग्रिम जानकारी।
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-teal-400 text-xs font-bold mb-1">
              <BrainCircuit className="h-4 w-4" />
              बजारको साथी (Gemini RAG)
            </div>
            <p className="text-xs text-slate-400">
              पसलको हिसाबकिताब र नाफाबारे नेपालीमै सोध्न सकिने बुद्धिमान सहायक।
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold mb-1">
              <FileText className="h-4 w-4" />
              WeasyPrint PDF Reports
            </div>
            <p className="text-xs text-slate-400">
              साप्ताहिक नाफा, स्टक तथा अडिटको चिटिक्क परेको A4 PDF रिपोर्ट डाउनलोड।
            </p>
          </div>
        </div>

        {/* SECTION 1: POS / Excel CSV Upload Widget (Requested by User) */}
        <section>
          <PosUploadCard
            businessId={currentUser?.business_id}
            currentUser={currentUser}
            onRequireAuth={() => setAuthModalOpen(true)}
            onUploadSuccess={() => {
              loadItems();
            }}
          />
        </section>

        {/* SECTION 2: Real-time Backend Health Check Card */}
        <HealthStatus />

        {/* SECTION 3: Live Inventory Catalog Demo */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <PackageCheck className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">
                  लाइभ इन्भेन्टरी क्याटलग (Live Inventory Catalog)
                </h2>
                {activeFileName && (
                  <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-medium border border-emerald-500/30">
                    Active File: {activeFileName} ({items.length} सामानहरू)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Data dynamically fetched from <code className="font-mono text-emerald-400 font-semibold">{API_BASE_URL}/api/v1/items</code> {activeFileName ? "• Grounded on uploaded sales transactions" : "• Starter Catalog"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeFileName && (
                <button
                  onClick={() => {
                    if (currentUser?.business_id) {
                      localStorage.removeItem(`retailiq_etl_${currentUser.business_id}`);
                    }
                    localStorage.removeItem("retailiq_latest_etl");
                    localStorage.removeItem("retailiq_analytics_timestamp");
                    setActiveFileName(null);
                    loadItems();
                    window.dispatchEvent(new Event("retailiq_data_updated"));
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition"
                  title="Reset to default starter items"
                >
                  डिफल्ट रिसेट
                </button>
              )}
              <button
                onClick={loadItems}
                disabled={loadingItems}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingItems ? "animate-spin" : ""}`} />
                क्याटलग ताजा गर्नुहोस् (Refresh)
              </button>
            </div>
          </div>

          <div className="mt-4">
            {loadingItems ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
                <span className="mt-3 text-sm">Connecting to FastAPI backend...</span>
              </div>
            ) : itemsError ? (
              <div className="rounded-xl bg-rose-950/40 p-4 border border-rose-800/60 text-xs text-rose-300">
                <p className="font-semibold">Backend Unreachable</p>
                <p className="mt-1">{itemsError}</p>
              </div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No items returned from backend.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-850 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">सामानको नाम (Product Name)</th>
                      <th className="px-4 py-3">वर्ग (Category)</th>
                      <th className="px-4 py-3 text-right">मूल्य (Price NPR)</th>
                      <th className="px-4 py-3 text-right">उपलब्ध स्टक (Stock)</th>
                      <th className="px-4 py-3 text-center">अवस्था (Status)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {items.map((item) => {
                      const isLowStock = item.quantity <= item.reorder_level;
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-300">
                            {item.sku}
                          </td>
                          <td className="px-4 py-3 font-medium text-white">
                            {item.name}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            <span className="rounded-md bg-slate-800 px-2.5 py-0.5 border border-slate-700">
                              {item.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-white">
                            Rs. {item.price_npr.toLocaleString("en-NP", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-300">
                            {item.quantity} units
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.quantity === 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-950/40 border border-rose-800/50 px-2.5 py-0.5 text-xs font-medium text-rose-300">
                                <AlertTriangle className="h-3 w-3" />
                                स्टक सकियो
                              </span>
                            ) : isLowStock ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/40 border border-amber-800/50 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                                <AlertTriangle className="h-3 w-3" />
                                न्यून स्टक ({item.quantity})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                                उपलब्ध ({item.quantity})
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Multi-Tenant Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
        }}
      />

      {/* SaaS Subscription Modal */}
      <SubscriptionModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        businessId={currentUser?.business_id}
        storeName={currentUser?.business_name || currentUser?.full_name}
        currentPlanId={currentSubscription?.plan_id || currentSubscription?.tier}
        onPlanUpgraded={(newSub: CurrentSubscription) => {
          setCurrentSubscription(newSub);
        }}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-400 mt-12">
        RetailIQ Nepal • Built for Nepali Merchants • Zero-Budget Deployment (Render & Vercel)
      </footer>
    </div>
  );
}
