export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/better-auth";

import {
  lemonSqueezySetup,
  listSubscriptions,
} from "@lemonsqueezy/lemonsqueezy.js";
import { upsertSubscription, getActiveSubscription } from "@/app/actions/v5/subscriptions";

const apiKey = process.env.LEMONSQUEEZY_API_KEY || "";
const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID || "";

export async function POST(req: NextRequest) {
  try {
    const auth = getAuth();
    const sessionResponse = await auth.api.getSession({ headers: req.headers });
    const user = sessionResponse?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if we already have an active subscription in Database
    const existing = await getActiveSubscription(user.id);
    if (existing) {
      return NextResponse.json({
        synced: true,
        isPremium: true,
        status: existing.status,
        source: "database",
      });
    }

    // If not, query LemonSqueezy directly for this user's subscriptions
    if (!apiKey) {
      return NextResponse.json({ synced: false, isPremium: false, error: "API key not configured" });
    }

    lemonSqueezySetup({ apiKey });

    // List subscriptions for the store, filtered by user email
    const response = await listSubscriptions({
      filter: {
        storeId: STORE_ID,
        userEmail: user.email,
      },
    });

    if (response.error || !response.data?.data?.length) {
      return NextResponse.json({
        synced: false,
        isPremium: false,
        message: "No subscription found in LemonSqueezy",
      });
    }

    // Find the most recent active subscription
    const activeSub = response.data.data.find(
      (sub: any) => ["active", "on_trial", "past_due"].includes(sub.attributes.status)
    );

    if (!activeSub) {
      return NextResponse.json({
        synced: false,
        isPremium: false,
        message: "No active subscription found",
      });
    }

    const attrs = activeSub.attributes;

    // Upsert into Database (mimicking what the webhook would do)
    await upsertSubscription({
      userId: user.id,
      lemonSqueezyCustomerId: String(attrs.customer_id || ""),
      lemonSqueezySubscriptionId: String(activeSub.id),
      lemonSqueezyOrderId: String(attrs.order_id || ""),
      productId: String(attrs.product_id || ""),
      variantId: String(attrs.variant_id || ""),
      status: attrs.status,
      currentPeriodEnd: attrs.renews_at || attrs.ends_at || "",
      cancelAtPeriodEnd: attrs.cancelled || false,
      planName: attrs.product_name || attrs.variant_name || "",
      userEmail: user.email,
    });

    console.log(`[Sync] ✅ Synced subscription ${activeSub.id} for user ${user.id}`);

    return NextResponse.json({
      synced: true,
      isPremium: true,
      status: attrs.status,
      source: "lemonsqueezy_sync",
    });
  } catch (err: any) {
    console.error("[Sync] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
