/**
 * Checkout API — creates a LemonSqueezy checkout session.
 *
 * POST /api/checkout
 * Body: { variantId: string }
 *
 * Requires authenticated user session (reads Appwrite JWT from cookie).
 */

import { NextRequest, NextResponse } from "next/server";
import { createCheckout } from "@/lib/lemonsqueezy/client";
import { Client, Account } from "node-appwrite";

async function getAuthUser(req: NextRequest) {
  // Get Appwrite session from cookie or Authorization header
  const sessionCookie =
    req.cookies.get("a_session_backing-score")?.value ||
    req.cookies.get("a_session_backing_score")?.value || "";

  if (!sessionCookie) return null;

  try {
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
    client.setSession(sessionCookie);
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

    const body = await req.json();
    const { variantId } = body;

    if (!variantId) {
      return NextResponse.json({ error: "variantId is required" }, { status: 400 });
    }

    const checkoutUrl = await createCheckout(user.$id, user.email, variantId);

    return NextResponse.json({ checkoutUrl });
  } catch (err: any) {
    console.error("[Checkout] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
