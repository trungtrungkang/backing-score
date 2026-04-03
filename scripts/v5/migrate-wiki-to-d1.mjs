#!/usr/bin/env node

/**
 * Script hút cạn 100% dữ liệu Hệ thống Bách khoa toàn thư Âm nhạc (Wiki)
 * từ Appwrite sang D1.
 */

import { Client, Databases, Query } from "node-appwrite";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "backing_score_db";

const COLL_ARTISTS = "wiki_artists";
const COLL_INSTRUMENTS = "wiki_instruments";
const COLL_GENRES = "wiki_genres";
const COLL_COMPOSITIONS = "wiki_compositions";
const COLL_TRANSLATIONS = "wiki_translations";
const COLL_PROJECTS = "projects"; // Cần query lại để bốc mảng ID ra Pivot

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error("Thiếu biến môi trường Appwrite trong .env.local!");
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const databases = new Databases(client);

const OUTPUT_FILE = path.join(process.cwd(), "scripts", "v5", "dump_wiki.sql");

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
      const response = await databases.listDocuments(DB_ID, collectionId, [
          Query.limit(100),
          Query.offset(offset)
      ]);
      const batch = response.documents;
      if (batch.length === 0) hasMore = false;
      else {
        allDocs.push(...batch);
        process.stdout.write(`Đã tải ${allDocs.length} từ ${collectionId}...\r`);
        offset += 100;
        await new Promise(r => setTimeout(r, 250));
      }
    } catch (e) {
      if (e.code === 404) {
         console.warn(`\nBỏ qua ${collectionId} (Không tìm thấy trên Appwrite)`);
         return [];
      }
      throw e;
    }
  }
  console.log(`\n✅ ${allDocs.length} ${collectionId}.`);
  return allDocs;
}

async function main() {
  console.log("======================================");
  console.log("🎻 BẮT ĐẦU RÚT RUỘT WIKI TỪ APPWRITE");
  console.log("======================================");
  
  const artists = await fetchAll(COLL_ARTISTS);
  const instruments = await fetchAll(COLL_INSTRUMENTS);
  const genres = await fetchAll(COLL_GENRES);
  const compositions = await fetchAll(COLL_COMPOSITIONS);
  const translations = await fetchAll(COLL_TRANSLATIONS);
  
  // Quét lại Projects 1 lần nữa ĐỂ BÓC TÁCH MẢNG ID cho PIVOT TABLES
  console.log("\n💿 Quét Projects để tách mảng Wiki Links...");
  const projects = await fetchAll(COLL_PROJECTS);

  const sqlCommands = [
    "PRAGMA defer_foreign_keys = TRUE;",
    "PRAGMA foreign_keys = OFF;"
  ];

  // 1. WIKI ARTISTS
  for (const doc of artists) {
    const roles = Array.isArray(doc.roles) ? JSON.stringify(doc.roles) : "[]";
    const cmd = `INSERT INTO wiki_artists (id, slug, name, name_original, bio, birth_date, death_date, nationality, roles, image_url, cover_url) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.slug || doc.$id)}, ${escapeSql(doc.name)}, ${escapeSql(doc.nameOriginal)}, ${escapeSql(doc.bio)}, ${escapeSql(doc.birthDate)}, ${escapeSql(doc.deathDate)}, ${escapeSql(doc.nationality)}, ${escapeSql(roles)}, ${escapeSql(doc.imageUrl)}, ${escapeSql(doc.coverUrl)}) ON CONFLICT(id) DO NOTHING;`;
    sqlCommands.push(cmd);
  }

  // 2. WIKI INSTRUMENTS
  for (const doc of instruments) {
    const cmd = `INSERT INTO wiki_instruments (id, slug, name, family, description, image_url, tuning) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.slug || doc.$id)}, ${escapeSql(doc.name)}, ${escapeSql(doc.family)}, ${escapeSql(doc.description)}, ${escapeSql(doc.imageUrl)}, ${escapeSql(doc.tuning)}) ON CONFLICT(id) DO NOTHING;`;
    sqlCommands.push(cmd);
  }

  // 3. WIKI GENRES
  for (const doc of genres) {
    const cmd = `INSERT INTO wiki_genres (id, slug, name, description, parent_genre_id, era) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.slug || doc.$id)}, ${escapeSql(doc.name)}, ${escapeSql(doc.description)}, ${escapeSql(doc.parentGenreId)}, ${escapeSql(doc.era)}) ON CONFLICT(id) DO NOTHING;`;
    sqlCommands.push(cmd);
  }

  // 4. WIKI COMPOSITIONS
  for (const doc of compositions) {
    const cmd = `INSERT INTO wiki_compositions (id, slug, title, year, period, genre_id, key_signature, description) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.slug || doc.$id)}, ${escapeSql(doc.title)}, ${escapeSql(doc.year)}, ${escapeSql(doc.period)}, ${escapeSql(doc.genreId)}, ${escapeSql(doc.keySignature)}, ${escapeSql(doc.description)}) ON CONFLICT(id) DO NOTHING;`;
    sqlCommands.push(cmd);
  }

  // 5. WIKI TRANSLATIONS
  for (const doc of translations) {
    const cmd = `INSERT INTO wiki_translations (id, entity_id, entity_type, locale, field, value) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.entityId)}, ${escapeSql(doc.entityType)}, ${escapeSql(doc.locale)}, ${escapeSql(doc.field)}, ${escapeSql(doc.value)}) ON CONFLICT(id) DO NOTHING;`;
    sqlCommands.push(cmd);
  }

  // (KHÔNG NẠP PIVOT TẠI ĐÂY NỮA, SẼ NẠP TRONG PROJECT MIGRATION)

  fs.writeFileSync(OUTPUT_FILE, sqlCommands.join("\n"));
  
  console.log(`\n🎉 THÀNH CÔNG! Đã bọc dữ liệu Wiki thành file lệnh SQL: ${OUTPUT_FILE}`);
  console.log("Tiến hành tiêm Wiki vào D1 Local:");
  console.log("npx wrangler d1 execute backing-score-prod --local --file=scripts/v5/dump_wiki.sql");
}

main().catch(console.error);
