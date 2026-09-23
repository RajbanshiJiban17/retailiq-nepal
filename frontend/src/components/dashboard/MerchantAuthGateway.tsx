"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Lock,
  Mail,
  Phone,
  User,
  CheckCircle2,
  ArrowRight,
  Store,
  ShieldCheck,
  Sparkles,
  Zap,
  BarChart3,
  BrainCircuit,
  Bot,
  Layers,
  Crown,
  ShieldAlert,
  KeyRound,
} from "lucide-react";
import { loginUser, registerMerchant, fetchRegisteredMerchants } from "@/lib/api";
import { UserProfile } from "@/types";
import { startSession } from "@/lib/session";

interface Props {
  onLoginSuccess: (user: UserProfile) => void;
}

export function MerchantAuthGateway({ onLoginSuccess }: Props) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [timeoutNotice, setTimeoutNotice] = useState<string | null>(null);

  // Inactivity timeout notice check
  useEffect(() => {
    if (typeof window !== "undefined") {
      const reason = sessionStorage.getItem("retailiq_logout_reason");
      if (reason === "inactivity") {
        setTimeoutNotice("सुरक्षाको लागि ३० मिनेट निष्क्रिय भएपछि स्वतः लगआउट गरियो। कृपया पुन: लगइन गर्नुहोस्।");
        sessionStorage.removeItem("retailiq_logout_reason");
      }
    }
  }, []);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [fullName, setFullName] = useState("");
  const [panVat, setPanVat] = useState("");
  const [phone, setPhone] = useState("");

  const [totalCount, setTotalCount] = useState(5);

  useEffect(() => {
    const loadMerchantsCount = async () => {
      try {
        const res = await fetchRegisteredMerchants();
        setTotalCount(res.total_count || 5);
      } catch {
        // fallback
      }
    };
    loadMerchantsCount();
  }, []);

  const handleFillDemoCreds = () => {
    setIsLogin(true);
    setEmail("admin@retailiq.com.np");
    setPassword("admin123");
    setError(null);
  };

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
      if (businessName.trim().length < 2) {
        setError("पसल वा फर्मको नाम कम्तीमा २ अक्षरको हुनुपर्दछ।");
        return;
      }
      if (fullName.trim().length < 2) {
        setError("सञ्चालकको पूरा नाम कम्तीमा २ अक्षरको हुनुपर्दछ।");
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        const res = await loginUser(cleanEmail, password);
        const userToSave: UserProfile = {
          ...res.user,
          business_name:
            res.user.business_name ||
            (res.user.email === "admin@retailiq.com.np"
              ? "पशुपति किराना तथा सुपरस्टोर"
              : `${res.user.full_name}'s Store`),
        };
        startSession(res.access_token, userToSave, 30);
        setSuccessMsg("सफलतापूर्वक लगइन भयो! ड्यासबोर्ड खुल्दैछ...");
        setTimeout(() => {
          onLoginSuccess(userToSave);
        }, 500);
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
        setSuccessMsg("🎉 पसल दर्ता सफल भयो! कृपया आफ्नो पासवर्ड हानेर लगइन गर्नुहोस्।");
      }
    } catch (err: any) {
      setError(err?.message || "प्रक्रिया असफल भयो। कृपया विवरण जाँच्नुहोस्।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Top Bar */}
      <header className="border-b border-slate-850 bg-slate-950/80 backdrop-blur-md px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-emerald-500/20">
            IQ
          </div>
          <div>
            <span className="text-white font-black text-lg tracking-tight leading-none block">
              RetailIQ <span className="text-emerald-400 font-bold">नेपाल</span>
            </span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
              Enterprise Retail & Inventory OS
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
            <Store className="h-3.5 w-3.5" />
            नेपालभर {totalCount}+ पसलहरू दर्ता
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Platform Capabilities & Nepali Intelligence (6 Cols) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              नेपालका खुद्रा तथा थोक व्यवसायीका लागि स्मार्ट प्रणाली
            </div>

            <div>
              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                पसलको हिसाबकिताब, स्टक र बिक्री अब{" "}
                <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                  AI मार्फत स्वचालित
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-3 leading-relaxed">
                आफ्नो पसलको खातामा सुरक्षित लगइन गर्नुहोस् वा नयाँ पसल दर्ता गरी ७-हप्ते मेसिन लर्निङ माग प्रक्षेपण,
                'बजारको साथी' AI र प्रत्यक्ष इन्भेन्टरी नियन्त्रण सुरु गर्नुहोस्।
              </p>
            </div>

            {/* Core Feature Pillars */}
            <div className="space-y-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <BrainCircuit className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">७-हप्ते ML माग पूर्वानुमान (Nepali Ridge Model)</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    दसैँ, तिहार, लगन र सिजनल क्यालेन्डर अनुसार प्रत्येक सामानको बिक्री प्रक्षेपण।
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">बजारको साथी AI (वास्तविक बिक्रीमा आधारित सल्लाहकार)</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    आफ्नै सामानको बिक्री, मौज्दात र चाडपर्व मागबारे नेपालीमै सटीक सोधपुछ।
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">प्रत्यक्ष इन्भेन्टरी र रिअर्डर अलर्टहरू</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    सामान सकिनु अगावै अलर्ट, स्वचालित रिअर्डर मात्रा गणना र बहु-पसल व्यवस्थापन।
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Demo Credentials Autofill Banner */}
            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <KeyRound className="h-4 w-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-300">परीक्षण गर्न डेमो खाता प्रयोग गर्नुहोस्</p>
                  <p className="text-[10px] text-slate-400 font-mono">admin@retailiq.com.np • admin123</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleFillDemoCreds}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition shrink-0 shadow"
              >
                डेमो भर्नुहोस्
              </button>
            </div>
          </div>

          {/* Right Column: Clean Authentication Box (6 Cols) */}
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex border-b border-slate-800 mb-6">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(true);
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 pb-3 text-xs sm:text-sm font-bold transition border-b-2 ${
                  isLogin
                    ? "border-emerald-500 text-emerald-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                पसल लगइन (Sign In)
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLogin(false);
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 pb-3 text-xs sm:text-sm font-bold transition border-b-2 ${
                  !isLogin
                    ? "border-emerald-500 text-emerald-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                नयाँ पसल दर्ता (Register)
              </button>
            </div>

            {timeoutNotice && (
              <div className="mb-4 p-3 rounded-xl bg-amber-950/50 border border-amber-500/60 text-xs text-amber-200 flex items-center gap-2.5">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
                <span>{timeoutNotice}</span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {!isLogin && (
                <>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      पसल वा फर्मको नाम (Business Name)
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="उदा: काठमाडौं सुपरस्टोर"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        सञ्चालकको नाम
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="उदा: रमेश श्रेष्ठ"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        PAN / VAT नम्बर (ऐच्छिक)
                      </label>
                      <input
                        type="text"
                        value={panVat}
                        onChange={(e) => setPanVat(e.target.value)}
                        placeholder="६०१२३४५६७"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  इमेल ठेगाना (Email Address)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="pashupati.kirana@gmail.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  पासवर्ड (Password)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="कम्तीमा ६ अक्षर"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    सम्पर्क फोन नम्बर (Mobile)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="९८४१००००००"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <span>प्रक्रिया चल्दैछ...</span>
                ) : (
                  <>
                    <span>{isLogin ? "ड्यासबोर्ड खोल्नुहोस्" : "पसल दर्ता सम्पन्न गर्नुहोस्"}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-center gap-1.5 text-center">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>१००% सुरक्षित मल्टी-टेनेन्ट आर्किटेक्चर • नेपाल कानुन अनुसार दर्ता</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-850 py-4 px-4 text-center text-xs text-slate-500">
        RetailIQ Nepal • नेपालका खुद्रा तथा थोक व्यवसायीहरूका लागि डिजाइन गरिएको स्मार्ट अपरेटिङ सिस्टम
      </footer>
    </div>
  );
}
