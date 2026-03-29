import { Client, Databases, Query, Permission, Role } from "node-appwrite";
import { config } from "dotenv";

// Load environment variables from .env.local
config({ path: ".env.local" });

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY; // Requires Server API Key
const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;

if (!endpoint || !projectId || !apiKey || !dbId) {
  console.error("Missing required environment variables in .env.local");
  process.exit(1);
}

const client = new Client();
client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);

const databases = new Databases(client);

// Collections to migrate
const collections = {
  projects: "projects",
  classrooms: "classrooms",
  courses: "courses",
  sheetMusic: "sheet_music",
  playlists: "playlists"
};

/** Helpers matching our new src/lib/appwrite/permissions.ts */
function buildStandardPermissions(ownerId) {
  return [
    Permission.read(Role.user(ownerId)),
    Permission.update(Role.user(ownerId)),
    Permission.delete(Role.user(ownerId)),

    Permission.read(Role.label("admin")),
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin")),

    Permission.read(Role.label("contentmanager")),
    Permission.update(Role.label("contentmanager")),
    Permission.delete(Role.label("contentmanager")),
  ];
}

function buildPublishedPermissions(ownerId) {
  const std = buildStandardPermissions(ownerId);
  return [
    Permission.read(Role.any()),
    ...std.filter((p) => !p.startsWith("read(")),
  ];
}

function buildClassroomPermissions(teacherId) {
  return [
    Permission.read(Role.user(teacherId)),
    Permission.update(Role.user(teacherId)),
    Permission.delete(Role.user(teacherId)),
    Permission.read(Role.users()), // Authenticated users can read to join
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin")),
    Permission.update(Role.label("contentmanager")),
    Permission.delete(Role.label("contentmanager")),
  ];
}

// ------------------------------------------------------------
// Core Migration Logic
// ------------------------------------------------------------

async function migrateCollection(collectionName, extractOwnerId, getPermsBuilder) {
  console.log(`\nMigrating collection: [${collectionName}]...`);
  let cursor = null;
  let totalProcessed = 0;

  try {
    while (true) {
      const queries = [Query.limit(100)];
      if (cursor) queries.push(Query.cursorAfter(cursor));

      const response = await databases.listDocuments(dbId, collectionName, queries);
      
      if (response.documents.length === 0) break;

      for (const doc of response.documents) {
        const ownerId = extractOwnerId(doc);
        if (!ownerId) {
          console.warn(`Skipping doc ${doc.$id} - missing owner field`);
          continue;
        }

        const newPermissions = getPermsBuilder(ownerId, doc);

        // Update Document explicitly overrides the old permission array
        await databases.updateDocument(
          dbId,
          collectionName,
          doc.$id,
          {}, // Only update permissions, no data body changes
          newPermissions
        );
      }

      totalProcessed += response.documents.length;
      cursor = response.documents[response.documents.length - 1].$id;
      console.log(` -> Processed ${totalProcessed} documents so far...`);
    }

    console.log(`✅ Finished [${collectionName}]. Total migrated: ${totalProcessed}`);
  } catch (error) {
    console.error(`❌ Error migrating [${collectionName}]:`, error.message);
  }
}

// ------------------------------------------------------------
// Execution
// ------------------------------------------------------------

async function runMigration() {
  console.log("=========================================");
  console.log("   STARTING RBAC BACKFILL MIGRATION      ");
  console.log("=========================================\n");

  // 1. Migrate Projects (Check if published)
  await migrateCollection(
    collections.projects,
    (doc) => doc.userId,
    (ownerId, doc) => doc.published ? buildPublishedPermissions(ownerId) : buildStandardPermissions(ownerId)
  );

  // 2. Migrate Classrooms (Owner is teacherId)
  await migrateCollection(
    collections.classrooms,
    (doc) => doc.teacherId,
    (ownerId, doc) => buildClassroomPermissions(ownerId)
  );

  // 3. Migrate Courses (Owner is creatorId)
  await migrateCollection(
    collections.courses,
    (doc) => doc.creatorId,
    (ownerId, doc) => buildStandardPermissions(ownerId)
  );

  // 4. Migrate Sheet Music (Owner is userId)
  await migrateCollection(
    collections.sheetMusic,
    (doc) => doc.userId,
    (ownerId, doc) => buildStandardPermissions(ownerId)
  );

  // 5. Migrate Playlists (Owner is ownerId)
  await migrateCollection(
    collections.playlists,
    (doc) => doc.ownerId,
    (ownerId, doc) => doc.isPublished ? buildPublishedPermissions(ownerId) : buildStandardPermissions(ownerId)
  );

  console.log("\n=========================================");
  console.log("   MIGRATION COMPLETED SUCCESSFULLY!     ");
  console.log("=========================================\n");
}

runMigration();
