import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.warn("🚨 CRITICAL: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is missing in environment variables.");
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://dummy.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN || 'dummy',
});

// Create base instance
export const db = drizzle(client);

// Stub getDb for backwards compatibility with existing backend code
export function getDb(envBinding?: any, schemaConfig?: any) {
  if (schemaConfig) {
    return drizzle(client, { schema: schemaConfig });
  }
  return db;
}
