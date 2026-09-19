"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  BrainCircuit,
  PieChart as PieIcon,
  BarChart3,
  Package,
  Bot,
  Upload,
  Crown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Building2,
  LogOut,
  LogIn,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  X,
} from "lucide-react";
import { UserProfile, CurrentSubscription } from "@/types";
import { getNepaliDate } from "@/lib/nepaliDate";

interface Props {
  storeName: string;
  tenantId?: string;
  currentUser: UserProfile | null;
  currentSubscription: CurrentSubscription | null;
  activeSection: string;
  onSelectSection: (sectionId: string) => void;
  onOpenUpload: () => void;
  onOpenSubscription: () => void;
  onOpenBajarSathi: () => void;
  onOpenInventoryCrud?: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export function AppSidebar({
  storeName,
  tenantId,
  currentUser,
  currentSubscription,
  activeSection,
  onSelectSection,
  onOpenUpload,
  onOpenSubscription,
  onOpenBajarSathi,
  onOpenInventoryCrud,
  onOpenAuth,
  onLogout,
  isMobileOpen,
  onMobileClose,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    {
      id: "overview",
      label: "ड्यासबोर्ड अवलोकन",
      labelEn: "Dashboard Overview",
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: "ml-forecast",
      label: "ML माग भविष्यवाणी",
      labelEn: "ML 7-Week Forecast",
      icon: BrainCircuit,
      badge: "ML Ridge",
      badgeColor: "bg-teal-500/20 text-teal-400 border-teal-500/30",
    },
    {
      id: "category-analytics",
      label: "वर्ग तथा दैनिक चाप",
      labelEn: "Category & Weekday Traffic",
      icon: PieIcon,
      badge: null,
    },
    {
      id: "top-products",
      label: "शीर्ष बिक्री सामान",
      labelEn: "Top Selling Movers",
      icon: BarChart3,
      badge: null,
    },
    {
      id: "inventory",
      label: "इन्भेन्टरी रिअर्डर अलर्ट",
      labelEn: "Restock Alerts",
      icon: Package,
      badge: "Alerts",
      badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    },
  ];

  const handleNavClick = (id: string) => {
    onSelectSection(id);
    onMobileClose();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar Container: Responsive Drawer on Mobile (<lg), Sticky Column on Desktop (lg+) */}
      <aside
        className={`fixed lg:sticky top-0 bottom-0 left-0 lg:h-screen shrink-0 z-50 lg:z-30 bg-slate-900/95 border-r border-slate-800 backdrop-blur-xl flex flex-col justify-between transition-all duration-300 shadow-2xl lg:shadow-none w-72 ${
          collapsed ? "lg:w-20" : "lg:w-64"
        } ${
          isMobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Top Branding Section */}
        <div>
          <div className="h-16 border-b border-slate-800/80 flex items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-black text-slate-950 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                IQ
              </div>
              {!collapsed && (
                <div className="flex flex-col">
                  <span className="text-white font-black text-lg tracking-tight leading-none">
                    RetailIQ <span className="text-emerald-400 font-bold text-sm">नेपाल</span>
                  </span>
                  <span className="text-[10px] text-slate-400 tracking-wider uppercase font-semibold">
                    Smart Retail OS
                  </span>
                </div>
              )}
            </Link>

            {/* Action Buttons: Desktop Collapse Toggle + Mobile Close */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>

              <button
                onClick={onMobileClose}
                className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                aria-label="Close sidebar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Active Store Badge Card */}
          {!collapsed ? (
            <div className="p-3 mx-3 mt-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate">{storeName}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono truncate">{tenantId || "Live Store"}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mt-3">
              <div
                className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center"
                title={storeName}
              >
                <Building2 className="h-4 w-4" />
              </div>
            </div>
          )}

          {/* Special AI Copilot Action Button */}
          <div className="px-3 mt-4">
            <button
              onClick={() => {
                onOpenBajarSathi();
                onMobileClose();
              }}
              className={`w-full flex items-center rounded-xl p-2.5 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 text-slate-950 font-bold transition shadow-lg shadow-emerald-500/25 hover:brightness-110 group ${
                collapsed ? "justify-center" : "gap-3 justify-between"
              }`}
              title="बजारको साथी AI (सोधपुछ गर्नुहोस्)"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded-lg bg-slate-950/20 text-slate-950 text-base">
                  🤖
                </div>
                {!collapsed && (
                  <div className="text-left">
                    <span className="text-xs font-black block text-slate-950">
                      बजारको साथी AI
                    </span>
                    <span className="text-[10px] text-slate-900/80 font-medium block">
                      नेपाली व्यापार सहायक
                    </span>
                  </div>
                )}
              </div>
              {!collapsed && (
                <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping shrink-0" />
              )}
            </button>
          </div>

          {/* Main Navigation Menu */}
          <nav className="mt-5 px-3 space-y-1">
            <div className={`px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${collapsed ? "text-center" : ""}`}>
              {collapsed ? "•••" : "नेभिगेसन मेनु"}
            </div>

            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center rounded-xl px-3 py-2.5 text-xs font-semibold transition group ${
                    collapsed ? "justify-center" : "gap-3 justify-between"
                  } ${
                    isActive
                      ? "bg-slate-800 text-emerald-400 border border-slate-700/80 shadow-sm"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                  }`}
                  title={item.label}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`h-4 w-4 ${isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-slate-200"}`} />
                    {!collapsed && <span>{item.label}</span>}
                  </div>
                  {!collapsed && item.badge && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${item.badgeColor || "bg-slate-800 text-slate-400"}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Quick Actions in Sidebar */}
            <div className={`pt-4 mt-4 border-t border-slate-800/70 px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${collapsed ? "text-center" : ""}`}>
              {collapsed ? "•••" : "द्रुत कार्यहरू"}
            </div>

