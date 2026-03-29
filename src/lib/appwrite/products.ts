import { databases, ID, Query, Models } from "./client";
import { APPWRITE_DATABASE_ID as DATABASE_ID, APPWRITE_PRODUCTS_COLLECTION_ID as PRODUCTS_COLLECTION } from "./constants";
import { buildStandardPermissions } from "./permissions";

export interface ProductDoc extends Models.Document {
  creatorId: string;
  targetType: "course" | "pdf" | "booking" | "project";
  targetId: string;
  priceCents: number;
  lemonSqueezyVariantId: string;
  status: "draft" | "active" | "archived";
}

// ==============
// Getters
// ==============
export async function getProductById(productId: string): Promise<ProductDoc | null> {
  try {
    const doc = await databases.getDocument(DATABASE_ID, PRODUCTS_COLLECTION, productId);
    return doc as unknown as ProductDoc;
  } catch (err) {
    return null;
  }
}

export async function getProductByVariantId(variantId: string): Promise<ProductDoc | null> {
  try {
    const res = await databases.listDocuments(DATABASE_ID, PRODUCTS_COLLECTION, [
      Query.equal("lemonSqueezyVariantId", variantId),
      Query.limit(1)
    ]);
    if (res.documents.length === 0) return null;
    return res.documents[0] as unknown as ProductDoc;
  } catch (err) {
    return null;
  }
}

// ==============
// Creator Actions
// ==============
export async function createProduct(
  creatorId: string, 
  targetType: "course" | "pdf" | "booking" | "project",
  targetId: string,
  priceCents: number,
  lemonSqueezyVariantId: string,
  status: "draft" | "active" | "archived" = "active"
): Promise<ProductDoc> {
  const doc = await databases.createDocument(
    DATABASE_ID, 
    PRODUCTS_COLLECTION, 
    ID.unique(), 
    {
      creatorId,
      targetType,
      targetId,
      priceCents,
      lemonSqueezyVariantId,
      status
    },
    buildStandardPermissions(creatorId) // Chỉ người tạo sửa được, nhưng public đọc được nếu role cho phép
  );
  return doc as unknown as ProductDoc;
}

export async function updateProduct(
  productId: string, 
  updates: Partial<Pick<ProductDoc, "priceCents" | "lemonSqueezyVariantId" | "status">>
): Promise<ProductDoc> {
  const doc = await databases.updateDocument(DATABASE_ID, PRODUCTS_COLLECTION, productId, updates);
  return doc as unknown as ProductDoc;
}
