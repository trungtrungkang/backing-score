"use server";

import { getDb } from "@/db";
import { courses, enrollments } from "@/db/schema/courses";
import { users } from "@/db/schema/auth";
import { eq, desc, and } from "drizzle-orm";
import { getAuth } from "@/lib/auth/better-auth";

export interface CourseDoc {
  $id: string; // for compatibility
  creatorId: string;
  title: string;
  description?: string;
  priceCents?: number;
  coverUrl?: string;
  published: boolean;
  visibility: "public" | "private";
  courseCode: string;
  createdAt?: string;
  category?: string;
  difficulty?: string;
}

export interface EnrollmentDoc {
  $id: string;
  userId: string;
  courseId: string;
  status: "pending" | "active" | "removed";
  userName?: string;
  enrolledAt: string;
}

function mapCourse(row: any): CourseDoc {
  return {
    ...row,
    $id: row.id,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : undefined
  };
}

// ==============
// Course Getters
// ==============
export async function getPublishedCourses(): Promise<CourseDoc[]> {
  const db = getDb();
  const rows = await db.select().from(courses).where(eq(courses.published, true)).orderBy(desc(courses.createdAt)).limit(50);
  return rows.map(mapCourse);
}

export async function getCreatorCourses(creatorId: string): Promise<CourseDoc[]> {
  const db = getDb();
  const rows = await db.select().from(courses).where(eq(courses.creatorId, creatorId)).orderBy(desc(courses.createdAt)).limit(50);
  return rows.map(mapCourse);
}

export async function getCourseById(courseId: string): Promise<CourseDoc | null> {
  const db = getDb();
  const rows = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (rows.length === 0) return null;
  return mapCourse(rows[0]);
}

// ==============
// Creator Actions
// ==============
export async function createCourse(creatorId: string, title: string, priceCents: number = 0): Promise<CourseDoc> {
  const db = getDb();
  const newId = "crs_" + crypto.randomUUID().replace(/-/g, "").substring(0, 16);
  
  await db.insert(courses).values({
    id: newId,
    creatorId,
    title,
    priceCents,
    published: false,
    visibility: "public",
    createdAt: new Date()
  });
  
  const created = await getCourseById(newId);
  if (!created) throw new Error("Failed to create course");
  return created;
}

export async function updateCourse(
  courseId: string, 
  updates: { title?: string; description?: string; priceCents?: number; published?: boolean; category?: string; difficulty?: string; coverUrl?: string; visibility?: "public" | "private" }
): Promise<CourseDoc> {
  const db = getDb();
  await db.update(courses).set(updates).where(eq(courses.id, courseId));
  const updated = await getCourseById(courseId);
  if (!updated) throw new Error("Course not found");
  return updated;
}

export async function deleteCourse(courseId: string): Promise<boolean> {
  const db = getDb();
  await db.delete(courses).where(eq(courses.id, courseId));
  return true;
}

// ==============
// Enrollments
// ==============
export async function checkEnrollment(userId: string, courseId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db.select().from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId))).limit(1);
  return rows.length > 0;
}

export async function createEnrollment(userId: string, courseId: string): Promise<EnrollmentDoc> {
  const db = getDb();
  const newId = "enr_" + crypto.randomUUID().replace(/-/g, "").substring(0, 16);
  
  await db.insert(enrollments).values({
    id: newId,
    userId,
    courseId,
    enrolledAt: new Date()
  });
  
  return {
    $id: newId,
    userId,
    courseId,
    status: "active",
    enrolledAt: new Date().toISOString()
  };
}
