#!/usr/bin/env node
/**
 * Add project_folders collection + folderId attribute to projects.
 * Run after the main setup-classroom-collections.mjs script.
 */
import "dotenv/config";
import { config } from "dotenv";
import { Client, Databases, Permission, Role, IndexType, OrderBy } from "node-appwrite";

config({ path: ".env.local", override: true });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error("Missing env: NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, or APPWRITE_API_KEY");
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

async function main() {
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const databases = new Databases(client);

  console.log("📁 Setting up Project Folders...\n");

  // 1. Create project_folders collection
  const permissions = [
    Permission.create(Role.users()),
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin")),
    Permission.read(Role.label("admin")),
  ];

  try {
    await databases.createCollection({
      databaseId: DATABASE_ID,
      collectionId: "project_folders",
      name: "Project Folders",
      permissions,
      documentSecurity: true,
    });
    console.log("✅ Created collection: project_folders");
  } catch (e) {
    if (e.code === 409) {
      console.log("⏭️  Collection already exists: project_folders");
      await databases.updateCollection({
        databaseId: DATABASE_ID,
        collectionId: "project_folders",
        name: "Project Folders",
        permissions,
        documentSecurity: true,
        enabled: true,
      });
    } else throw e;
  }

  // 2. Create attributes for project_folders
  console.log("\nCreating attributes for project_folders...");
  const attrs = [
    { key: "userId", type: "string", required: true, size: 256 },
    { key: "name", type: "string", required: true, size: 512 },
    { key: "order", type: "integer", required: false },
    { key: "parentFolderId", type: "string", required: false, size: 256 },
  ];
  for (const attr of attrs) {
    try {
      if (attr.type === "string") {
        await databases.createStringAttribute({ databaseId: DATABASE_ID, collectionId: "project_folders", key: attr.key, size: attr.size, required: attr.required });
      } else if (attr.type === "integer") {
        await databases.createIntegerAttribute({ databaseId: DATABASE_ID, collectionId: "project_folders", key: attr.key, required: attr.required, xdefault: 0 });
      }
      console.log(`  Attribute created: project_folders.${attr.key}`);
      await waitForAttribute(databases, DATABASE_ID, "project_folders", attr.key);
      await sleep(500);
    } catch (e) {
      if (e.code === 409) console.log(`  Attribute already exists: project_folders.${attr.key}`);
      else throw e;
    }
  }

  // 3. Add folderId attribute to projects collection
  console.log("\nAdding folderId to projects collection...");
  try {
    await databases.createStringAttribute({
      databaseId: DATABASE_ID,
      collectionId: "projects",
      key: "folderId",
      size: 256,
      required: false,
    });
    console.log("  Attribute created: projects.folderId");
    await waitForAttribute(databases, DATABASE_ID, "projects", "folderId");
  } catch (e) {
    if (e.code === 409) console.log("  Attribute already exists: projects.folderId");
    else throw e;
  }

  // 4. Create indexes
  console.log("\nCreating indexes...");
  const indexes = [
    { collection: "project_folders", key: "idx_user", type: IndexType.Key, attributes: ["userId", "order"], orders: [OrderBy.Asc, OrderBy.Asc] },
    { collection: "project_folders", key: "idx_parent", type: IndexType.Key, attributes: ["userId", "parentFolderId"], orders: [] },
    { collection: "projects", key: "idx_folder", type: IndexType.Key, attributes: ["folderId"], orders: [] },
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

  console.log("\n🎉 Project Folders Setup Complete!");
}

main().catch(err => { console.error(err); process.exit(1); });
