import { account } from "./client";
import { isAppwriteConfigured } from "./constants";
import * as D1 from "@/app/actions/v5/submissions";

async function getUserIdFallback() {
  if (!isAppwriteConfigured()) return undefined;
  try {
    const user = await account.get();
    return user.$id;
  } catch {
    return undefined;
  }
}

export async function submitAssignment(params: any) {
  return D1.submitAssignmentV5(params, await getUserIdFallback());
}

export async function listSubmissions(assignmentId: string) {
  return D1.listSubmissionsV5(assignmentId, await getUserIdFallback());
}

export async function getMySubmission(assignmentId: string) {
  return D1.getMySubmissionV5(assignmentId, await getUserIdFallback());
}

export async function listMySubmissions(classroomId: string) {
  return D1.listMySubmissionsV5(classroomId, await getUserIdFallback());
}

export function getRecordingUrl(fileId: string) {
  if (!fileId) return "";
  return `/api/r2/download/${fileId}`;
}

export function getRecordingDownloadUrl(fileId: string) {
  if (!fileId) return "";
  return `/api/r2/download/${fileId}`;
}

