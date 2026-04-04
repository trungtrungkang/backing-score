import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const db = createClient({ 
  url: process.env.TURSO_DATABASE_URL, 
  authToken: process.env.TURSO_AUTH_TOKEN 
});

async function main() {
  try {
    const result = await db.execute("SELECT id, name FROM projects LIMIT 5");
    console.log("Tìm thấy các bài nhạc sau:");
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error("Lỗi:", err.message);
  }
}
main();
