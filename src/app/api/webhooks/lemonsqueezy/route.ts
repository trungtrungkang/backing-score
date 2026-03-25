/**
 * LemonSqueezy Webhook Handler
 *
 * Receives events from LemonSqueezy and updates Appwrite subscription records.
 * Configure this URL in LemonSqueezy Dashboard → Settings → Webhooks:
 *   https://your-domain.com/api/webhooks/lemonsqueezy
 *
 * Events handled:
 *   - subscription_created
 *   - subscription_updated
 *   - subscription_cancelled
 *   - subscription_expired
 *   - subscription_resumed
 *   - subscription_payment_success
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { upsertSubscription } from "@/lib/appwrite/subscriptions";

const WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "";

/**
 * Verify the X-Signature header to ensure the request is from LemonSqueezy.
 */
function verifySignature(rawBody: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn("[Webhook] LEMONSQUEEZY_WEBHOOK_SECRET not set — skipping verification");
    return true; // Allow in dev without secret
  }
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  const digest = hmac.update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature") || "";

    // Verify webhook authenticity
    if (signature && !verifySignature(rawBody, signature)) {
      console.error("[Webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const eventName: string = payload.meta?.event_name || "";
    const customData = payload.meta?.custom_data || {};
    const userId: string = customData.user_id || "";

    // Extract subscription data from the payload
    const attrs = payload.data?.attributes || {};
    const subscriptionId = String(payload.data?.id || "");
    const customerId = String(attrs.customer_id || "");
    const orderId = String(attrs.order_id || "");
    const productId = String(attrs.product_id || "");
    const variantId = String(attrs.variant_id || "");
    const status: string = attrs.status || "";
    const renewsAt: string = attrs.renews_at || "";
    const endsAt: string = attrs.ends_at || "";
    const productName: string = attrs.product_name || attrs.variant_name || "";
    const userEmail: string = attrs.user_email || "";

    console.log(`[Webhook] Event: ${eventName} | Sub: ${subscriptionId} | Status: ${status} | User: ${userId}`);

    // Only process subscription events
    if (!eventName.startsWith("subscription_")) {
      console.log(`[Webhook] Ignoring non-subscription event: ${eventName}`);
      return NextResponse.json({ received: true });
    }

    if (!subscriptionId) {
      console.error("[Webhook] No subscription ID in payload");
      return NextResponse.json({ error: "No subscription ID" }, { status: 400 });
    }

    // Determine the current period end date
    const currentPeriodEnd = renewsAt || endsAt || "";

    // Map LS status to our status
    let mappedStatus = status;
    if (eventName === "subscription_cancelled") {
      mappedStatus = "cancelled";
    } else if (eventName === "subscription_expired") {
      mappedStatus = "expired";
    } else if (eventName === "subscription_resumed") {
      mappedStatus = "active";
    }

    // Upsert subscription in Appwrite
    await upsertSubscription({
      userId,
      lemonSqueezyCustomerId: customerId,
      lemonSqueezySubscriptionId: subscriptionId,
      lemonSqueezyOrderId: orderId,
      productId,
      variantId,
      status: mappedStatus,
      currentPeriodEnd,
      cancelAtPeriodEnd: eventName === "subscription_cancelled" || attrs.cancelled === true,
      planName: productName,
      userEmail,
    });

    console.log(`[Webhook] ✅ Subscription ${subscriptionId} upserted with status: ${mappedStatus}`);

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[Webhook] Error processing:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Reject non-POST requests
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
