"use server";

import { getDb } from "@/db";
import { setlists, setlistItems } from "@/db/schema/collections";
import { projects } from "@/db/schema/drive";
import { eq, desc, inArray } from "drizzle-orm";
import { getAuth } from "@/lib/auth/better-auth";
import { headers } from "next/headers";
import type { SetlistDocument, SetlistItem } from "@/lib/appwrite/types";

// Lấy thông tin relation items và mock lại JSON thô
async function mockFormat(db: any, row: any): Promise<SetlistDocument> {
  // Join với projects để lấy name, pageCount cho mảng items
  const itemsRs = await db
    .select({
       projectId: setlistItems.projectId,
       orderIndex: setlistItems.orderIndex,
       title: projects.title,
       payload: projects.payload
    })
    .from(setlistItems)
    .leftJoin(projects, eq(setlistItems.projectId, projects.id))
    .where(eq(setlistItems.setlistId, row.id))
    .orderBy(setlistItems.orderIndex);

  const mappedItems: SetlistItem[] = itemsRs.map((i: any) => {
      let pc = 0;
      if (i.payload) {
         try {
           const payloadObj = typeof i.payload === "string" ? JSON.parse(i.payload) : i.payload;
           pc = payloadObj?.notationData?.pages?.length || payloadObj?.pdfMap?.pages || 0;
         } catch {} // ignore
      }
      return {
          sheetMusicId: i.projectId,
          title: i.title || "Unknown File",
          pageCount: pc
      };
  });

  return {
    $id: row.id,
    $createdAt: new Date(row.createdAt).toISOString(),
    $updatedAt: new Date(row.createdAt).toISOString(),
    userId: row.userId,
    name: row.name,
    items: JSON.stringify(mappedItems),
  } as unknown as SetlistDocument;
}

export async function createSetlistV5(name: string, items: SetlistItem[] = []): Promise<SetlistDocument> {
  const env = process.env as any;
  const db = getDb();
  const auth = getAuth(env);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");

  const newId = crypto.randomUUID();
  
  await db.insert(setlists).values({
     id: newId,
     userId: session.user.id,
     name: name.trim() || 'Untitled Setlist',
     createdAt: new Date(),
  });

  if (items.length > 0) {
      const inserts = items.map((i, idx) => ({
          id: crypto.randomUUID(),
          setlistId: newId,
          projectId: i.sheetMusicId,
          orderIndex: idx
      }));
      // Filter out empty ones if any
      const validInserts = inserts.filter(i => i.projectId);
      if (validInserts.length > 0) {
          await db.insert(setlistItems).values(validInserts);
      }
  }

  return getSetlistV5(newId);
}

export async function getSetlistV5(id: string): Promise<SetlistDocument> {
  const env = process.env as any;
  const db = getDb();

  const results = await db.select().from(setlists).where(eq(setlists.id, id)).limit(1);
  if (results.length === 0) throw new Error("Setlist not found");

  return mockFormat(db, results[0]);
}

export async function listMySetlistsV5(): Promise<SetlistDocument[]> {
  const env = process.env as any;
  const db = getDb();
  const auth = getAuth(env);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");

  const results = await db.select()
       .from(setlists)
       .where(eq(setlists.userId, session.user.id))
       .orderBy(desc(setlists.createdAt))
       .limit(100);

  const out = [];
  for (const r of results) {
     out.push(await mockFormat(db, r));
  }
  return out;
}

export async function updateSetlistV5(
  id: string,
  updates: { name?: string; items?: SetlistItem[] }
): Promise<SetlistDocument> {
   const env = process.env as any;
   const db = getDb();
   const auth = getAuth(env);

   const session = await auth.api.getSession({ headers: await headers() });
   if (!session?.user) throw new Error("Unauthorized");

   const rs = await db.select().from(setlists).where(eq(setlists.id, id)).limit(1);
   if (rs.length === 0) throw new Error("Cannot find setlist");
   if (rs[0].userId !== session.user.id) throw new Error("Forbidden");

   if (updates.name !== undefined) {
      await db.update(setlists)
            .set({ name: updates.name.trim() })
            .where(eq(setlists.id, id));
   }

   if (updates.items !== undefined) {
      await db.delete(setlistItems).where(eq(setlistItems.setlistId, id));
      if (updates.items.length > 0) {
          const inserts = updates.items.map((i, idx) => ({
              id: crypto.randomUUID(),
              setlistId: id,
              projectId: i.sheetMusicId,
              orderIndex: idx
          }));
          const validInserts = inserts.filter(i => i.projectId);
          if (validInserts.length > 0) {
             await db.insert(setlistItems).values(validInserts);
          }
      }
   }

   return getSetlistV5(id);
}

export async function deleteSetlistV5(id: string): Promise<void> {
   const env = process.env as any;
   const db = getDb();
   
   await db.delete(setlists).where(eq(setlists.id, id));
}

export async function removeProjectFromAllSetlistsV5(projectId: string): Promise<void> {
   const env = process.env as any;
   const db = getDb();
   const auth = getAuth(env);

   const session = await auth.api.getSession({ headers: await headers() });
   if (!session?.user) return; // Silent background fail
   
   const mySetlists = await db.select({ id: setlists.id }).from(setlists).where(eq(setlists.userId, session.user.id));
   const myIds = mySetlists.map((s: { id: string }) => s.id);
   
   if (myIds.length > 0) {
      const qIds = await db.delete(setlistItems)
        // Note: eq(projectId) removes the specific item
        .where(eq(setlistItems.projectId, projectId))
        .returning({ sId: setlistItems.setlistId });
   }
}