            {/* Upload CSV */}
            <button
              onClick={() => {
                onOpenUpload();
                onMobileClose();
              }}
              className={`w-full flex items-center rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-300 hover:text-emerald-300 hover:bg-slate-800/60 transition group ${
                collapsed ? "justify-center" : "gap-3"
              }`}
              title="CSV / Excel अपलोड"
            >
              <Upload className="h-4 w-4 text-slate-400 group-hover:text-emerald-400" />
              {!collapsed && <span>CSV / Excel अपलोड</span>}
            </button>

            {/* Manage Stock & Items */}
            {onOpenInventoryCrud && (
              <button
                onClick={() => {
                  onOpenInventoryCrud();
                  onMobileClose();
                }}
                className={`w-full flex items-center rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-300 hover:text-emerald-400 hover:bg-slate-800/60 transition group ${
                  collapsed ? "justify-center" : "gap-3 justify-between"
                }`}
                title="इन्भेन्टरी सम्पादन र व्यवस्थापन"
              >
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-emerald-400" />
                  {!collapsed && <span>स्टक सम्पादन (CRUD)</span>}
                </div>
                {!collapsed && (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                    Live
                  </span>
                )}
              </button>
            )}

            {/* Subscription */}
            <button
              onClick={() => {
                onOpenSubscription();
                onMobileClose();
              }}
              className={`w-full flex items-center rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-300 hover:text-amber-300 hover:bg-slate-800/60 transition group ${
                collapsed ? "justify-center" : "gap-3 justify-between"
              }`}
              title="सदस्यता व्यवस्थापन"
            >
              <div className="flex items-center gap-3">
                <Crown className="h-4 w-4 text-amber-400" />
                {!collapsed && <span>सदस्यता योजना</span>}
              </div>
              {!collapsed && (
                <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
                  {currentSubscription?.plan_name?.split(" ")[0] || "Starter"}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Bottom User Profile & Footer Section */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60">
          {!collapsed ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">
                    {currentUser?.full_name ? currentUser.full_name[0].toUpperCase() : "प"}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-white truncate">
                      {currentUser?.full_name || "पसले (Merchant)"}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {currentUser?.email || "admin@retailiq.com.np"}
                    </p>
                  </div>
                </div>

                {currentUser ? (
                  <button
                    onClick={onLogout}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                    title="लगआउट"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onOpenAuth();
                      onMobileClose();
                    }}
                    className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-950/50 transition"
                    title="लगइन"
                  >
                    <LogIn className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1" title={getNepaliDate().adDateString}>
                  <Calendar className="h-3 w-3 text-emerald-400" />
                  {getNepaliDate().shortDateString}
                </span>
                <span className="text-emerald-400 font-mono">v1.2 Nepal</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400"
                title={currentUser?.full_name || "Merchant"}
              >
                {currentUser?.full_name ? currentUser.full_name[0].toUpperCase() : "प"}
              </div>
              {currentUser && (
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                  title="लगआउट"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
