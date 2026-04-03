"use server";

import { getDb } from "@/db";
import { favorites } from "@/db/schema/collections";
import { getAuth } from "@/lib/auth/better-auth";
import { eq, and, desc } from "drizzle-orm";
import type { FavoriteDocument } from "@/lib/appwrite/types";

// Auth helper
async function requireUser(clientUserId?: string) {
  if (clientUserId) return clientUserId;
  let env = process.env as any;
  try {
     const { getRequestContext } = await import('@cloudflare/next-on-pages');
     env = getRequestContext().env || env;
  } catch {}
  const auth = getAuth(env);
  const { headers } = await import("next/headers");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

function mockFavorite(row: any): FavoriteDocument {
   return {
      $id: row.id,
      $createdAt: new Date(row.createdAt).toISOString(),
      $updatedAt: new Date(row.createdAt).toISOString(),
      userId: row.userId,
      targetId: row.projectId,
      targetType: "project" // Note: we merged sheet music into project, so targetType is mostly 'project'
   } as unknown as FavoriteDocument;
}

export async function toggleFavoriteV5(targetType: string, targetId: string, _clientUserId?: string): Promise<boolean> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();

  const q = await db.select().from(favorites).where(and(eq(favorites.userId, userId), eq(favorites.projectId, targetId))).limit(1);
  if (q.length > 0) {
      await db.delete(favorites).where(eq(favorites.id, q[0].id));
      return false; // unfavorited
  } else {
      await db.insert(favorites).values({
          id: crypto.randomUUID(),
          userId,
          projectId: targetId,
          createdAt: new Date()
      });
      return true; // favorited
  }
}

export async function checkIsFavoritedV5(targetType: string, targetId: string, _clientUserId?: string): Promise<boolean> {
  try {
    const userId = await requireUser(_clientUserId);
    const db = getDb();
    const q = await db.select().from(favorites).where(and(eq(favorites.userId, userId), eq(favorites.projectId, targetId))).limit(1);
    return q.length > 0;
  } catch {
    return false;
  }
}

export async function listMyFavoritesV5(targetType?: string, _clientUserId?: string): Promise<FavoriteDocument[]> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  const q = await db.select().from(favorites).where(eq(favorites.userId, userId)).orderBy(desc(favorites.createdAt));
  return q.map(mockFavorite);
}

export async function removeAllFavoritesByTargetV5(targetType: string, targetId: string, _clientUserId?: string): Promise<void> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.projectId, targetId)));
}
