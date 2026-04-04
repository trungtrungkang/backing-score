import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
async function main() {
  const result = await db.execute("SELECT id, name, email FROM users");
  for (const row of result.rows) {
    console.log(`User: ${row.name} (${row.email}) (ID: ${row.id})`);
  }
}
main().catch(console.error);
