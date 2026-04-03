#!/usr/bin/env node

/**
 * Script này càn quét toàn bộ bảng Users của Appwrite và tạo ra file `dump_users.sql`.
 * Mục đích: Thực thi Data Dump vào D1 để giải quyết bài toán Account Linking (OAuth) của BetterAuth.
 */

import { Client, Users, Query } from "node-appwrite";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error("Thiếu biến môi trường Appwrite trong .env.local!");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const usersAppwrite = new Users(client);

// File xuất ra
const OUTPUT_FILE = path.join(process.cwd(), "scripts", "v5", "dump_users.sql");

// Hàm escape cho SQL an toàn
function escapeSql(val) {
  if (val === undefined || val === null) return "NULL";
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "number") return val;
  // Replace single quotes with double single quotes for sqlite
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
  console.log("🚀 Bắt đầu quét cạn dữ liệu User từ Appwrite...");
  
  let allUsers = [];
  let offset = 0;
  // Query 100 users mỗi lần để tránh rate limit
  let hasMore = true;

  while (hasMore) {
    // node-appwrite sdk không xài query.offset() bình thường được mà phải truyền object parameters tuỳ phiên bản.
    // Cách an toàn là dùng URL Queries Array.
    // Ví dụ queries: [`limit(100)`, `offset(${offset})`]
    // Tuy nhiên theo doc mới chuẩn nhất ta truyền queries array:
    const response = await usersAppwrite.list([
        Query.limit(100),
        Query.offset(offset)
    ]);

    const batch = response.users;
    if (batch.length === 0) {
      hasMore = false;
    } else {
      allUsers.push(...batch);
      console.log(`Đã kéo mẻ ${batch.length} users (Tổng: ${allUsers.length})`);
      offset += 100;
      
      // Delay 500ms tránh spam API
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\n🎉 Quét thành công! Tổng số Appwrite Users: ${allUsers.length}`);

  // Chuyển thể thành Drizzle SQL Mode
  const sqlCommands = [];
  for (const user of allUsers) {
    const id = user.$id;
    // Bắt dự phòng tên rỗng vì Appwrite đôi khi Name rỗng nhưng BetterAuth yêu cầu NotNull
    const name = user.name || "Appwrite User"; 
    const email = user.email;
    const emailVerified = user.emailVerification ? 1 : 0;
    
    // SQLite drizzle mode timestamp lưu timestamp dạng Epoch Miliseconds (số nguyên)
    const createdAt = new Date(user.$createdAt).getTime();
    const updatedAt = new Date(user.$updatedAt).getTime();
    
    let role = "student";
    if (user.labels && user.labels.includes("admin")) {
        role = "admin";
    }

    const command = `INSERT INTO users (id, name, email, email_verified, image, created_at, updated_at, role) VALUES (${escapeSql(id)}, ${escapeSql(name)}, ${escapeSql(email)}, ${emailVerified}, NULL, ${createdAt}, ${updatedAt}, ${escapeSql(role)}) ON CONFLICT(id) DO NOTHING;`;
    sqlCommands.push(command);
  }

  fs.writeFileSync(OUTPUT_FILE, sqlCommands.join("\n"));
  
  console.log(`\n✅ Đã bọc dữ liệu thành file SQL: ${OUTPUT_FILE}`);
  console.log("\nĐể kết thúc quá trình Di trú, bạn hãy chạy lệnh sau:");
  console.log("\n  npx wrangler d1 execute backing-score-prod --local --file=scripts/v5/dump_users.sql");
  console.log("  (Thay --local bằng --remote nếu muốn cấy thẳng vào Server D1 trên cấu hình mạng)");
}

main().catch(console.error);
