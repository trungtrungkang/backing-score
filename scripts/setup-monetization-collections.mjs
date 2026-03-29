#!/usr/bin/env node
/**
 * Migration: Create the Monetization Collections in Appwrite.
 * Handles `products`, `purchases`, and `entitlements`.
 * Run once: node scripts/setup-monetization-collections.mjs
 */
import { Client, Databases, Permission, Role } from "node-appwrite";
import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const db = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;

const COLLECTION_PRODUCTS = "products";
const COLLECTION_PURCHASES = "purchases";
const COLLECTION_ENTITLEMENTS = "entitlements";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function createCollectionSafe(collectionId, name, permissions) {
  try {
    await db.createCollection(DATABASE_ID, collectionId, name, permissions);
    console.log(`✅ Collection created: ${collectionId}`);
    return true;
  } catch (e) {
    if (e.code === 409) {
      console.log(`⚠️  Collection already exists: ${collectionId}`);
      return false;
    } else {
      throw e;
    }
  }
}

async function createAttributeSafe(collectionId, attr, type) {
  try {
    if (type === "string") {
      await db.createStringAttribute(DATABASE_ID, collectionId, attr.name, attr.size, attr.required);
    } else if (type === "integer") {
      await db.createIntegerAttribute(DATABASE_ID, collectionId, attr.name, attr.required);
    } else if (type === "float") {
      await db.createFloatAttribute(DATABASE_ID, collectionId, attr.name, attr.required);
    } else if (type === "boolean") {
      await db.createBooleanAttribute(DATABASE_ID, collectionId, attr.name, attr.required);
    }
    console.log(`  ✅ Attribute: ${attr.name} [${collectionId}]`);
  } catch (e) {
    if (e.code === 409) {
      console.log(`  ⚠️  Attribute ${attr.name} already exists`);
    } else {
      console.error(`  ❌ Attribute ${attr.name}:`, e.message);
    }
  }
  await sleep(1500); // Prevent rate limits
}

async function createIndexSafe(collectionId, name, type, attrs) {
  try {
    await db.createIndex(DATABASE_ID, collectionId, name, type, attrs);
    console.log(`  ✅ Index: ${name} [${collectionId}]`);
  } catch (e) {
    if (e.code === 409) {
      console.log(`  ⚠️  Index ${name} already exists`);
    } else {
      console.error(`  ❌ Index ${name}:`, e.message);
    }
  }
  await sleep(2000);
}

async function main() {
  console.log("🔧 Starting Monetization Database Setup...");

  // permissions: product catalog needs to be publicly readable
  await createCollectionSafe(COLLECTION_PRODUCTS, "products", [
    Permission.read(Role.any()), // Public can view products
  ]);

  // purchases: only user and admin can see
  await createCollectionSafe(COLLECTION_PURCHASES, "purchases", []);

  // entitlements: only user and admin
  await createCollectionSafe(COLLECTION_ENTITLEMENTS, "entitlements", []);

  console.log("\n--- Creating Attributes ---");

  // 1. PRODUCTS
  const productAttrs = [
    { name: "creatorId", type: "string", size: 64, required: true },
    { name: "targetType", type: "string", size: 32, required: true }, // course, pdf, booking
    { name: "targetId", type: "string", size: 64, required: true },
    { name: "priceCents", type: "integer", required: true },
    { name: "lemonSqueezyVariantId", type: "string", size: 64, required: true },
    { name: "status", type: "string", size: 32, required: true }, // draft, active, archived
  ];
  for (const attr of productAttrs) await createAttributeSafe(COLLECTION_PRODUCTS, attr, attr.type);

  // 2. PURCHASES
  const purchaseAttrs = [
    { name: "orderId", type: "string", size: 64, required: true }, // LemonSqueezy order_id
    { name: "userId", type: "string", size: 64, required: true },
    { name: "productId", type: "string", size: 64, required: true },
    { name: "amountCents", type: "integer", required: true },
    { name: "currency", type: "string", size: 16, required: true },
    { name: "createdAt", type: "string", size: 64, required: true },
  ];
  for (const attr of purchaseAttrs) await createAttributeSafe(COLLECTION_PURCHASES, attr, attr.type);

  // 3. ENTITLEMENTS
  const entitlementAttrs = [
    { name: "userId", type: "string", size: 64, required: true },
    { name: "targetType", type: "string", size: 32, required: true },
    { name: "targetId", type: "string", size: 64, required: true },
    { name: "grantedAt", type: "string", size: 64, required: true },
    { name: "sourceProductId", type: "string", size: 64, required: true },
  ];
  for (const attr of entitlementAttrs) await createAttributeSafe(COLLECTION_ENTITLEMENTS, attr, attr.type);

  console.log("\n--- Creating Indexes ---");
  await sleep(3000); // Give attributes time to propagate

  // Products indexes
  await createIndexSafe(COLLECTION_PRODUCTS, "idx_lsVariantId", "key", ["lemonSqueezyVariantId"]);
  await createIndexSafe(COLLECTION_PRODUCTS, "idx_target", "key", ["targetType", "targetId"]);

  // Purchases indexes
  await createIndexSafe(COLLECTION_PURCHASES, "idx_userId", "key", ["userId"]);

  // Entitlements indexes
  await createIndexSafe(COLLECTION_ENTITLEMENTS, "idx_userId_target", "key", ["userId", "targetType", "targetId"]);

  console.log("\n🎉 Done! Monetization collections are ready.");
}

main().catch(console.error);
