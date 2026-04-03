"use server";

import { getDb } from "@/db";
import { sheetNavMaps } from "@/db/schema/collections";
import { getAuth } from "@/lib/auth/better-auth";
import { eq, and } from "drizzle-orm";
import type { Bookmark, NavigationSequence, ParsedSheetNavMap, SheetNavMapDocument } from "@/lib/appwrite/nav-maps";

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

export async function getNavMapV5(sheetMusicId: string, _clientUserId?: string): Promise<ParsedSheetNavMap | null> {
  const db = getDb();
  const q = await db.select().from(sheetNavMaps).where(eq(sheetNavMaps.sheetMusicId, sheetMusicId)).limit(1);
  if (q.length === 0) return null;
  
  const doc = q[0];
  try {
     return {
         $id: doc.id,
         sheetMusicId: doc.sheetMusicId,
         bookmarks: JSON.parse(doc.bookmarks),
         sequence: JSON.parse(doc.sequence)
     };
  } catch {
     return null;
  }
}

export async function saveNavMapV5(sheetMusicId: string, bookmarks: Bookmark[], sequence: NavigationSequence, _clientUserId?: string): Promise<ParsedSheetNavMap> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();

  const q = await db.select().from(sheetNavMaps).where(eq(sheetNavMaps.sheetMusicId, sheetMusicId)).limit(1);
  if (q.length > 0) {
      if (q[0].userId !== userId) throw new Error("Forbidden");
      await db.update(sheetNavMaps).set({
         bookmarks: JSON.stringify(bookmarks),
         sequence: JSON.stringify(sequence),
         updatedAt: new Date()
      }).where(eq(sheetNavMaps.id, q[0].id));
      
      return {
         $id: q[0].id,
         sheetMusicId,
         bookmarks,
         sequence
      };
  } else {
      const newId = crypto.randomUUID();
      await db.insert(sheetNavMaps).values({
         id: newId,
         userId,
         sheetMusicId,
         bookmarks: JSON.stringify(bookmarks),
         sequence: JSON.stringify(sequence),
         createdAt: new Date(),
         updatedAt: new Date()
      });
      return {
         $id: newId,
         sheetMusicId,
         bookmarks,
         sequence
      };
  }
}

export async function deleteNavMapV5(sheetMusicId: string, _clientUserId?: string): Promise<void> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  
  const q = await db.select().from(sheetNavMaps).where(eq(sheetNavMaps.sheetMusicId, sheetMusicId)).limit(1);
  if (q.length > 0 && q[0].userId === userId) {
      await db.delete(sheetNavMaps).where(eq(sheetNavMaps.id, q[0].id));
  }
}
