import { databases, ID, Query, Models, account } from "./client";
import { APPWRITE_DATABASE_ID as DATABASE_ID } from "./constants";
import { buildStandardPermissions } from "./permissions";

export const LESSONS_COLLECTION = "lessons";
export const PROGRESS_COLLECTION = "progress";

export interface LessonDoc extends Models.Document {
  courseId: string;
  title: string;
  orderIndex: number;
  contentRaw: string; // Tiptap JSON
  published: boolean;
}

export interface ProgressDoc extends Models.Document {
  userId: string;
  courseId: string;
  lessonId: string;
  waitModeScore: number;
  completedSnippets: string[];
  unlocked: boolean;
  completedAt?: string;
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
  const user = await account.get();
  const doc = await databases.createDocument(
    DATABASE_ID,
    LESSONS_COLLECTION,
    ID.unique(),
    {
      courseId,
      title,
      contentRaw,
      orderIndex,
      published: true,
    },
    buildStandardPermissions(user.$id)
  );
  return doc as unknown as LessonDoc;
}

export async function updateLesson(lessonId: string, title?: string, contentRaw?: string, orderIndex?: number): Promise<LessonDoc> {
  const data: any = {};
  if (title !== undefined) data.title = title;
  if (contentRaw !== undefined) data.contentRaw = contentRaw;
  if (orderIndex !== undefined) data.orderIndex = orderIndex;
  const doc = await databases.updateDocument(DATABASE_ID, LESSONS_COLLECTION, lessonId, data);
  return doc as unknown as LessonDoc;
}

export async function deleteLesson(lessonId: string): Promise<boolean> {
  try {
    await databases.deleteDocument(DATABASE_ID, LESSONS_COLLECTION, lessonId);
    return true;
  } catch (err) {
    console.error("Failed to delete lesson:", err);
    return false;
  }
}

// ==============
// Lesson Fetchers
// ==============
export async function getLessonsByCourse(courseId: string): Promise<LessonDoc[]> {
  try {
    const result = await databases.listDocuments(DATABASE_ID, LESSONS_COLLECTION, [
      Query.equal("courseId", courseId),
      Query.orderAsc("orderIndex"),
      Query.limit(100), // Max 100 lessons per course
    ]);
    return result.documents as unknown as LessonDoc[];
  } catch (err) {
    return [];
  }
}

export async function getLessonById(lessonId: string): Promise<LessonDoc | null> {
  try {
    return await databases.getDocument(DATABASE_ID, LESSONS_COLLECTION, lessonId) as unknown as LessonDoc;
  } catch (err) {
    return null;
  }
}

// ==============
// Progress Actions
// ==============
export async function getStudentProgress(userId: string, courseId: string): Promise<ProgressDoc[]> {
  try {
    const result = await databases.listDocuments(DATABASE_ID, PROGRESS_COLLECTION, [
      Query.equal("userId", userId),
      Query.equal("courseId", courseId),
      Query.orderAsc("lessonId")
    ]);
    return result.documents as unknown as ProgressDoc[];
  } catch (err) {
    return [];
  }
}

/**
 * Triggered by Server Action when WaitMode completes
 */
export async function saveWaitModeScore(
  userId: string, 
  courseId: string, 
  lessonId: string, 
  score: number,
  snippetId?: string,
  totalSnippets: number = 1
): Promise<{ progressDoc: ProgressDoc; justUnlocked: boolean }> {
  // First check if a progress doc exists
  let existing: ProgressDoc | null = null;
  try {
    const response = await databases.listDocuments(DATABASE_ID, PROGRESS_COLLECTION, [
      Query.equal("userId", userId),
      Query.equal("lessonId", lessonId),
      Query.limit(1)
    ]);
    if (response.documents.length > 0) {
      existing = response.documents[0] as unknown as ProgressDoc;
    }
  } catch (err) {}

  let completedSnippets = existing?.completedSnippets || [];
  if (snippetId && score >= 80 && !completedSnippets.includes(snippetId)) {
    completedSnippets = [...completedSnippets, snippetId];
  }

  // A lesson is unlocked if it was ALREADY unlocked, OR if the new array length satisfies all snippets.
  let isNowUnlocked = existing?.unlocked || completedSnippets.length >= totalSnippets;
  // It `justUnlocked` if it WASN'T unlocked before, but is NOW unlocked.
  let justUnlocked = isNowUnlocked && !existing?.unlocked;

  if (existing) {
    // Update existing score if higher
    const highestScore = Math.max(existing.waitModeScore, score);
    const doc = await databases.updateDocument(
      DATABASE_ID, 
      PROGRESS_COLLECTION, 
      existing.$id, 
      {
        waitModeScore: highestScore,
        completedSnippets,
        unlocked: isNowUnlocked,
        completedAt: existing.completedAt || (justUnlocked ? new Date().toISOString() : undefined)
      }
    );
    return { progressDoc: doc as unknown as ProgressDoc, justUnlocked };
  } else {
    const doc = await databases.createDocument(
      DATABASE_ID,
      PROGRESS_COLLECTION,
      ID.unique(),
      {
         userId,
         courseId,
         lessonId,
         waitModeScore: score,
         completedSnippets,
         unlocked: isNowUnlocked,
         completedAt: justUnlocked ? new Date().toISOString() : undefined
      }
    );
    return { progressDoc: doc as unknown as ProgressDoc, justUnlocked };
  }
}
