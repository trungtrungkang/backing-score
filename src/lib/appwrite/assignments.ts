import * as D1 from "@/app/actions/v5/assignments";

export async function createAssignment(params: any) {
  return D1.createAssignmentV5(params, undefined);
}

export async function listAssignments(classroomId: string) {
  return D1.listAssignmentsV5(classroomId, undefined);
}

export async function getAssignment(assignmentId: string) {
  return D1.getAssignmentV5(assignmentId);
}

export async function updateAssignment(assignmentId: string, updates: any) {
  return D1.updateAssignmentV5(assignmentId, updates, undefined);
}

export async function deleteAssignment(assignmentId: string) {
  return D1.deleteAssignmentV5(assignmentId, undefined);
}
