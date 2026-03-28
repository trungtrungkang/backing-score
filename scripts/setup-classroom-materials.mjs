#!/usr/bin/env node
/**
 * Setup Appwrite collection: classroom_materials
 * Also adds sheetMusicId attribute to existing assignments collection.
 *
 * Usage: node scripts/setup-classroom-materials.mjs
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

  console.log("📄 Setting up Classroom Materials Collection...\n");

  // ==========================================
  // 1. Create classroom_materials collection
  // ==========================================

  const permissions = [
    Permission.create(Role.users()),
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin")),
    Permission.read(Role.label("admin")),
  ];

  try {
    await databases.createCollection({
      databaseId: DATABASE_ID,
      collectionId: "classroom_materials",
      name: "Classroom Materials",
      permissions,
      documentSecurity: true,
    });
    console.log("✅ Created collection: classroom_materials");
  } catch (e) {
    if (e.code === 409) {
      console.log("⏭️  Collection already exists: classroom_materials");
      await databases.updateCollection({
        databaseId: DATABASE_ID,
        collectionId: "classroom_materials",
        name: "Classroom Materials",
        permissions,
        documentSecurity: true,
        enabled: true,
      });
    } else throw e;
  }

  // ==========================================
  // 2. Create Attributes for classroom_materials
  // ==========================================

  console.log("\nCreating attributes for classroom_materials...");
  await createAttributes(databases, "classroom_materials", [
    { key: "classroomId", type: "string", required: true, size: 256 },
    { key: "sheetMusicId", type: "string", required: true, size: 256 },
    { key: "sharedById", type: "string", required: true, size: 256 },
    { key: "note", type: "string", required: false, size: 1024 },
  ]);

  // ==========================================
  // 3. Add sheetMusicId attribute to assignments
  // ==========================================

  console.log("\nAdding sheetMusicId to assignments...");
  await createAttributes(databases, "assignments", [
    { key: "sheetMusicId", type: "string", required: false, size: 256 },
  ]);

  // ==========================================
  // 4. Create Indexes
  // ==========================================

  console.log("\nCreating indexes...");
  const indexes = [
    {
      collection: "classroom_materials",
      key: "idx_classroom",
      type: IndexType.Key,
      attributes: ["classroomId", "$createdAt"],
      orders: [OrderBy.Asc, OrderBy.Desc],
    },
    {
      collection: "classroom_materials",
      key: "idx_classroom_sheet",
      type: IndexType.Key,
      attributes: ["classroomId", "sheetMusicId"],
      orders: [],
    },
    {
      collection: "classroom_materials",
      key: "idx_shared_by",
      type: IndexType.Key,
      attributes: ["sharedById"],
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

  console.log("\n🎉 Classroom Materials Setup Complete!");
  console.log("   New collection: classroom_materials (classroomId, sheetMusicId, sharedById, note)");
  console.log("   Updated: assignments.sheetMusicId");
  console.log("   Indexes: 3");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
