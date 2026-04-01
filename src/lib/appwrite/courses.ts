import { databases, ID, Query, Models } from "./client";
import { APPWRITE_DATABASE_ID as DATABASE_ID } from "./constants";
import { buildStandardPermissions } from "./permissions";

export const COURSES_COLLECTION = "courses";
export const ENROLLMENTS_COLLECTION = "enrollments";

export interface CourseDoc extends Models.Document {
  creatorId: string;
  title: string;
  description?: string;
  priceCents?: number; // Deprecated: Kept for legacy compatibility
  coverUrl?: string;
  published: boolean;
  visibility: "public" | "private";
  courseCode: string;
  createdAt?: string;
  category?: string;    // e.g. "Music Theory", "Piano", "Guitar"
  difficulty?: string;  // e.g. "Beginner", "Intermediate", "Advanced"
}

export interface EnrollmentDoc extends Models.Document {
  userId: string;
  courseId: string;
  status: "pending" | "active" | "removed";
  userName?: string;
  enrolledAt: string;
}

// ==============
// Course Getters
// ==============
export async function getPublishedCourses(): Promise<CourseDoc[]> {
  const result = await databases.listDocuments(DATABASE_ID, COURSES_COLLECTION, [
    Query.equal("published", true),
    Query.orderDesc("$createdAt"),
    Query.limit(50),
  ]);
  return result.documents as unknown as CourseDoc[];
}

export async function getCreatorCourses(creatorId: string): Promise<CourseDoc[]> {
  try {
    const result = await databases.listDocuments(DATABASE_ID, COURSES_COLLECTION, [
      Query.equal("creatorId", creatorId),
      Query.orderDesc("$createdAt"),
      Query.limit(50),
    ]);
    return result.documents as unknown as CourseDoc[];
  } catch (err) {
    return [];
  }
}

export async function getCourseById(courseId: string): Promise<CourseDoc | null> {
  try {
    const doc = await databases.getDocument(DATABASE_ID, COURSES_COLLECTION, courseId);
    return doc as unknown as CourseDoc;
  } catch (err) {
    return null;
  }
}

// ==============
// Creator Actions
// ==============
export async function createCourse(creatorId: string, title: string, priceCents: number = 0): Promise<CourseDoc> {
  const doc = await databases.createDocument(DATABASE_ID, COURSES_COLLECTION, ID.unique(), {
    creatorId,
    title,
    priceCents,
    published: false,
    createdAt: new Date().toISOString(),
  }, buildStandardPermissions(creatorId));
  return doc as unknown as CourseDoc;
}

export async function updateCourse(
  courseId: string, 
  updates: { title?: string; description?: string; priceCents?: number; published?: boolean; category?: string; difficulty?: string }
): Promise<CourseDoc> {
  const doc = await databases.updateDocument(DATABASE_ID, COURSES_COLLECTION, courseId, updates);
  return doc as unknown as CourseDoc;
}

export async function deleteCourse(courseId: string): Promise<boolean> {
  try {
    await databases.deleteDocument(DATABASE_ID, COURSES_COLLECTION, courseId);
    return true;
  } catch (err) {
    console.error("Failed to delete course:", err);
    return false;
  }
}

export async function checkEnrollment(userId: string, courseId: string): Promise<boolean> {
  try {
    const res = await databases.listDocuments(DATABASE_ID, ENROLLMENTS_COLLECTION, [
      Query.equal("userId", userId),
      Query.equal("courseId", courseId),
      Query.limit(1)
    ]);
    return res.documents.length > 0;
  } catch {
    return false;
  }
}

export async function createEnrollment(
  userId: string, 
  courseId: string
): Promise<EnrollmentDoc> {
  const doc = await databases.createDocument(DATABASE_ID, ENROLLMENTS_COLLECTION, ID.unique(), {
    userId,
    courseId,
    enrolledAt: new Date().toISOString()
  });
  return doc as unknown as EnrollmentDoc;
}
