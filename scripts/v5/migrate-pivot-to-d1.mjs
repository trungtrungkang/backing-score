#!/usr/bin/env node

/**
 * Script phụ trợ chuyên múc các Array Link JSON rác rưởi của Appwrite 
 * và nối gân lại thành SQL Pivot Tables.
 */

import { Client, Databases, Query, Users } from "node-appwrite";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT).setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID).setKey(process.env.APPWRITE_API_KEY);
const databases = new Databases(client);

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "backing_score_db";

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
        offset += 100;
        await new Promise(r => setTimeout(r, 250));
      }
    } catch {
       return [];
    }
  }
  return allDocs;
}

function escapeSql(val) {
  if (val === undefined || val === null) return "NULL";
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "number") return val;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
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

  const artists = await fetchAll("wiki_artists");
  const instruments = await fetchAll("wiki_instruments");
  const projects = await fetchAll("projects");

  const validArtists = new Set(artists.map(a => a.$id));
  const validInstruments = new Set(instruments.map(i => i.$id));

  const sqlCommands = [
    "PRAGMA defer_foreign_keys = TRUE;",
    "PRAGMA foreign_keys = OFF;"
  ];

  for (const proj of projects) {
    if (!validUserIds.has(proj.userId)) continue;

    if (proj.wikiComposerIds && Array.isArray(proj.wikiComposerIds)) {
        for (const aId of proj.wikiComposerIds) {
            if (aId && validArtists.has(aId)) {
                sqlCommands.push(`INSERT INTO project_wiki_composers (project_id, artist_id) VALUES (${escapeSql(proj.$id)}, ${escapeSql(aId)}) ON CONFLICT DO NOTHING;`);
            }
        }
    }

    if (proj.wikiInstrumentIds && Array.isArray(proj.wikiInstrumentIds)) {
        for (const instId of proj.wikiInstrumentIds) {
            if (instId && validInstruments.has(instId)) {
                sqlCommands.push(`INSERT INTO project_wiki_instruments (project_id, instrument_id) VALUES (${escapeSql(proj.$id)}, ${escapeSql(instId)}) ON CONFLICT DO NOTHING;`);
            }
        }
    }
  }

  const out = path.join(process.cwd(), "scripts", "v5", "dump_pivot.sql");
  fs.writeFileSync(out, sqlCommands.join("\n"));
  console.log("Xúc xong Pivot vào " + out);
}
main();
