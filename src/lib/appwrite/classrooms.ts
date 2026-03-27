/**
 * Classroom CRUD and membership APIs.
 * Follows same pattern as projects.ts — client-side, session required.
 */

import {
  account,
  databases,
  ID,
  Query,
  Permission,
  Role,
} from "./client";
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_CLASSROOMS_COLLECTION_ID,
  APPWRITE_CLASSROOM_MEMBERS_COLLECTION_ID,
} from "./constants";
import type { ClassroomDocument, ClassroomMemberDocument } from "./types";

const dbId = APPWRITE_DATABASE_ID;
const classroomsCol = APPWRITE_CLASSROOMS_COLLECTION_ID;
const membersCol = APPWRITE_CLASSROOM_MEMBERS_COLLECTION_ID;

/** Generate a random 6-character class code (uppercase letters + digits). */
function generateClassCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid confusing chars: I,O,0,1
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Create a new classroom. Caller must be logged in (teacher). */
export async function createClassroom(params: {
  name: string;
  description?: string;
  instrumentFocus?: string;
  level?: string;
}): Promise<ClassroomDocument> {
  const user = await account.get();
  const classCode = generateClassCode();

  const doc = await databases.createDocument(
    dbId,
    classroomsCol,
    ID.unique(),
    {
      teacherId: user.$id,
      name: params.name,
      description: params.description || "",
      instrumentFocus: params.instrumentFocus || "",
      level: params.level || "",
      classCode,
      status: "active",
    },
    [
      // Any logged-in user can read (needed for join-by-code query)
      Permission.read(Role.users()),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ]
  );

  // Also add teacher as a member
  await databases.createDocument(
    dbId,
    membersCol,
    ID.unique(),
    {
      classroomId: doc.$id,
      userId: user.$id,
      userName: user.name || user.email || "Teacher",
      role: "teacher",
      joinedAt: new Date().toISOString(),
      status: "active",
    },
    [
      Permission.read(Role.users()),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ]
  );

  return doc as unknown as ClassroomDocument;
}

/** Get a single classroom by ID. */
export async function getClassroom(classroomId: string): Promise<ClassroomDocument> {
  const doc = await databases.getDocument(dbId, classroomsCol, classroomId);
  return doc as unknown as ClassroomDocument;
}

/** List classrooms where the current user is a member (teacher or student). */
export async function listMyClassrooms(): Promise<ClassroomDocument[]> {
  const user = await account.get();

  // First get all memberships for this user
  const { documents: memberships } = await databases.listDocuments(dbId, membersCol, [
    Query.equal("userId", user.$id),
    Query.equal("status", "active"),
    Query.limit(50),
  ]);

  if (memberships.length === 0) return [];

  // Then fetch the classroom details
  const classroomIds = memberships.map((m) => (m as any).classroomId as string);
  const classrooms: ClassroomDocument[] = [];

  for (const id of classroomIds) {
    try {
      const doc = await databases.getDocument(dbId, classroomsCol, id);
      classrooms.push(doc as unknown as ClassroomDocument);
    } catch {
      // Classroom might have been deleted
    }
  }

  return classrooms;
}

/** Update classroom details. Caller must be teacher/owner. */
export async function updateClassroom(
  classroomId: string,
  updates: {
    name?: string;
    description?: string;
    instrumentFocus?: string;
    level?: string;
    status?: string;
  }
): Promise<ClassroomDocument> {
  const body: Record<string, unknown> = {};
  if (updates.name !== undefined) body.name = updates.name;
  if (updates.description !== undefined) body.description = updates.description;
  if (updates.instrumentFocus !== undefined) body.instrumentFocus = updates.instrumentFocus;
  if (updates.level !== undefined) body.level = updates.level;
  if (updates.status !== undefined) body.status = updates.status;

  const doc = await databases.updateDocument(dbId, classroomsCol, classroomId, body);
  return doc as unknown as ClassroomDocument;
}

