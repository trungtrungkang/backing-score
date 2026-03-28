#!/usr/bin/env node
/**
 * Setup Appwrite collections and bucket for PDF Sheet Music feature.
 *
 * Creates:
 *   - Collection: sheet_music (with attributes + indexes)
 *   - Collection: sheet_music_folders (with attributes + indexes)
 *   - Bucket: sheet_pdfs (20MB max, PDF only)
 *
 * Usage:
 *   node scripts/setup-sheet-music.mjs
 *
 * Prerequisites:
 *   - .env.local with APPWRITE_API_KEY, NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID
 */
import "dotenv/config";
import { config } from "dotenv";
import { Client, Databases, Storage, Permission, Role, IndexType, OrderBy } from "node-appwrite";

config({ path: ".env.local", override: true });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error("❌ Missing env: NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, or APPWRITE_API_KEY");
  process.exit(1);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

async function createCollectionSafe(databases, databaseId, collectionId, name, permissions) {
  try {
    await databases.createCollection({
      databaseId,
      collectionId,
      name,
      permissions,
      documentSecurity: true,
    });
    console.log(`✅ Created collection: ${collectionId}`);
  } catch (e) {
    if (e.code === 409) {
      console.log(`⏭️  Collection already exists: ${collectionId}`);
      await databases.updateCollection({
        databaseId,
        collectionId,
        name,
        permissions,
        documentSecurity: true,
        enabled: true,
      });
    } else throw e;
  }
}

async function createAttributesSafe(databases, databaseId, collectionId, attrs) {
  for (const attr of attrs) {
    try {
      if (attr.type === "string") {
        await databases.createStringAttribute({
          databaseId, collectionId, key: attr.key, size: attr.size, required: attr.required,
        });
      } else if (attr.type === "integer") {
        await databases.createIntegerAttribute({
          databaseId, collectionId, key: attr.key, required: attr.required, xdefault: attr.xdefault ?? null,
        });
      } else if (attr.type === "boolean") {
        await databases.createBooleanAttribute({
          databaseId, collectionId, key: attr.key, required: attr.required, xdefault: attr.xdefault ?? null,
        });
      } else if (attr.type === "datetime") {
        await databases.createDatetimeAttribute({
          databaseId, collectionId, key: attr.key, required: attr.required,
        });
      }
      console.log(`  ✅ Attribute: ${collectionId}.${attr.key}`);
      await waitForAttribute(databases, databaseId, collectionId, attr.key);
      await sleep(500);
    } catch (e) {
      if (e.code === 409) console.log(`  ⏭️  Already exists: ${collectionId}.${attr.key}`);
      else throw e;
    }
  }
}

async function createIndexesSafe(databases, databaseId, indexes) {
  for (const idx of indexes) {
    try {
      await databases.createIndex({
        databaseId,
        collectionId: idx.collection,
        key: idx.key,
        type: idx.type,
        attributes: idx.attributes,
        orders: idx.orders || [],
      });
      console.log(`  ✅ Index: ${idx.collection}.${idx.key}`);
    } catch (e) {
      if (e.code === 409) console.log(`  ⏭️  Already exists: ${idx.collection}.${idx.key}`);
      else throw e;
    }
    await sleep(500);
  }
}

async function main() {
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const databases = new Databases(client);
  const storageClient = new Storage(client);

  console.log("📄 Setting up PDF Sheet Music...\n");

  const permissions = [
    Permission.create(Role.users()),
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin")),
    Permission.read(Role.label("admin")),
  ];

  // ─── 1. Collection: sheet_music ────────────────────────────

  console.log("── Collection: sheet_music ──");
  await createCollectionSafe(databases, DATABASE_ID, "sheet_music", "Sheet Music", permissions);

  await createAttributesSafe(databases, DATABASE_ID, "sheet_music", [
    { key: "userId",       type: "string",   required: true,  size: 256 },
    { key: "title",        type: "string",   required: true,  size: 500 },
    { key: "fileId",       type: "string",   required: true,  size: 256 },
    { key: "fileSize",     type: "integer",  required: true },
    { key: "pageCount",    type: "integer",  required: true },
    { key: "composer",     type: "string",   required: false, size: 200 },
    { key: "instrument",   type: "string",   required: false, size: 100 },
    { key: "folderId",     type: "string",   required: false, size: 256 },
    { key: "lastOpenedAt", type: "datetime", required: false },
    { key: "favorite",     type: "boolean",  required: false, xdefault: false },
  ]);

  // ─── 2. Collection: sheet_music_folders ────────────────────

  console.log("\n── Collection: sheet_music_folders ──");
  await createCollectionSafe(databases, DATABASE_ID, "sheet_music_folders", "Sheet Music Folders", permissions);

  await createAttributesSafe(databases, DATABASE_ID, "sheet_music_folders", [
    { key: "userId",         type: "string",  required: true,  size: 256 },
    { key: "name",           type: "string",  required: true,  size: 200 },
    { key: "order",          type: "integer", required: false, xdefault: 0 },
    { key: "parentFolderId", type: "string",  required: false, size: 256 },
  ]);

  // ─── 3. Indexes ────────────────────────────────────────────

  console.log("\n── Indexes ──");
  await createIndexesSafe(databases, DATABASE_ID, [
    { collection: "sheet_music", key: "idx_user",      type: IndexType.Key, attributes: ["userId"],              orders: [OrderBy.Asc] },
    { collection: "sheet_music", key: "idx_folder",    type: IndexType.Key, attributes: ["userId", "folderId"],  orders: [OrderBy.Asc, OrderBy.Asc] },
    { collection: "sheet_music", key: "idx_favorite",  type: IndexType.Key, attributes: ["userId", "favorite"],  orders: [OrderBy.Asc, OrderBy.Asc] },
    { collection: "sheet_music", key: "idx_opened",    type: IndexType.Key, attributes: ["userId", "lastOpenedAt"], orders: [OrderBy.Asc, OrderBy.Desc] },
    { collection: "sheet_music", key: "idx_title",     type: IndexType.Fulltext, attributes: ["title"] },
    { collection: "sheet_music_folders", key: "idx_user",   type: IndexType.Key, attributes: ["userId", "order"], orders: [OrderBy.Asc, OrderBy.Asc] },
    { collection: "sheet_music_folders", key: "idx_parent", type: IndexType.Key, attributes: ["userId", "parentFolderId"], orders: [] },
  ]);

  // ─── 4. Storage Bucket: sheet_pdfs ─────────────────────────

  console.log("\n── Bucket: sheet_pdfs ──");
  try {
    await storageClient.createBucket({
      bucketId: "sheet_pdfs",
      name: "Sheet Music PDFs",
      permissions: [
        Permission.create(Role.users()),
        Permission.read(Role.users()),
      ],
      fileSecurity: true,
      maximumFileSize: 20 * 1024 * 1024, // 20MB
      allowedFileExtensions: ["pdf"],
    });
    console.log("✅ Created bucket: sheet_pdfs (20MB max, PDF only)");
  } catch (e) {
    if (e.code === 409) {
      console.log("⏭️  Bucket already exists: sheet_pdfs");
    } else throw e;
  }

  console.log("\n🎉 PDF Sheet Music Setup Complete!");
  console.log("\nResources created:");
  console.log("  • Collection: sheet_music (10 attributes, 5 indexes)");
  console.log("  • Collection: sheet_music_folders (4 attributes, 2 indexes)");
  console.log("  • Bucket: sheet_pdfs (20MB max, PDF only)");
}

main().catch(err => { console.error(err); process.exit(1); });
