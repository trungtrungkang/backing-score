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

  console.log("Setting up Appwrite Social Schema...");

  const collections = [
    { id: "playlists", name: "Playlists" },
    { id: "posts", name: "Posts" },
    { id: "comments", name: "Comments" },
    { id: "reactions", name: "Reactions" },
    { id: "follows", name: "Follows" },
    { id: "favorites", name: "Favorites" },
    { id: "notifications", name: "Notifications" },
    { id: "reports", name: "Reports" }
  ];

  for (const col of collections) {
    // Basic permissions. Document Security (DLS) is true, meaning
    // creators automatically get read/write/delete.
    // We only grant Collection level create(users) + admin over-rides.
    const permissions = [
      Permission.create(Role.users()),
      Permission.update(Role.label("admin")),
      Permission.delete(Role.label("admin")),
      Permission.read(Role.label("admin"))
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
        await databases.updateCollection({
          databaseId: DATABASE_ID,
          collectionId: col.id,
          name: col.name,
          permissions,
          documentSecurity: true,
          enabled: true
        });
      } else throw e;
    }
  }

  console.log("Creating attributes for Playlists...");
  await createAttributes(databases, "playlists", [
    { key: "ownerId", type: "string", required: true, size: 256 },
    { key: "name", type: "string", required: true, size: 512 },
    { key: "description", type: "string", required: false, size: 4096 },
    { key: "isPublished", type: "boolean", required: true },
    { key: "coverImageId", type: "string", required: false, size: 256 },
    { key: "projectIds", type: "string", required: false, size: 256, array: true },
  ]);

  console.log("Creating attributes for Posts...");
  await createAttributes(databases, "posts", [
    { key: "authorId", type: "string", required: true, size: 256 },
    { key: "content", type: "string", required: false, size: 4096 },
    { key: "attachmentType", type: "string", required: false, size: 64 }, // 'project', 'playlist', 'none'
    { key: "attachmentId", type: "string", required: false, size: 256 },
  ]);

  console.log("Creating attributes for Comments...");
  await createAttributes(databases, "comments", [
    { key: "postId", type: "string", required: true, size: 256 },
    { key: "authorId", type: "string", required: true, size: 256 },
    { key: "content", type: "string", required: true, size: 4096 },
  ]);

  console.log("Creating attributes for Reactions...");
  await createAttributes(databases, "reactions", [
    { key: "targetType", type: "string", required: true, size: 64 }, // 'post', 'comment', 'project', 'playlist'
    { key: "targetId", type: "string", required: true, size: 256 },
    { key: "userId", type: "string", required: true, size: 256 },
    { key: "type", type: "string", required: true, size: 64 }, // 'like', 'heart', etc.
  ]);

  console.log("Creating attributes for Follows...");
  await createAttributes(databases, "follows", [
    { key: "followerId", type: "string", required: true, size: 256 },
    { key: "followingId", type: "string", required: true, size: 256 },
  ]);

  console.log("Creating attributes for Favorites...");
  await createAttributes(databases, "favorites", [
    { key: "userId", type: "string", required: true, size: 256 },
    { key: "targetType", type: "string", required: true, size: 64 }, // 'project', 'playlist'
    { key: "targetId", type: "string", required: true, size: 256 },
  ]);

  console.log("Creating attributes for Notifications...");
  await createAttributes(databases, "notifications", [
    { key: "recipientId", type: "string", required: true, size: 256 },
    { key: "type", type: "string", required: true, size: 64 }, // 'like', 'follow', 'comment', 'report_resolved'
    { key: "sourceUserName", type: "string", required: true, size: 512 },
    { key: "sourceUserId", type: "string", required: true, size: 256 },
    { key: "targetName", type: "string", required: false, size: 512 },
    { key: "targetId", type: "string", required: false, size: 256 },
    { key: "read", type: "boolean", required: true },
  ]);

  console.log("Creating attributes for Reports...");
  await createAttributes(databases, "reports", [
    { key: "targetType", type: "string", required: true, size: 64 },
    { key: "targetId", type: "string", required: true, size: 256 },
    { key: "reason", type: "string", required: true, size: 512 },
    { key: "details", type: "string", required: false, size: 4096 },
    { key: "reporterId", type: "string", required: true, size: 256 },
    { key: "status", type: "string", required: true, size: 64 },
  ]);

  console.log("Creating Indexes...");
  const indexes = [
    { collection: "playlists", key: "owner_index", type: IndexType.Key, attributes: ["ownerId", "$createdAt"], orders: [OrderBy.Desc] },
    { collection: "playlists", key: "published_index", type: IndexType.Key, attributes: ["isPublished", "$createdAt"], orders: [OrderBy.Desc] },
    
    { collection: "posts", key: "author_index", type: IndexType.Key, attributes: ["authorId", "$createdAt"], orders: [OrderBy.Desc] },
    { collection: "posts", key: "timeline_index", type: IndexType.Key, attributes: ["$createdAt"], orders: [OrderBy.Desc] },
    
    { collection: "comments", key: "post_comments_index", type: IndexType.Key, attributes: ["postId", "$createdAt"], orders: [OrderBy.Asc] },
    
    { collection: "reactions", key: "target_reactions_index", type: IndexType.Key, attributes: ["targetType", "targetId"], orders: [] },
    { collection: "reactions", key: "user_reaction_check", type: IndexType.Unique, attributes: ["targetType", "targetId", "userId"], orders: [] }, // Prevent double-likes
    
    { collection: "follows", key: "follower_following_unique", type: IndexType.Unique, attributes: ["followerId", "followingId"], orders: [] },
    { collection: "follows", key: "user_followers_index", type: IndexType.Key, attributes: ["followingId", "$createdAt"], orders: [OrderBy.Desc] },
    { collection: "follows", key: "user_following_index", type: IndexType.Key, attributes: ["followerId", "$createdAt"], orders: [OrderBy.Desc] },

    { collection: "favorites", key: "user_target_unique", type: IndexType.Unique, attributes: ["userId", "targetType", "targetId"], orders: [] },
    { collection: "favorites", key: "user_favorites_index", type: IndexType.Key, attributes: ["userId", "targetType", "$createdAt"], orders: [OrderBy.Desc] },

    { collection: "notifications", key: "recipient_read_index", type: IndexType.Key, attributes: ["recipientId", "read", "$createdAt"], orders: [OrderBy.Asc, OrderBy.Asc, OrderBy.Desc] },
    { collection: "notifications", key: "recipient_created_index", type: IndexType.Key, attributes: ["recipientId", "$createdAt"], orders: [OrderBy.Asc, OrderBy.Desc] },

    { collection: "reports", key: "status_created_index", type: IndexType.Key, attributes: ["status", "$createdAt"], orders: [OrderBy.Asc, OrderBy.Desc] },
    { collection: "reports", key: "reporter_index", type: IndexType.Key, attributes: ["reporterId", "$createdAt"], orders: [OrderBy.Asc, OrderBy.Desc] },
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

  console.log("\n✅ Appwrite Social Setup Complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
