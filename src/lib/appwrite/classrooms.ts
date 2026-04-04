import * as D1 from "@/app/actions/v5/classrooms";

/** Lấy UserId thủ công từ Appwrite Client do Frontend chưa migrate qua BetterAuth */

export async function createClassroom(params: any) {
  return D1.createClassroomV5(params, undefined);
}

export async function getClassroom(classroomId: string) {
  return D1.getClassroomV5(classroomId);
}

export async function listMyClassrooms() {
  return D1.listMyClassroomsV5(undefined);
}

export async function updateClassroom(classroomId: string, updates: any) {
  return D1.updateClassroomV5(classroomId, updates, undefined);
}

export async function deleteClassroom(classroomId: string) {
  return D1.deleteClassroomV5(classroomId, undefined);
}

export async function joinClassroom(code: string) {
  return D1.joinClassroomV5(code, undefined);
}

export async function createInviteTicket(classroomId: string, studentName?: string, expiresInDays: number = 7) {
  return D1.createInviteTicketV5(classroomId, studentName, expiresInDays, undefined);
}

export async function listClassroomInvites(classroomId: string) {
  return D1.listClassroomInvitesV5(classroomId, undefined);
}

export async function deleteInviteTicket(inviteId: string) {
  return D1.deleteInviteTicketV5(inviteId, undefined);
}

export async function approveMember(memberDocId: string) {
  return D1.approveMemberV5(memberDocId, undefined);
}

export async function declineMember(memberDocId: string) {
  return D1.declineMemberV5(memberDocId, undefined);
}

export async function leaveClassroom(classroomId: string) {
  return D1.leaveClassroomV5(classroomId, undefined);
}

export async function listClassroomMembers(classroomId: string) {
  return D1.listClassroomMembersV5(classroomId, undefined);
}

export async function listPendingMembers(classroomId: string) {
  return D1.listPendingMembersV5(classroomId, undefined);
}

export async function removeClassroomMember(classroomId: string, userId: string) {
  return D1.removeClassroomMemberV5(classroomId, userId, undefined);
}

export async function isClassroomMember(classroomId: string) {
  return D1.isClassroomMemberV5(classroomId, undefined);
}
