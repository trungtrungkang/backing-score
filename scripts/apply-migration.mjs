import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function run() {
  try {
    const rawSql = fs.readFileSync(path.join(process.cwd(), "drizzle", "0011_heavy_blindfold.sql"), "utf-8");
    const statements = rawSql.split("--> statement-breakpoint").map(s => s.trim()).filter(s => s.length > 0);
    
    for (const sql of statements) {
       console.log("Executing:", sql);
       await client.execute({ sql, args: [] });
    }
    
    console.log("MIGRATION APPLIED SUCESSFULLY!");
  } catch (e) {
    console.error("Error migrating:", e);
  }
}
run();
