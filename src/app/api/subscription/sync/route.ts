import { Client, Databases, Account, Storage, Query, ID, Permission, Role, Models } from "@/lib/appwrite/client";
/**
 * Subscription Sync API — manually checks LemonSqueezy for a user's subscription
 * when the webhook hasn't fired yet (e.g. during LS account verification period).
 *
 * POST /api/subscription/sync
 * Header: Authorization: Bearer <JWT>
 *
 * This endpoint is called after checkout success to ensure the subscription
 * record exists in Appwrite even if the webhook is delayed.
 */

import { NextRequest, NextResponse } from "next/server";

import {
  lemonSqueezySetup,
  listSubscriptions,
} from "@lemonsqueezy/lemonsqueezy.js";
import { upsertSubscription, getActiveSubscription } from "@/lib/appwrite/subscriptions";

const apiKey = process.env.LEMONSQUEEZY_API_KEY || "";
const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID || "";

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) return null;

  try {
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
    client.setJWT(jwt);
    const account = new Account(client);
    return await account.get();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if we already have an active subscription in Appwrite
    const existing = await getActiveSubscription(user.$id);
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

    // Upsert into Appwrite (mimicking what the webhook would do)
    await upsertSubscription({
      userId: user.$id,
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

    console.log(`[Sync] ✅ Synced subscription ${activeSub.id} for user ${user.$id}`);

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
