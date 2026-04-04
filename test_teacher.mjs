import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function main() {
  const result = await db.execute("SELECT id, name, teacher_id FROM classrooms");
  if (result.rows.length === 0) {
    console.log("Không có lớp học nào trong Database cả!");
  } else {
    for (const row of result.rows) {
      console.log(`Lớp học: [${row.id}] ${row.name}`);
      const userRes = await db.execute({
        sql: "SELECT name, email FROM users WHERE id = ?",
        args: [row.teacher_id]
      });
      if (userRes.rows.length > 0) {
        console.log(`  -> Giáo viên: ${userRes.rows[0].name} (${userRes.rows[0].email}) (ID: ${row.teacher_id})`);
      } else {
        console.log(`  -> Giáo viên: [Không tìm thấy trong Users] (ID: ${row.teacher_id})`);
      }
    }
  }
}

main().catch(console.error);
