import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

async function main() {
  const result = await db.execute("SELECT id, name, email FROM user LIMIT 1");
  if (result.rows.length > 0) {
    const userId = result.rows[0].id;
    console.log(`Tìm thấy Local User: ${result.rows[0].name} (ID: ${userId})`);
    
    // Gán User này làm Giáo viên cho lớp Piano 3
    await db.execute({
      sql: "UPDATE classrooms SET teacher_id = ? WHERE id = ?",
      args: [userId, "69cf294b001d96f3040a"]
    });
    console.log(`✅ Đã trao quyền Teacher của Classroom [69cf294b001d96f3040a] cho User [${userId}]`);
  } else {
    console.log("Không có dòng dữ liệu nào trong bảng user!");
  }
}
main().catch(console.error);
