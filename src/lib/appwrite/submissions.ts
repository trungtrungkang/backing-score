import * as D1 from "@/app/actions/v5/submissions";

export async function submitAssignment(params: any) {
  return D1.submitAssignmentV5(params, undefined);
}

export async function listSubmissions(assignmentId: string) {
  return D1.listSubmissionsV5(assignmentId, undefined);
}

export async function getMySubmission(assignmentId: string) {
  return D1.getMySubmissionV5(assignmentId, undefined);
}

export async function listMySubmissions(classroomId: string) {
  return D1.listMySubmissionsV5(classroomId, undefined);
}

export function getRecordingUrl(fileId: string) {
  if (!fileId) return "";
  return `/api/r2/download/${fileId}`;
}

export function getRecordingDownloadUrl(fileId: string) {
  if (!fileId) return "";
  return `/api/r2/download/${fileId}`;
}

