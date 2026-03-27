import {
  account,
  databases,
  storage,
  ID,
  Query,
  Permission,
  Role,
} from "./client";
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_ASSIGNMENTS_COLLECTION_ID,
  APPWRITE_SUBMISSIONS_COLLECTION_ID,
  APPWRITE_SUBMISSION_FEEDBACK_COLLECTION_ID,
  APPWRITE_CLASSROOM_RECORDINGS_BUCKET_ID,
} from "./constants";
import type { AssignmentDocument, SubmissionDocument } from "./types";

const dbId = APPWRITE_DATABASE_ID;
const collId = APPWRITE_ASSIGNMENTS_COLLECTION_ID;
const submissionsCollId = APPWRITE_SUBMISSIONS_COLLECTION_ID;
const feedbackCollId = APPWRITE_SUBMISSION_FEEDBACK_COLLECTION_ID;
const recordingsBucket = APPWRITE_CLASSROOM_RECORDINGS_BUCKET_ID;

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

/**
 * Delete an assignment with cascade: removes all submissions,
 * their feedback, and recording files before deleting the assignment.
 */
export async function deleteAssignment(assignmentId: string): Promise<void> {
  // 1. Fetch all submissions for this assignment
  const { documents: subs } = await databases.listDocuments(dbId, submissionsCollId, [
    Query.equal("assignmentId", assignmentId),
    Query.limit(200),
  ]);
  const submissions = subs as unknown as SubmissionDocument[];

  // 2. For each submission: delete feedback + recording file
  for (const sub of submissions) {
    // Delete all feedback for this submission
    try {
      const { documents: feedbacks } = await databases.listDocuments(dbId, feedbackCollId, [
        Query.equal("submissionId", sub.$id),
        Query.limit(100),
      ]);
      await Promise.all(
        feedbacks.map(fb => databases.deleteDocument(dbId, feedbackCollId, fb.$id))
      );
    } catch { /* best-effort */ }

    // Delete recording file from storage
    if (sub.recordingFileId) {
      try {
        await storage.deleteFile(recordingsBucket, sub.recordingFileId);
      } catch { /* best-effort */ }
    }

    // Delete the submission document
    try {
      await databases.deleteDocument(dbId, submissionsCollId, sub.$id);
    } catch { /* best-effort */ }
  }

  // 3. Finally delete the assignment itself
  await databases.deleteDocument(dbId, collId, assignmentId);
}

/** Update an assignment. Caller must be teacher/owner. */
export async function updateAssignment(
  assignmentId: string,
  updates: {
    title?: string;
    description?: string;
    type?: string;
    deadline?: string | null;
    waitModeRequired?: boolean;
  }
): Promise<AssignmentDocument> {
  const body: Record<string, unknown> = {};
  if (updates.title !== undefined) body.title = updates.title;
  if (updates.description !== undefined) body.description = updates.description;
  if (updates.type !== undefined) body.type = updates.type;
  if (updates.deadline !== undefined) body.deadline = updates.deadline;
  if (updates.waitModeRequired !== undefined) body.waitModeRequired = updates.waitModeRequired;

  const doc = await databases.updateDocument(dbId, collId, assignmentId, body);
  return doc as unknown as AssignmentDocument;
}
