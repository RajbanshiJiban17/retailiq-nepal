"use client";

import React, { useState } from "react";
import { X, Building2, Lock, Mail, Phone, User, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { loginUser, registerMerchant } from "@/lib/api";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userData: any) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (isLogin) {
        const res = await loginUser(email, password);
        const userToSave = {
          ...res.user,
          business_name: res.user.business_name || (res.user.email === "admin@retailiq.com.np" ? "पशुपति किराना तथा सुपरस्टोर" : `${res.user.full_name}'s Store`),
        };
        localStorage.setItem("retailiq_token", res.access_token);
        localStorage.setItem("retailiq_user", JSON.stringify(userToSave));
        window.dispatchEvent(new Event("retailiq_user_updated"));
        setSuccessMsg("सफलतापूर्वक लगइन भयो! (Login Successful)");
        setTimeout(() => {
          onSuccess(userToSave);
          onClose();
        }, 800);
      } else {
        const res = await registerMerchant({
          business_name: businessName,
          pan_vat_number: panVat || undefined,
          full_name: fullName,
          email,
          password,
          phone: phone || undefined,
        });
        const userToSave = {
          ...res.user,
          business_name: res.user.business_name || businessName,
        };
        localStorage.setItem("retailiq_token", res.access_token);
        localStorage.setItem("retailiq_user", JSON.stringify(userToSave));
        window.dispatchEvent(new Event("retailiq_user_updated"));
        setSuccessMsg("नयाँ पसल सफलतापूर्वक दर्ता भयो! (Registered Successfully)");
        setTimeout(() => {
          onSuccess(userToSave);
          onClose();
        }, 800);
      }
    } catch (err: any) {
      setError(err.message || "प्रक्रिया असफल भयो। कृपया फेरि प्रयास गर्नुहोस्।");
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

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Building2 className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-black text-white">
            {isLogin ? "पसल व्यवस्थापक लगइन (Merchant Login)" : "नयाँ पसल दर्ता (Register Store)"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isLogin
              ? "आफ्नो RetailIQ एकाउन्टमा प्रवेश गर्नुहोस्"
              : "नेपालको पहिलो AI-सञ्चालित स्मार्ट इन्भेन्टरी प्लेटफर्म"}
          </p>
        </div>

        {/* Tab switch */}
        <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-800/80 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(null); }}
            className={`rounded-lg py-2 transition ${isLogin ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
          >
            लगइन (Sign In)
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(null); }}
            className={`rounded-lg py-2 transition ${!isLogin ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
          >
            नयाँ दर्ता (Register)
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-rose-950/50 border border-rose-800/60 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-950/50 border border-emerald-800/60 p-3 text-xs text-emerald-300">
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {!isLogin && (
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
                    placeholder="उदा: काठमाडौं सुपरस्टोर प्रा.लि."
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  तपाईंको पूरा नाम (Full Name) *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="उदा: सन्तोष श्रेष्ठ"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    PAN / VAT नम्बर
                  </label>
                  <input
                    type="text"
                    placeholder="उदा: 601234567"
                    value={panVat}
                    onChange={(e) => setPanVat(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    सम्पर्क फोन
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="98XXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
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
                placeholder="store@retailiq.com.np"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
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
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLogin ? "लगइन गर्नुहोस् (Sign In)" : "नयाँ पसल खाता खोल्नुहोस् (Register Business)"}
          </button>
        </form>
      </div>
    </div>
  );
}
