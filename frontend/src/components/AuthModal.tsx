"use client";

import React, { useState } from "react";
import { X, Building2, Lock, Mail, Phone, User, CheckCircle, AlertCircle, Loader2, Store, Crown, KeyRound, Shield } from "lucide-react";
import { loginUser, registerMerchant, loginAdmin, registerAdmin } from "@/lib/api";
import { startSession } from "@/lib/session";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userData: any) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [authPortal, setAuthPortal] = useState<"client" | "admin">("client");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [fullName, setFullName] = useState("");
  const [panVat, setPanVat] = useState("");
  const [phone, setPhone] = useState("");
  const [adminSecretKey, setAdminSecretKey] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("कृपया सही इमेल ठेगाना प्रविष्ट गर्नुहोस्।");
      return;
    }

    if (password.length < 6) {
      setError("पासवर्ड कम्तीमा ६ अक्षरको हुनुपर्दछ।");
      return;
    }

    if (!isLogin) {
      if (fullName.trim().length < 2) {
        setError("कृपया कम्तीमा २ अक्षरको पूरा नाम प्रविष्ट गर्नुहोस्।");
        return;
      }
      if (authPortal === "client") {
        if (businessName.trim().length < 2) {
          setError("पसल वा फर्मको नाम कम्तीमा २ अक्षरको हुनुपर्दछ।");
          return;
        }
      } else {
        if (!adminSecretKey.trim()) {
          setError("⚠️ एडमिन दर्ताका लागि मास्टर सेक्युरिटी की अनिवार्य छ।");
          return;
        }
      }
    }

    setLoading(true);

    try {
      if (authPortal === "admin") {
        if (isLogin) {
          const res = await loginAdmin(cleanEmail, password);
          const userToSave = {
            ...res.user,
            is_platform_admin: true,
            business_name: res.user.business_name || "RetailIQ नेपाल केन्द्रीय प्रणाली (Platform HQ)",
          };
          startSession(res.access_token, userToSave, 30);
          setSuccessMsg("सफलतापूर्वक एडमिन लगइन भयो!");
          setTimeout(() => {
            onSuccess(userToSave);
            onClose();
          }, 600);
        } else {
          const res = await registerAdmin({
            email: cleanEmail,
            password,
            full_name: fullName.trim(),
            admin_secret_key: adminSecretKey.trim(),
            phone: phone.trim() || undefined,
          });
          const userToSave = {
            ...res.user,
            is_platform_admin: true,
            business_name: "RetailIQ नेपाल केन्द्रीय प्रणाली (Platform HQ)",
          };
          startSession(res.access_token, userToSave, 30);
          setSuccessMsg("🎉 नयाँ एडमिन दर्ता सफल भयो!");
          setTimeout(() => {
            onSuccess(userToSave);
            onClose();
          }, 600);
        }
      } else {
        if (isLogin) {
          const res = await loginUser(cleanEmail, password);
          const userToSave = {
            ...res.user,
            business_name: res.user.business_name || (res.user.email === "demo@retailiq.com.np" ? "पशुपति किराना तथा सुपरस्टोर" : `${res.user.full_name}'s Store`),
          };
          startSession(res.access_token, userToSave, 30);
          setSuccessMsg("सफलतापूर्वक लगइन भयो!");
          setTimeout(() => {
            onSuccess(userToSave);
            onClose();
          }, 600);
        } else {
          await registerMerchant({
            business_name: businessName.trim(),
            pan_vat_number: panVat.trim() || undefined,
            full_name: fullName.trim(),
            email: cleanEmail,
            password,
            phone: phone.trim() || undefined,
          });
          setIsLogin(true);
          setPassword("");
          setSuccessMsg("🎉 नयाँ पसल दर्ता सफल भयो! कृपया आफ्नो पासवर्ड हानेर लगइन गर्नुहोस्।");
        }
      }
    } catch (err: any) {
      setError(err?.message || "प्रक्रिया असफल भयो। कृपया विवरण जाँच्नुहोस्।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900 p-6 text-white shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Portal Switcher: Client vs Admin */}
        <div className="flex p-1 bg-slate-950 border border-slate-800 rounded-xl mb-4">
          <button
            type="button"
            onClick={() => {
              setAuthPortal("client");
              setIsLogin(true);
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
              authPortal === "client" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Store className="h-3.5 w-3.5" />
            पसले / ग्राहक
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthPortal("admin");
              setIsLogin(true);
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
              authPortal === "admin" ? "bg-rose-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Crown className="h-3.5 w-3.5" />
            प्रणाली एडमिन
          </button>
        </div>

        {/* Modal Header */}
        <div className="text-center mb-5">
          <h2 className="text-lg font-black text-white">
            {authPortal === "admin"
              ? isLogin
                ? "प्रत्यक्ष एडमिन लगइन (Direct Admin Sign In)"
                : "नयाँ एडमिन दर्ता (Admin Setup)"
              : isLogin
              ? "पसल व्यवस्थापक लगइन (Merchant Login)"
              : "नयाँ पसल दर्ता (Register Store)"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {authPortal === "admin"
              ? "केन्द्रीय नियन्त्रण कक्ष तथा प्रणाली प्रशासन"
              : "आफ्नो RetailIQ एकाउन्टमा सुरक्षित प्रवेश गर्नुहोस्"}
          </p>
        </div>

        {/* Sub-Tab switch */}
        <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-800/80 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(null); }}
            className={`rounded-lg py-2 transition ${
              isLogin
                ? authPortal === "admin"
                  ? "bg-rose-600 text-white shadow-md"
                  : "bg-emerald-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {authPortal === "admin" ? "प्रत्यक्ष लगइन" : "लगइन (Sign In)"}
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(null); }}
            className={`rounded-lg py-2 transition ${
              !isLogin
                ? authPortal === "admin"
                  ? "bg-rose-600 text-white shadow-md"
                  : "bg-emerald-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {authPortal === "admin" ? "नयाँ दर्ता (Key)" : "नयाँ दर्ता (Register)"}
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-xl bg-rose-950/50 border border-rose-800/60 p-2.5 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-950/50 border border-emerald-800/60 p-2.5 text-xs text-emerald-300">
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {!isLogin && authPortal === "client" && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  पसल / फर्मको नाम (Business Name) *
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="उदा: काठमाडौं सुपरस्टोर"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  सञ्चालकको पूरा नाम (Full Name) *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="उदा: रमेश अधिकारी"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    PAN / VAT नम्बर
                  </label>
                  <input
                    type="text"
                    placeholder="उदा: 601234567"
                    value={panVat}
                    onChange={(e) => setPanVat(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    सम्पर्क फोन
                  </label>
                  <input
                    type="tel"
                    placeholder="९८४१००००००"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>
              </div>
            </>
          )}

          {!isLogin && authPortal === "admin" && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  एडमिनको पूरा नाम (Full Name) *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="उदा: प्रणाली प्रशासक"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-rose-300 mb-1">
                  मास्टर सेक्युरिटी की (Admin Master Key) *
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-rose-400" />
                  <input
                    type="password"
                    required
                    placeholder="retailiq-admin-secret-2026"
                    value={adminSecretKey}
                    onChange={(e) => setAdminSecretKey(e.target.value)}
                    className="w-full rounded-xl border border-rose-800/80 bg-slate-800/90 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-rose-400 focus:outline-none font-mono"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              इमेल ठेगाना (Email Address) *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                placeholder={authPortal === "admin" ? "admin@retailiq.com.np" : "store@retailiq.com.np"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none font-mono ${
                  authPortal === "admin" ? "focus:border-rose-500" : "focus:border-emerald-500"
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              गोप्य पासवर्ड (Password) *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none ${
                  authPortal === "admin" ? "focus:border-rose-500" : "focus:border-emerald-500"
                }`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full mt-2 rounded-xl py-2.5 text-xs font-bold text-white shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2 ${
              authPortal === "admin"
                ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-600/30"
                : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/30"
            }`}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLogin
              ? authPortal === "admin"
                ? "सिधै एडमिन लगइन गर्नुहोस्"
                : "लगइन गर्नुहोस् (Sign In)"
              : authPortal === "admin"
              ? "एडमिन दर्ता सम्पन्न गर्नुहोस्"
              : "नयाँ पसल खाता खोल्नुहोस्"}
          </button>

          {isLogin && (
            <div className="mt-3 pt-3 border-t border-slate-800 text-center flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (authPortal === "admin") {
                    setEmail("admin@retailiq.com.np");
                    setPassword("admin123");
                  } else {
                    setEmail("demo@retailiq.com.np");
                    setPassword("demo123");
                  }
                  setError(null);
                }}
                className="text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 transition"
              >
                ⚡ {authPortal === "admin" ? "एडमिन डेमो भर्नुहोस्" : "ग्राहक डेमो भर्नुहोस्"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
