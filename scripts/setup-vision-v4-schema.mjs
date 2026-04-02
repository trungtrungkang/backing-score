#!/usr/bin/env node
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

/**
 * Idempotent Attribute Creation
 * This handles creating attributes on an existing collection safely.
 */
async function createAttributesIdempotent(databases, collectionId, attributes) {
  for (const attr of attributes) {
    const { key, type, required, array } = attr;
    try {
      if (type === "string") {
        const size = attr.size ?? 256;
        const xdefault = attr.xdefault;
        if (xdefault !== undefined) {
            await databases.createStringAttribute({ databaseId: DATABASE_ID, collectionId, key, size, required, array, xdefault });
        } else {
            await databases.createStringAttribute({ databaseId: DATABASE_ID, collectionId, key, size, required, array });
        }
      } else if (type === "integer") {
        const xdefault = attr.xdefault;
        if (xdefault !== undefined) {
             await databases.createIntegerAttribute({ databaseId: DATABASE_ID, collectionId, key, required, array, xdefault });
        } else {
            await databases.createIntegerAttribute({ databaseId: DATABASE_ID, collectionId, key, required, array, ...(required ? {} : { xdefault: 0 }) });
        }
      } else if (type === "datetime") {
        await databases.createDatetimeAttribute({ databaseId: DATABASE_ID, collectionId, key, required, array });
      } else if (type === "boolean") {
        const xdefault = attr.xdefault;
        if (xdefault !== undefined) {
          await databases.createBooleanAttribute({ databaseId: DATABASE_ID, collectionId, key, required, array, xdefault });
        } else {
          await databases.createBooleanAttribute({ databaseId: DATABASE_ID, collectionId, key, required, array });
        }
      }
      console.log(`  [+] Attribute created: ${collectionId}.${key}`);
      await waitForAttribute(databases, DATABASE_ID, collectionId, key);
      await sleep(1000);
    } catch (e) {
      if (e.code === 409) {
        console.log(`  [v] Attribute already exists: ${collectionId}.${key} - Pass`);
      } else {
        console.error(`  [x] Error creating attribute ${collectionId}.${key}:`, e.message);
        throw e;
      }
    }
  }
}

/**
 * Idempotent Collection Creation
 */
async function createCollectionIdempotent(databases, col) {
  try {
    await databases.createCollection({
      databaseId: DATABASE_ID,
      collectionId: col.id,
      name: col.name,
      permissions: col.permissions || [
        Permission.create(Role.users()),
        Permission.update(Role.label("admin")),
        Permission.delete(Role.label("admin")),
        Permission.read(Role.users()), // Assuming general read for invites is safe if document security is on
      ],
      documentSecurity: true,
    });
    console.log(`\n✅ Created collection: ${col.id}`);
    await sleep(1000);
  } catch (e) {
    if (e.code === 409) {
      console.log(`\n⏭️  Collection already exists (409): ${col.id}`);
      // Try to re-apply permissions/documentSecurity just in case it was created differently
      try {
        await databases.updateCollection({
          databaseId: DATABASE_ID,
          collectionId: col.id,
          name: col.name,
          permissions: col.permissions || [
            Permission.create(Role.users()),
            Permission.update(Role.label("admin")),
            Permission.delete(Role.label("admin")),
            Permission.read(Role.users()),
          ],
          documentSecurity: true,
          enabled: true,
        });
      } catch (err) {
         console.log(`  [!] Could not update existing collection settings: ${err.message}`);
      }
    } else {
      console.error(`\n❌ Error creating collection ${col.id}: ${e.message}`);
      throw e;
    }
  }
}

/**
 * Idempotent Index Creation
 */
async function createIndexIdempotent(databases, idx) {
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
      if (e.code === 409) {
         console.log(`  ⏭️  Index already exists: ${idx.collection}.${idx.key}`);
      }
      else {
        console.error(`  ❌ Error creating index ${idx.collection}.${idx.key}:`, e.message);
        throw e;
      }
    }
    await sleep(500);
}

