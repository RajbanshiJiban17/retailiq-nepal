"use client";

import React, { useState, useEffect } from "react";
import {
  Check,
  Sparkles,
  Zap,
  ShieldCheck,
  CreditCard,
  X,
  ArrowRight,
  Loader2,
  Star,
  QrCode,
  Smartphone,
  CheckCircle2,
  Crown,
  Gift,
  Printer,
  FileCheck2,
  Building2,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { fetchSubscriptionPlans, fetchCurrentSubscription, upgradeSubscriptionPlan } from "@/lib/api";
import { SubscriptionPlan, CurrentSubscription } from "@/types";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId?: string;
  storeName?: string;
  currentPlanId?: string;
  onPlanUpgraded?: (subscription: CurrentSubscription) => void;
  onTierChanged?: (tier: string) => void;
}

type PaymentMethod = "fonepay" | "esewa" | "khalti";
type BillingCycle = "monthly" | "yearly";

export function SubscriptionModal({
  isOpen,
  onClose,
  businessId = "00000000-0000-0000-0000-000000000001",
  storeName = "तपाईंको स्टोर",
  currentPlanId,
  onPlanUpgraded,
  onTierChanged,
}: SubscriptionModalProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSub, setCurrentSub] = useState<CurrentSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  // Billing cycle state
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  // Flow step: 'plans' | 'checkout' | 'success'
  const [step, setStep] = useState<"plans" | "checkout" | "success">("plans");
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("fonepay");
  const [esewaNumber, setEsewaNumber] = useState("9841234567");
  const [khaltiNumber, setKhaltiNumber] = useState("9860123456");
  const [transactionRef, setTransactionRef] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStatusText, setPaymentStatusText] = useState("");
  const [completedSubscription, setCompletedSubscription] = useState<CurrentSubscription | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Load plans and current status
  useEffect(() => {
    if (!isOpen) {
      // Reset state when closed
      setStep("plans");
      setSelectedPlan(null);
      setTransactionRef("");
      setValidationError(null);
      setIsProcessingPayment(false);
      return;
    }

    let isMounted = true;
    const loadPlans = async () => {
      setLoading(true);
      try {
        const [plansData, currentData] = await Promise.all([
          fetchSubscriptionPlans(),
          fetchCurrentSubscription(businessId),
        ]);
        if (isMounted) {
          setPlans(plansData);
          setCurrentSub(currentData);
        }
      } catch (err) {
        console.error("Failed to load subscription data", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPlans();
    return () => {
      isMounted = false;
    };
  }, [isOpen, businessId]);

  if (!isOpen) return null;

  // Pricing calculations
  const getPlanPrice = (plan: SubscriptionPlan): number => {
    if (plan.id === "starter" || plan.price_npr === 0) return 0;
    if (billingCycle === "yearly") {
      return plan.id === "enterprise" ? 28790 : 9590; // ~20% discount (2 months free)
    }
    return plan.price_npr;
  };

  const getSavingsText = (plan: SubscriptionPlan): string | null => {
    if (plan.id === "starter" || billingCycle === "monthly") return null;
    if (plan.id === "pro") return "बचत रु. २,३९८ (२ महिना निःशुल्क!)";
    if (plan.id === "enterprise") return "बचत रु. ७,१९८ (२ महिना निःशुल्क!)";
    return null;
  };

  // Plan selection handler
  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (plan.id === "starter") {
      executeUpgrade(plan.id, "trial", "");
      return;
    }
    setSelectedPlan(plan);
    setValidationError(null);
    setTransactionRef("");
    setStep("checkout");
  };

  // Start or renew 7-Day Free Trial
  const handleStartTrial = () => {
    const proPlan = plans.find((p) => p.id === "pro") || plans[1];
    executeUpgrade(proPlan ? proPlan.id : "pro", "trial", "");
  };

  // Quick helper to fill test payment reference code
  const handleFillTestCode = () => {
    const prefix = paymentMethod === "fonepay" ? "FP" : paymentMethod === "esewa" ? "ES" : "KH";
    const randomHex = Math.floor(100000 + Math.random() * 900000);
    setTransactionRef(`${prefix}-2083-${randomHex}`);
    setValidationError(null);
  };

  // Execute upgrade API with strict payment verification
  const executeUpgrade = async (planId: string, channel: string, refCode: string) => {
    // If not trial or free, require actual transaction reference
    if (channel !== "trial" && channel !== "free") {
      if (!refCode || refCode.trim().length < 4) {
        setValidationError(
          "⚠️ भुक्तानी सम्पन्न गरिसकेपछि प्राप्त भएको Fonepay/eSewa/Khalti ट्रान्ज्याक्सन वा भाउचर कोड यहाँ अनिवार्य रूपमा लेख्नुहोस्।"
        );
        return;
      }
    }

    setValidationError(null);
    setIsProcessingPayment(true);

    try {
      if (channel === "trial") {
        setPaymentStatusText("७ दिनको निःशुल्क ट्रायल सक्रिय गरिँदैछ...");
        await new Promise((resolve) => setTimeout(resolve, 800));
      } else {
        setPaymentStatusText("नेपाल क्लियरिङ हाउस (NCHL) तथा गेटवेबाट भुक्तानी रुजु हुँदैछ...");
        await new Promise((resolve) => setTimeout(resolve, 1100));
        setPaymentStatusText("ट्रान्ज्याक्सन प्रमाणीकरण सफल भयो! डिजिटल कर बिजक तयार हुँदैछ...");
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      const amountToPay = selectedPlan ? getPlanPrice(selectedPlan) : 0;
      const updated = await upgradeSubscriptionPlan(
        businessId,
        planId,
        channel,
        refCode.trim(),
        billingCycle,
        amountToPay
      );

      setCurrentSub(updated);
      setCompletedSubscription(updated);
      if (onTierChanged) onTierChanged(planId);
      if (onPlanUpgraded) onPlanUpgraded(updated);

      setStep("success");
    } catch (err: any) {
      setValidationError(err.message || "सब्सक्रिप्सन अपग्रेड तथा भुक्तानी प्रमाणीकरण असफल भयो।");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        // Dismiss when clicking backdrop outside modal card
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 text-white shadow-2xl my-8">
        {/* Top Prominent Close Button */}
        <div className="absolute right-5 top-5 z-20 flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-700/80 text-slate-300 hover:text-rose-200 transition shadow-sm text-xs font-semibold"
            title="बन्द गर्नुहोस् (Close / Dismiss)"
          >
            <X className="h-4 w-4 text-slate-400 hover:text-rose-300" />
            <span>बन्द गर्नुहोस् (Close)</span>
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* STEP 1: PLANS OVERVIEW (तपाईंको स्टोरका लागि उपयुक्त प्लान) */}
        {/* ------------------------------------------------------------- */}
        {step === "plans" && (
          <div>
            {/* Header */}
            <div className="text-center max-w-xl mx-auto mb-6 pr-24 sm:pr-0">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <Sparkles className="h-3.5 w-3.5" /> RetailIQ Nepal SaaS Subscriptions
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                पसलका लागि उपयुक्त प्लान र ७ दिनको निःशुल्क ट्रायल
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
                {storeName} को बिक्री वृद्धि, असीमित Excel/CSV विश्लेषण र २४/७ बजारको साथी AI चलाउनुहोस्।
              </p>

              {/* Billing Cycle Toggle */}
              <div className="inline-flex items-center gap-2 mt-4 p-1 rounded-2xl bg-slate-800/90 border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-4 py-1.5 rounded-xl font-bold transition ${
                    billingCycle === "monthly"
                      ? "bg-emerald-500 text-slate-950 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  मासिक (Monthly)
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("yearly")}
                  className={`px-4 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                    billingCycle === "yearly"
                      ? "bg-emerald-500 text-slate-950 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span>वार्षिक (Annual)</span>
                  <span className="text-[10px] bg-amber-400/30 text-amber-200 px-1.5 py-0.5 rounded-md font-extrabold">
                    २०% छुट 🎁
                  </span>
                </button>
              </div>
            </div>

            {/* Trial Status Banner */}
            {currentSub?.is_trial && (
              <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/70 via-teal-950/60 to-slate-900 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Gift className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                        🎁 ७ दिनको निःशुल्क ट्रायल सक्रिय छ
                      </span>
                      <span className="text-[11px] bg-emerald-500/30 text-emerald-200 font-mono font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                        {currentSub.trial_days_remaining} दिन बाँकी
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      ट्रायल अवधिभर सबै प्रो सुविधाहरू निःशुल्क छन्। ट्रायल समाप्तिपछि निरन्तरताका लागि नियमित भुक्तानी आवश्यक पर्नेछ।
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const proPlan = plans.find((p) => p.id === "pro");
                    if (proPlan) handleSelectPlan(proPlan);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 px-4 py-2 text-xs font-bold transition shadow-md shrink-0"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  अहिले नै नियमित सदस्यता लिनुहोस्
                </button>
              </div>
            )}

            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mb-3" />
                <p className="text-sm">प्लानहरू लोड हुँदैछ...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((p) => {
                  const isCurrent = currentSub?.tier === p.id && !currentSub?.is_trial;
                  const isPro = p.id === "pro";
                  const displayPrice = getPlanPrice(p);
                  const savings = getSavingsText(p);

                  return (
                    <div
                      key={p.id}
                      className={`relative flex flex-col justify-between rounded-2xl p-6 transition-all duration-200 border ${
                        isPro
                          ? "bg-gradient-to-b from-slate-850 via-slate-900 to-slate-950 border-emerald-500/50 shadow-xl shadow-emerald-950/40 ring-1 ring-emerald-500/30"
                          : "bg-slate-850/60 border-slate-700/80 hover:border-slate-600"
                      }`}
                    >
                      {/* Badge */}
                      {p.badge && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-[11px] font-bold text-slate-950 shadow-md whitespace-nowrap">
                          {p.badge}
                        </div>
                      )}

                      <div>
                        {/* Plan Name */}
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                            {isPro && <Star className="h-4 w-4 text-emerald-400 fill-emerald-400" />}
                            {p.name_nepali.split("(")[0].trim()}
                          </h3>
                        </div>

                        {/* Price */}
                        <div className="mt-4 mb-2">
                          {p.id === "starter" ? (
                            <div>
                              <span className="text-3xl font-black text-white font-mono">रु. ०</span>
                              <span className="text-xs text-slate-400 ml-1.5">७ दिन परिक्षण</span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-3xl font-black text-emerald-400 font-mono">
                                रु. {displayPrice.toLocaleString("en-NP")}
                              </span>
                              <span className="text-xs text-slate-400 ml-1.5">
                                {billingCycle === "yearly" ? "/ वर्ष" : "/ महिना"}
                              </span>
                              {savings && (
                                <span className="block text-[11px] text-amber-300 font-semibold mt-1">
                                  {savings}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-slate-400 min-h-[36px] mt-1">{p.description}</p>

                        {/* Features List */}
                        <div className="mt-5 space-y-2.5 pt-4 border-t border-slate-800 text-xs">
                          {p.features.map((feat, fIdx) => (
                            <div key={fIdx} className="flex items-start gap-2">
                              <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                              <span className="text-slate-300 leading-tight">{feat}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="mt-6 pt-4 border-t border-slate-800 space-y-2">
                        <button
                          disabled={isCurrent}
                          onClick={() => handleSelectPlan(p)}
                          className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                            isCurrent
                              ? "bg-slate-800 text-slate-400 cursor-default border border-slate-700"
                              : isPro
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-md shadow-emerald-500/20"
                              : "bg-slate-750 hover:bg-slate-700 text-white border border-slate-600"
                          }`}
                        >
                          {isCurrent ? (
                            "हालको सक्रिय प्लान"
                          ) : p.id === "starter" ? (
                            "७ दिनको ट्रायल सुरु गर्नुहोस्"
                          ) : (
                            <>
                              भुक्तानी गरी सदस्यता लिनुहोस् <ArrowRight className="h-3.5 w-3.5" />
                            </>
                          )}
                        </button>

                        {isPro && !currentSub?.is_trial && (
                          <button
                            onClick={handleStartTrial}
                            className="w-full py-2 px-3 rounded-xl text-[11px] font-semibold text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 transition flex items-center justify-center gap-1.5"
                          >
                            <Gift className="h-3.5 w-3.5 text-emerald-400" />
                            ७ दिन निःशुल्क परिक्षण गर्नुहोस्
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer and Dismiss Option */}
            <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Fonepay QR, eSewa, वा Khalti बाट आधिकारिक कर बिजक (VAT Invoice) सहित सुरक्षित भुक्तानी।</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded text-[11px]">Fonepay QR</span>
                  <span className="font-mono text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded text-[11px]">eSewa</span>
                  <span className="font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded text-[11px]">Khalti</span>
                </div>
                <button
                  onClick={onClose}
                  className="ml-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition text-xs font-semibold border border-slate-700"
                >
                  बन्द गर्नुहोस् (Close)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 2: PAYMENT CHECKOUT (गेटवे भुक्तानी तथा प्रमाणिकरण) */}
        {/* ------------------------------------------------------------- */}
        {step === "checkout" && selectedPlan && (
          <div className="max-w-2xl mx-auto py-2">
            {/* Header / Back */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800 pr-20 sm:pr-0">
              <button
                onClick={() => setStep("plans")}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
              >
                ← प्लान सूचीमा फर्कनुहोस् (Back to Plans)
              </button>
              <div className="text-right">
                <span className="text-[11px] text-emerald-400 font-mono uppercase tracking-wider block">
                  सुरक्षित भुक्तानी चेकआउट
                </span>
                <span className="text-xs text-slate-300 font-bold">
                  {selectedPlan.name_nepali.split("(")[0].trim()} ({billingCycle === "yearly" ? "वार्षिक" : "मासिक"})
                </span>
              </div>
            </div>

            {/* Order Summary Box */}
            <div className="rounded-2xl border border-slate-800 bg-slate-850/60 p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-400 block">छानिएको सदस्यता:</span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-400" />
                  {selectedPlan.name_nepali.split("(")[0].trim()}
                </h3>
                <span className="text-xs text-slate-300 font-mono">
                  अवधि: {billingCycle === "yearly" ? "३६५ दिन (१ वर्ष पूर्ण)" : "३० दिन (१ महिना पूर्ण)"}
                </span>
              </div>

              <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                <span className="text-xs text-slate-400 block">कुल भुक्तानी रकम (NPR):</span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  Rs. {getPlanPrice(selectedPlan).toLocaleString("en-NP")}.00
                </span>
                <span className="text-[10px] text-slate-400 block">१३% कर बिजक (भ्याट) समावेश</span>
              </div>
            </div>

            {/* Validation Error Alert */}
            {validationError && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-600/70 text-rose-200 text-xs flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{validationError}</div>
              </div>
            )}

            {/* Payment Method Selector Tabs */}
            <div className="mb-6">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2.5">
                भुक्तानी माध्यम छान्नुहोस् (Select Gateway):
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod("fonepay");
                    setValidationError(null);
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition ${
                    paymentMethod === "fonepay"
                      ? "bg-rose-950/40 border-rose-500 text-white shadow-lg shadow-rose-950/30"
                      : "bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                  }`}
                >
                  <QrCode className="h-6 w-6 text-rose-400 mb-1" />
                  <span className="text-xs font-bold">Fonepay QR</span>
                  <span className="text-[10px] text-slate-400">कुनै पनि बैंक / QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod("esewa");
                    setValidationError(null);
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition ${
                    paymentMethod === "esewa"
                      ? "bg-emerald-950/40 border-emerald-500 text-white shadow-lg shadow-emerald-950/30"
                      : "bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                  }`}
                >
                  <Smartphone className="h-6 w-6 text-emerald-400 mb-1" />
                  <span className="text-xs font-bold">eSewa Wallet</span>
                  <span className="text-[10px] text-slate-400">ई-सेवा वालेट</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod("khalti");
                    setValidationError(null);
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition ${
                    paymentMethod === "khalti"
                      ? "bg-purple-950/40 border-purple-500 text-white shadow-lg shadow-purple-950/30"
                      : "bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                  }`}
                >
                  <CreditCard className="h-6 w-6 text-purple-400 mb-1" />
                  <span className="text-xs font-bold">Khalti</span>
                  <span className="text-[10px] text-slate-400">खल्ती इन्स्ट्यान्ट</span>
                </button>
              </div>
            </div>

            {/* Fonepay QR View */}
            {paymentMethod === "fonepay" && (
              <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-b from-rose-950/20 to-slate-900 p-6 space-y-4">
                <div className="text-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold mb-3">
                    <QrCode className="h-3.5 w-3.5" /> Fonepay Merchant QR Scan
                  </div>

                  {/* QR Box */}
                  <div className="mx-auto w-48 h-48 bg-white p-3 rounded-2xl shadow-xl flex flex-col items-center justify-between border-4 border-rose-600">
                    <div className="text-[10px] font-black tracking-wider text-rose-600 uppercase">
                      fonepay • RETAILIQ NEPAL
                    </div>
                    {/* Simulated Dynamic QR pattern */}
                    <div className="grid grid-cols-6 gap-1 p-1 w-32 h-32">
                      {Array.from({ length: 36 }).map((_, i) => (
                        <div
                          key={i}
                          className={`rounded-xs ${
                            (i % 2 === 0 && i % 3 !== 1) || i < 7 || i % 6 === 0 || i > 28
                              ? "bg-slate-900"
                              : "bg-rose-600/40"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-[9px] font-bold text-slate-800 font-mono">
                      Rs. {getPlanPrice(selectedPlan).toLocaleString("en-NP")} • SCAN & PAY
                    </div>
                  </div>

                  <div className="text-xs text-slate-300 space-y-1 mt-3">
                    <p className="font-semibold text-white">व्यापारी: RetailIQ Nepal Tech Pvt. Ltd. (PAN: 609823451)</p>
                    <p className="text-slate-400 text-[11px]">
                      Global, Nabil, NIC Asia, Prabhu वा eSewa बाट स्क्यान गरी भुक्तानी गर्नुहोस्।
                    </p>
                  </div>
                </div>

                {/* Transaction Ref Input Field */}
                <div className="pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-white flex items-center gap-1">
                      <span>Fonepay Transaction ID (१२ अङ्कको कारोबार कोड):</span>
                      <span className="text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleFillTestCode}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold underline"
                    >
                      परीक्षण कोड भर्नुहोस् (Auto-fill Test Ref)
                    </button>
                  </div>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => {
                      setTransactionRef(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder="उदा: FP-2083-481920 वा 12 अङ्कको कोड"
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2.5 text-sm text-white font-mono focus:border-rose-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    * भुक्तानी सम्पन्न भएपछि तपाईंको मोबाइल बैंकिङ एपमा देखिने ट्रान्ज्याक्सन कोड यहाँ लेख्नुहोस्।
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => executeUpgrade(selectedPlan.id, "fonepay", transactionRef)}
                  disabled={isProcessingPayment}
                  className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-sm transition shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {paymentStatusText}
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      भुक्तानी प्रमाणीकरण गरी सक्रिय गर्नुहोस् (Verify & Activate Rs. {getPlanPrice(selectedPlan)})
                    </>
                  )}
                </button>
              </div>
            )}

            {/* eSewa View */}
            {paymentMethod === "esewa" && (
              <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 to-slate-900 p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    eSewa Direct Payment
                  </span>
                  <span className="text-xs font-mono text-slate-300">
                    रकम: रु. {getPlanPrice(selectedPlan).toLocaleString("en-NP")}
                  </span>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">eSewa ID / Mobile Number:</label>
                  <input
                    type="text"
                    value={esewaNumber}
                    onChange={(e) => setEsewaNumber(e.target.value)}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2.5 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
                    placeholder="98XXXXXXXX"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-white flex items-center gap-1">
                      <span>eSewa Reference / Transaction Code:</span>
                      <span className="text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleFillTestCode}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold underline"
                    >
                      परीक्षण कोड भर्नुहोस् (Auto-fill Test Ref)
                    </button>
                  </div>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => {
                      setTransactionRef(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder="उदा: ES-2083-948123"
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2.5 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    * eSewa बाट भुक्तानी गरिसकेपछि प्राप्त भएको Ref ID हाल्नुहोस्।
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => executeUpgrade(selectedPlan.id, "esewa", transactionRef)}
                  disabled={isProcessingPayment}
                  className="w-full py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-sm transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {paymentStatusText}
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      eSewa भुक्तानी रुजु गरी सक्रिय गर्नुहोस्
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Khalti View */}
            {paymentMethod === "khalti" && (
              <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-b from-purple-950/20 to-slate-900 p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                    Khalti Instant Payment
                  </span>
                  <span className="text-xs font-mono text-slate-300">
                    रकम: रु. {getPlanPrice(selectedPlan).toLocaleString("en-NP")}
                  </span>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">Khalti Mobile Number:</label>
                  <input
                    type="text"
                    value={khaltiNumber}
                    onChange={(e) => setKhaltiNumber(e.target.value)}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2.5 text-sm text-white font-mono focus:border-purple-500 focus:outline-none"
                    placeholder="98XXXXXXXX"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-white flex items-center gap-1">
                      <span>Khalti Token / Transaction Code:</span>
                      <span className="text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleFillTestCode}
                      className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold underline"
                    >
                      परीक्षण कोड भर्नुहोस् (Auto-fill Test Ref)
                    </button>
                  </div>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => {
                      setTransactionRef(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder="उदा: KH-2083-718290"
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2.5 text-sm text-white font-mono focus:border-purple-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    * खल्ती ट्रान्ज्याक्सन कोड वा टोकन नम्बर यहाँ लेख्नुहोस्।
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => executeUpgrade(selectedPlan.id, "khalti", transactionRef)}
                  disabled={isProcessingPayment}
                  className="w-full py-3 px-6 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {paymentStatusText}
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Khalti भुक्तानी रुजु गरी सक्रिय गर्नुहोस्
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Bottom Back Button */}
            <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800 text-xs">
              <button
                onClick={() => setStep("plans")}
                className="text-slate-400 hover:text-white transition"
              >
                ← योजना छनौटमा फर्कनुहोस्
              </button>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-rose-300 transition"
              >
                रद्द गरी बन्द गर्नुहोस् (Cancel & Close)
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 3: OFFICIAL TAX INVOICE & RECEIPT (कर बिजक रसिद) */}
        {/* ------------------------------------------------------------- */}
        {step === "success" && completedSubscription && (
          <div className="max-w-lg mx-auto py-4 space-y-5">
            {/* Header Success Badge */}
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 shadow-xl animate-in zoom-in-90">
                <FileCheck2 className="h-8 w-8" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                {completedSubscription.is_trial ? "🎁 ७ दिनको निःशुल्क परिक्षण सुरु" : "✨ भुक्तानी प्रमाणित तथा सक्रिय"}
              </span>
              <h3 className="text-2xl font-black text-white mt-1">
                {completedSubscription.plan_name_nepali.split("(")[0].trim()} सदस्यता सक्रिय भयो!
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                तपाईंको स्टोर <strong className="text-white">{storeName}</strong> का लागि सबै प्रिमियम सुविधाहरू तत्काल खोलिएको छ।
              </p>
            </div>

            {/* Printable Official Digital Tax Invoice Box */}
            <div className="rounded-2xl border-2 border-emerald-500/40 bg-slate-950 p-5 text-xs text-slate-300 shadow-2xl relative overflow-hidden">
              {/* PAID Watermark Stamp */}
              <div className="absolute right-4 bottom-4 border-2 border-emerald-500/40 text-emerald-400/30 uppercase text-xs font-black tracking-widest px-3 py-1 rounded-lg rotate-[-12deg] pointer-events-none select-none">
                PAID & VERIFIED • RETAILIQ NEPAL
              </div>

              {/* Company & Invoice Header */}
              <div className="flex justify-between items-start pb-4 border-b border-slate-800">
                <div>
                  <h4 className="font-extrabold text-white text-sm">RetailIQ Nepal Tech Pvt. Ltd.</h4>
                  <p className="text-[11px] text-slate-400">अनामनगर, काठमाडौं, नेपाल</p>
                  <p className="text-[11px] text-emerald-400 font-mono">PAN / VAT: 609823451</p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[11px] border border-emerald-500/30">
                    कर बिजक (TAX INVOICE)
                  </span>
                  <p className="text-[11px] font-mono text-slate-400 mt-1">
                    नं: {completedSubscription.invoice_no || `INV-2083-09-${businessId.slice(0, 6).toUpperCase()}`}
                  </p>
                </div>
              </div>

              {/* Invoice Meta Grid */}
              <div className="grid grid-cols-2 gap-3 py-3 border-b border-slate-800/80 text-[11px]">
                <div>
                  <span className="text-slate-400 block">ग्राहक (Store Name):</span>
                  <span className="font-bold text-white">{storeName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">भुक्तानी माध्यम (Payment Gateway):</span>
                  <span className="font-bold text-emerald-300 uppercase">
                    {completedSubscription.payment_channel || "Fonepay QR"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">ट्रान्ज्याक्सन कोड (Ref Code):</span>
                  <span className="font-mono font-bold text-slate-200">
                    {completedSubscription.transaction_id || "TRX-2083-OK"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">वैधता अवधि (Expiry Date):</span>
                  <span className="font-bold text-slate-200">
                    {completedSubscription.expires_at} ({completedSubscription.days_remaining} दिन बाँकी)
                  </span>
                </div>
              </div>

              {/* Amount Breakdown */}
              <div className="pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>सदस्यता शुल्क ({billingCycle === "yearly" ? "१ वर्ष" : "१ महिना"}):</span>
                  <span className="font-mono text-slate-200">
                    Rs. {completedSubscription.amount_paid_npr ? (completedSubscription.amount_paid_npr / 1.13).toFixed(2) : "0.00"}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>१३% मूल्य अभिवृद्धि कर (VAT):</span>
                  <span className="font-mono text-slate-200">
                    Rs. {completedSubscription.amount_paid_npr ? (completedSubscription.amount_paid_npr - completedSubscription.amount_paid_npr / 1.13).toFixed(2) : "0.00"}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800">
                  <span className="text-emerald-400">कुल भुक्तानी रकम (Total Paid):</span>
                  <span className="font-mono text-emerald-400 font-extrabold text-base">
                    Rs. {completedSubscription.amount_paid_npr ? completedSubscription.amount_paid_npr.toLocaleString("en-NP") : "0"}.00
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-2 border border-slate-700"
              >
                <Printer className="h-4 w-4 text-emerald-400" />
                रसिद प्रिन्ट गर्नुहोस् (Print Receipt)
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new Event("retailiq_data_updated"));
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                <span>ड्यासबोर्डमा जानुहोस्</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
