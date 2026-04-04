export const runtime = "edge";
/**
 * Checkout API — creates a LemonSqueezy checkout session.
 *
 * POST /api/checkout
 * Body: { variantId: string }
 * Header: Authorization: Bearer <JWT>
 *
 * Requires authenticated user.
 */

import { NextRequest, NextResponse } from "next/server";
import { createCheckout } from "@/lib/lemonsqueezy/client";
import { getAuth } from "@/lib/auth/better-auth";

export async function POST(req: NextRequest) {
  try {
    const auth = getAuth();
    const sessionResponse = await auth.api.getSession({ headers: req.headers });
    const user = sessionResponse?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = ((await req.json()) as any) as any;
    const { variantId } = body;

    if (!variantId) {
      return NextResponse.json({ error: "variantId is required" }, { status: 400 });
    }

    const checkoutUrl = await createCheckout(user.id, user.email, variantId);

    return NextResponse.json({ checkoutUrl });
  } catch (err: any) {
    console.error("[Checkout] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
