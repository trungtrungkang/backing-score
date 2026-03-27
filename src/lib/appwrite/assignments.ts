/**
 * Assignment CRUD APIs for Classroom.
 * Teacher creates assignments, students view them.
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
  APPWRITE_ASSIGNMENTS_COLLECTION_ID,
} from "./constants";
import type { AssignmentDocument } from "./types";

const dbId = APPWRITE_DATABASE_ID;
const collId = APPWRITE_ASSIGNMENTS_COLLECTION_ID;

/** Create a new assignment for a classroom. Caller must be teacher. */
export async function createAssignment(params: {
  classroomId: string;
  title: string;
  description?: string;
  sourceType: string;
  sourceId: string;
  type: string;
  deadline?: string;
  waitModeRequired?: boolean;
}): Promise<AssignmentDocument> {
  const user = await account.get();

  const doc = await databases.createDocument(
    dbId,
    collId,
    ID.unique(),
    {
      classroomId: params.classroomId,
      title: params.title,
      description: params.description || "",
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      type: params.type,
      deadline: params.deadline || null,
      waitModeRequired: params.waitModeRequired ?? false,
    },
    [
      // Any authenticated user can read (we check membership in UI)
      Permission.read(Role.users()),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ]
  );

  return doc as unknown as AssignmentDocument;
}

/** List all assignments for a classroom, ordered by creation date. */
export async function listAssignments(classroomId: string): Promise<AssignmentDocument[]> {
  const { documents } = await databases.listDocuments(dbId, collId, [
    Query.equal("classroomId", classroomId),
    Query.orderDesc("$createdAt"),
    Query.limit(50),
  ]);
  return documents as unknown as AssignmentDocument[];
}

/** Get a single assignment by ID. */
export async function getAssignment(assignmentId: string): Promise<AssignmentDocument> {
  const doc = await databases.getDocument(dbId, collId, assignmentId);
  return doc as unknown as AssignmentDocument;
}

/** Delete an assignment. Caller must be teacher/owner. */
export async function deleteAssignment(assignmentId: string): Promise<void> {
  await databases.deleteDocument(dbId, collId, assignmentId);
}
