#!/usr/bin/env node
/**
 * Migration: Add `playCount` integer attribute to the `projects` collection.
 * Safe to run multiple times — skips if attribute already exists.
 *
 * Run: node scripts/setup-play-count.mjs
 */
import "dotenv/config";
import { config } from "dotenv";
import { Client, Databases } from "node-appwrite";

config({ path: ".env.local", override: true });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";
const COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECTS_COLLECTION_ID || "projects";

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

async function waitForAttribute(databases, key, maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const att = await databases.getAttribute(DATABASE_ID, COLLECTION_ID, key);
      if (att.status === "available") return true;
    } catch (_) { }
    await sleep(800);
  }
  return false;
}

async function main() {
  requireEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT");
  requireEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID");
  requireEnv("APPWRITE_API_KEY");

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const databases = new Databases(client);

  console.log("🔧 Adding playCount attribute to projects collection...");
  console.log(`   Database: ${DATABASE_ID}`);
  console.log(`   Collection: ${COLLECTION_ID}\n`);

  // 1. Create playCount integer attribute (default 0, not required)
  try {
    await databases.createIntegerAttribute(
      DATABASE_ID,
      COLLECTION_ID,
      "playCount",
      false,   // required
      0,       // default value
      0,       // min
      undefined // max (no limit)
    );
    console.log("  ✅ Attribute created: playCount (integer, default: 0)");

    // Wait for attribute to be available
    const ready = await waitForAttribute(databases, "playCount");
    if (ready) {
      console.log("  ✅ Attribute is available");
    } else {
      console.log("  ⏳ Attribute is still building (may take a moment)");
    }
  } catch (e) {
    if (e.code === 409) {
      console.log("  ⚠️  Attribute playCount already exists — skipping");
    } else {
      console.error("  ❌ Failed to create attribute:", e.message);
      throw e;
    }
  }

  console.log("\n🎉 Done! playCount attribute is ready on the projects collection.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
