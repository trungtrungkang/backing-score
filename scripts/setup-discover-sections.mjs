#!/usr/bin/env node
/**
 * Migration: Add `featured`, `featuredAt`, `favoriteCount` attributes
 * to the `projects` collection for Discover page content categorization.
 *
 * Also creates indexes for featured and favoriteCount queries.
 * Safe to run multiple times — skips if attributes already exist.
 *
 * Run: node scripts/setup-discover-sections.mjs
 */
import "dotenv/config";
import { config } from "dotenv";
import { Client, Databases } from "node-appwrite";

config({ path: ".env.local", override: true });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";
const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECTS_COLLECTION_ID || "projects";

function requireEnv(name) {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    console.error(`Missing env: ${name}. Add it to .env or .env.local`);
    process.exit(1);
  }
  return v.trim();
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForAttribute(databases, key, maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const att = await databases.getAttribute(DATABASE_ID, COLLECTION_ID, key);
      if (att.status === "available") return true;
    } catch (_) { }
    await sleep(800);
  }
  return false;
}

async function createAttr(databases, createFn, name) {
  try {
    await createFn();
    console.log(`  ✅ Created: ${name}`);
    const ready = await waitForAttribute(databases, name);
    console.log(ready ? `  ✅ ${name} is available` : `  ⏳ ${name} still building`);
  } catch (e) {
    if (e.code === 409) {
      console.log(`  ⚠️  ${name} already exists — skipping`);
    } else {
      console.error(`  ❌ Failed to create ${name}:`, e.message);
      throw e;
    }
  }
}

async function createIdx(databases, key, attrs, orders) {
  try {
    await databases.createIndex(DATABASE_ID, COLLECTION_ID, key, "key", attrs, orders);
    console.log(`  ✅ Index created: ${key}`);
  } catch (e) {
    if (e.code === 409) {
      console.log(`  ⚠️  Index ${key} already exists — skipping`);
    } else {
      console.error(`  ❌ Failed to create index ${key}:`, e.message);
    }
  }
}

async function main() {
  requireEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT");
  requireEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID");
  requireEnv("APPWRITE_API_KEY");

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const databases = new Databases(client);

  console.log("🔧 Setting up Discover section attributes on projects collection...");
  console.log(`   Database: ${DATABASE_ID}`);
  console.log(`   Collection: ${COLLECTION_ID}\n`);

  // 1. featured (boolean, default false)
  await createAttr(databases, () =>
    databases.createBooleanAttribute(DATABASE_ID, COLLECTION_ID, "featured", false, false),
    "featured"
  );

  // 2. featuredAt (string/datetime, optional)
  await createAttr(databases, () =>
    databases.createDatetimeAttribute(DATABASE_ID, COLLECTION_ID, "featuredAt", false),
    "featuredAt"
  );

  // 3. favoriteCount (integer, default 0)
  await createAttr(databases, () =>
    databases.createIntegerAttribute(DATABASE_ID, COLLECTION_ID, "favoriteCount", false, 0, 0, undefined),
    "favoriteCount"
  );

  // Wait a moment for all attributes to finish building
  await sleep(2000);

  console.log("\n📇 Creating indexes...\n");

  // Index for listFeatured: featured=true, order by featuredAt DESC
  await createIdx(databases, "featured_idx", ["published", "featured", "featuredAt"], ["ASC", "ASC", "DESC"]);

  // Index for listMostFavorited: published=true, order by favoriteCount DESC
  await createIdx(databases, "favoriteCount_idx", ["published", "favoriteCount"], ["ASC", "DESC"]);

  console.log("\n🎉 Done! Discover section attributes are ready.");
  console.log("   You can now use /admin/featured to curate featured content.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
