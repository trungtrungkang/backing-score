#!/usr/bin/env node

/**
 * Script tàn sát nốt 3 tụ điểm dữ liệu mồ côi:
 * 1. Collections (Setlists / Playlists)
 * 2. Gamification (User Stats, Practice)
 * 3. Monetization (Products, Purchases)
 */

import { Client, Databases, Query, Users } from "node-appwrite";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT).setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID).setKey(process.env.APPWRITE_API_KEY);
const databases = new Databases(client);

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "backing_score_db";

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
  console.log("🕵️‍♂️ Đang càn quét Users & Projects để lọc rác Foreign Keys...");
  
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

  console.log(`Đã load ${validUserIds.size} Users hợp pháp & ${validProjectIds.size} Projects chuẩn.`);
  console.log("\n======================================");
  console.log("🔥 CHÍNH THỨC XÚC DATA");
  console.log("======================================");

  // 1. COLLECTIONS
  const setlists = await fetchAll("setlists");

  // 2. GAMIFICATION
  const userStats = await fetchAll("user_stats");
  const practiceSessions = await fetchAll("practice_sessions");
  const platformConfig = await fetchAll("platform_config");

  // 3. MONETIZATION
  const products = await fetchAll("products");
  const purchases = await fetchAll("purchases");
  const entitlements = await fetchAll("entitlements");

  const sqlCommands = [
    "PRAGMA defer_foreign_keys = TRUE;",
    "PRAGMA foreign_keys = OFF;"
  ];

  // ==========================================
  // SETLISTS
  // ==========================================
  for (const doc of setlists) {
    if (!validUserIds.has(doc.userId)) continue;
    
    // Insert Parent Setlist
    const createdAt = new Date(doc.$createdAt).getTime();
    const cmd = `INSERT INTO setlists (id, user_id, name, description, created_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.userId)}, ${escapeSql(doc.name)}, ${escapeSql(doc.description)}, ${createdAt}) ON CONFLICT(id) DO NOTHING;`;
    sqlCommands.push(cmd);

    // Insert Items
    if (doc.items && typeof doc.items === 'string') {
        try {
            const arr = JSON.parse(doc.items);
            arr.forEach((item, index) => {
                const pId = item.sheetMusicId || item.projectId;
                if (pId && validProjectIds.has(pId)) {
                   const itemId = `${doc.$id}_${pId}_${index}`;
                   sqlCommands.push(`INSERT INTO setlist_items (id, setlist_id, project_id, order_index) VALUES (${escapeSql(itemId)}, ${escapeSql(doc.$id)}, ${escapeSql(pId)}, ${index}) ON CONFLICT DO NOTHING;`);
                }
            });
        } catch {}
    }
  }

  // ==========================================
  // GAMIFICATION
  // ==========================================
  for (const doc of userStats) {
     if (!validUserIds.has(doc.userId)) continue;
     const badges = doc.badges ? JSON.stringify(doc.badges) : null;
     sqlCommands.push(`INSERT INTO user_stats (user_id, total_xp, level, current_streak, longest_streak, last_practice_date, total_practice_ms, badges) VALUES (${escapeSql(doc.userId)}, ${doc.totalXp || 0}, ${doc.level || 1}, ${doc.currentStreak || 0}, ${doc.longestStreak || 0}, ${escapeSql(doc.lastPracticeDate)}, ${doc.totalPracticeMs || 0}, ${escapeSql(badges)}) ON CONFLICT(user_id) DO NOTHING;`);
  }

  for (const doc of practiceSessions) {
     if (!validUserIds.has(doc.userId) || !validProjectIds.has(doc.projectId)) continue;
     const startedAt = doc.startedAt ? new Date(doc.startedAt).getTime() : new Date(doc.$createdAt).getTime();
     const completedAt = doc.completedAt ? new Date(doc.completedAt).getTime() : null;
     sqlCommands.push(`INSERT INTO practice_sessions (id, user_id, project_id, started_at, completed_at, duration_ms, max_speed, wait_mode_score, flow_mode_score, input_type) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.userId)}, ${escapeSql(doc.projectId)}, ${startedAt}, ${escapeSql(completedAt)}, ${doc.durationMs || 0}, ${escapeSql(doc.maxSpeed)}, ${escapeSql(doc.waitModeScore)}, ${escapeSql(doc.flowModeScore)}, ${escapeSql(doc.inputType)}) ON CONFLICT(id) DO NOTHING;`);
  }

  for (const doc of platformConfig) {
     const val = typeof doc.value === 'string' ? doc.value : JSON.stringify(doc.value);
     sqlCommands.push(`INSERT INTO platform_config (key, value) VALUES (${escapeSql(doc.$id)}, ${escapeSql(val)}) ON CONFLICT(key) DO NOTHING;`);
  }

  // ==========================================
  // MONETIZATION
  // ==========================================
  for (const doc of products) {
     if (!validUserIds.has(doc.creatorId)) continue;
     sqlCommands.push(`INSERT INTO products (id, creator_id, target_type, target_id, price_cents, lemon_squeezy_variant_id, status) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.creatorId)}, ${escapeSql(doc.targetType)}, ${escapeSql(doc.targetId)}, ${doc.priceCents || 0}, ${escapeSql(doc.lemonSqueezyVariantId)}, ${escapeSql(doc.status)}) ON CONFLICT(id) DO NOTHING;`);
  }

  for (const doc of purchases) {
     if (!validUserIds.has(doc.userId)) continue;
     const createdAt = new Date(doc.$createdAt).getTime();
     // Product lookup (to ensure Foreign Key valid on productId, but Appwrite productId might be deleted)
     sqlCommands.push(`INSERT INTO purchases (order_id, user_id, product_id, amount_cents, currency, created_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.userId)}, ${escapeSql(doc.productId)}, ${doc.amountCents || 0}, ${escapeSql(doc.currency)}, ${createdAt}) ON CONFLICT(order_id) DO NOTHING;`);
  }

  for (const doc of entitlements) {
     if (!validUserIds.has(doc.userId)) continue;
     const grantedAt = new Date(doc.$createdAt).getTime();
     sqlCommands.push(`INSERT INTO entitlements (id, user_id, target_type, target_id, source_product_id, granted_at) VALUES (${escapeSql(doc.$id)}, ${escapeSql(doc.userId)}, ${escapeSql(doc.targetType)}, ${escapeSql(doc.targetId)}, ${escapeSql(doc.sourceProductId)}, ${grantedAt}) ON CONFLICT(id) DO NOTHING;`);
  }

  const out = path.join(process.cwd(), "scripts", "v5", "dump_others.sql");
  fs.writeFileSync(out, sqlCommands.join("\n"));
  console.log(`\n🎉 SẠCH BÁCH! Đã cạo tận đáy Appwrite và gom rác vào ${out}`);
}

main().catch(console.error);
