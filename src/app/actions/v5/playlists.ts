"use server";

import { getDb } from "@/db";
import { setlists, setlistItems } from "@/db/schema/collections";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getAuth } from "@/lib/auth/better-auth";
import { headers } from "next/headers";
import type { PlaylistDocument } from "@/lib/appwrite/types";

// Helper internal function to fetch items for a setlist since we do simple joins
async function getPlaylistItems(db: any, playlistId: string): Promise<string[]> {
   const items = await db.select()
       .from(setlistItems)
       .where(eq(setlistItems.setlistId, playlistId))
       .orderBy(setlistItems.orderIndex);
   return items.map((i: any) => i.projectId);
}

// Giả lập Appwrite shape
async function mockFormat(db: any, row: any): Promise<PlaylistDocument> {
  const pIds = await getPlaylistItems(db, row.id);
  return {
    $id: row.id,
    $createdAt: new Date(row.createdAt).toISOString(),
    $updatedAt: new Date(row.createdAt).toISOString(),
    ownerId: row.userId,
    name: row.name,
    description: row.description || "",
    isPublished: Boolean(row.isPublished),
    coverImageId: row.coverImageId,
    projectIds: pIds,
  } as unknown as PlaylistDocument;
}

export async function listMyPlaylistsV5(): Promise<PlaylistDocument[]> {
  const env = process.env as any;
  const db = getDb();
  const auth = getAuth(env);

  const session = await auth.api.getSession({ headers: await headers() });
  
  if (!session?.user) throw new Error("Chưa đăng nhập");

  const results = await db
    .select()
    .from(setlists)
    .where(eq(setlists.userId, session.user.id))
    .orderBy(desc(setlists.createdAt))
    .limit(100);

  // We do this sequentially to map items, alternatively can use a JOIN or drizzle relation.
  const finalResults = [];
  for (const row of results) {
     finalResults.push(await mockFormat(db, row));
  }
  return finalResults;
}

export async function listPublishedPlaylistsV5(ownerId?: string): Promise<PlaylistDocument[]> {
  const env = process.env as any;
  const db = getDb();

  let conditions: any[] = [eq(setlists.isPublished, true)];
  if (ownerId) {
     conditions.push(eq(setlists.userId, ownerId));
  }
  
  const results = await db
    .select()
    .from(setlists)
    .where(and(...conditions))
    .orderBy(desc(setlists.createdAt))
    .limit(50);

  const finalResults = [];
  for (const row of results) {
     finalResults.push(await mockFormat(db, row));
  }
  return finalResults;
}

export async function getPlaylistV5(playlistId: string): Promise<PlaylistDocument> {
  const env = process.env as any;
  const db = getDb();

  const results = await db
    .select()
    .from(setlists)
    .where(eq(setlists.id, playlistId))
    .limit(1);

  if (results.length === 0) throw new Error("Playlist không tồn tại");

  return await mockFormat(db, results[0]);
}

export async function createPlaylistV5(params: {
  name: string;
  description?: string;
  coverImageId?: string;
}): Promise<PlaylistDocument> {
  const env = process.env as any;
  const db = getDb();
  const auth = getAuth(env);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Chưa đăng nhập");

  const newId = crypto.randomUUID();
  const now = Date.now();
  
  await db.insert(setlists).values({
     id: newId,
     userId: session.user.id,
     name: params.name,
     description: params.description || "",
     coverImageId: params.coverImageId || null,
     isPublished: false,
     createdAt: new Date(now),
  });

  return getPlaylistV5(newId);
}

export async function updatePlaylistV5(
  playlistId: string,
  updates: Partial<{
    name: string;
    description: string;
    isPublished: boolean;
    coverImageId: string;
    projectIds: string[];
  }>
): Promise<PlaylistDocument> {
  const env = process.env as any;
  const db = getDb();
  const auth = getAuth(env);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Chưa đăng nhập");

  const pl = await db.select().from(setlists).where(eq(setlists.id, playlistId)).limit(1);
  if (pl.length === 0) throw new Error("Not round");
  if (pl[0].userId !== session.user.id) throw new Error("Forbidden"); // Should only update own

  const body: any = {};
  if (updates.name !== undefined) body.name = updates.name;
  if (updates.description !== undefined) body.description = updates.description;
  if (updates.isPublished !== undefined) body.isPublished = updates.isPublished;
  if (updates.coverImageId !== undefined) body.coverImageId = updates.coverImageId;

  if (Object.keys(body).length > 0) {
      await db.update(setlists).set(body).where(eq(setlists.id, playlistId));
  }

  // Handle items sync if needed
  if (updates.projectIds !== undefined) {
      // Xoá list cũ
      await db.delete(setlistItems).where(eq(setlistItems.setlistId, playlistId));
      
      // Chèn list mới
      if (updates.projectIds.length > 0) {
          const toInsert = updates.projectIds.map((pId, idx) => ({
             id: `${playlistId}_${pId}_${idx}_${Date.now()}`,
             setlistId: playlistId,
             projectId: pId,
             orderIndex: idx,
          }));
          await db.insert(setlistItems).values(toInsert);
      }
  }

  return getPlaylistV5(playlistId);
}

export async function addProjectToPlaylistV5(playlistId: string, projectId: string): Promise<PlaylistDocument> {
    const env = process.env as any;
    const db = getDb();
    
    // Check exist
    const exist = await db.select().from(setlistItems)
         .where(and(eq(setlistItems.setlistId, playlistId), eq(setlistItems.projectId, projectId)))
         .limit(1);
    
    if (exist.length > 0) return getPlaylistV5(playlistId);

    // Get max order
    const items = await db.select().from(setlistItems).where(eq(setlistItems.setlistId, playlistId)).orderBy(desc(setlistItems.orderIndex)).limit(1);
    const mIdx = items.length > 0 ? items[0].orderIndex + 1 : 0;

    await db.insert(setlistItems).values({
        id: crypto.randomUUID(),
        setlistId: playlistId,
        projectId: projectId,
        orderIndex: mIdx
    });

    return getPlaylistV5(playlistId);
}

export async function removeProjectFromPlaylistV5(playlistId: string, projectId: string): Promise<PlaylistDocument> {
    const env = process.env as any;
    const db = getDb(env.backing_score_prod);

    await db.delete(setlistItems)
         .where(and(
             eq(setlistItems.setlistId, playlistId),
             eq(setlistItems.projectId, projectId)
         ));
    
    return getPlaylistV5(playlistId);
}

export async function deletePlaylistV5(playlistId: string): Promise<void> {
   const env = process.env as any;
   const db = getDb(env.backing_score_prod);
   
   // D1 Delete Cascade will auto remove items
   await db.delete(setlists).where(eq(setlists.id, playlistId));
}

export async function removeProjectFromAllMyPlaylistsV5(projectId: string): Promise<void> {
   const env = process.env as any;
   const db = getDb(env.backing_score_prod);
   const auth = getAuth(env);

   const session = await auth.api.getSession({ headers: await headers() });
   if (!session?.user) return; // Silent fail if called background
   
   // Xoá tất cả item mà thuộc các playlist của mình chứa projectId này
   // Ở chuẩn SQL thì dùng Query có JOIN, nhưng ta làm đơn giản trước
   const mySetlists = await db.select().from(setlists).where(eq(setlists.userId, session.user.id));
   const myIds = mySetlists.map((s: any) => s.id);
   
   if (myIds.length > 0) {
      await db.delete(setlistItems).where(
          and(
              inArray(setlistItems.setlistId, myIds),
              eq(setlistItems.projectId, projectId)
          )
      );
   }
}
