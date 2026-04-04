import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const db = createClient({ 
  url: process.env.TURSO_DATABASE_URL, 
  authToken: process.env.TURSO_AUTH_TOKEN 
});

async function main() {
  try {
    const sessions = await db.execute("SELECT id, classroom_id, started_at, ended_at FROM live_sessions ORDER BY started_at DESC LIMIT 5");
    console.log("--- BẢNG LIVE SESSIONS ---");
    console.table(sessions.rows);

    const attendances = await db.execute("SELECT id, session_id, student_id, joined_at, left_at FROM live_attendances ORDER BY joined_at DESC LIMIT 5");
    console.log("\n--- BẢNG LIVE ATTENDANCES ---");
    console.table(attendances.rows);
  } catch (err) {
    console.error("Lỗi kết nối DB:", err.message);
  }
}
main();
