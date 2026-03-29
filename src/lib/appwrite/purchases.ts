import { databases, ID, Query, Models, Permission, Role } from "./client";
import { 
  APPWRITE_DATABASE_ID as DATABASE_ID, 
  APPWRITE_PURCHASES_COLLECTION_ID as PURCHASES_COLLECTION,
  APPWRITE_ENTITLEMENTS_COLLECTION_ID as ENTITLEMENTS_COLLECTION 
} from "./constants";
import { getProductById } from "./products";

export interface PurchaseDoc extends Models.Document {
  orderId: string;
  userId: string;
  productId: string;
  amountCents: number;
  currency: string;
  createdAt: string;
}

export interface EntitlementDoc extends Models.Document {
  userId: string;
  targetType: "course" | "pdf" | "booking" | "project";
  targetId: string;
  grantedAt: string;
  sourceProductId: string;
}

// ==============
// Webhook Handlers
// ==============

/**
 * Lưu lịch sử giao dịch từ Lemon Squeezy (Chỉ dùng cho sổ sách Backend)
 */
export async function logPurchase(
  orderId: string,
  userId: string,
  productId: string,
  amountCents: number,
  currency: string
): Promise<PurchaseDoc> {
  const doc = await databases.createDocument(
    DATABASE_ID,
    PURCHASES_COLLECTION,
    ID.unique(),
    {
      orderId,
      userId,
      productId,
      amountCents,
      currency,
      createdAt: new Date().toISOString(),
    },
    // Purchase receipt should be viewable by the user and admins
    [
      Permission.read(Role.user(userId)),
      Permission.read(Role.label("admin"))
    ]
  );
  return doc as unknown as PurchaseDoc;
}

/**
 * Cấp quyền truy cập vĩnh viễn cho User dựa trên Product đã mua
 * Hàm này dùng để gọi từ Webhook sau khi logPurchase thành công.
 */
export async function grantEntitlement(
  userId: string,
  productId: string
): Promise<EntitlementDoc | null> {
  const product = await getProductById(productId);
  if (!product) return null;

  // Tránh cấp quyền trùng lập
  const existing = await databases.listDocuments(DATABASE_ID, ENTITLEMENTS_COLLECTION, [
    Query.equal("userId", userId),
    Query.equal("targetId", product.targetId),
    Query.equal("targetType", product.targetType),
  ]);

  if (existing.documents.length > 0) {
    return existing.documents[0] as unknown as EntitlementDoc;
  }

  const doc = await databases.createDocument(
    DATABASE_ID,
    ENTITLEMENTS_COLLECTION,
    ID.unique(),
    {
      userId,
      targetType: product.targetType,
      targetId: product.targetId,
      sourceProductId: productId,
      grantedAt: new Date().toISOString(),
    },
    [
      Permission.read(Role.user(userId)),
      Permission.read(Role.label("admin")),
      Permission.delete(Role.label("admin")) // In case of refund
    ]
  );

  return doc as unknown as EntitlementDoc;
}

// ==============
// Access Checkers (Frontend/API usage)
// ==============

/**
 * Kiểm tra xem User có quyền truy cập món đồ này không
 */
export async function checkEntitlement(
  userId: string, 
  targetType: "course" | "pdf" | "booking" | "project", 
  targetId: string
): Promise<boolean> {
  try {
    const res = await databases.listDocuments(DATABASE_ID, ENTITLEMENTS_COLLECTION, [
      Query.equal("userId", userId),
      Query.equal("targetType", targetType),
      Query.equal("targetId", targetId),
      Query.limit(1)
    ]);
    return res.documents.length > 0;
  } catch {
    return false;
  }
}

/**
 * Lịch sử các món đồ đã mua của User (My Purchases)
 */
export async function getUserEntitlements(userId: string): Promise<EntitlementDoc[]> {
  try {
    const res = await databases.listDocuments(DATABASE_ID, ENTITLEMENTS_COLLECTION, [
      Query.equal("userId", userId),
      Query.orderDesc("$createdAt"),
      Query.limit(100)
    ]);
    return res.documents as unknown as EntitlementDoc[];
  } catch (err) {
    return [];
  }
}
