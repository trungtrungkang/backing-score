export const runtime = "edge";
/**
 * Subscription status API — checks if a user has an active premium subscription.
 *
 * GET /api/subscription?userId=xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { getActiveSubscription } from "@/app/actions/v5/subscriptions";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ isPremium: false, status: null });
  }

  try {
    const sub = await getActiveSubscription(userId) as any;
    if (sub) {
      return NextResponse.json({
        isPremium: true,
        status: sub.status,
        planName: sub.planName,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      });
    }
    return NextResponse.json({ isPremium: false, status: null });
  } catch {
    return NextResponse.json({ isPremium: false, status: null });
  }
}
