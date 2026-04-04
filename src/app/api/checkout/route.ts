export const runtime = "edge";
/**
 * Checkout API — creates a LemonSqueezy checkout session.
 *
 * POST /api/checkout
 * Body: { variantId: string }
 * Header: Authorization: Bearer <JWT>
 *
 * Requires authenticated user (Appwrite JWT token).
 */

import { NextRequest, NextResponse } from "next/server";
import { createCheckout } from "@/lib/lemonsqueezy/client";
import { Client, Account } from "@/lib/appwrite/client";


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

    const body = ((await req.json()) as any) as any;
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
