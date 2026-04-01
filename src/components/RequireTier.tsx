"use client";

import { ReactNode } from "react";
import { useAuth, type ServiceTier } from "@/contexts/AuthContext";
import { Crown, Lock } from "lucide-react";
import { Link } from "@/i18n/routing";

interface RequireTierProps {
  children: ReactNode;
  tier: "pro" | "studio";
  fallbackContext?: string; // e.g., "to access advanced analytics"
  showFallback?: boolean;
}

const TIER_LEVELS = {
  free: 0,
  pro: 1,
  studio: 2,
};

export function RequireTier({
  children,
  tier,
  fallbackContext = "to unlock this feature",
  showFallback = true,
}: RequireTierProps) {
  const { user, serviceTier, loading } = useAuth();

  if (loading) return null;

  const userLevel = TIER_LEVELS[serviceTier || "free"];
  const requiredLevel = TIER_LEVELS[tier];

  if (!user || userLevel < requiredLevel) {
    if (!showFallback) return null;

    return (
      <div className="flex flex-col items-center justify-center p-8 border border-zinc-200 dark:border-zinc-800 border-dashed rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm text-center">
        <div className="w-12 h-12 rounded-full bg-[#C8A856]/10 flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-[#C8A856]" />
        </div>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">
          {tier === "studio" ? "Studio Access Required" : "Premium Feature"}
        </h3>
        <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-6">
          Upgrade to {tier === "studio" ? "Studio" : "Pro"} {fallbackContext}.
        </p>
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-[#C8A856]/90 to-[#b5954a] text-zinc-900 text-sm font-bold shadow-lg shadow-[#C8A856]/20 hover:scale-105 transition-all"
        >
          <Crown className="w-4 h-4" />
          View Plans
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
