"use server";

import { getDb } from "@/db";
import { projects } from "@/db/schema/drive";
import { getAuth } from "@/lib/auth/better-auth";
import { eq, and, desc, isNull, like } from "drizzle-orm";
// We mock SheetMusicDocument directly so we don't import from appwrite.
import type { SheetMusicDocument } from "@/lib/appwrite/types";

async function requireUser(clientUserId?: string) {
  if (clientUserId) return clientUserId;
  const auth = getAuth(process.env as any);
  const { headers } = await import("next/headers");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

function mockSheetMusic(row: any): SheetMusicDocument {
  const pl = typeof row.payload === "string" ? JSON.parse(row.payload || "{}") : (row.payload || {});
  
  return {
    $id: row.id,
    $createdAt: new Date(row.createdAt).toISOString(),
    $updatedAt: new Date(row.updatedAt).toISOString(),
    userId: row.userId,
    title: row.title,
    folderId: row.folderId,
    // Trích xuất từ payload
    fileId: pl.fileId || "",
    fileSize: pl.fileSize || 0,
    pageCount: pl.pageCount || 1,
    composer: pl.composer || null,
    instrument: pl.instrument || null,
    tags: pl.tags || [],
    favorite: pl.favorite || false,
    lastOpenedAt: pl.lastOpenedAt,
    // Extract thumbnail id from coverUrl if it starts with /api/r2/download/
    thumbnailId: row.coverUrl ? row.coverUrl.replace("/api/r2/download/", "") : null,
  } as unknown as SheetMusicDocument;
}

// ---------------------------------------------------------
// CRUD Actions
// ---------------------------------------------------------

export async function createSheetMusicV5(params: Partial<SheetMusicDocument>, _clientUserId?: string): Promise<SheetMusicDocument> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  const newId = crypto.randomUUID();
  
  const payload = {
     fileId: params.fileId,
     fileSize: params.fileSize,
     pageCount: params.pageCount,
     composer: params.composer,
     instrument: params.instrument,
     tags: params.tags,
     favorite: params.favorite || false,
  };

  const coverUrl = params.thumbnailId ? `/api/r2/download/${params.thumbnailId}` : null;

  await db.insert(projects).values({
     id: newId,
     projectType: "sheet_music",
     userId,
     title: params.title || "Untitled",
     folderId: params.folderId || null,
     coverUrl,
     payload: JSON.stringify(payload),
     createdAt: new Date(),
     updatedAt: new Date()
  });

  return getSheetMusicV5(newId);
}

export async function listMySheetMusicV5(
  folderId?: string | null,
  options?: {
    favoritesOnly?: boolean;
    sortBy?: "lastOpenedAt" | "title" | "$createdAt";
    sortOrder?: "asc" | "desc";
    search?: string;
    limit?: number;
    offset?: number;
  },
  _clientUserId?: string
): Promise<{ documents: SheetMusicDocument[]; total: number }> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();

  // Load toàn bộ sheet_music của user (Drizzle SQLite D1 không hỗ trợ dễ dàng JSON JSON_EXTRACT order 
  // nên ta sẽ query sau đó filter/sort in-memory cho tập < 1000 items)
  const q = await db.select().from(projects).where(and(eq(projects.userId, userId), eq(projects.projectType, "sheet_music")));
  
  let docs = q.map(mockSheetMusic);

  if (folderId !== undefined) {
      if (folderId === null) docs = docs.filter((d: SheetMusicDocument) => !d.folderId);
      else docs = docs.filter((d: SheetMusicDocument) => d.folderId === folderId);
  }

  if (options?.favoritesOnly) {
      docs = docs.filter((d: SheetMusicDocument) => d.favorite === true);
  }

  if (options?.search) {
      const s = options.search.toLowerCase();
      docs = docs.filter((d: SheetMusicDocument) => d.title.toLowerCase().includes(s));
  }

  // Sort
  const sortField = options?.sortBy || "$createdAt";
  docs.sort((a: any, b: any) => {
      const va = sortField === "$createdAt" ? new Date(a.$createdAt).getTime() : 
                 sortField === "lastOpenedAt" ? new Date(a.lastOpenedAt || 0).getTime() : a.title;
      const vb = sortField === "$createdAt" ? new Date(b.$createdAt).getTime() : 
                 sortField === "lastOpenedAt" ? new Date(b.lastOpenedAt || 0).getTime() : b.title;

      if (va < vb) return options?.sortOrder === "asc" ? -1 : 1;
      if (va > vb) return options?.sortOrder === "asc" ? 1 : -1;
      return 0;
  });

  const total = docs.length;
  if (options?.offset) {
      docs = docs.slice(options.offset);
  }
  if (options?.limit) {
      docs = docs.slice(0, options.limit);
  }

  return { documents: docs, total };
}

export async function getSheetMusicV5(id: string): Promise<SheetMusicDocument> {
  const db = getDb();
  const q = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (q.length === 0) throw new Error("Sheet Music not found");
  return mockSheetMusic(q[0]);
}

export async function updateSheetMusicV5(
  id: string,
  data: Partial<Pick<SheetMusicDocument, "title" | "composer" | "instrument" | "tags" | "folderId" | "favorite" | "lastOpenedAt" | "thumbnailId">>,
  _clientUserId?: string
): Promise<SheetMusicDocument> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  const q = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (q.length === 0 || q[0].userId !== userId) throw new Error("Forbidden");

  const p = q[0];
  const oldPl = typeof p.payload === "string" ? JSON.parse(p.payload) : p.payload;
  
  const updates: any = { updatedAt: new Date() };
  if (data.title !== undefined) updates.title = data.title;
  if (data.folderId !== undefined) updates.folderId = data.folderId;
  if (data.thumbnailId !== undefined) updates.coverUrl = `/api/r2/download/${data.thumbnailId}`;

  const newPl = { ...oldPl };
  if (data.composer !== undefined) newPl.composer = data.composer;
  if (data.instrument !== undefined) newPl.instrument = data.instrument;
  if (data.tags !== undefined) newPl.tags = data.tags;
  if (data.favorite !== undefined) newPl.favorite = data.favorite;
  if (data.lastOpenedAt !== undefined) newPl.lastOpenedAt = data.lastOpenedAt;

  updates.payload = JSON.stringify(newPl);

  await db.update(projects).set(updates).where(eq(projects.id, id));
  return getSheetMusicV5(id);
}

export async function deleteSheetMusicV5(id: string, _clientUserId?: string): Promise<void> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  const q = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (q.length === 0 || q[0].userId !== userId) throw new Error("Forbidden");

  // R2 assets cleanup could be added here in the future
  await db.delete(projects).where(eq(projects.id, id));
}

// Admin only list
export async function listSheetMusicV5(limit = 100): Promise<{ documents: SheetMusicDocument[], total: number }> {
    const db = getDb();
    const q = await db.select().from(projects).where(eq(projects.projectType, "sheet_music")).orderBy(desc(projects.createdAt)).limit(limit);
    return { documents: q.map(mockSheetMusic), total: q.length };
}
