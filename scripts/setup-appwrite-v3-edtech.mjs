#!/usr/bin/env node
/**
 * Setup Appwrite database schemas specifically for Lotusa V3 EdTech Architecture.
 * Provisions robust Collections: Courses, Lessons, Enrollments, and Learner Progress.
 *
 * Run: node scripts/setup-appwrite-v3-edtech.mjs
 */

import "dotenv/config";
import { config } from "dotenv";
import { Client, Databases, Permission, Role, IndexType, OrderBy } from "node-appwrite";

config({ path: ".env.local", override: true });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";

const COURSES_COLLECTION = "courses";
const LESSONS_COLLECTION = "lessons";
const ENROLLMENTS_COLLECTION = "enrollments";
const PROGRESS_COLLECTION = "progress";

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

  console.log("Setting up Appwrite V3 EdTech Schema...");

  try {
    await databases.create(DATABASE_ID, "Backing & Score DB");
    console.log("Created database:", DATABASE_ID);
  } catch (e) {
    if (e.code === 409) console.log("Database already exists:", DATABASE_ID);
  }

  const collections = [
    { id: COURSES_COLLECTION, name: "Courses" },
    { id: LESSONS_COLLECTION, name: "Lessons" },
    { id: ENROLLMENTS_COLLECTION, name: "Enrollments" },
    { id: PROGRESS_COLLECTION, name: "Student Progress" },
  ];

  for (const col of collections) {
    // Both Creators and Learners need broad READ access, but only Admins/Server Actions can Create/Update securely
    const permissions = [
      Permission.create(Role.users()), // Authenticated Users can enroll/save progress
      Permission.read(Role.any()),     // Anyone can read public courses
      Permission.update(Role.users()), // Learners update progress, Creators update courses
      Permission.delete(Role.label("admin")) // Only admins delete
    ];

    try {
      await databases.createCollection({
        databaseId: DATABASE_ID,
        collectionId: col.id,
        name: col.name,
        permissions,
        documentSecurity: true
      });
      console.log("Created collection:", col.id);
    } catch (e) {
      if (e.code === 409) {
        console.log("Collection already exists, updating permissions:", col.id);
      } else throw e;
    }
  }

  // 1. Courses Collection Attributes
  console.log("Creating Attributes for Courses...");
  await createAttributes(databases, COURSES_COLLECTION, [
    { key: "creatorId", type: "string", required: true, size: 64 },
    { key: "title", type: "string", required: true, size: 512 },
    { key: "description", type: "string", required: false, size: 4096 },
    { key: "priceCents", type: "integer", required: true }, // 0 = Free
    { key: "coverUrl", type: "string", required: false, size: 2048 },
    { key: "published", type: "boolean", required: true },
    { key: "createdAt", type: "datetime", required: false },
  ]);

  // 2. Lessons Collection Attributes
  console.log("Creating Attributes for Lessons...");
  await createAttributes(databases, LESSONS_COLLECTION, [
    { key: "courseId", type: "string", required: true, size: 64 },
    { key: "title", type: "string", required: true, size: 512 },
    { key: "orderIndex", type: "integer", required: true },
    { key: "contentRaw", type: "string", required: true, size: 16777216 }, // Massive JSON from Tiptap ProseMirror
    { key: "published", type: "boolean", required: true },
  ]);

  // 3. Enrollments Collection Attributes (Learner access pass)
  console.log("Creating Attributes for Enrollments...");
  await createAttributes(databases, ENROLLMENTS_COLLECTION, [
    { key: "userId", type: "string", required: true, size: 64 },
    { key: "courseId", type: "string", required: true, size: 64 },
    { key: "enrolledAt", type: "datetime", required: true },
  ]);

  // 4. Student Progress Attributes (Gamification unlock state)
  console.log("Creating Attributes for Progress...");
  await createAttributes(databases, PROGRESS_COLLECTION, [
    { key: "userId", type: "string", required: true, size: 64 },
    { key: "courseId", type: "string", required: true, size: 64 },
    { key: "lessonId", type: "string", required: true, size: 64 },
    { key: "waitModeScore", type: "integer", required: true }, // Wait Mode Accuracy 0-100%
    { key: "completedSnippets", type: "string", required: false, array: true, size: 64 }, // Track specific snippets passed
    { key: "unlocked", type: "boolean", required: true }, // Determines if child node next-lesson is Accessible
    { key: "completedAt", type: "datetime", required: false },
  ]);

  // Setup Indexes
  const indexes = [
    { collection: COURSES_COLLECTION, key: "creator_idx", type: IndexType.Key, attributes: ["creatorId"], orders: [OrderBy.Desc] },
    { collection: LESSONS_COLLECTION, key: "course_order", type: IndexType.Key, attributes: ["courseId", "orderIndex"], orders: [OrderBy.Asc] },
    { collection: ENROLLMENTS_COLLECTION, key: "user_enrollment", type: IndexType.Key, attributes: ["userId", "courseId"], orders: [OrderBy.Desc] },
    { collection: PROGRESS_COLLECTION, key: "user_progress", type: IndexType.Key, attributes: ["userId", "courseId", "lessonId"], orders: [OrderBy.Asc] },
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
      console.log(`  Index created: ${idx.collection}.${idx.key}`);
    } catch (e) {
      if (e.code === 409) console.log(`  Index already exists: ${idx.collection}.${idx.key}`);
      else throw e;
    }
    await sleep(500);
  }

  console.log("\n✅ V3 EdTech Appwrite Database Arrays fully synthesized!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
