#!/usr/bin/env node
/**
 * Add wiki-linking attributes to the projects collection.
 * Adds: wikiGenreId, wikiInstrumentIds (array), wikiCompositionId, wikiComposerIds (array)
 *
 * Run: node scripts/setup-appwrite-wiki-links.mjs
 */

import "dotenv/config";
import { config } from "dotenv";
import { Client, Databases } from "node-appwrite";

config({ path: ".env.local", override: true });

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";
const PROJECTS = process.env.NEXT_PUBLIC_APPWRITE_PROJECTS_COLLECTION_ID || "projects";

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);
const databases = new Databases(client);

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const ATTRIBUTES = [
  // Links to wiki_genres document ID
  { key: "wikiGenreId", type: "string", size: 128, required: false, array: false },
  // Links to wiki_instruments document IDs
  { key: "wikiInstrumentIds", type: "string", size: 128, required: false, array: true },
  // Links to wiki_compositions document ID
  { key: "wikiCompositionId", type: "string", size: 128, required: false, array: false },
  // Links to wiki_artists document IDs
  { key: "wikiComposerIds", type: "string", size: 128, required: false, array: true },
];

async function main() {
  console.log("Adding wiki-link attributes to projects collection...\n");

  for (const attr of ATTRIBUTES) {
    try {
      await databases.createStringAttribute({
        databaseId: DB,
        collectionId: PROJECTS,
        key: attr.key,
        size: attr.size,
        required: attr.required,
        array: attr.array,
      });
      console.log(`  ✓ Created: ${attr.key}${attr.array ? " (array)" : ""}`);
      await sleep(2000); // Wait for attribute to be ready
    } catch (e) {
      if (e.code === 409) {
        console.log(`  ↻ Already exists: ${attr.key}`);
      } else if (e.code === 400 && e.type === "attribute_limit_exceeded") {
        console.log(`  ⚠ Attribute limit reached, skipping: ${attr.key}`);
      } else {
        throw e;
      }
    }
  }

  console.log("\n✅ Done. Projects collection now has wiki-link fields.");
}

main().catch(err => { console.error(err); process.exit(1); });
