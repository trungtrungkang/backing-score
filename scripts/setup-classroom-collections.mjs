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

  console.log("🎓 Setting up Appwrite Classroom Collections...\n");

  // ==========================================
  // 1. Create Collections
  // ==========================================

  const collections = [
    { id: "classrooms", name: "Classrooms" },
    { id: "classroom_members", name: "Classroom Members" },
    { id: "assignments", name: "Assignments" },
    { id: "submissions", name: "Submissions" },
  ];

  const permissions = [
    Permission.create(Role.users()),
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin")),
    Permission.read(Role.label("admin")),
  ];

  for (const col of collections) {
    try {
      await databases.createCollection({
        databaseId: DATABASE_ID,
        collectionId: col.id,
        name: col.name,
        permissions,
        documentSecurity: true,
      });
      console.log("✅ Created collection:", col.id);
    } catch (e) {
      if (e.code === 409) {
        console.log("⏭️  Collection already exists, updating:", col.id);
        await databases.updateCollection({
          databaseId: DATABASE_ID,
          collectionId: col.id,
          name: col.name,
          permissions,
          documentSecurity: true,
          enabled: true,
        });
      } else throw e;
    }
  }

  // ==========================================
  // 2. Create Attributes
  // ==========================================

  console.log("\nCreating attributes for classrooms...");
  await createAttributes(databases, "classrooms", [
    { key: "teacherId", type: "string", required: true, size: 256 },
    { key: "name", type: "string", required: true, size: 512 },
    { key: "description", type: "string", required: false, size: 4096 },
    { key: "coverImage", type: "string", required: false, size: 1024 },
    { key: "instrumentFocus", type: "string", required: false, size: 128 },
    { key: "level", type: "string", required: false, size: 64 },
    { key: "classCode", type: "string", required: true, size: 10 },
    { key: "status", type: "string", required: true, size: 32 },
  ]);

  console.log("\nCreating attributes for classroom_members...");
  await createAttributes(databases, "classroom_members", [
    { key: "classroomId", type: "string", required: true, size: 256 },
    { key: "userId", type: "string", required: true, size: 256 },
    { key: "userName", type: "string", required: false, size: 512 },
    { key: "role", type: "string", required: true, size: 32 }, // "teacher" or "student"
    { key: "joinedAt", type: "string", required: true, size: 64 },
    { key: "status", type: "string", required: true, size: 32 }, // "active" or "removed"
  ]);

  console.log("\nCreating attributes for assignments...");
  await createAttributes(databases, "assignments", [
    { key: "classroomId", type: "string", required: true, size: 256 },
    { key: "title", type: "string", required: true, size: 512 },
    { key: "description", type: "string", required: false, size: 4096 },
    { key: "sourceType", type: "string", required: true, size: 32 }, // "library", "upload", "discover"
    { key: "sourceId", type: "string", required: true, size: 256 },
    { key: "type", type: "string", required: true, size: 32 }, // "practice", "assessment", "performance"
    { key: "deadline", type: "datetime", required: false },
    { key: "waitModeRequired", type: "boolean", required: true },
  ]);

  console.log("\nCreating attributes for submissions...");
  await createAttributes(databases, "submissions", [
    { key: "assignmentId", type: "string", required: true, size: 256 },
    { key: "classroomId", type: "string", required: true, size: 256 },
    { key: "studentId", type: "string", required: true, size: 256 },
    { key: "studentName", type: "string", required: false, size: 512 },
    { key: "recordingFileId", type: "string", required: false, size: 256 },
    { key: "accuracy", type: "float", required: false },
    { key: "tempo", type: "float", required: false },
    { key: "attempts", type: "integer", required: true },
    { key: "submittedAt", type: "datetime", required: false },
    { key: "status", type: "string", required: true, size: 32 }, // "draft", "submitted", "reviewed"
  ]);

  // ==========================================
  // 3. Create Indexes
  // ==========================================

  console.log("\nCreating indexes...");
  const indexes = [
    // Classrooms
    { collection: "classrooms", key: "idx_teacher", type: IndexType.Key, attributes: ["teacherId"], orders: [] },
    { collection: "classrooms", key: "idx_class_code", type: IndexType.Unique, attributes: ["classCode"], orders: [] },
    { collection: "classrooms", key: "idx_status", type: IndexType.Key, attributes: ["status", "$createdAt"], orders: [OrderBy.Asc, OrderBy.Desc] },

    // Classroom Members
    { collection: "classroom_members", key: "idx_classroom_user", type: IndexType.Unique, attributes: ["classroomId", "userId"], orders: [] },
    { collection: "classroom_members", key: "idx_user_status", type: IndexType.Key, attributes: ["userId", "status"], orders: [] },
    { collection: "classroom_members", key: "idx_classroom_status", type: IndexType.Key, attributes: ["classroomId", "status"], orders: [] },

    // Assignments
    { collection: "assignments", key: "idx_classroom", type: IndexType.Key, attributes: ["classroomId", "$createdAt"], orders: [OrderBy.Asc, OrderBy.Desc] },

    // Submissions
    { collection: "submissions", key: "idx_assignment_student", type: IndexType.Unique, attributes: ["assignmentId", "studentId"], orders: [] },
    { collection: "submissions", key: "idx_classroom_student", type: IndexType.Key, attributes: ["classroomId", "studentId"], orders: [] },
    { collection: "submissions", key: "idx_assignment", type: IndexType.Key, attributes: ["assignmentId", "submittedAt"], orders: [OrderBy.Asc, OrderBy.Desc] },
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

  console.log("\n🎉 Appwrite Classroom Setup Complete!");
  console.log("   Collections: classrooms, classroom_members, assignments, submissions");
  console.log("   Total indexes: 10");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
