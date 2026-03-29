import { Client, Databases, Query } from "node-appwrite";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";
const PROJECTS_COLLECTION = process.env.NEXT_PUBLIC_APPWRITE_PROJECTS_COLLECTION_ID || "projects";

function getServerClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(client);
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; 
  }
  return Math.abs(hash);
}

let cachedChallenge: any = null;
let customCachedDateStr: string = "";

export async function getDailyChallenge() {
  const todayStr = new Date().toISOString().slice(0, 10);
  
  if (cachedChallenge && customCachedDateStr === todayStr) {
    return cachedChallenge;
  }

  const db = getServerClient();
  const result = await db.listDocuments(DB, PROJECTS_COLLECTION, [
    Query.equal("published", true),
    Query.limit(50),
    Query.orderDesc("publishedAt")
  ]);

  if (result.documents.length === 0) return null;

  const hashValue = hashString(todayStr);
  const pIndex = hashValue % result.documents.length;
  cachedChallenge = result.documents[pIndex];
  customCachedDateStr = todayStr;

  return cachedChallenge;
}
