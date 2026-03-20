"use server";

import { Client, Users } from "node-appwrite";

/**
 * Fetches a public user profile via the Appwrite Server SDK.
 * Bypasses Client-side permissions to safely read basic Name/Prefs details.
 */
export async function getPublicProfile(userId: string) {
  if (!process.env.APPWRITE_API_KEY) {
    console.error("Missing APPWRITE_API_KEY server environment variable.");
    return null;
  }

  try {
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const users = new Users(client);
    const profile = await users.get(userId);
    
    // Force prototype stripping utilizing JSON transform so Next.js doesn't crash passing to Client Components
    return JSON.parse(JSON.stringify({
      $id: profile.$id,
      name: profile.name,
      prefs: profile.prefs || {},
    }));
  } catch (error: any) {
    console.error("Failed to fetch Appwrite user profile:", error);
    // Explicit return null if User doesn't exist to prevent rendering crashes
    if (error?.code === 404) return null;
    return null;
  }
}
