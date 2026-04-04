"use server";

import { getDb } from "@/db";
import { subscriptions, products, purchases, entitlements } from "@/db/schema/monetization";
import { eq, desc, and } from "drizzle-orm";

export async function getActiveSubscription(userId: string) {
  const db = getDb();
  // Fetch active subscriptions sorted by currentPeriodEnd to get the latest
  const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.currentPeriodEnd));
  
  if (rows.length === 0) return null;
  
  // Try to find one that is truly active
  const active = rows.find((r: any) => r.status === "active" || r.status === "on_trial");
  if (active) return active;
  
  // Or at least return whatever past_due we have
  return rows[0];
}

export async function upsertSubscription(data: {
  userId: string;
  lemonSqueezyCustomerId: string;
  lemonSqueezySubscriptionId: string;
  lemonSqueezyOrderId: string;
  productId: string;
  variantId: string;
  status: string;
  currentPeriodEnd: string | Date;
  cancelAtPeriodEnd: boolean;
  planName: string;
  userEmail?: string;
}) {
  const db = getDb();
  
  // Check if exists
  const existing = await db.select().from(subscriptions).where(eq(subscriptions.id, data.lemonSqueezySubscriptionId)).limit(1);
  
  const endPeriodDate = typeof data.currentPeriodEnd === "string" ? new Date(data.currentPeriodEnd) : data.currentPeriodEnd;
  
  if (existing.length > 0) {
    await db.update(subscriptions).set({
      userId: data.userId,
      status: data.status,
      planId: data.variantId,
      planName: data.planName,
      productId: data.productId,
      orderId: data.lemonSqueezyOrderId,
      customerId: data.lemonSqueezyCustomerId,
      userEmail: data.userEmail,
      currentPeriodEnd: endPeriodDate,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd
    }).where(eq(subscriptions.id, data.lemonSqueezySubscriptionId));
  } else {
    await db.insert(subscriptions).values({
      id: data.lemonSqueezySubscriptionId,
      userId: data.userId,
      status: data.status,
      planId: data.variantId,
      planName: data.planName,
      productId: data.productId,
      orderId: data.lemonSqueezyOrderId,
      customerId: data.lemonSqueezyCustomerId,
      userEmail: data.userEmail,
      currentPeriodEnd: endPeriodDate,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd
    });
  }
  
  return true;
}

// ==============
// Products & Purchases
// ==============

export async function getProductByVariantId(variantId: string) {
  const db = getDb();
  const rows = await db.select().from(products).where(eq(products.lemonSqueezyVariantId, variantId)).limit(1);
  if (rows.length === 0) return null;
  return rows[0];
}

export async function logPurchase(
  orderId: string,
  userId: string,
  productId: string,
  amountCents: number,
  currency: string
) {
  const db = getDb();
  await db.insert(purchases).values({
    orderId,
    userId,
    productId,
    amountCents,
    currency,
    createdAt: new Date()
  });
  return { orderId, userId, productId };
}

export async function grantEntitlement(userId: string, productId: string) {
  const db = getDb();
  
  const product = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (product.length === 0) return null;
  
  const targetType = product[0].targetType;
  const targetId = product[0].targetId;
  
  // Check if exists
  const existing = await db.select().from(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.targetId, targetId), eq(entitlements.targetType, targetType))).limit(1);
  if (existing.length > 0) return existing[0];
  
  const newId = "ent_" + crypto.randomUUID().replace(/-/g, "").substring(0, 16);
  await db.insert(entitlements).values({
    id: newId,
    userId,
    targetType,
    targetId,
    sourceProductId: productId,
    grantedAt: new Date()
  });
  
  return { id: newId, userId, targetType, targetId };
}
