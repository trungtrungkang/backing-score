import { drizzle } from 'drizzle-orm/d1';
import { getRequestContext } from '@cloudflare/next-on-pages';

export function getDb(envBinding?: import("@cloudflare/workers-types").D1Database, schemaConfig?: any) {
  if (envBinding) {
    return drizzle(envBinding, schemaConfig ? { schema: schemaConfig } : undefined);
  }
  
  // Fallback lấy env chính xác từ next-on-pages runtime request
  let d1: any = undefined;
  
  try {
     const env = getRequestContext().env as any;
     if (env && env.backing_score_prod) {
         d1 = env.backing_score_prod;
     }
  } catch (err) {}

  if (!d1) {
     if (process.env.NODE_ENV === "development") {
        // Mock D1 locally using better-sqlite3 for Node.js Next.js workers
        const fs = require('fs');
        const path = require('path');
        const dbDir = path.join(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
        
        let sqliteFile;
        try {
           const files = fs.readdirSync(dbDir).filter((f: string) => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
           if (files.length > 0) {
               // Chọn file có dung lượng lớn nhất (chứa data thật)
               let largestSize = -1;
               for (const f of files) {
                   const stats = fs.statSync(path.join(dbDir, f));
                   if (stats.size > largestSize) {
                       largestSize = stats.size;
                       sqliteFile = f;
                   }
               }
           }
        } catch(e) {}

        if (sqliteFile) {
           const Database = require('better-sqlite3');
           const { drizzle: sqliteDrizzle } = require('drizzle-orm/better-sqlite3');
           const sqlite = new Database(path.join(dbDir, sqliteFile));
           return sqliteDrizzle(sqlite, schemaConfig ? { schema: schemaConfig } : undefined);
        }
     }
  }
  
  if (!d1) {
     console.error("🚨 CRITICAL: Cannot find Cloudflare D1 Binding 'backing_score_prod' in process.env or getRequestContext(). D1 Queries will crash!");
  }

  return drizzle(d1, schemaConfig ? { schema: schemaConfig } : undefined);
}
