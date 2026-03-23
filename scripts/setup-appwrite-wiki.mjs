#!/usr/bin/env node
/**
 * Setup Appwrite collections, attributes, and indexes for the Music Encyclopedia (Wiki) feature.
 *
 * Prerequisites:
 * - .env or .env.local with NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, APPWRITE_API_KEY
 *
 * Run: node scripts/setup-appwrite-wiki.mjs
 */

import "dotenv/config";
import { config } from "dotenv";
import { Client, Databases, Permission, Role, IndexType } from "node-appwrite";

config({ path: ".env.local", override: true });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";

const COLLECTIONS = {
  artists: "wiki_artists",
  instruments: "wiki_instruments",
  compositions: "wiki_compositions",
  genres: "wiki_genres",
  translations: "wiki_translations",
};

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

async function waitForAttribute(databases, collectionId, key, maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const att = await databases.getAttribute({ databaseId: DATABASE_ID, collectionId, key });
      if (att.status === "available") return;
    } catch (_) {}
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
      console.log(`  ✓ ${collectionId}.${key}`);
      await waitForAttribute(databases, collectionId, key);
      await sleep(500);
    } catch (e) {
      if (e.code === 409) {
        console.log(`  ↳ already exists: ${collectionId}.${key}`);
      } else if (e.type === 'attribute_limit_exceeded') {
        console.log(`  ↳ limit reached, skipping: ${collectionId}.${key}`);
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

  console.log("🎵 Setting up Music Encyclopedia (Wiki) collections...\n");

  // 1. Create collections
  for (const [label, id] of Object.entries(COLLECTIONS)) {
    try {
      await databases.createCollection({
        databaseId: DATABASE_ID,
        collectionId: id,
        name: `Wiki: ${label.charAt(0).toUpperCase() + label.slice(1)}`,
        permissions: [
          Permission.read(Role.any()),
          Permission.create(Role.label("admin")),
          Permission.update(Role.label("admin")),
          Permission.delete(Role.label("admin")),
        ],
        documentSecurity: false, // Public read, admin-only write
      });
      console.log(`Created collection: ${id}`);
    } catch (e) {
      if (e.code === 409) console.log(`Collection already exists: ${id}`);
      else throw e;
    }
  }

  // 2. Attributes: Artists
  console.log("\n📝 Artists attributes...");
  await createAttributes(databases, COLLECTIONS.artists, [
    { key: "name", type: "string", required: true, size: 512 },
    { key: "nameOriginal", type: "string", required: false, size: 512 },
    { key: "slug", type: "string", required: true, size: 256 },
    { key: "bio", type: "string", required: false, size: 16384 },
    { key: "birthDate", type: "string", required: false, size: 32 },
    { key: "deathDate", type: "string", required: false, size: 32 },
    { key: "nationality", type: "string", required: false, size: 128 },
    { key: "roles", type: "string", required: false, size: 64, array: true },
    { key: "imageUrl", type: "string", required: false, size: 2048 },
    { key: "coverUrl", type: "string", required: false, size: 2048 },
    { key: "genreIds", type: "string", required: false, size: 64, array: true },
    { key: "instrumentIds", type: "string", required: false, size: 64, array: true },
    { key: "externalLinks", type: "string", required: false, size: 4096 },
  ]);

  // 3. Attributes: Instruments
  console.log("\n🎸 Instruments attributes...");
  await createAttributes(databases, COLLECTIONS.instruments, [
    { key: "name", type: "string", required: true, size: 256 },
    { key: "slug", type: "string", required: true, size: 256 },
    { key: "family", type: "string", required: false, size: 128 },
    { key: "description", type: "string", required: false, size: 4096 },
    { key: "imageUrl", type: "string", required: false, size: 2048 },
    { key: "tuning", type: "string", required: false, size: 256 },
    { key: "range", type: "string", required: false, size: 256 },
    { key: "origin", type: "string", required: false, size: 256 },
  ]);

  // 4. Attributes: Compositions
  console.log("\n🎼 Compositions attributes...");
  await createAttributes(databases, COLLECTIONS.compositions, [
    { key: "title", type: "string", required: true, size: 512 },
    { key: "slug", type: "string", required: true, size: 256 },
    { key: "composerIds", type: "string", required: false, size: 64, array: true },
    { key: "performerIds", type: "string", required: false, size: 64, array: true },
    { key: "year", type: "integer", required: false },
    { key: "period", type: "string", required: false, size: 128 },
    { key: "genreId", type: "string", required: false, size: 64 },
    { key: "instrumentIds", type: "string", required: false, size: 64, array: true },
    { key: "keySignature", type: "string", required: false, size: 32 },
    { key: "tempo", type: "string", required: false, size: 64 },
    { key: "timeSignature", type: "string", required: false, size: 16 },
    { key: "description", type: "string", required: false, size: 4096 },
    // historicalContext removed — Appwrite attribute size limit; use description field instead
    { key: "difficulty", type: "string", required: false, size: 32 },
    { key: "projectIds", type: "string", required: false, size: 64, array: true },
  ]);

  // 5. Attributes: Genres
  console.log("\n🎶 Genres attributes...");
  await createAttributes(databases, COLLECTIONS.genres, [
    { key: "name", type: "string", required: true, size: 256 },
    { key: "slug", type: "string", required: true, size: 256 },
    { key: "description", type: "string", required: false, size: 4096 },
    { key: "parentGenreId", type: "string", required: false, size: 64 },
    { key: "era", type: "string", required: false, size: 128 },
  ]);

  // 6. Attributes: Translations
  console.log("\n🌐 Translations attributes...");
  await createAttributes(databases, COLLECTIONS.translations, [
    { key: "entityId", type: "string", required: true, size: 64 },
    { key: "entityType", type: "string", required: true, size: 32 },
    { key: "locale", type: "string", required: true, size: 10 },
    { key: "field", type: "string", required: true, size: 64 },
    { key: "value", type: "string", required: true, size: 16384 },
  ]);

  // 7. Add encyclopedia metadata fields to existing projects collection
  console.log("\n📦 Adding encyclopedia metadata to projects...");
  const PROJECTS_COLLECTION = process.env.NEXT_PUBLIC_APPWRITE_PROJECTS_COLLECTION_ID || "projects";
  await createAttributes(databases, PROJECTS_COLLECTION, [
    { key: "composerIds", type: "string", required: false, size: 64, array: true },
    { key: "performerIds", type: "string", required: false, size: 64, array: true },
    { key: "instrumentIds", type: "string", required: false, size: 64, array: true },
    { key: "genreId", type: "string", required: false, size: 64 },
    { key: "compositionId", type: "string", required: false, size: 64 },
  ]);

  // 8. Indexes
  console.log("\n🔍 Creating indexes...");
  const indexes = [
    { collection: COLLECTIONS.artists, key: "slug_unique", type: IndexType.Unique, attributes: ["slug"] },
    { collection: COLLECTIONS.artists, key: "name_search", type: IndexType.Fulltext, attributes: ["name"] },
    { collection: COLLECTIONS.instruments, key: "slug_unique", type: IndexType.Unique, attributes: ["slug"] },
    { collection: COLLECTIONS.instruments, key: "family_idx", type: IndexType.Key, attributes: ["family"] },
    { collection: COLLECTIONS.compositions, key: "slug_unique", type: IndexType.Unique, attributes: ["slug"] },
    { collection: COLLECTIONS.compositions, key: "genre_idx", type: IndexType.Key, attributes: ["genreId"] },
    { collection: COLLECTIONS.compositions, key: "title_search", type: IndexType.Fulltext, attributes: ["title"] },
    { collection: COLLECTIONS.genres, key: "slug_unique", type: IndexType.Unique, attributes: ["slug"] },
    { collection: COLLECTIONS.genres, key: "parent_idx", type: IndexType.Key, attributes: ["parentGenreId"] },
    // Indexes on projects for encyclopedia queries
    { collection: PROJECTS_COLLECTION, key: "genre_idx", type: IndexType.Key, attributes: ["genreId"] },
    { collection: PROJECTS_COLLECTION, key: "composition_idx", type: IndexType.Key, attributes: ["compositionId"] },
    // Translations indexes
    { collection: COLLECTIONS.translations, key: "entity_locale_field", type: IndexType.Key, attributes: ["entityId", "locale", "field"] },
    { collection: COLLECTIONS.translations, key: "entity_locale", type: IndexType.Key, attributes: ["entityId", "locale"] },
  ];

  for (const idx of indexes) {
    try {
      await databases.createIndex({
        databaseId: DATABASE_ID,
        collectionId: idx.collection,
        key: idx.key,
        type: idx.type,
        attributes: idx.attributes,
      });
      console.log(`  ✓ ${idx.collection}.${idx.key}`);
    } catch (e) {
      if (e.code === 409) console.log(`  ↳ already exists: ${idx.collection}.${idx.key}`);
      else throw e;
    }
    await sleep(500);
  }

  console.log("\n✅ Music Encyclopedia setup complete!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
