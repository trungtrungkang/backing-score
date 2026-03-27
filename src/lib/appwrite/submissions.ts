/**
 * Submission CRUD APIs for Classroom.
 * Students create submissions for assignments.
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
  APPWRITE_SUBMISSIONS_COLLECTION_ID,
} from "./constants";
import type { SubmissionDocument } from "./types";

const dbId = APPWRITE_DATABASE_ID;
const collId = APPWRITE_SUBMISSIONS_COLLECTION_ID;

/** Create or update a submission. If student already has one for this assignment, update it. */
export async function submitAssignment(params: {
  assignmentId: string;
  classroomId: string;
  accuracy?: number;
  tempo?: number;
  attempts?: number;
}): Promise<SubmissionDocument> {
  const user = await account.get();

  // Check if student already has a submission for this assignment
  const { documents: existing } = await databases.listDocuments(dbId, collId, [
    Query.equal("assignmentId", params.assignmentId),
    Query.equal("studentId", user.$id),
    Query.limit(1),
  ]);

  if (existing.length > 0) {
    // Update existing submission
    const doc = await databases.updateDocument(dbId, collId, existing[0].$id, {
      accuracy: params.accuracy ?? (existing[0] as any).accuracy,
      tempo: params.tempo ?? (existing[0] as any).tempo,
      attempts: (params.attempts ?? 0) + ((existing[0] as any).attempts ?? 0),
      submittedAt: new Date().toISOString(),
      status: "submitted",
    });
    return doc as unknown as SubmissionDocument;
  }

  // Create new submission
  const doc = await databases.createDocument(
    dbId,
    collId,
    ID.unique(),
    {
      assignmentId: params.assignmentId,
      classroomId: params.classroomId,
      studentId: user.$id,
      studentName: user.name || user.email || "Student",
      accuracy: params.accuracy ?? 0,
      tempo: params.tempo ?? 0,
      attempts: params.attempts ?? 1,
      submittedAt: new Date().toISOString(),
      status: "submitted",
    },
    [
      // Client-side SDK: can only set permissions for self or users/any
      Permission.read(Role.users()),
      Permission.update(Role.user(user.$id)),
    ]
  );

  return doc as unknown as SubmissionDocument;
}

/** List all submissions for an assignment (teacher view). */
export async function listSubmissions(assignmentId: string): Promise<SubmissionDocument[]> {
  const { documents } = await databases.listDocuments(dbId, collId, [
    Query.equal("assignmentId", assignmentId),
    Query.orderDesc("submittedAt"),
    Query.limit(100),
  ]);
  return documents as unknown as SubmissionDocument[];
}

/** Get the current student's submission for an assignment. */
export async function getMySubmission(assignmentId: string): Promise<SubmissionDocument | null> {
  const user = await account.get();
  const { documents } = await databases.listDocuments(dbId, collId, [
    Query.equal("assignmentId", assignmentId),
    Query.equal("studentId", user.$id),
    Query.limit(1),
  ]);
  if (documents.length === 0) return null;
  return documents[0] as unknown as SubmissionDocument;
}

/** List all submissions by the current student for a classroom. */
export async function listMySubmissions(classroomId: string): Promise<SubmissionDocument[]> {
  const user = await account.get();
  const { documents } = await databases.listDocuments(dbId, collId, [
    Query.equal("classroomId", classroomId),
    Query.equal("studentId", user.$id),
    Query.orderDesc("submittedAt"),
    Query.limit(100),
  ]);
  return documents as unknown as SubmissionDocument[];
}