async function main() {
  requireEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT");
  requireEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID");
  requireEnv("APPWRITE_API_KEY");

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const databases = new Databases(client);

  console.log("🚀 Migrating Appwrite Schema to Vision V4 (LMS Core)...");

  // ==========================================
  // 1. UPDATE EXISTING COLLECTIONS
  // ==========================================
  console.log("\n--- UPDATING EXISTING CLASSROOMS ---");
  await createAttributesIdempotent(databases, "classrooms", [
    { key: "courseId", type: "string", required: false, size: 256 }, // Inherit curriculum from course
  ]);

  console.log("\n--- UPDATING EXISTING COURSES ---");
  await createAttributesIdempotent(databases, "courses", [
    { key: "courseCode", type: "string", required: false, size: 10 }, // Make false first for backward compatibility
    { key: "visibility", type: "string", required: false, size: 32, xdefault: "private" },
  ]);

  console.log("\n--- UPDATING EXISTING ENROLLMENTS ---");
  await createAttributesIdempotent(databases, "enrollments", [
    { key: "status", type: "string", required: false, size: 32, xdefault: "active" }, // pending | active | removed
    { key: "userName", type: "string", required: false, size: 512 },
  ]);

  // Note: classroom_members already has 'status' and 'userName' from setup-classroom-collections.mjs

  console.log("\n--- UPDATING EXISTING POSTS (TIER 3) ---");
  await createAttributesIdempotent(databases, "posts", [
    { key: "visibility", type: "string", required: false, size: 32, xdefault: "public" }, // public | followers | classroom
    { key: "classroomId", type: "string", required: false, size: 256 },
    { key: "isPinned", type: "boolean", required: false, xdefault: false },
    { key: "reactionLike", type: "integer", required: false, xdefault: 0 },
    { key: "reactionLove", type: "integer", required: false, xdefault: 0 },
    { key: "reactionHaha", type: "integer", required: false, xdefault: 0 },
    { key: "reactionWow", type: "integer", required: false, xdefault: 0 },
    { key: "reactionTotal", type: "integer", required: false, xdefault: 0 },
    { key: "commentsCount", type: "integer", required: false, xdefault: 0 },
  ]);

  // ==========================================
  // 2. CREATE NEW INVITES COLLECTION
  // ==========================================
  console.log("\n--- CREATING INVITES COLLECTION ---");
  await createCollectionIdempotent(databases, {
      id: "classroom_invites",
      name: "Classroom Invites",
      permissions: [
        Permission.create(Role.users()), // Teachers create
        Permission.read(Role.users()),   // Students read to redeem
        Permission.update(Role.users()), // Students/Teachers update to used/revoked
        Permission.delete(Role.label("admin"))
      ]
  });

  await createAttributesIdempotent(databases, "classroom_invites", [
    { key: "code", type: "string", required: true, size: 32 },
    { key: "classroomId", type: "string", required: false, size: 256 },
    { key: "courseId", type: "string", required: false, size: 256 },
    { key: "teacherId", type: "string", required: true, size: 256 },
    { key: "studentName", type: "string", required: false, size: 512 },
    { key: "expiresAt", type: "datetime", required: false },
    { key: "status", type: "string", required: true, size: 32 }, // active | used | revoked
    { key: "usedById", type: "string", required: false, size: 256 },
  ]);

  await createIndexIdempotent(databases, { collection: "classroom_invites", key: "idx_code", type: IndexType.Unique, attributes: ["code"], orders: [] });
  await createIndexIdempotent(databases, { collection: "classroom_invites", key: "idx_teacher", type: IndexType.Key, attributes: ["teacherId"], orders: [] });
  await createIndexIdempotent(databases, { collection: "classroom_invites", key: "idx_classroom", type: IndexType.Key, attributes: ["classroomId"], orders: [] });


  console.log("\n🎉 Vision V4 Schema Migration Complete!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
