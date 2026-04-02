"use server";

import { Client, Databases } from "node-appwrite";
import { APPWRITE_POSTS_COLLECTION_ID } from "@/lib/appwrite/constants";

export async function updatePostStatsAction(postId: string, updates: { reactionLike?: number, reactionLove?: number, reactionHaha?: number, reactionWow?: number, reactionTotal?: number, commentsCount?: number }) {
  if (!process.env.APPWRITE_API_KEY) {
    console.error("Missing APPWRITE_API_KEY server environment variable.");
    return false;
  }

  try {
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const databases = new Databases(client);
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";
    
    const p = await databases.getDocument(dbId, APPWRITE_POSTS_COLLECTION_ID, postId);
    if (!p) return false;
    
    const payload: any = {};
    if (updates.reactionLike !== undefined) payload.reactionLike = Math.max(0, (p.reactionLike || 0) + updates.reactionLike);
    if (updates.reactionLove !== undefined) payload.reactionLove = Math.max(0, (p.reactionLove || 0) + updates.reactionLove);
    if (updates.reactionHaha !== undefined) payload.reactionHaha = Math.max(0, (p.reactionHaha || 0) + updates.reactionHaha);
    if (updates.reactionWow !== undefined) payload.reactionWow = Math.max(0, (p.reactionWow || 0) + updates.reactionWow);
    if (updates.commentsCount !== undefined) payload.commentsCount = Math.max(0, (p.commentsCount || 0) + updates.commentsCount);

    // Auto-heal 'reactionTotal' dynamically based on the sum of all individual flags!
    const finalLike = payload.reactionLike !== undefined ? payload.reactionLike : (p.reactionLike || 0);
    const finalLove = payload.reactionLove !== undefined ? payload.reactionLove : (p.reactionLove || 0);
    const finalHaha = payload.reactionHaha !== undefined ? payload.reactionHaha : (p.reactionHaha || 0);
    const finalWow  = payload.reactionWow  !== undefined ? payload.reactionWow  : (p.reactionWow  || 0);
    
    payload.reactionTotal = finalLike + finalLove + finalHaha + finalWow;

    await databases.updateDocument(dbId, APPWRITE_POSTS_COLLECTION_ID, postId, payload);
    return true;
  } catch (error) {
    console.error("Failed to update post stats via server action:", error);
    return false;
  }
}
