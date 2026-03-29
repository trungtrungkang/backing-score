import { Client, Databases } from "node-appwrite";
import { APPWRITE_PLATFORM_CONFIG_COLLECTION_ID } from "./constants";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";

function getServerClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(client);
}

// In-memory cache to avoid repeated DB calls on the server (Vercel edge limits)
// Cache is kept for 5 minutes
const configCache = new Map<string, { value: any; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getPlatformConfig<T>(key: string): Promise<T | null> {
  const now = Date.now();
  if (configCache.has(key)) {
    const cached = configCache.get(key)!;
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return cached.value as T;
    }
  }

  try {
    const db = getServerClient();
    const doc = await db.getDocument(DB, APPWRITE_PLATFORM_CONFIG_COLLECTION_ID, key);
    if (!doc || !doc.value) return null;

    const parsed = JSON.parse(doc.value) as T;
    configCache.set(key, { value: parsed, timestamp: now });
    return parsed;
  } catch (err) {
    console.error(`[Config] Failed to fetch config '${key}':`, err);
    return null;
  }
}

export async function clearPlatformConfigCache(key: string) {
  configCache.delete(key);
}
