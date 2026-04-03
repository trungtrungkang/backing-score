"use server";


import { getDb } from "@/db";
import { projects } from "@/db/schema/drive";
import { getAuth } from "@/lib/auth/better-auth";
import { headers } from "next/headers";
import { eq, desc, and, inArray } from "drizzle-orm";
import type { ProjectDocument, ProjectPayload } from "@/lib/appwrite/types";

/**
 * Hàm hỗ trợ đội lốt Model SQLite thành Model Appwrite
 */
function mockAppwriteFormat(row: any): ProjectDocument {
  // Fix double-stringify if it ever occurred
  let parsedPayload = row.payload;
  if (typeof parsedPayload === "string") {
      try { parsedPayload = JSON.parse(parsedPayload); } catch(e) {}
  }
  if (typeof parsedPayload === "string") {
      try { parsedPayload = JSON.parse(parsedPayload); } catch(e) {}
  }
  
  return {
    ...row,
    $id: row.id,
    $createdAt: new Date(row.createdAt).toISOString(),
    $updatedAt: new Date(row.updatedAt).toISOString(),
    name: row.title,
    published: Boolean(row.isPublished),
    // Appwrite models use string for payload
    payload: typeof parsedPayload === "object" ? JSON.stringify(parsedPayload) : String(parsedPayload),
    wikiGenreId: parsedPayload?.wikiGenreId,
    wikiInstrumentIds: parsedPayload?.wikiInstrumentIds || [],
    wikiCompositionId: parsedPayload?.wikiCompositionId,
    wikiComposerIds: parsedPayload?.wikiComposerIds || [],
    tags: parsedPayload?.tags || [],
  } as unknown as ProjectDocument;
}

export async function listMyProjectsV5(tagFilters?: string[]): Promise<ProjectDocument[]> {
  let env = process.env as any;
  try {
     const { getRequestContext } = await import('@cloudflare/next-on-pages');
     env = getRequestContext().env || env;
  } catch {}
  const db = getDb();
  const auth = getAuth(env);

  // Lấy Cookie/Headers gọi BetterAuth xác thực
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user) {
    throw new Error("Không có quyền truy cập. Vui lòng đăng nhập lại.");
  }

  const userId = session.user.id;

  // Gọi trực tiếp D1 SQLite
  const result = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt))
    .limit(100);

  // Ép kiểu Data trả về
  return result.map(mockAppwriteFormat);
}

export async function getProjectV5(projectId: string): Promise<ProjectDocument> {
  let env = process.env as any;
  try {
     const { getRequestContext } = await import('@cloudflare/next-on-pages');
     env = getRequestContext().env || env;
  } catch {}
  const db = getDb();

  const rs = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (rs.length === 0) {
    throw new Error("Dự án không tồn tại trên D1");
  }

  return mockAppwriteFormat(rs[0]);
}

export async function listPublishedV5(
  tagFilters?: string[],
  authorId?: string,
  wikiFilters?: { genreId?: string; instrumentIds?: string[] },
  searchQuery?: string
): Promise<ProjectDocument[]> {
  const env = process.env as any;
  const db = getDb();

  let q = db.select().from(projects).where(eq(projects.isPublished, true)).orderBy(desc(projects.updatedAt)).limit(50);
  
  // NOTE: Trong schema SQLite hiện tại ta đã loại bỏ mảng tags lưu kiểu NoSQL. 
  // Việc filter tags, search string sẽ được tối ưu bằng Full Text Search ở Phase sau.
  // Tạm thời trả về list mới nhất.
  
  const rs = await q;
  return rs.map(mockAppwriteFormat);
}

