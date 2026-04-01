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
  APPWRITE_CLASSROOM_INVITES_COLLECTION_ID,
} from "./constants";
import { buildClassroomPermissions } from "./permissions";
import type { ClassroomDocument, ClassroomMemberDocument, ClassroomInviteDocument } from "./types";
import { createNotification } from "./notifications";

const dbId = APPWRITE_DATABASE_ID;
const classroomsCol = APPWRITE_CLASSROOMS_COLLECTION_ID;
const membersCol = APPWRITE_CLASSROOM_MEMBERS_COLLECTION_ID;
const invitesCol = APPWRITE_CLASSROOM_INVITES_COLLECTION_ID;

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
    buildClassroomPermissions(user.$id)
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
    buildClassroomPermissions(user.$id)
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

export async function joinClassroom(code: string): Promise<ClassroomDocument> {
  const user = await account.get();
  const normalizedCode = code.trim(); // Invites might be random case, classCode is usually uppercase

  // Branch B: Single-use Invite Ticket Check
  let inviteDoc: ClassroomInviteDocument | null = null;
  try {
    const { documents } = await databases.listDocuments(dbId, invitesCol, [
      Query.equal("code", normalizedCode),
      Query.limit(1),
    ]);
    if (documents.length > 0) inviteDoc = documents[0] as unknown as ClassroomInviteDocument;
  } catch (err) { /* ignore */ }

  if (inviteDoc && inviteDoc.status === "active") {
    // Check expiration
    if (inviteDoc.expiresAt && new Date(inviteDoc.expiresAt) < new Date()) {
      throw new Error("Invite ticket has expired");
    }

    // Bypass flow: Mark ticket as used and add student straight to class
    if (!inviteDoc.classroomId) throw new Error("Invite ticket has no target classroom");
    
    const classroom = await getClassroom(inviteDoc.classroomId);

    // Update invite status to used
    await databases.updateDocument(dbId, invitesCol, inviteDoc.$id, {
      status: "used",
      usedById: user.$id
    });

    // Check if member already exists
    const existing = await isClassroomMember(classroom.$id);
    if (!existing.isMember) {
      await databases.createDocument(dbId, membersCol, ID.unique(), {
        classroomId: classroom.$id,
        userId: user.$id,
        userName: inviteDoc.studentName || user.name || user.email || "Student",
        role: "student",
        joinedAt: new Date().toISOString(),
        status: "active", // <-- Magic: Active immediately
      }, [
        Permission.read(Role.users()),
        Permission.update(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id)),
      ]);
    }
    return classroom;
  }

  // Branch A: Generic Class Code Check
  const { documents } = await databases.listDocuments(dbId, classroomsCol, [
    Query.equal("classCode", normalizedCode.toUpperCase()),
    Query.equal("status", "active"),
    Query.limit(1),
  ]);

  if (documents.length === 0) {
    throw new Error("Mã tham gia không hợp lệ hoặc Lớp học đã đóng");
  }

  const classroom = documents[0] as unknown as ClassroomDocument;

  // Check if existing
  const { documents: existingMembers } = await databases.listDocuments(dbId, membersCol, [
    Query.equal("classroomId", classroom.$id),
    Query.equal("userId", user.$id),
    Query.limit(1),
  ]);

  if (existingMembers.length > 0) {
    // Already in (or pending)
    return classroom;
  }

  // Add to Waiting Room
  await databases.createDocument(dbId, membersCol, ID.unique(), {
      classroomId: classroom.$id,
      userId: user.$id,
      userName: user.name || user.email || "Student",
      role: "student",
      joinedAt: new Date().toISOString(),
      status: "pending", // <-- Pushed to waiting room
    }, [
      Permission.read(Role.users()),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ]
  );
  
  // Notify Teacher
  try {
     await createNotification({
        recipientId: classroom.teacherId,
        type: "classroom_join_request",
        sourceUserName: user.name || user.email || "Student",
        sourceUserId: user.$id,
        targetType: "classroom",
        targetName: classroom.name,
        targetId: classroom.$id
     });
  } catch (e) {
     console.warn("Failed to notify teacher about join request", e);
  }

  return classroom;
}

/** Create a single-use Invite Ticket for bypass onboarding (Teacher only) */
export async function createInviteTicket(classroomId: string, studentName?: string, expiresInDays: number = 7): Promise<ClassroomInviteDocument> {
  const user = await account.get();
  const rawCode = ID.unique();
  const ticketCode = `INV-${rawCode.substring(0,4).toUpperCase()}-${rawCode.substring(4,8).toUpperCase()}`;
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const doc = await databases.createDocument(dbId, invitesCol, ID.unique(), {
    code: ticketCode,
    classroomId,
    teacherId: user.$id,
    studentName: studentName || "",
    expiresAt: expiresAt.toISOString(),
    status: "active",
  });
  return doc as unknown as ClassroomInviteDocument;
}

/** List all invite tickets for a classroom (Teacher only). */
export async function listClassroomInvites(classroomId: string): Promise<ClassroomInviteDocument[]> {
  const { documents } = await databases.listDocuments(dbId, invitesCol, [
    Query.equal("classroomId", classroomId),
    Query.orderDesc("$createdAt"),
    Query.limit(100),
  ]);
  return documents as unknown as ClassroomInviteDocument[];
}

/** Revoke/Delete an invite ticket (Teacher only). */
export async function deleteInviteTicket(inviteId: string): Promise<void> {
  await databases.deleteDocument(dbId, invitesCol, inviteId);
}


/** Approve a student from the waiting room (Teacher only) */
export async function approveMember(memberDocId: string): Promise<void> {
  const result = await databases.updateDocument(dbId, membersCol, memberDocId, {
    status: "active"
  });
  
  try {
     const member = result as unknown as ClassroomMemberDocument;
     const classroom = await getClassroom(member.classroomId);
     await createNotification({
        recipientId: member.userId,
        type: "classroom_join_approved",
        sourceUserName: classroom.name, // The classroom itself acts as the sender
        sourceUserId: classroom.teacherId, 
        targetType: "classroom",
        targetName: classroom.name,
        targetId: classroom.$id
     });
  } catch(e) {
     console.warn("Failed to notify student about approval", e);
  }
}

/** Decline a student from the waiting room (Teacher only) */
export async function declineMember(memberDocId: string): Promise<void> {
  await databases.deleteDocument(dbId, membersCol, memberDocId);
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

/** List all PENDING members in the waiting room. */
export async function listPendingMembers(classroomId: string): Promise<ClassroomMemberDocument[]> {
  const { documents } = await databases.listDocuments(dbId, membersCol, [
    Query.equal("classroomId", classroomId),
    Query.equal("status", "pending"),
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
