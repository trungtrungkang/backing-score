"use server";

import { getDb } from "@/db";
import { lessons, progress } from "@/db/schema/courses";
import { users } from "@/db/schema/auth";
import { eq, desc, and, asc } from "drizzle-orm";
import { getAuth } from "@/lib/auth/better-auth";

export interface LessonDoc {
  $id: string;
  courseId: string;
  title: string;
  orderIndex: number;
  contentRaw: string; // Tiptap JSON
  published: boolean;
  projectId?: string | null;
}

export interface ProgressDoc {
  $id: string;
  userId: string;
  courseId: string;
  lessonId: string;
  waitModeScore: number;
  completedSnippets: string[];
  unlocked: boolean;
  completedAt?: string;
}

function mapLesson(row: any): LessonDoc {
  return {
    ...row,
    $id: row.id
  };
}

function mapProgress(row: any): ProgressDoc {
  return {
    ...row,
    $id: row.id,
    completedSnippets: typeof row.completedSnippets === "string" ? JSON.parse(row.completedSnippets) : row.completedSnippets,
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : undefined
  };
}

// ==============
// Lesson Fetchers
// ==============
export async function getLessonsByCourse(courseId: string): Promise<LessonDoc[]> {
  const db = getDb();
  const rows = await db.select().from(lessons).where(eq(lessons.courseId, courseId)).orderBy(asc(lessons.orderIndex)).limit(100);
  return rows.map(mapLesson);
}

export async function getLessonById(lessonId: string): Promise<LessonDoc | null> {
  const db = getDb();
  const rows = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (rows.length === 0) return null;
  return mapLesson(rows[0]);
}

// ==============
// Lesson Mutations
// ==============
export async function createLesson(
  courseId: string,
  title: string,
  contentRaw: string,
  orderIndex: number = 0
): Promise<LessonDoc> {
  const db = getDb();
  const newId = "les_" + crypto.randomUUID().replace(/-/g, "").substring(0, 16);
  
  await db.insert(lessons).values({
    id: newId,
    courseId,
    title,
    contentRaw,
    orderIndex,
    published: true,
    createdAt: new Date()
  });
  
  return mapLesson((await db.select().from(lessons).where(eq(lessons.id, newId)).limit(1))[0]);
}

export async function updateLesson(lessonId: string, title?: string, contentRaw?: string, orderIndex?: number, projectId?: string | null): Promise<LessonDoc> {
  const db = getDb();
  const data: any = {};
  if (title !== undefined) data.title = title;
  if (contentRaw !== undefined) data.contentRaw = contentRaw;
  if (orderIndex !== undefined) data.orderIndex = orderIndex;
  // Make sure not to send undefined to DB to accidentally clear project if omitted
  if (projectId !== undefined) data.projectId = projectId;

  await db.update(lessons).set(data).where(eq(lessons.id, lessonId));
  return mapLesson((await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1))[0]);
}

export async function deleteLesson(lessonId: string): Promise<boolean> {
  const db = getDb();
  await db.delete(lessons).where(eq(lessons.id, lessonId));
  return true;
}

// ==============
// Progress Actions
// ==============
export async function getStudentProgress(userId: string, courseId: string): Promise<ProgressDoc[]> {
  const db = getDb();
  const rows = await db.select().from(progress).where(and(eq(progress.userId, userId), eq(progress.courseId, courseId)));
  return rows.map(mapProgress);
}

export async function saveWaitModeScore(
  userId: string, 
  courseId: string, 
  lessonId: string, 
  score: number,
  snippetId?: string,
  totalSnippets: number = 1
): Promise<{ progressDoc: ProgressDoc; justUnlocked: boolean }> {
  const db = getDb();
  const now = new Date();
  
  const existingRows = await db.select().from(progress).where(and(eq(progress.userId, userId), eq(progress.lessonId, lessonId))).limit(1);
  const existing = existingRows[0];
  
  let completedSnippets: string[] = existing?.completedSnippets ? (typeof existing.completedSnippets === 'string' ? JSON.parse(existing.completedSnippets) : existing.completedSnippets) : [];
  
  if (snippetId && score >= 80 && !completedSnippets.includes(snippetId)) {
    completedSnippets.push(snippetId);
  }

  let isNowUnlocked = existing?.unlocked || completedSnippets.length >= totalSnippets;
  let justUnlocked = isNowUnlocked && !existing?.unlocked;
  
  const completedAt = existing?.completedAt || (justUnlocked ? now : undefined);
  const highestScore = existing ? Math.max(existing.waitModeScore, score) : score;
  const status = isNowUnlocked ? "completed" : "in_progress";

  if (existing) {
    await db.update(progress).set({
      waitModeScore: highestScore,
      completedSnippets: JSON.stringify(completedSnippets),
      unlocked: isNowUnlocked,
      completedAt,
      status,
      updatedAt: now
    }).where(eq(progress.id, existing.id));
    
    return {
      progressDoc: mapProgress((await db.select().from(progress).where(eq(progress.id, existing.id)).limit(1))[0]),
      justUnlocked
    };
  } else {
    const newId = "prg_" + crypto.randomUUID().replace(/-/g, "").substring(0, 16);
    await db.insert(progress).values({
      id: newId,
      userId,
      courseId,
      lessonId,
      waitModeScore: highestScore,
      completedSnippets: JSON.stringify(completedSnippets),
      unlocked: isNowUnlocked,
      completedAt,
      status,
      updatedAt: now
    });
    
    return {
      progressDoc: mapProgress((await db.select().from(progress).where(eq(progress.id, newId)).limit(1))[0]),
      justUnlocked
    };
  }
}
