import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const db = createClient({ 
  url: process.env.TURSO_DATABASE_URL, 
  authToken: process.env.TURSO_AUTH_TOKEN 
});

async function main() {
  const result = await db.execute({
    sql: "SELECT name, payload FROM projects WHERE id = ?",
    args: ["69c17fad00297666b725"]
  });
  console.log(result.rows[0]);
}
main();
