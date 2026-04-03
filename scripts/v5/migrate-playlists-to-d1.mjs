#!/usr/bin/env node

/**
 * Migrate Appwrite `playlists` into Drizzle `setlists` (as they use the same table schema under the hood)
 */

import { Client, Databases, Query, Users } from "node-appwrite";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
const databases = new Databases(client);

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "backing_score_db";
const PLAYLISTS_COLL = "playlists";

function escapeSql(val) {
  if (val === undefined || val === null) return "NULL";
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "number") return val;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function fetchAll(collectionId) {
  let allDocs = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    try {
      const resp = await databases.listDocuments(DB_ID, collectionId, [Query.limit(100), Query.offset(offset)]);
      if (resp.documents.length === 0) hasMore = false;
      else {
        allDocs.push(...resp.documents);
        process.stdout.write(`Đã múc ${allDocs.length} từ ${collectionId}...\r`);
        offset += 100;
        await new Promise(r => setTimeout(r, 250));
      }
    } catch {
       return [];
    }
  }
  console.log(`\n✅ ${allDocs.length} ${collectionId}.`);
  return allDocs;
}

async function main() {
  console.log("🕵️‍♂️ Fetching Users & Projects to validate FK...");
  
  const usersService = new Users(client);
  const validUserIds = new Set();
  let uOffset = 0;
  let uHasMore = true;
  while(uHasMore) {
     const resUser = await usersService.list([Query.limit(100), Query.offset(uOffset)]);
     if(resUser.users.length === 0) uHasMore = false;
     else {
        resUser.users.forEach(u => validUserIds.add(u.$id));
        uOffset += 100;
     }
  }

  const projects = await fetchAll("projects");
  const validProjectIds = new Set(projects.filter(p => validUserIds.has(p.userId)).map(p => p.$id));

  console.log(`Loaded ${validUserIds.size} Users & ${validProjectIds.size} Projects.`);
  
  const playlists = await fetchAll(PLAYLISTS_COLL);

  const sqlCommands = [
    "PRAGMA defer_foreign_keys = TRUE;",
    "PRAGMA foreign_keys = OFF;"
  ];

  for (const doc of playlists) {
    if (!validUserIds.has(doc.ownerId)) continue;
    
    // Insert Parent Setlist (acting as Playlist)
    const createdAt = new Date(doc.$createdAt).getTime();
    const cmd = `INSERT INTO setlists (id, user_id, name, description, is_published, cover_image_id, created_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.ownerId)}, ${escapeSql(doc.name)}, ${escapeSql(doc.description)}, ${escapeSql(doc.isPublished)}, ${escapeSql(doc.coverImageId)}, ${createdAt}) ON CONFLICT(id) DO NOTHING;`;
    sqlCommands.push(cmd);

    // Insert Items (projectIds is an array of strings in PlaylistDocument)
    if (doc.projectIds && Array.isArray(doc.projectIds)) {
        doc.projectIds.forEach((pId, index) => {
            if (pId && validProjectIds.has(pId)) {
                // Generate a random ID or derived ID for setlist item
                const itemId = `${doc.$id}_${pId}_${index}`;
                sqlCommands.push(`INSERT INTO setlist_items (id, setlist_id, project_id, order_index) VALUES (${escapeSql(itemId)}, ${escapeSql(doc.$id)}, ${escapeSql(pId)}, ${index}) ON CONFLICT DO NOTHING;`);
            }
        });
    }
  }

  const out = path.join(process.cwd(), "scripts", "v5", "dump_playlists.sql");
  fs.writeFileSync(out, sqlCommands.join("\n"));
  console.log(`\n🎉 Generated ${sqlCommands.length} queries to restore Playlists into Drizzle Setlists structure -> ${out}`);
}

main().catch(console.error);
