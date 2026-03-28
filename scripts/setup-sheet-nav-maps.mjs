#!/usr/bin/env node
/**
 * Setup Appwrite collection: sheet_nav_maps
 * Used for storing Navigation Maps (Bookmarks + Reading Sequence) for Sheet Music PDFs
 *
 * Usage: node scripts/setup-sheet-nav-maps.mjs
 */
import "dotenv/config";
import { config } from "dotenv";
import { Client, Databases, Permission, Role, IndexType, OrderBy } from "node-appwrite";

config({ path: ".env.local", override: true });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";

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

async function waitForAttribute(databases, databaseId, collectionId, key, maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const att = await databases.getAttribute({ databaseId, collectionId, key });
      if (att.status === "available") return;
    } catch (_) { }
    await sleep(800);
  }
}

async function createAttributes(databases, collectionId, attributes) {
  for (const attr of attributes) {
    const { key, type, required, array } = attr;
    try {
      if (type === "string") {
        const size = attr.size ?? 256;
        await databases.createStringAttribute({ databaseId: DATABASE_ID, collectionId, key, size, required, array });
      } else if (type === "integer") {
        await databases.createIntegerAttribute({ databaseId: DATABASE_ID, collectionId, key, required, array, ...(required ? {} : { xdefault: 0 }) });
      } else if (type === "boolean") {
        await databases.createBooleanAttribute({ databaseId: DATABASE_ID, collectionId, key, required, array, ...(required ? {} : { xdefault: false }) });
      } else if (type === "datetime") {
        await databases.createDatetimeAttribute({ databaseId: DATABASE_ID, collectionId, key, required, array });
      } else if (type === "float") {
        await databases.createFloatAttribute({ databaseId: DATABASE_ID, collectionId, key, required, array, ...(required ? {} : { xdefault: 0 }) });
      }
      console.log(`  Attribute created: ${collectionId}.${key}`);
      await waitForAttribute(databases, DATABASE_ID, collectionId, key);
      await sleep(500);
    } catch (e) {
      if (e.code === 409) {
        console.log(`  Attribute already exists: ${collectionId}.${key}`);
      } else throw e;
    }
  }
}

async function main() {
  requireEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT");
  requireEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID");
  requireEnv("APPWRITE_API_KEY");

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const databases = new Databases(client);

  console.log("🗺️ Setting up Navigation Maps Collection...\n");

  // ==========================================
  // 1. Create sheet_nav_maps collection
  // ==========================================

  const permissions = [
    Permission.create(Role.users()),
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin")),
    // Data is public to authenticated users so students can read teacher's map
    Permission.read(Role.users()),
  ];

  try {
    await databases.createCollection({
      databaseId: DATABASE_ID,
      collectionId: "sheet_nav_maps",
      name: "Sheet Nav Maps",
      permissions,
      documentSecurity: true,
    });
    console.log("✅ Created collection: sheet_nav_maps");
  } catch (e) {
    if (e.code === 409) {
      console.log("⏭️  Collection already exists: sheet_nav_maps");
      await databases.updateCollection({
        databaseId: DATABASE_ID,
        collectionId: "sheet_nav_maps",
        name: "Sheet Nav Maps",
        permissions,
        documentSecurity: true,
        enabled: true,
      });
    } else throw e;
  }

  // ==========================================
  // 2. Create Attributes for sheet_nav_maps
  // ==========================================

  console.log("\nCreating attributes for sheet_nav_maps...");
  // Bookmarks and sequence will be stored as stringified JSON because Appwrite limits string arrays/objects
  // Max size 65535 is large enough for thousands of bookmarks/sequences
  await createAttributes(databases, "sheet_nav_maps", [
    { key: "sheetMusicId", type: "string", required: true, size: 256 },
    { key: "userId", type: "string", required: true, size: 256 },
    { key: "bookmarks", type: "string", required: true, size: 65535 },
    { key: "sequence", type: "string", required: true, size: 65535 },
  ]);

  // ==========================================
  // 3. Create Indexes
  // ==========================================

  console.log("\nCreating indexes...");
  const indexes = [
    {
      collection: "sheet_nav_maps",
      key: "idx_sheet",
      type: IndexType.Key,
      attributes: ["sheetMusicId"],
      orders: [],
    },
    {
      collection: "sheet_nav_maps",
      key: "idx_user",
      type: IndexType.Key,
      attributes: ["userId"],
      orders: [],
    },
  ];

  for (const idx of indexes) {
    try {
      await databases.createIndex({
        databaseId: DATABASE_ID,
        collectionId: idx.collection,
        key: idx.key,
        type: idx.type,
        attributes: idx.attributes,
        orders: idx.orders,
      });
      console.log(`  ✅ Index created: ${idx.collection}.${idx.key}`);
    } catch (e) {
      if (e.code === 409) console.log(`  ⏭️  Index already exists: ${idx.collection}.${idx.key}`);
      else throw e;
    }
    await sleep(500);
  }

  console.log("\n🎉 Sheet Nav Maps Setup Complete!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
