"use server";

import { getDb } from "@/db";
import { classroomMaterials, classrooms } from "@/db/schema/classroom";
import { eq, desc, and } from "drizzle-orm";
import { getAuth } from "@/lib/auth/better-auth";
import { headers } from "next/headers";
import type { ClassroomMaterialDocument } from "@/lib/appwrite/types";

async function requireUser(clientUserId?: string) {
  if (clientUserId) return clientUserId;
  const env = process.env as any;
  const auth = getAuth(env);
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

function mockMaterial(row: any): ClassroomMaterialDocument {
  return {
    $id: row.id,
    $createdAt: new Date(row.createdAt).toISOString(),
    $updatedAt: new Date(row.createdAt).toISOString(),
    classroomId: row.classroomId,
    sheetMusicId: row.sheetMusicId,
    sharedById: row.sharedById,
    note: row.note,
  } as unknown as ClassroomMaterialDocument;
}

export async function shareToClassroomV5(params: any, _clientUserId?: string): Promise<ClassroomMaterialDocument> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  
  const c = await db.select().from(classrooms).where(eq(classrooms.id, params.classroomId)).limit(1);
  if (c.length === 0 || c[0].teacherId !== userId) throw new Error("Forbidden"); // Only teacher can share materials right now

  const newId = crypto.randomUUID();
  await db.insert(classroomMaterials).values({
     id: newId,
     classroomId: params.classroomId,
     sheetMusicId: params.sheetMusicId,
     sharedById: userId,
     note: params.note || "",
     createdAt: new Date()
  });

  const rs = await db.select().from(classroomMaterials).where(eq(classroomMaterials.id, newId)).limit(1);
  return mockMaterial(rs[0]);
}

export async function listClassroomMaterialsV5(classroomId: string, _clientUserId?: string): Promise<ClassroomMaterialDocument[]> {
  const db = getDb();
  const rs = await db.select().from(classroomMaterials).where(eq(classroomMaterials.classroomId, classroomId)).orderBy(desc(classroomMaterials.createdAt));
  return rs.map(mockMaterial);
}

export async function removeClassroomMaterialV5(materialId: string, _clientUserId?: string): Promise<void> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();

  const m = await db.select().from(classroomMaterials).where(eq(classroomMaterials.id, materialId)).limit(1);
  if (m.length === 0) return;
  
  const c = await db.select().from(classrooms).where(eq(classrooms.id, m[0].classroomId)).limit(1);
  if (c.length === 0 || c[0].teacherId !== userId) throw new Error("Forbidden");

  await db.delete(classroomMaterials).where(eq(classroomMaterials.id, materialId));
}
