"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useCallback } from "react";
import { Check, Crown, Sparkles, Music, Zap, Download, Shield } from "lucide-react";
import Link from "next/link";

export default function PricingPage() {
  const t = useTranslations("Pricing");
  const { user, serviceTier, subscriptionStatus, getJWT } = useAuth();
  const isPremium = serviceTier === "pro" || serviceTier === "studio";
  const [isYearly, setIsYearly] = useState(true);
  const [loading, setLoading] = useState(false);

  // TODO: Replace with real LemonSqueezy variant IDs after creating products in LS dashboard
  const MONTHLY_VARIANT_ID = process.env.NEXT_PUBLIC_LS_MONTHLY_VARIANT_ID || "";
  const YEARLY_VARIANT_ID = process.env.NEXT_PUBLIC_LS_YEARLY_VARIANT_ID || "";

  const handleSubscribe = useCallback(async () => {
    if (!user) {
      window.location.href = "/en/login?redirect=/en/pricing";
      return;
    }

    setLoading(true);
    try {
      const variantId = isYearly ? YEARLY_VARIANT_ID : MONTHLY_VARIANT_ID;
      const jwt = await getJWT();
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({ variantId }),
      });

      if (!res.ok) throw new Error("Failed to create checkout");

      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setLoading(false);
    }
  }, [user, isYearly, MONTHLY_VARIANT_ID, YEARLY_VARIANT_ID, getJWT]);

  const freeFeatures = [
    { icon: Music, text: t("freeFeature1") },
    { icon: Sparkles, text: t("freeFeature2") },
    { icon: Shield, text: t("freeFeature3") },
  ];

  const premiumFeatures = [
    { icon: Zap, text: t("premiumFeature1") },
    { icon: Download, text: t("premiumFeature2") },
    { icon: Crown, text: t("premiumFeature3") },
    { icon: Sparkles, text: t("premiumFeature4") },
    { icon: Shield, text: t("premiumFeature5") },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(200,168,86,0.08),transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(200,168,86,0.15),transparent_50%)]" />
        <div className="relative max-w-5xl mx-auto px-4 pt-20 pb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#C8A856]/10 border border-[#C8A856]/20 text-[#C8A856] text-sm font-medium mb-6">
            <Crown className="w-4 h-4" />
            {t("badge")}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
            {t("title")}
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto mb-10">
            {t("subtitle")}
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800/50 rounded-full p-1 border border-zinc-200 dark:border-zinc-700/50">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                !isYearly
                  ? "bg-white dark:bg-white text-zinc-900 shadow-lg"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              {t("monthly")}
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                isYearly
                  ? "bg-white dark:bg-white text-zinc-900 shadow-lg"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              {t("yearly")}
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                {t("savePercent")}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-5xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Free Tier */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-8 flex flex-col">
            <h3 className="text-lg font-bold text-zinc-600 dark:text-zinc-300 mb-1">{t("freeTier")}</h3>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mb-6">{t("freeDesc")}</p>
            <div className="mb-8">
              <span className="text-4xl font-bold text-zinc-900 dark:text-white">$0</span>
              <span className="text-zinc-400 dark:text-zinc-500 ml-1">/ {t("forever")}</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {freeFeatures.map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <f.icon className="w-5 h-5 text-zinc-400 dark:text-zinc-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">{f.text}</span>
                </li>
              ))}
            </ul>
            {!user ? (
              <Link
                href="/en/signup"
                className="w-full py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 text-center text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors block"
              >
                {t("getStarted")}
              </Link>
            ) : (
              <div className="w-full py-3 rounded-xl border border-zinc-200 dark:border-zinc-700/50 text-center text-sm text-zinc-400 dark:text-zinc-500">
                {t("currentPlan")}
              </div>
            )}
          </div>

          {/* Premium Tier */}
          <div className="rounded-2xl border-2 border-[#C8A856]/40 bg-gradient-to-b from-[#C8A856]/5 to-white dark:to-zinc-900/50 p-8 flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#C8A856] text-zinc-900 text-xs font-bold uppercase tracking-wider">
              {t("recommended")}
            </div>
            <h3 className="text-lg font-bold text-[#C8A856] mb-1">{t("premiumTier")}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{t("premiumDesc")}</p>
            <div className="mb-8">
              <span className="text-4xl font-bold text-zinc-900 dark:text-white">
                ${isYearly ? "39.99" : "4.99"}
              </span>
              <span className="text-zinc-400 dark:text-zinc-500 ml-1">
                / {isYearly ? t("year") : t("month")}
              </span>
              {isYearly && (
                <div className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                  ≈ $3.33/{t("month")} · {t("saveAmount")}
                </div>
              )}
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {premiumFeatures.map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-[#C8A856]/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-[#C8A856]" />
                  </div>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{f.text}</span>
                </li>
              ))}
            </ul>

            {isPremium ? (
              <div className="w-full py-3 rounded-xl bg-[#C8A856]/10 border border-[#C8A856]/30 text-center text-sm font-bold text-[#C8A856]">
                ✓ {t("activePlan")}
                {subscriptionStatus === "cancelled" && (
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-1">{t("cancelledNote")}</span>
                )}
              </div>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={loading || !MONTHLY_VARIANT_ID}
                className="w-full py-3 rounded-xl bg-[#C8A856] text-zinc-900 text-sm font-bold hover:bg-[#d4b85f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {t("subscribe")}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* FAQ / Trust */}
        <div className="mt-16 text-center">
          <p className="text-sm text-zinc-400 dark:text-zinc-500 max-w-lg mx-auto">
            {t("guarantee")}
          </p>
        </div>
      </div>
    </div>
  );
}