/** Delete a classroom and all its members. Caller must be teacher/owner. */
export async function deleteClassroom(classroomId: string): Promise<void> {
  // Delete all members first
  const { documents: members } = await databases.listDocuments(dbId, membersCol, [
    Query.equal("classroomId", classroomId),
    Query.limit(100),
  ]);
  for (const m of members) {
    await databases.deleteDocument(dbId, membersCol, m.$id);
  }
  // Delete classroom
  await databases.deleteDocument(dbId, classroomsCol, classroomId);
}

/** Join a classroom via class code. Returns the classroom document. */
export async function joinClassroom(classCode: string): Promise<ClassroomDocument> {
  const user = await account.get();

  // Find classroom by code
  const { documents } = await databases.listDocuments(dbId, classroomsCol, [
    Query.equal("classCode", classCode.toUpperCase()),
    Query.equal("status", "active"),
    Query.limit(1),
  ]);

  if (documents.length === 0) {
    throw new Error("Classroom not found or inactive");
  }

  const classroom = documents[0] as unknown as ClassroomDocument;

  // Check if already a member
  const { documents: existing } = await databases.listDocuments(dbId, membersCol, [
    Query.equal("classroomId", classroom.$id),
    Query.equal("userId", user.$id),
    Query.limit(1),
  ]);

  if (existing.length > 0) {
    // Already a member, just return
    return classroom;
  }

  // Add as student member
  await databases.createDocument(
    dbId,
    membersCol,
    ID.unique(),
    {
      classroomId: classroom.$id,
      userId: user.$id,
      userName: user.name || user.email || "Student",
      role: "student",
      joinedAt: new Date().toISOString(),
      status: "active",
    },
    [
      // Client-side SDK can only set permissions for self, users, or any
      // Teacher removal handled via collection-level admin permissions
      Permission.read(Role.users()),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ]
  );

  // Also grant the student read access to the classroom document
  // by updating permissions to include this new student
  // (For now, we'll rely on membership check instead of doc-level perms for students)

  return classroom;
}

/** Leave a classroom (student only). */
export async function leaveClassroom(classroomId: string): Promise<void> {
  const user = await account.get();
  const { documents } = await databases.listDocuments(dbId, membersCol, [
    Query.equal("classroomId", classroomId),
    Query.equal("userId", user.$id),
    Query.limit(1),
  ]);
  if (documents.length > 0) {
    await databases.deleteDocument(dbId, membersCol, documents[0].$id);
  }
}

/** List all members of a classroom. */
export async function listClassroomMembers(classroomId: string): Promise<ClassroomMemberDocument[]> {
  const { documents } = await databases.listDocuments(dbId, membersCol, [
    Query.equal("classroomId", classroomId),
    Query.equal("status", "active"),
    Query.orderAsc("joinedAt"),
    Query.limit(100),
  ]);
  return documents as unknown as ClassroomMemberDocument[];
}

/** Remove a member from classroom (teacher only). */
export async function removeClassroomMember(classroomId: string, userId: string): Promise<void> {
  const { documents } = await databases.listDocuments(dbId, membersCol, [
    Query.equal("classroomId", classroomId),
    Query.equal("userId", userId),
    Query.limit(1),
  ]);
  if (documents.length > 0) {
    await databases.deleteDocument(dbId, membersCol, documents[0].$id);
  }
}

/** Check if the current user is a member of a classroom. */
export async function isClassroomMember(classroomId: string): Promise<{ isMember: boolean; role?: string }> {
  const user = await account.get();
  const { documents } = await databases.listDocuments(dbId, membersCol, [
    Query.equal("classroomId", classroomId),
    Query.equal("userId", user.$id),
    Query.equal("status", "active"),
    Query.limit(1),
  ]);
  if (documents.length === 0) return { isMember: false };
  return { isMember: true, role: (documents[0] as any).role };
}
