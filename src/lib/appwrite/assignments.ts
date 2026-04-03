import { account } from "./client";
import { isAppwriteConfigured } from "./constants";
import * as D1 from "@/app/actions/v5/assignments";

async function getUserIdFallback() {
  if (!isAppwriteConfigured()) return undefined;
  try {
    const user = await account.get();
    return user.$id;
  } catch {
    return undefined;
  }
}

export async function createAssignment(params: any) {
  return D1.createAssignmentV5(params, await getUserIdFallback());
}

export async function listAssignments(classroomId: string) {
  return D1.listAssignmentsV5(classroomId, await getUserIdFallback());
}

export async function getAssignment(assignmentId: string) {
  return D1.getAssignmentV5(assignmentId);
}

export async function updateAssignment(assignmentId: string, updates: any) {
  return D1.updateAssignmentV5(assignmentId, updates, await getUserIdFallback());
}

export async function deleteAssignment(assignmentId: string) {
  return D1.deleteAssignmentV5(assignmentId, await getUserIdFallback());
}
