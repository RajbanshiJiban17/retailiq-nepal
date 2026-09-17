"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { StatCards } from "@/components/dashboard/StatCards";
import { SalesTrendChart } from "@/components/dashboard/SalesTrendChart";
import { TopProductsChart } from "@/components/dashboard/TopProductsChart";
import { PaymentBreakdownChart } from "@/components/dashboard/PaymentBreakdownChart";
import { BajarSathiWidget } from "@/components/dashboard/BajarSathiWidget";
import { InventoryRestockAlerts } from "@/components/dashboard/InventoryRestockAlerts";
import { PosUploadCard } from "@/components/PosUploadCard";
import { AuthModal } from "@/components/AuthModal";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { UserProfile, ETLUploadSummary, CurrentSubscription } from "@/types";
import { loginUser, fetchCurrentSubscription } from "@/lib/api";
import {
  Building2,
  FileSpreadsheet,
  Upload,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  LogIn,
  LogOut,
  Calendar,
  Layers,
  ArrowRight,
  Lock,
  ShieldAlert,
  Loader2,
  ShieldCheck,
  Crown,
  CreditCard,
} from "lucide-react";

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<"7D" | "30D" | "YTD">("30D");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isDemoLoggingIn, setIsDemoLoggingIn] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [etlSummary, setEtlSummary] = useState<ETLUploadSummary | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);

  const loadData = async () => {
    // Read current user session
    let userObj: UserProfile | null = null;
    const savedUser = localStorage.getItem("retailiq_user");
    if (savedUser) {
      try {
        userObj = JSON.parse(savedUser);
        setCurrentUser(userObj);
      } catch {
        setCurrentUser(null);
      }
    } else {
      setCurrentUser(null);
    }
    setAuthChecking(false);

    // Read tenant-isolated uploaded ETL data first, fallback to retailiq_latest_etl
    let savedEtl: string | null = null;
    if (userObj?.business_id) {
      savedEtl = localStorage.getItem(`retailiq_etl_${userObj.business_id}`);
    }
    if (!savedEtl) {
      savedEtl = localStorage.getItem("retailiq_latest_etl");
    }

    if (savedEtl) {
      try {
        setEtlSummary(JSON.parse(savedEtl));
      } catch {
        // ignore
      }
    } else {
      setEtlSummary(null);
    }

    // Fetch subscription status for this store
    try {
      const sub = await fetchCurrentSubscription(userObj?.business_id);
      setCurrentSubscription(sub);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadData();

    const handleDataUpdate = () => loadData();
    window.addEventListener("retailiq_data_updated", handleDataUpdate);
    window.addEventListener("retailiq_user_updated", handleDataUpdate);

    return () => {
      window.removeEventListener("retailiq_data_updated", handleDataUpdate);
      window.removeEventListener("retailiq_user_updated", handleDataUpdate);
    };
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleClearUploadedData = () => {
    if (confirm("के तपाईं अपलोड गरिएको डाटा हटाएर डिफल्ट डेमो डाटामा फर्कन चाहनुहुन्छ?")) {
      if (currentUser?.business_id) {
        localStorage.removeItem(`retailiq_etl_${currentUser.business_id}`);
      }
      localStorage.removeItem("retailiq_latest_etl");
      localStorage.removeItem("retailiq_analytics_timestamp");
      setEtlSummary(null);
      window.dispatchEvent(new Event("retailiq_data_updated"));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("retailiq_token");
    localStorage.removeItem("retailiq_user");
    setCurrentUser(null);
  };

  const handleQuickDemoLogin = async () => {
    setIsDemoLoggingIn(true);
    setDemoError(null);
    try {
      const res = await loginUser("admin@retailiq.com.np", "admin123");
      const userToSave = {
        ...res.user,
        business_name: res.user.business_name || "पशुपति किराना तथा सुपरस्टोर",
      };
      localStorage.setItem("retailiq_token", res.access_token);
      localStorage.setItem("retailiq_user", JSON.stringify(userToSave));
      window.dispatchEvent(new Event("retailiq_user_updated"));
      setCurrentUser(userToSave);
    } catch (err: any) {
      setDemoError(err.message || "डेमो लगइन असफल भयो।");
    } finally {
      setIsDemoLoggingIn(false);
    }
  };

  // If still checking localStorage auth state
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mb-3" />
        <p className="text-sm font-medium">खाता प्रमाणीकरण हुँदैछ (Checking authentication)...</p>
      </div>
    );
  }

  // If unauthenticated: Strictly block viewing the sales dashboard!
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white flex flex-col justify-between">
        {/* Top Header */}
        <header className="border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 text-white font-black text-xl tracking-tight">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950">
                IQ
              </div>
              <span>
                RetailIQ <span className="text-emerald-400 font-semibold">नेपाल</span>
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-xl border border-slate-800 hover:border-slate-700 transition"
              >
                ← मुख्य पृष्ठ (Home)
              </Link>
              <button
                onClick={() => setAuthModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-1.5 text-xs font-bold text-slate-950 transition shadow-md shadow-emerald-500/20"
              >
                <LogIn className="h-3.5 w-3.5" />
                पसल लगइन (Sign In)
              </button>
            </div>
          </div>
        </header>

        {/* Lock Screen Body */}
        <main className="max-w-3xl mx-auto px-4 py-12 text-center my-auto">
          <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-8 sm:p-12 shadow-2xl">
            {/* Ambient glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Lock Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/30 px-3.5 py-1 text-xs font-bold text-amber-300 mb-6">
              <Lock className="h-3.5 w-3.5 text-amber-400" />
              सुरक्षित ड्यासबोर्ड (Protected Business Portal)
            </div>

            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-800/80 border border-slate-700 text-emerald-400 shadow-xl mb-6">
              <ShieldAlert className="h-10 w-10 text-emerald-400" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              बिक्री ड्यासबोर्ड हेर्न कृपया पहिले लगइन गर्नुहोस्
            </h1>
            <p className="text-sm sm:text-base text-slate-300 mt-3 max-w-xl mx-auto leading-relaxed">
              गोपनीयता र मल्टी-टेनेन्ट सुरक्षा नियम अनुसार, प्रत्येक पसलको वास्तविक बिक्री, नाफा र इन्भेन्टरी केवल आधिकारिक खाताबाट मात्र हेर्न र एक्सेल/CSV अपलोड गर्न मिल्छ।
            </p>

            {/* 3 Protection Reasons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-8 text-left">
              <div className="rounded-2xl border border-slate-800 bg-slate-850/60 p-4">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  डाटा गोपनीयता
                </div>
                <p className="text-[11px] text-slate-400">
                  तपाईंको पसलको कारोबार विवरण अन्य कसैले हेर्न पाउँदैन।
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-850/60 p-4">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold mb-1">
                  <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  CSV / Excel अपलोड
                </div>
                <p className="text-[11px] text-slate-400">
                  लगइन गरेपछि आफ्नो पसलको बिलिङ डाटा सुरक्षित अपलोड गर्नुहोस्।
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-850/60 p-4">
                <div className="flex items-center gap-2 text-teal-400 text-xs font-bold mb-1">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  बजारको साथी AI
                </div>
                <p className="text-[11px] text-slate-400">
                  आफ्नै पसलको नाफा र माग पूर्वानुमानबारे नेपालीमै सोध्नुहोस्।
                </p>
              </div>
            </div>

            {demoError && (
              <div className="mb-4 rounded-xl bg-rose-950/50 border border-rose-800/60 p-3 text-xs text-rose-300">
                {demoError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => setAuthModalOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 text-sm transition shadow-xl shadow-emerald-500/25"
              >
                <LogIn className="h-4 w-4" />
                🔐 पसल लगइन वा दर्ता गर्नुहोस् (Sign In / Register)
              </button>

              <button
                onClick={handleQuickDemoLogin}
                disabled={isDemoLoggingIn}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 font-semibold px-5 py-3 text-sm transition disabled:opacity-50"
              >
                {isDemoLoggingIn ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                    लगइन हुँदैछ...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    ⚡ १-क्लिक डेमो लगइन (Pashupati Kirana)
                  </>
                )}
              </button>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-center gap-4">
              <span>डेमो खाता: <code className="font-mono text-emerald-400">admin@retailiq.com.np</code></span>
              <span>पासवर्ड: <code className="font-mono text-emerald-400">admin123</code></span>
            </div>
          </div>
        </main>

        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={(user) => {
            setCurrentUser(user);
          }}
        />

        <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
          RetailIQ Nepal • Protected Store Analytics
        </footer>
      </div>
    );
  }

  // Resolve Store / Merchant title dynamically
  const displayStoreName =
    currentUser?.business_name ||
    (currentUser?.full_name ? `${currentUser.full_name}'s Store` : "पशुपति किराना तथा सुपरस्टोर");

  const displayTenantId = currentUser?.business_id
    ? currentUser.business_id.slice(0, 12) + "..."
    : "Pashupati-Demo";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 group text-white font-black text-xl tracking-tight"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950 group-hover:scale-105 transition-transform">
                IQ
              </div>
              <span className="hidden xs:inline">
                RetailIQ <span className="text-emerald-400 font-semibold">नेपाल</span>
              </span>
            </Link>

            {/* Dynamic Store Header */}
            <div className="flex items-center gap-2 border-l border-slate-800 pl-3 sm:pl-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="max-w-[180px] sm:max-w-[280px] truncate">
                <span className="text-xs sm:text-sm text-white font-bold block truncate">
                  {displayStoreName}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  Tenant: <span className="font-mono text-emerald-400">{displayTenantId}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Active Subscription Plan Badge & Upgrade Button */}
            <button
              onClick={() => setSubscriptionModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border shadow-sm ${
                currentSubscription?.plan_id === "enterprise"
                  ? "bg-purple-950/70 border-purple-500/50 text-purple-300 hover:bg-purple-900/60 shadow-purple-950/40"
                  : currentSubscription?.plan_id === "pro"
                  ? "bg-amber-950/70 border-amber-500/50 text-amber-300 hover:bg-amber-900/60 shadow-amber-950/40"
                  : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-850"
              }`}
              title="सदस्यता योजना परिवर्तन गर्नुहोस् (Manage Subscription)"
            >
              <Crown className="h-3.5 w-3.5 text-amber-400" />
              <span>
                {currentSubscription?.plan_id === "enterprise"
                  ? "इन्टरप्राइज"
                  : currentSubscription?.plan_id === "pro"
                  ? "प्रो मर्चन्ट"
                  : "स्टार्टर"}
              </span>
              <span className="text-[10px] text-amber-400/90 font-normal underline ml-0.5">अपग्रेड</span>
            </button>

            {/* Upload Sales CSV Button directly on Dashboard */}
            <button
              onClick={() => setUploadModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:from-emerald-500 hover:to-teal-500 transition shadow-md shadow-emerald-600/25"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden md:inline">CSV / Excel अपलोड</span>
            </button>

            {/* Time Filter Tabs */}
            <div className="hidden sm:flex bg-slate-900 border border-slate-800 rounded-xl p-1 items-center gap-1 text-xs">
              {(["7D", "30D", "YTD"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    timeRange === range
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {range === "7D" ? "७ दिन" : range === "30D" ? "३० दिन" : "वर्षिक"}
                </button>
              ))}
            </div>

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs p-2 sm:px-3 sm:py-1.5 rounded-xl transition flex items-center gap-1.5"
              title="Refresh Data"
            >
              <span className={`inline-block ${isRefreshing ? "animate-spin" : ""}`}>🔄</span>
              <span className="hidden lg:inline">ताजा गर्नुहोस्</span>
            </button>

            {/* User Login/Switch or Home */}
            {currentUser ? (
              <button
                onClick={handleLogout}
                className="text-xs text-slate-400 hover:text-rose-400 px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition flex items-center gap-1"
                title="Log Out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">लगआउट</span>
              </button>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="text-xs text-emerald-400 hover:text-emerald-300 px-2.5 py-1.5 rounded-lg border border-emerald-800/60 bg-emerald-950/40 transition flex items-center gap-1"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">लगइन / नयाँ दर्ता</span>
              </button>
            )}

            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition"
            >
              Home →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Active Uploaded Dataset Banner */}
        {etlSummary ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/40 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    अपलोड गरिएको फाइल सक्रिय छ (Active Dataset)
                  </span>
                  <span className="text-[11px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
                    {etlSummary.file_name}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  कुल <strong>{(etlSummary.valid_rows_count || etlSummary.total_rows_processed).toLocaleString()}</strong> वटा कारोबार (बिक्री: <strong>Rs. {etlSummary.total_revenue_npr.toLocaleString("en-NP")}</strong>) को प्रत्यक्ष विश्लेषण तल देखाइएको छ।
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setUploadModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:text-white transition"
              >
                <Upload className="h-3.5 w-3.5 text-emerald-400" />
                अर्को CSV हाल्नुहोस्
              </button>
              <button
                onClick={handleClearUploadedData}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-850 hover:bg-rose-950/50 border border-slate-700 hover:border-rose-800/60 px-3 py-1.5 text-xs text-slate-400 hover:text-rose-300 transition"
                title="Reset to default demo data"
              >
                <RotateCcw className="h-3 w-3" />
                डिफल्ट रिसेट
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-400 border border-slate-700">
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white">
                  आफ्नो पसलको वास्तविक बिक्री डाटा हेर्न चाहनुहुन्छ?
                </h4>
                <p className="text-xs text-slate-400">
                  Tally, Excel वा POS बाट निकालिएको कुनै पनि बिक्री CSV अपलोड गर्नुहोस्, प्रणालीले तत्काल हिसाब विश्लेषण गर्छ।
                </p>
              </div>
            </div>
            <button
              onClick={() => setUploadModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 text-xs transition shadow-md shrink-0"
            >
              <Upload className="h-3.5 w-3.5" />
              फाइल अपलोड गर्नुहोस् (Upload CSV)
            </button>
          </div>
        )}

        {/* Welcome and Summary Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-white tracking-tight">
                {displayStoreName} • ड्यासबोर्ड
              </h1>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-2.5 py-0.5 rounded-full font-medium">
                Tenant: {displayTenantId}
              </span>
              <button
                onClick={() => setSubscriptionModalOpen(true)}
                className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold border transition ${
                  currentSubscription?.plan_id === "enterprise"
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30"
                    : currentSubscription?.plan_id === "pro"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750"
                }`}
              >
                <Crown className="h-3 w-3 text-amber-400" />
                {currentSubscription?.plan_name || "स्टार्टर निःशुल्क (Starter)"} • योजना हेर्नुहोस्
              </button>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Real-time cash flow, inventory forecasting, and Nepali business intelligence overview.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">नेपाली मिति</span>
              <span className="text-sm font-semibold text-emerald-400 font-mono">२०८३ भाद्र २५, बिहीबार</span>
            </div>
          </div>
        </div>

        {/* Section 1: KPI Stat Cards (Dynamic based on uploaded CSV) */}
        <StatCards summary={etlSummary} />

        {/* Section 2: Charts Row 1 (Sales Trend Area Chart + Payment Breakdown Pie Chart) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SalesTrendChart data={etlSummary?.monthly_trend} />
          </div>
          <div className="lg:col-span-1">
            <PaymentBreakdownChart data={etlSummary?.payment_breakdown} />
          </div>
        </div>

        {/* Section 3: Charts Row 2 (Top Products Horizontal Bar Chart + Bajar ko Sathi AI Widget) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <TopProductsChart products={etlSummary?.top_products} />
          </div>
          <div>
            <BajarSathiWidget
              summary={etlSummary}
              storeName={displayStoreName}
              tenantId={displayTenantId}
            />
          </div>
        </div>

        {/* Section 4: Inventory Restock Intelligence Table (Dynamic based on uploaded CSV) */}
        <div>
          <InventoryRestockAlerts summary={etlSummary} />
        </div>
      </main>

      {/* Upload CSV Modal right on Dashboard */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl">
            <div className="absolute right-3 top-3 z-10">
              <button
                onClick={() => setUploadModalOpen(false)}
                className="rounded-lg bg-slate-800 p-1.5 text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>
            <PosUploadCard
              currentUser={currentUser}
              businessId={currentUser?.business_id}
              onRequireAuth={() => setAuthModalOpen(true)}
              onUploadSuccess={(summary) => {
                setEtlSummary(summary);
                setTimeout(() => setUploadModalOpen(false), 1200);
              }}
            />
          </div>
        </div>
      )}

      {/* Auth Modal */}
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
        storeName={displayStoreName}
        currentPlanId={currentSubscription?.plan_id || currentSubscription?.tier}
        onPlanUpgraded={(newSub: CurrentSubscription) => {
          setCurrentSubscription(newSub);
        }}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-400">
        RetailIQ Nepal • Built for Nepali Retailers • Multi-Tenant Active Analytics
      </footer>
    </div>
  );
}
