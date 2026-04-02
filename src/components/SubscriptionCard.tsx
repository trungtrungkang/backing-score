"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import { Crown, CreditCard, Calendar, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function SubscriptionCard() {
  const t = useTranslations("Subscription");
  const { user, serviceTier, subscriptionStatus, refreshSubscription } = useAuth();
  const isPremium = serviceTier === "pro" || serviceTier === "studio";
  const [cancelling, setCancelling] = useState(false);

  if (!user) return null;

  // Free user — show upgrade prompt
  if (!isPremium) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-zinc-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{t("freePlan")}</h3>
              <p className="text-xs text-zinc-500">{t("upgradeHint")}</p>
            </div>
          </div>
          <Link
            href="/pricing"
            className="px-4 py-2 rounded-lg bg-[#C8A856] text-zinc-900 text-sm font-bold hover:bg-[#d4b85f] transition-colors flex items-center gap-2"
          >
            <Crown className="w-4 h-4" />
            {t("upgrade")}
          </Link>
        </div>
      </div>
    );
  }

  // Premium user — show status
  return (
    <div className="rounded-xl border-2 border-[#C8A856]/30 bg-gradient-to-r from-[#C8A856]/5 to-transparent dark:from-[#C8A856]/10 p-5 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#C8A856]/20 flex items-center justify-center">
            <Crown className="w-5 h-5 text-[#C8A856]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{t("premiumPlan")}</h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500">
                {subscriptionStatus === "cancelled" ? t("cancelledStatus") : t("activeStatus")}
              </span>
            </div>
            {subscriptionStatus === "cancelled" && (
              <p className="text-xs text-zinc-500 mt-0.5">{t("cancelledNote")}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* LemonSqueezy Customer Portal — LS provides a portal URL for managing subscriptions */}
          <a
            href="https://backingscore.lemonsqueezy.com/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            {t("manageBilling")}
          </a>
        </div>
      </div>
    </div>
  );
}
