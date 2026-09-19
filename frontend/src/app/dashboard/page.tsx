"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { StatCards } from "@/components/dashboard/StatCards";
import { SalesTrendChart } from "@/components/dashboard/SalesTrendChart";
import { TopProductsChart } from "@/components/dashboard/TopProductsChart";
import { PaymentBreakdownChart } from "@/components/dashboard/PaymentBreakdownChart";
import { MlForecastChart } from "@/components/dashboard/MlForecastChart";
import { CategoryBreakdownChart } from "@/components/dashboard/CategoryBreakdownChart";
import { WeekdaySalesChart } from "@/components/dashboard/WeekdaySalesChart";
import { BajarSathiDrawer } from "@/components/dashboard/BajarSathiDrawer";
import { InventoryRestockAlerts } from "@/components/dashboard/InventoryRestockAlerts";
import { PosUploadCard } from "@/components/PosUploadCard";
import { AuthModal } from "@/components/AuthModal";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { MerchantAuthGateway } from "@/components/dashboard/MerchantAuthGateway";
import { MerchantDirectoryModal } from "@/components/dashboard/MerchantDirectoryModal";
import { InventoryManagementModal } from "@/components/dashboard/InventoryManagementModal";
import { UserProfile, ETLUploadSummary, CurrentSubscription } from "@/types";
import { loginUser, fetchCurrentSubscription, fetchRegisteredMerchants } from "@/lib/api";
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
  Menu,
  Store,
  Package,
} from "lucide-react";

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<"7D" | "30D" | "YTD">("30D");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [etlSummary, setEtlSummary] = useState<ETLUploadSummary | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);
  const [bajarSathiDrawerOpen, setBajarSathiDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // New states for merchant directory and live inventory CRUD
  const [merchantDirectoryOpen, setMerchantDirectoryOpen] = useState(false);
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [registeredMerchantCount, setRegisteredMerchantCount] = useState<number>(5);

  const displayStoreName =
    currentUser?.business_name || "पशुपति किराना तथा सुपरस्टोर";
  const displayTenantId =
    currentUser?.business_id || "biz-pashupati-001";

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
      // If not logged in, user remains null so MerchantAuthGateway is displayed
      setCurrentUser(null);
    }
    setAuthLoading(false);

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

    // Fetch registered merchants count
    try {
      const merchantsRes = await fetchRegisteredMerchants();
      if (merchantsRes?.total_count) {
        setRegisteredMerchantCount(merchantsRes.total_count);
      }
    } catch {
      // keep fallback 5
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-slate-300">
            RetailIQ नेपाल प्रमाणीकरण जाँच गर्दै...
          </span>
        </div>
      </div>
    );
  }

  // If visitor is unauthenticated, show Commercial Merchant Gateway with live store count & directory
  if (!currentUser) {
    return (
      <MerchantAuthGateway
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          loadData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white flex">
      {/* Enterprise Left Sidebar */}
      <AppSidebar
        storeName={displayStoreName}
        tenantId={displayTenantId}
        currentUser={currentUser}
        currentSubscription={currentSubscription}
        activeSection={activeSection}
        onSelectSection={(sec) => setActiveSection(sec)}
        onOpenUpload={() => setUploadModalOpen(true)}
        onOpenSubscription={() => setSubscriptionModalOpen(true)}
        onOpenBajarSathi={() => setBajarSathiDrawerOpen(true)}
        onOpenInventoryCrud={() => setInventoryModalOpen(true)}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
        isMobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main Container Offset by Sidebar on Desktop */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        {/* Top Navigation - Executive Store Header */}
        <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Mobile Hamburger toggle for Sidebar */}
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition"
                aria-label="Open navigation sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>

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
                <div className="max-w-[170px] sm:max-w-[260px] truncate">
                  <span className="text-xs sm:text-sm text-white font-bold block truncate">
                    {displayStoreName}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate">
                    Tenant: <span className="font-mono text-emerald-400">{displayTenantId}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Clean Executive Navbar Controls (No duplicate buttons from sidebar) */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Registered Merchants Counter Button */}
              <button
                onClick={() => setMerchantDirectoryOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-emerald-400 hover:border-emerald-500/50 hover:bg-slate-850 transition"
                title="दर्ता भएका सबै पसलहरूको विवरण हेर्नुहोस् (View Merchant Directory)"
              >
                <Store className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-bold">{registeredMerchantCount}+</span>
                <span className="hidden md:inline text-slate-300">पसलहरू दर्ता</span>
              </button>

              {/* Stored Items CRUD Shortcut */}
              <button
                onClick={() => setInventoryModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:border-slate-700 transition"
                title="इन्भेन्टरी सम्पादन र व्यवस्थापन (CRUD)"
              >
                <Package className="h-3.5 w-3.5 text-emerald-400" />
                <span>स्टक सम्पादन</span>
              </button>

              {/* Active Subscription Plan Badge & Upgrade Button */}
              <button
                onClick={() => setSubscriptionModalOpen(true)}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition border shadow-sm ${
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

              {/* User Profile & Logout */}
              {currentUser && (
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-800">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs">
                      {currentUser.full_name?.charAt(0) || "M"}
                    </div>
                    <span className="text-xs text-slate-300 max-w-[120px] truncate">
                      {currentUser.full_name}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-xs text-slate-400 hover:text-rose-400 px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition flex items-center gap-1"
                    title="लगआउट गर्नुहोस्"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">लगआउट</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full">
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
          <div id="overview" className="scroll-mt-20">
            <StatCards summary={etlSummary} />
          </div>

          {/* Section 2: Sales Trend Area Chart + Category Breakdown Donut Chart */}
          <div id="category-analytics" className="grid grid-cols-1 lg:grid-cols-3 gap-6 scroll-mt-20">
            <div className="lg:col-span-2">
              <SalesTrendChart data={etlSummary?.monthly_trend} />
            </div>
            <div className="lg:col-span-1">
              <CategoryBreakdownChart summary={etlSummary} />
            </div>
          </div>

          {/* Section 3: ML 7-Week Demand Forecast Line Chart + Day-of-Week Traffic Bar Chart */}
          <div id="ml-forecast" className="grid grid-cols-1 lg:grid-cols-3 gap-6 scroll-mt-20">
            <div className="lg:col-span-2">
              <MlForecastChart summary={etlSummary} />
            </div>
            <div className="lg:col-span-1">
              <WeekdaySalesChart summary={etlSummary} />
            </div>
          </div>

          {/* Section 4: Top Products Performance + Payment Breakdown */}
          <div id="top-products" className="grid grid-cols-1 lg:grid-cols-3 gap-6 scroll-mt-20">
            <div className="lg:col-span-2">
              <TopProductsChart products={etlSummary?.top_products} />
            </div>
            <div className="lg:col-span-1">
              <PaymentBreakdownChart data={etlSummary?.payment_breakdown} />
            </div>
          </div>

          {/* Section 5: Inventory Restock Intelligence Table (Dynamic based on uploaded CSV) */}
          <div id="inventory" className="scroll-mt-20">
            <InventoryRestockAlerts summary={etlSummary} />
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-400">
          RetailIQ Nepal • Built for Nepali Retailers • Multi-Tenant Active Analytics
        </footer>
      </div>

      {/* Floating Action Button (FAB) for Bajar ko Sathi AI */}
      <button
        onClick={() => setBajarSathiDrawerOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-2xl shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all group border border-emerald-300/40"
        title="बजारको साथी AI खोल्नुहोस्"
      >
        <span className="text-lg group-hover:rotate-12 transition-transform">🤖</span>
        <span className="tracking-tight font-bold">बजारको साथी AI</span>
        <span className="h-2 w-2 rounded-full bg-slate-950 animate-pulse" />
      </button>

      {/* Slide-over Drawer for Bajar ko Sathi */}
      <BajarSathiDrawer
        isOpen={bajarSathiDrawerOpen}
        onClose={() => setBajarSathiDrawerOpen(false)}
        summary={etlSummary}
        storeName={displayStoreName}
        tenantId={displayTenantId}
      />

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

      {/* Live Inventory CRUD Database Management Modal */}
      <InventoryManagementModal
        isOpen={inventoryModalOpen}
        onClose={() => setInventoryModalOpen(false)}
        businessId={currentUser?.business_id}
        storeName={displayStoreName}
        onDataChanged={() => {
          loadData();
        }}
      />

      {/* Registered Merchants Directory Roster Modal */}
      <MerchantDirectoryModal
        isOpen={merchantDirectoryOpen}
        onClose={() => setMerchantDirectoryOpen(false)}
        currentBusinessId={currentUser?.business_id}
        onSelectMerchant={(m) => {
          const newUser: UserProfile = {
            id: m.id || "user-" + (m.business_id || m.id),
            email: m.email || "store@retailiq.com.np",
            full_name: m.owner_name || "Merchant Owner",
            business_name: m.business_name,
            business_id: m.business_id || m.id,
            phone: m.phone || "9800000000",
            role: "owner",
            is_active: true,
            is_business_owner: true,
          };
          localStorage.setItem("retailiq_user", JSON.stringify(newUser));
          setCurrentUser(newUser);
          setMerchantDirectoryOpen(false);
          loadData();
        }}
      />
    </div>
  );
}