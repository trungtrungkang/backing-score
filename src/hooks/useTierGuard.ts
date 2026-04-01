"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "@/i18n/routing";

const TIER_LEVELS = {
  free: 0,
  pro: 1,
  studio: 2,
};

export function useTierGuard(targetTier: "pro" | "studio") {
  const { user, serviceTier, loading } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login?redirect=/pricing");
      return;
    }

    const userLevel = TIER_LEVELS[serviceTier || "free"];
    const requiredLevel = TIER_LEVELS[targetTier];

    if (userLevel < requiredLevel) {
      setIsAuthorized(false);
      // Redirect to pricing page with a query param describing why they were redirected
      router.push(`/pricing?gate=${targetTier}`);
    } else {
      setIsAuthorized(true);
    }
  }, [user, serviceTier, loading, router, targetTier]);

  return { isAuthorized, loading: loading || isAuthorized === null };
}
