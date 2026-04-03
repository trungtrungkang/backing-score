"use server";

import { getDb } from "@/db";
import { submissionFeedback, submissions, classrooms } from "@/db/schema/classroom";
import { eq, desc } from "drizzle-orm";
import { getAuth } from "@/lib/auth/better-auth";
import { headers } from "next/headers";
import type { SubmissionFeedbackDocument } from "@/lib/appwrite/types";

async function requireUser(clientUserId?: string) {
  if (clientUserId) return clientUserId;
  const env = process.env as any;
  const auth = getAuth(env);
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

function mockFeedback(row: any): SubmissionFeedbackDocument {
  return {
    $id: row.id,
    $createdAt: new Date(row.createdAt).toISOString(),
    $updatedAt: new Date(row.createdAt).toISOString(),
    submissionId: row.submissionId,
    teacherId: row.teacherId,
    teacherName: row.teacherName,
    content: row.content,
    grade: row.grade,
  } as unknown as SubmissionFeedbackDocument;
}

export async function createFeedbackV5(params: any, _clientUserId?: string): Promise<SubmissionFeedbackDocument> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  
  const s = await db.select().from(submissions).where(eq(submissions.id, params.submissionId)).limit(1);
  if (s.length === 0) throw new Error("Submission not found");
  
  const c = await db.select().from(classrooms).where(eq(classrooms.id, s[0].classroomId)).limit(1);
  if (c.length === 0 || c[0].teacherId !== userId) throw new Error("Forbidden"); // Only teacher can grade

  const newId = crypto.randomUUID();
  await db.insert(submissionFeedback).values({
     id: newId,
     submissionId: params.submissionId,
     teacherId: userId,
     teacherName: "Teacher", // fallback
     content: params.content || "",
     grade: params.grade || null,
     createdAt: new Date()
  });

  // Update submission status to reviewed
  await db.update(submissions).set({ status: "reviewed" }).where(eq(submissions.id, params.submissionId));

  const rs = await db.select().from(submissionFeedback).where(eq(submissionFeedback.id, newId)).limit(1);
  return mockFeedback(rs[0]);
}

export async function listFeedbackV5(submissionId: string, _clientUserId?: string): Promise<SubmissionFeedbackDocument[]> {
  const db = getDb();
  const rs = await db.select().from(submissionFeedback).where(eq(submissionFeedback.submissionId, submissionId)).orderBy(desc(submissionFeedback.createdAt));
  return rs.map(mockFeedback);
}

export async function updateFeedbackV5(feedbackId: string, updates: any, _clientUserId?: string): Promise<SubmissionFeedbackDocument> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  
  const f = await db.select().from(submissionFeedback).where(eq(submissionFeedback.id, feedbackId)).limit(1);
  if (f.length === 0 || f[0].teacherId !== userId) throw new Error("Forbidden");

  const pl: any = {};
  if (updates.content !== undefined) pl.content = updates.content;
  if (updates.grade !== undefined) pl.grade = updates.grade;

  await db.update(submissionFeedback).set(pl).where(eq(submissionFeedback.id, feedbackId));
  
  const rs = await db.select().from(submissionFeedback).where(eq(submissionFeedback.id, feedbackId)).limit(1);
  return mockFeedback(rs[0]);
}

export async function deleteFeedbackV5(feedbackId: string, _clientUserId?: string): Promise<void> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  
  const f = await db.select().from(submissionFeedback).where(eq(submissionFeedback.id, feedbackId)).limit(1);
  if (f.length === 0 || f[0].teacherId !== userId) throw new Error("Forbidden");

  await db.delete(submissionFeedback).where(eq(submissionFeedback.id, feedbackId));
}
