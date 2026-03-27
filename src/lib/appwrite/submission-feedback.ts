/**
 * Submission Feedback CRUD APIs for Classroom.
 * Teachers create feedback (with optional grade) on student submissions.
 * Supports multiple feedbacks per submission (conversation thread).
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
  APPWRITE_SUBMISSION_FEEDBACK_COLLECTION_ID,
} from "./constants";
import type { SubmissionFeedbackDocument } from "./types";
import { createNotification } from "./notifications";

const dbId = APPWRITE_DATABASE_ID;
const collId = APPWRITE_SUBMISSION_FEEDBACK_COLLECTION_ID;

/** Create feedback on a submission. Caller must be teacher. */
export async function createFeedback(params: {
  submissionId: string;
  content: string;
  grade?: number;
}): Promise<SubmissionFeedbackDocument> {
  const user = await account.get();

  const doc = await databases.createDocument(
    dbId,
    collId,
    ID.unique(),
    {
      submissionId: params.submissionId,
      teacherId: user.$id,
      teacherName: user.name || user.email || "Teacher",
      content: params.content,
      ...(params.grade !== undefined ? { grade: params.grade } : {}),
    },
    [
      Permission.read(Role.users()),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ]
  );

  // Fire-and-forget: notify the student
  (async () => {
    try {
      const { APPWRITE_SUBMISSIONS_COLLECTION_ID } = await import("./constants");
      const submission = await databases.getDocument(dbId, APPWRITE_SUBMISSIONS_COLLECTION_ID, params.submissionId);
      const { getAssignment } = await import("./assignments");
      const assignment = await getAssignment(submission.assignmentId as string);
      await createNotification({
        recipientId: submission.studentId as string,
        type: "feedback_new",
        sourceUserName: user.name || user.email || "Teacher",
        sourceUserId: user.$id,
        targetType: "assignment",
        targetName: assignment.title,
        targetId: `${submission.classroomId}/${submission.assignmentId}`,
      });
    } catch { /* best-effort */ }
  })();

  return doc as unknown as SubmissionFeedbackDocument;
}

/** List all feedback for a submission, ordered by creation date (oldest first). */
export async function listFeedback(submissionId: string): Promise<SubmissionFeedbackDocument[]> {
  const { documents } = await databases.listDocuments(dbId, collId, [
    Query.equal("submissionId", submissionId),
    Query.orderAsc("$createdAt"),
    Query.limit(50),
  ]);
  return documents as unknown as SubmissionFeedbackDocument[];
}

/** Update feedback content or grade. Caller must be the original teacher. */
export async function updateFeedback(
  feedbackId: string,
  updates: { content?: string; grade?: number }
): Promise<SubmissionFeedbackDocument> {
  const body: Record<string, unknown> = {};
  if (updates.content !== undefined) body.content = updates.content;
  if (updates.grade !== undefined) body.grade = updates.grade;

  const doc = await databases.updateDocument(dbId, collId, feedbackId, body);
  return doc as unknown as SubmissionFeedbackDocument;
}

/** Delete a feedback entry. Caller must be the original teacher. */
export async function deleteFeedback(feedbackId: string): Promise<void> {
  await databases.deleteDocument(dbId, collId, feedbackId);
}
