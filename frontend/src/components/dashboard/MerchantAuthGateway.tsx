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
} from "lucide-react";
import { loginUser, registerMerchant, fetchRegisteredMerchants } from "@/lib/api";
import { UserProfile } from "@/types";

interface Props {
  onLoginSuccess: (user: UserProfile) => void;
}

export function MerchantAuthGateway({ onLoginSuccess }: Props) {
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

  // Registered merchants state
  const [merchants, setMerchants] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(5);

  useEffect(() => {
    const loadMerchants = async () => {
      try {
        const res = await fetchRegisteredMerchants();
        setMerchants(res.merchants || []);
        setTotalCount(res.total_count || 5);
      } catch {
        // fallback
      }
    };
    loadMerchants();
  }, []);

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
        localStorage.setItem("retailiq_token", res.access_token);
        localStorage.setItem("retailiq_user", JSON.stringify(userToSave));
        window.dispatchEvent(new Event("retailiq_user_updated"));
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

  const handleDemoLogin = (merchant: any) => {
    const demoUser: UserProfile = {
      id: `usr-${merchant.id.slice(0, 8)}`,
      email: merchant.email || "admin@retailiq.com.np",
      full_name: merchant.owner_name || "पसल सञ्चालक",
      business_name: merchant.business_name,
      business_id: merchant.id,
      phone: merchant.phone || "९८४१००००००",
      role: "owner",
      is_active: true,
      is_business_owner: true,
    };

    localStorage.setItem("retailiq_token", `demo-token-${merchant.id}`);
    localStorage.setItem("retailiq_user", JSON.stringify(demoUser));
    window.dispatchEvent(new Event("retailiq_user_updated"));
    onLoginSuccess(demoUser);
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
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
            <Store className="h-3.5 w-3.5" />
            नेपालभर {totalCount}+ पसलहरू दर्ता
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1 flex flex-col justify-center">
        {/* Banner */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            नेपालका खुद्रा तथा थोक पसलेहरूका लागि निर्मित पहिलो AI प्लेटफर्म
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-snug">
            पसलको हिसाबकिताब, स्टक र बिक्री अब{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              AI मार्फत स्वचालित
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2.5 max-w-xl mx-auto">
            आफ्नो पसलको खातामा लगइन गर्नुहोस् वा नयाँ पसल दर्ता गरी ७-हप्ते माग प्रक्षेपण,
            'बजारको साथी' AI र प्रत्यक्ष इन्भेन्टरी नियन्त्रण सुरु गर्नुहोस्।
          </p>
        </div>

        {/* 2-Column Grid: Left (Auth Form), Right (Verified Merchant Stores Directory) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-6xl mx-auto w-full">
          {/* Column 1: Auth Form (5 Cols) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="flex border-b border-slate-800 mb-5">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(true);
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 pb-3 text-xs font-bold transition border-b-2 ${
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
                className={`flex-1 pb-3 text-xs font-bold transition border-b-2 ${
                  !isLogin
                    ? "border-emerald-500 text-emerald-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                नयाँ पसल दर्ता (Register)
              </button>
            </div>

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

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
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
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
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

            <div className="mt-4 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 text-center">
              १००% सुरक्षित मल्टी-टेनेन्ट आर्किटेक्चर • नेपाल कानुन अनुसार दर्ता
            </div>
          </div>

          {/* Column 2: Verified Merchant Stores Directory (7 Cols) */}
          <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Store className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-white">
                      दर्ता भएका सक्रिय पसलहरू (Merchant Roster)
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      परीक्षण गर्न कुनै पनि पसल छानेर १-क्लिकमा ड्यासबोर्ड अवलोकन गर्नुहोस्
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/30">
                  {totalCount} पसलहरू
                </span>
              </div>

              {/* Merchant Store Cards */}
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {merchants.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850/60 transition group flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 text-emerald-400 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-white truncate">
                            {m.business_name}
                          </p>
                          <span className="text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded font-medium shrink-0">
                            {m.plan || "Pro"}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">
                          {m.city || "काठमाडौं"} • {m.owner_name || "पसले"}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDemoLogin(m)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-bold rounded-lg transition shrink-0 group-hover:shadow group-hover:shadow-emerald-600/20"
                    >
                      <span>ड्यासबोर्ड खोल्नुहोस्</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Value Props Pills */}
            <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-slate-800 text-[11px] text-slate-400">
              <div className="p-2 rounded-lg bg-slate-950/40 border border-slate-800/80 text-center">
                <span className="text-emerald-400 font-bold block">७-हप्ते ML</span>
                बिक्री भविष्यवाणी
              </div>
              <div className="p-2 rounded-lg bg-slate-950/40 border border-slate-800/80 text-center">
                <span className="text-teal-400 font-bold block">बजारको साथी</span>
                नेपाली AI सल्लाहकार
              </div>
              <div className="p-2 rounded-lg bg-slate-950/40 border border-slate-800/80 text-center">
                <span className="text-purple-400 font-bold block">लाइभ स्टक</span>
                CRUD डाटाबेस नियन्त्रण
              </div>
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
