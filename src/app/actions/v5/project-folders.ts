"use server";

import { getDb } from "@/db";
import { projectFolders, projects } from "@/db/schema/drive";
import { getAuth } from "@/lib/auth/better-auth";
import { eq, and, desc } from "drizzle-orm";
import type { ProjectFolderDocument } from "@/lib/appwrite/types";

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

function mockFolder(row: any): ProjectFolderDocument {
   return {
      $id: row.id,
      $createdAt: new Date(row.createdAt).toISOString(),
      $updatedAt: new Date(row.createdAt).toISOString(),
      userId: row.userId,
      name: row.name,
      parentFolderId: row.parentId,
      order: 0
   } as unknown as ProjectFolderDocument;
}

export async function createProjectFolderV5(name: string, parentFolderId?: string | null, _clientUserId?: string): Promise<ProjectFolderDocument> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  
  const newId = crypto.randomUUID();
  await db.insert(projectFolders).values({
     id: newId,
     userId,
     name,
     parentId: parentFolderId || null,
     createdAt: new Date()
  });
  
  const q = await db.select().from(projectFolders).where(eq(projectFolders.id, newId)).limit(1);
  return mockFolder(q[0]);
}

export async function listProjectFoldersV5(_clientUserId?: string): Promise<ProjectFolderDocument[]> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  
  const q = await db.select().from(projectFolders).where(eq(projectFolders.userId, userId));
  return q.map(mockFolder);
}

export async function updateProjectFolderV5(folderId: string, name?: string, parentFolderId?: string | null, _clientUserId?: string): Promise<ProjectFolderDocument> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  
  const q = await db.select().from(projectFolders).where(eq(projectFolders.id, folderId)).limit(1);
  if (q.length === 0 || q[0].userId !== userId) throw new Error("Forbidden");
  
  const pl: any = {};
  if (name !== undefined) pl.name = name;
  if (parentFolderId !== undefined) pl.parentId = parentFolderId;
  
  if (Object.keys(pl).length > 0) {
      await db.update(projectFolders).set(pl).where(eq(projectFolders.id, folderId));
  }
  
  const rs = await db.select().from(projectFolders).where(eq(projectFolders.id, folderId)).limit(1);
  return mockFolder(rs[0]);
}

export async function deleteProjectFolderV5(folderId: string, _clientUserId?: string): Promise<void> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  
  const q = await db.select().from(projectFolders).where(eq(projectFolders.id, folderId)).limit(1);
  if (q.length === 0 || q[0].userId !== userId) throw new Error("Forbidden");
  
  // Xóa các sub-folders
  const subs = await db.select().from(projectFolders).where(eq(projectFolders.parentId, folderId));
  for (const s of subs) {
      await deleteProjectFolderV5(s.id, _clientUserId); // recursion
  }
  
  await db.delete(projectFolders).where(eq(projectFolders.id, folderId));
  // Note: các projects chứa trong folder sẽ bị unfile tự động do onDelete: 'set null'
}

export async function moveProjectToFolderV5(projectId: string, folderId: string | null, _clientUserId?: string): Promise<void> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  
  const q = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (q.length === 0 || q[0].userId !== userId) throw new Error("Forbidden");
  
  await db.update(projects).set({ folderId }).where(eq(projects.id, projectId));
}
