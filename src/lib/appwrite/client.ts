/**
 * Appwrite client and services for Backing & Score.
 * Uses NEXT_PUBLIC_* env vars so the client runs in the browser.
 * See docs/appwrite-setup.md for creating the Appwrite project, database, and bucket.
 *
 * If .env is not set, client still exists but API calls will fail; use isAppwriteConfigured() to show setup UI.
 */

import {
  Client,
  Account,
  Databases,
  Storage,
  ID,
  Query,
  Permission,
  Role,
  type Models,
} from "appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";

const client = new Client();
client.setEndpoint(endpoint).setProject(projectId);

// Removed 100MB CHUNK_SIZE forcing to allow Appwrite's default 5MB chunking
// This fixes massive memory freezing and slow upload starts
export function getAppwriteClient(): Client {
  return client;
}

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

let cachedJwt: string | null = null;
let jwtExpires: number = 0;

export async function getAuthToken(): Promise<string | null> {
  try {
    if (cachedJwt && Date.now() < jwtExpires) {
      return cachedJwt;
    }
    const { jwt } = await account.createJWT();
    cachedJwt = jwt;
    jwtExpires = Date.now() + 14 * 60 * 1000; // cache for 14 mins
    return jwt;
  } catch (e) {
    return null;
  }
}

export { ID, Query, Permission, Role };
export type { Models };
