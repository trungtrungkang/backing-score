#!/usr/bin/env node
/**
 * Migration: Add `category` and `difficulty` string attributes to the `courses` collection.
 * Run: node scripts/add-course-category-attributes.mjs
 */

import "dotenv/config";
import { config } from "dotenv";
import { Client, Databases } from "node-appwrite";

config({ path: ".env.local", override: true });

const ENDPOINT    = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID  = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY     = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";
const COLLECTION  = "courses";

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForAttribute(key, maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const att = await databases.getAttribute(DATABASE_ID, COLLECTION, key);
      if (att.status === "available") return;
    } catch (_) {}
    await sleep(800);
  }
  throw new Error(`Attribute ${key} did not become available within ${maxWaitMs}ms`);
}

async function addAttribute(key, size = 128) {
  try {
    await databases.createStringAttribute(DATABASE_ID, COLLECTION, key, size, false);
    console.log(`  ✓ Created attribute: courses.${key}`);
    await waitForAttribute(key);
  } catch (e) {
    if (e.code === 409) {
      console.log(`  ℹ Attribute already exists: courses.${key}`);
    } else {
      throw e;
    }
  }
}

async function main() {
  if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
    console.error("Missing required env vars. Make sure .env.local has NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, and APPWRITE_API_KEY");
    process.exit(1);
  }

  console.log("Adding category & difficulty attributes to `courses` collection...");
  await addAttribute("category", 128);
  await addAttribute("difficulty", 32);
  console.log("\n✅ Migration complete. You can now save category and difficulty on course documents.");
}

main().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
