/**
 * Submission CRUD APIs for Classroom.
 * Students create submissions for assignments, optionally with audio recordings.
 */

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
  APPWRITE_SUBMISSIONS_COLLECTION_ID,
  APPWRITE_UPLOADS_BUCKET_ID,
} from "./constants";
import type { SubmissionDocument } from "./types";

const dbId = APPWRITE_DATABASE_ID;
const collId = APPWRITE_SUBMISSIONS_COLLECTION_ID;
const recordingsBucket = APPWRITE_UPLOADS_BUCKET_ID;

/** Upload a recording file to classroom_recordings bucket. Returns fileId. */
async function uploadRecording(blob: Blob, assignmentId: string): Promise<string> {
  const user = await account.get();
  const fileId = ID.unique();
  const ext = blob.type.includes("mpeg") || blob.type.includes("mp3") ? "mp3" : blob.type.includes("webm") ? "webm" : blob.type.includes("mp4") ? "m4a" : "mp3";
  const file = new File([blob], `recording_${assignmentId}_${user.$id}.${ext}`, { type: blob.type });

  await storage.createFile(
    recordingsBucket,
    fileId,
    file,
    [
      Permission.read(Role.users()),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ]
  );

  return fileId;
}

/** Delete a recording file from storage. Silently ignores errors. */
async function deleteRecording(fileId: string): Promise<void> {
  try {
    await storage.deleteFile(recordingsBucket, fileId);
  } catch {
    // File may already be deleted or permissions changed
  }
}

/** Get the view URL for a recording file. */
export function getRecordingUrl(fileId: string): string {
  return storage.getFileView(recordingsBucket, fileId);
}

/** Get the download URL for a recording file. */
export function getRecordingDownloadUrl(fileId: string): string {
  return storage.getFileDownload(recordingsBucket, fileId);
}

/** Create or update a submission. If student already has one for this assignment, update it.
 *  Optionally attach an audio recording blob (will overwrite previous recording). */
export async function submitAssignment(params: {
  assignmentId: string;
  classroomId: string;
  accuracy?: number;
  tempo?: number;
  attempts?: number;
  recordingBlob?: Blob | null;
}): Promise<SubmissionDocument> {
  const user = await account.get();

  // Upload recording if provided
  let recordingFileId: string | undefined;
  if (params.recordingBlob) {
    recordingFileId = await uploadRecording(params.recordingBlob, params.assignmentId);
  }

  // Check if student already has a submission for this assignment
  const { documents: existing } = await databases.listDocuments(dbId, collId, [
    Query.equal("assignmentId", params.assignmentId),
    Query.equal("studentId", user.$id),
    Query.limit(1),
  ]);

  if (existing.length > 0) {
    const prev = existing[0] as unknown as SubmissionDocument;

    // Delete old recording if we have a new one (overwrite mode)
    if (recordingFileId && prev.recordingFileId) {
      await deleteRecording(prev.recordingFileId);
    }

    const doc = await databases.updateDocument(dbId, collId, prev.$id, {
      accuracy: params.accuracy ?? prev.accuracy,
      tempo: params.tempo ?? prev.tempo,
      attempts: (params.attempts ?? 0) + (prev.attempts ?? 0),
      submittedAt: new Date().toISOString(),
      status: "submitted",
      ...(recordingFileId ? { recordingFileId } : {}),
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
      ...(recordingFileId ? { recordingFileId } : {}),
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
