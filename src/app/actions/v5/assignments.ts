"use server";

import { getDb } from "@/db";
import { assignments, classrooms } from "@/db/schema/classroom";
import { eq, desc, and } from "drizzle-orm";
import { getAuth } from "@/lib/auth/better-auth";
import { headers } from "next/headers";
import type { AssignmentDocument } from "@/lib/appwrite/types";

async function requireUser(clientUserId?: string) {
  if (clientUserId) return clientUserId;
  const env = process.env as any;
  const auth = getAuth(env);
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

function mockAssignment(row: any): AssignmentDocument {
  return {
    $id: row.id,
    $createdAt: new Date(row.createdAt).toISOString(),
    $updatedAt: new Date(row.createdAt).toISOString(),
    classroomId: row.classroomId,
    title: row.title,
    description: row.description,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    type: row.type,
    deadline: row.deadline,
    sheetMusicId: row.sheetMusicId,
    waitModeRequired: row.waitModeRequired
  } as unknown as AssignmentDocument;
}

export async function createAssignmentV5(params: any, _clientUserId?: string): Promise<AssignmentDocument> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  
  const c = await db.select().from(classrooms).where(eq(classrooms.id, params.classroomId)).limit(1);
  if (c.length === 0 || c[0].teacherId !== userId) throw new Error("Forbidden"); // Only teacher can create assignment

  const newId = crypto.randomUUID();
  await db.insert(assignments).values({
     id: newId,
     classroomId: params.classroomId,
     title: params.title,
     description: params.description || "",
     sourceType: params.sourceType,
     sourceId: params.sourceId,
     type: params.type || "practice",
     deadline: params.deadline || null,
     sheetMusicId: params.sheetMusicId || null,
     waitModeRequired: params.waitModeRequired || false,
     createdAt: new Date()
  });

  return getAssignmentV5(newId);
}

export async function listAssignmentsV5(classroomId: string, _clientUserId?: string): Promise<AssignmentDocument[]> {
  const db = getDb();
  const rs = await db.select().from(assignments).where(eq(assignments.classroomId, classroomId)).orderBy(desc(assignments.createdAt));
  return rs.map(mockAssignment);
}

export async function getAssignmentV5(assignmentId: string): Promise<AssignmentDocument> {
  const db = getDb();
  const rs = await db.select().from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
  if (rs.length === 0) throw new Error("Not found");
  return mockAssignment(rs[0]);
}

export async function updateAssignmentV5(assignmentId: string, updates: any, _clientUserId?: string): Promise<AssignmentDocument> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  
  const a = await db.select().from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
  if (a.length === 0) throw new Error("Not found");
  
  const c = await db.select().from(classrooms).where(eq(classrooms.id, a[0].classroomId)).limit(1);
  if (c.length === 0 || c[0].teacherId !== userId) throw new Error("Forbidden");

  const pl: any = {};
  if (updates.title !== undefined) pl.title = updates.title;
  if (updates.description !== undefined) pl.description = updates.description;
  if (updates.sourceType !== undefined) pl.sourceType = updates.sourceType;
  if (updates.sourceId !== undefined) pl.sourceId = updates.sourceId;
  if (updates.type !== undefined) pl.type = updates.type;
  if (updates.deadline !== undefined) pl.deadline = updates.deadline;
  if (updates.sheetMusicId !== undefined) pl.sheetMusicId = updates.sheetMusicId;
  if (updates.waitModeRequired !== undefined) pl.waitModeRequired = updates.waitModeRequired;

  await db.update(assignments).set(pl).where(eq(assignments.id, assignmentId));
  return getAssignmentV5(assignmentId);
}

export async function deleteAssignmentV5(assignmentId: string, _clientUserId?: string): Promise<void> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  
  const a = await db.select().from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
  if (a.length === 0) return;
  
  const c = await db.select().from(classrooms).where(eq(classrooms.id, a[0].classroomId)).limit(1);
  if (c.length === 0 || c[0].teacherId !== userId) throw new Error("Forbidden");

  await db.delete(assignments).where(eq(assignments.id, assignmentId));
}
