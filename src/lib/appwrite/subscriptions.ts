import { Client, Databases, Query, ID, Permission, Role } from "node-appwrite";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";
const SUBSCRIPTIONS_COLLECTION_ID = "subscriptions";

function getServerClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(client);
}

export interface SubscriptionDoc {
  $id: string;
  userId: string;
  lemonSqueezyCustomerId: string;
  lemonSqueezySubscriptionId: string;
  lemonSqueezyOrderId: string;
  productId: string;
  variantId: string;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  planName: string;
  userEmail: string;
}

/**
 * Get the active subscription for a user.
 */
export async function getActiveSubscription(
  userId: string,
): Promise<SubscriptionDoc | null> {
  try {
    const db = getServerClient();
    const result = await db.listDocuments(DB, SUBSCRIPTIONS_COLLECTION_ID, [
      Query.equal("userId", userId),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);

    if (result.documents.length === 0) return null;
    const doc = result.documents[0] as unknown as SubscriptionDoc;

    if (doc.status === "active" || doc.status === "on_trial" || doc.status === "past_due") {
      if (doc.currentPeriodEnd) {
        const endDate = new Date(doc.currentPeriodEnd);
        if (endDate > new Date()) return doc;
        // past_due gets a grace period
        if (doc.status === "past_due") return doc;
      }
      return doc;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a user has premium access.
 */
export async function isUserPremium(userId: string): Promise<boolean> {
  const sub = await getActiveSubscription(userId);
  return sub !== null;
}

/**
 * Find subscription by LemonSqueezy subscription ID.
 */
export async function findByLSSubscriptionId(
  lsSubscriptionId: string,
): Promise<SubscriptionDoc | null> {
  try {
    const db = getServerClient();
    const result = await db.listDocuments(DB, SUBSCRIPTIONS_COLLECTION_ID, [
      Query.equal("lemonSqueezySubscriptionId", lsSubscriptionId),
      Query.limit(1),
    ]);
    if (result.documents.length === 0) return null;
    return result.documents[0] as unknown as SubscriptionDoc;
  } catch {
    return null;
  }
}

/**
 * Create or update a subscription record from a webhook event.
 */
export async function upsertSubscription(data: {
  userId: string;
  lemonSqueezyCustomerId?: string;
  lemonSqueezySubscriptionId: string;
  lemonSqueezyOrderId?: string;
  productId?: string;
  variantId?: string;
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  planName?: string;
  userEmail?: string;
}): Promise<SubscriptionDoc> {
  const db = getServerClient();
  const existing = await findByLSSubscriptionId(data.lemonSqueezySubscriptionId);

  const payload = {
    userId: data.userId,
    lemonSqueezyCustomerId: data.lemonSqueezyCustomerId || "",
    lemonSqueezySubscriptionId: data.lemonSqueezySubscriptionId,
    lemonSqueezyOrderId: data.lemonSqueezyOrderId || "",
    productId: data.productId || "",
    variantId: data.variantId || "",
    status: data.status,
    currentPeriodEnd: data.currentPeriodEnd || "",
    cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
    planName: data.planName || "",
    userEmail: data.userEmail || "",
  };

  if (existing) {
    const updated = await db.updateDocument(
      DB,
      SUBSCRIPTIONS_COLLECTION_ID,
      existing.$id,
      payload,
    );
    return updated as unknown as SubscriptionDoc;
  } else {
    const created = await db.createDocument(
      DB,
      SUBSCRIPTIONS_COLLECTION_ID,
      ID.unique(),
      payload,
      [Permission.read(Role.any())],
    );
    return created as unknown as SubscriptionDoc;
  }
}
