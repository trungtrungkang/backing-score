#!/usr/bin/env node

/**
 * Script này càn quét toàn bộ bảng Projects & Folders của Appwrite 
 * và tạo ra file `dump_drive.sql`.
 */

import { Client, Databases, Query, Users } from "node-appwrite";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "backing_score_db";
const COLL_PROJECTS = process.env.NEXT_PUBLIC_APPWRITE_PROJECTS_COLLECTION_ID ?? "projects";
const COLL_FOLDERS = "project_folders"; 

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error("Thiếu biến môi trường Appwrite trong .env.local!");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);

// File xuất ra
const OUTPUT_FILE = path.join(process.cwd(), "scripts", "v5", "dump_drive.sql");

// Hàm escape cho SQL an toàn
function escapeSql(val) {
  if (val === undefined || val === null) return "NULL";
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "number") return val;
  // Xử lý chuỗi JSON và Text
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
      if (batch.length === 0) {
        hasMore = false;
      } else {
        allDocs.push(...batch);
        process.stdout.write(`Đã tải ${allDocs.length} từ ${collectionId}...\r`);
        offset += 100;
        await new Promise(r => setTimeout(r, 250));
      }
    } catch (e) {
      if (e.code === 404) {
         console.warn(`\n[Cảnh báo] Không tìm thấy collection ${collectionId}. Bỏ qua!`);
         return [];
      }
      throw e;
    }
  }
  console.log(`\nHoàn thành tải ${allDocs.length} record từ ${collectionId}.`);
  return allDocs;
}

async function main() {
  // ===================================
  // Lấy sanh sách USER HỢP LỆ ĐỂ TRÁNH NGOẠI LỆ TRÊN D1
  // ===================================
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

  const folders = await fetchAll(COLL_FOLDERS);
  const projects = await fetchAll(COLL_PROJECTS);

  const sqlCommands = [
    "PRAGMA defer_foreign_keys = TRUE;",
    "PRAGMA foreign_keys = OFF;"
  ];

  // ===================================
  // 1. PROJECT FOLDERS
  // ===================================
  for (const folder of folders) {
    if (!validUserIds.has(folder.userId)) continue;

    const id = folder.$id;
    const userId = folder.userId;
    const name = folder.name || "Untitled Folder";
    const parentId = folder.parentId || null;
    const createdAt = new Date(folder.$createdAt).getTime();

    const cmd = `INSERT INTO project_folders (id, user_id, name, parent_id, created_at) VALUES (${escapeSql(id)}, ${escapeSql(userId)}, ${escapeSql(name)}, ${escapeSql(parentId)}, ${createdAt}) ON CONFLICT(id) DO NOTHING;`;
    sqlCommands.push(cmd);
  }

  // ===================================
  // 2. PROJECTS (BỎ QUA WIKI PIVOT VÌ CHƯA DUMP WIKI)
  // ===================================
  for (const proj of projects) {
    if (!validUserIds.has(proj.userId)) continue;

    const id = proj.$id;
    const userId = proj.userId;
    const folderId = proj.folderId || null;
    const title = proj.name || "Untitled";
    const coverUrl = proj.coverUrl || null;
    
    const payload = typeof proj.payload === 'string' ? proj.payload : JSON.stringify(proj.payload || { version: 1 });
    
    const isPublished = proj.published ? 1 : 0;
    const createdAt = new Date(proj.$createdAt).getTime();
    const updatedAt = new Date(proj.$updatedAt).getTime();

    const cmdProject = `INSERT INTO projects (id, user_id, folder_id, title, cover_url, payload, is_published, created_at, updated_at) VALUES (${escapeSql(id)}, ${escapeSql(userId)}, ${escapeSql(folderId)}, ${escapeSql(title)}, ${escapeSql(coverUrl)}, ${escapeSql(payload)}, ${isPublished}, ${createdAt}, ${updatedAt}) ON CONFLICT(id) DO NOTHING;`;
    sqlCommands.push(cmdProject);
  }

  fs.writeFileSync(OUTPUT_FILE, sqlCommands.join("\n"));
  
  console.log(`\n✅ Đã bọc dữ liệu thành file SQL: ${OUTPUT_FILE}`);
  console.log("Để bơm dữ liệu vào Database, hãy chạy lệnh:");
  console.log("\n  npx wrangler d1 execute backing-score-prod --local --file=scripts/v5/dump_drive.sql");
}

main().catch(console.error);
