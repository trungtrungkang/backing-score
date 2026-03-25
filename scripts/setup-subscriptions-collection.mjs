#!/usr/bin/env node
/**
 * Migration: Create the `subscriptions` collection in Appwrite.
 * Run once: node scripts/setup-subscriptions-collection.mjs
 */
import { Client, Databases, ID } from "node-appwrite";
import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const db = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const COLLECTION_ID = "subscriptions";

async function main() {
  console.log("🔧 Creating subscriptions collection...");

  try {
    await db.createCollection(DATABASE_ID, COLLECTION_ID, "subscriptions", [
      // Any authenticated user can read their own sub; server can read/write all
    ]);
    console.log("✅ Collection created");
  } catch (e) {
    if (e.code === 409) {
      console.log("⚠️  Collection already exists, continuing with attributes...");
    } else {
      throw e;
    }
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const attrs = [
    { name: "userId", type: "string", size: 128, required: true },
    { name: "lemonSqueezyCustomerId", type: "string", size: 64, required: false },
    { name: "lemonSqueezySubscriptionId", type: "string", size: 64, required: true },
    { name: "lemonSqueezyOrderId", type: "string", size: 64, required: false },
    { name: "productId", type: "string", size: 64, required: false },
    { name: "variantId", type: "string", size: 64, required: false },
    { name: "status", type: "string", size: 32, required: true },
    { name: "currentPeriodEnd", type: "string", size: 64, required: false },
    { name: "cancelAtPeriodEnd", type: "boolean", required: false },
    { name: "planName", type: "string", size: 128, required: false },
    { name: "userEmail", type: "string", size: 256, required: false },
  ];

  for (const attr of attrs) {
    try {
      if (attr.type === "boolean") {
        await db.createBooleanAttribute(DATABASE_ID, COLLECTION_ID, attr.name, attr.required, false);
      } else {
        await db.createStringAttribute(DATABASE_ID, COLLECTION_ID, attr.name, attr.size, attr.required);
      }
      console.log(`  ✅ Attribute: ${attr.name}`);
    } catch (e) {
      if (e.code === 409) {
        console.log(`  ⚠️  Attribute ${attr.name} already exists`);
      } else {
        console.error(`  ❌ Attribute ${attr.name}:`, e.message);
      }
    }
    await sleep(1500);
  }

  // Create indexes
  console.log("🔧 Creating indexes...");
  await sleep(3000);

  try {
    await db.createIndex(DATABASE_ID, COLLECTION_ID, "idx_userId", "key", ["userId"]);
    console.log("  ✅ Index: idx_userId");
  } catch (e) {
    if (e.code === 409) console.log("  ⚠️  Index idx_userId already exists");
    else console.error("  ❌", e.message);
  }

  try {
    await db.createIndex(DATABASE_ID, COLLECTION_ID, "idx_lsSubId", "unique", ["lemonSqueezySubscriptionId"]);
    console.log("  ✅ Index: idx_lsSubId");
  } catch (e) {
    if (e.code === 409) console.log("  ⚠️  Index idx_lsSubId already exists");
    else console.error("  ❌", e.message);
  }

  console.log("\n🎉 Done! subscriptions collection is ready.");
}

main().catch(console.error);