export async function updateProjectV5(
  projectId: string,
  updates: any
): Promise<ProjectDocument> {
  const env = process.env as any;
  const db = getDb();
  const auth = getAuth(env);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Chưa đăng nhập");

  const body: any = { updatedAt: new Date() };
  if (updates.name !== undefined) body.title = updates.name;
  if (updates.published !== undefined) body.isPublished = updates.published;
  if (updates.coverUrl !== undefined) body.coverUrl = updates.coverUrl;
  
  if (updates.payload !== undefined) {
      const pl = typeof updates.payload === 'string' ? JSON.parse(updates.payload) : updates.payload;
      if (updates.wikiGenreId !== undefined) pl.wikiGenreId = updates.wikiGenreId;
      if (updates.wikiInstrumentIds !== undefined) pl.wikiInstrumentIds = updates.wikiInstrumentIds;
      if (updates.wikiCompositionId !== undefined) pl.wikiCompositionId = updates.wikiCompositionId;
      if (updates.wikiComposerIds !== undefined) pl.wikiComposerIds = updates.wikiComposerIds;
      if (updates.tags !== undefined) pl.tags = updates.tags;
      body.payload = pl; // Drizzle {mode:'json'} tự động stringify
  } else if (updates.wikiGenreId !== undefined || updates.wikiInstrumentIds !== undefined || updates.wikiCompositionId !== undefined || updates.wikiComposerIds !== undefined || updates.tags !== undefined) {
      const existing = await getProjectV5(projectId);
      let pl: any = existing.payload;
      if (typeof pl === "string") {
         try { pl = JSON.parse(pl); } catch(e) {}
         if (typeof pl === "string") {
            try { pl = JSON.parse(pl); } catch(e) {}
         }
      }
      if (updates.wikiGenreId !== undefined) pl.wikiGenreId = updates.wikiGenreId;
      if (updates.wikiInstrumentIds !== undefined) pl.wikiInstrumentIds = updates.wikiInstrumentIds;
      if (updates.wikiCompositionId !== undefined) pl.wikiCompositionId = updates.wikiCompositionId;
      if (updates.wikiComposerIds !== undefined) pl.wikiComposerIds = updates.wikiComposerIds;
      if (updates.tags !== undefined) pl.tags = updates.tags;
      body.payload = pl;
  }

  await db.update(projects).set(body).where(eq(projects.id, projectId));
  return getProjectV5(projectId);
}

export async function createProjectV5(params: any): Promise<ProjectDocument> {
  const env = process.env as any;
  const db = getDb();
  const auth = getAuth(env);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Chưa đăng nhập");

  const newId = crypto.randomUUID();
  let pl: any = typeof params.payload === 'string' ? JSON.parse(params.payload) : (params.payload || {});
  if (params.wikiGenreId !== undefined) pl.wikiGenreId = params.wikiGenreId;
  if (params.wikiInstrumentIds !== undefined) pl.wikiInstrumentIds = params.wikiInstrumentIds;
  if (params.wikiCompositionId !== undefined) pl.wikiCompositionId = params.wikiCompositionId;
  if (params.wikiComposerIds !== undefined) pl.wikiComposerIds = params.wikiComposerIds;
  if (params.tags !== undefined) pl.tags = params.tags;

  await db.insert(projects).values({
     id: newId,
     userId: session.user.id,
     title: params.name || "Untitled",
     payload: pl,
     isPublished: false,
     coverUrl: params.coverUrl || null,
     folderId: params.folderId || null,
     createdAt: new Date(),
     updatedAt: new Date(),
  });

  return getProjectV5(newId);
}

export async function deleteProjectV5(projectId: string): Promise<void> {
  const env = process.env as any;
  const db = getDb();
  const auth = getAuth(env);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Chưa đăng nhập");

  await db.delete(projects).where(eq(projects.id, projectId));
}

export async function copyProjectToMineV5(projectId: string): Promise<ProjectDocument> {
   const src = await getProjectV5(projectId);
   if (!src.published) throw new Error("Not published");
   
   return createProjectV5({
      name: `${src.name} (copy)`,
      payload: src.payload,
      coverUrl: src.coverUrl
   });
}


// Discovery stubs
export async function listTrendingV5(limit: number = 8): Promise<ProjectDocument[]> {
  const env = process.env as any;
  const db = getDb(env.backing_score_prod);
  const rs = await db.select().from(projects).where(eq(projects.isPublished, true)).limit(limit);
  return rs.map(mockAppwriteFormat);
}

export async function listFeaturedV5(limit: number = 6): Promise<ProjectDocument[]> {
  const env = process.env as any;
  const db = getDb(env.backing_score_prod);
  const rs = await db.select().from(projects).where(eq(projects.isPublished, true)).limit(limit);
  return rs.map(mockAppwriteFormat);
}

export async function listMostFavoritedV5(limit: number = 8): Promise<ProjectDocument[]> {
  return listTrendingV5(limit);
}

export async function listRecentlyPublishedV5(limit: number = 8): Promise<ProjectDocument[]> {
  return listTrendingV5(limit);
}

export async function publishMyProjectV5(projectId: string, publish: boolean): Promise<ProjectDocument> {
  return updateProjectV5(projectId, { published: publish });
}

