import { account } from "./client";
import { isAppwriteConfigured } from "./constants";
import * as D1 from "@/app/actions/v5/classrooms";

/** Lấy UserId thủ công từ Appwrite Client do Frontend chưa migrate qua BetterAuth */
async function getUserIdFallback() {
  if (!isAppwriteConfigured()) return undefined;
  try {
    const user = await account.get();
    return user.$id;
  } catch {
    return undefined;
  }
}

export async function createClassroom(params: any) {
  return D1.createClassroomV5(params, await getUserIdFallback());
}

export async function getClassroom(classroomId: string) {
  return D1.getClassroomV5(classroomId);
}

export async function listMyClassrooms() {
  return D1.listMyClassroomsV5(await getUserIdFallback());
}

export async function updateClassroom(classroomId: string, updates: any) {
  return D1.updateClassroomV5(classroomId, updates, await getUserIdFallback());
}

export async function deleteClassroom(classroomId: string) {
  return D1.deleteClassroomV5(classroomId, await getUserIdFallback());
}

export async function joinClassroom(code: string) {
  return D1.joinClassroomV5(code, await getUserIdFallback());
}

export async function createInviteTicket(classroomId: string, studentName?: string, expiresInDays: number = 7) {
  return D1.createInviteTicketV5(classroomId, studentName, expiresInDays, await getUserIdFallback());
}

export async function listClassroomInvites(classroomId: string) {
  return D1.listClassroomInvitesV5(classroomId, await getUserIdFallback());
}

export async function deleteInviteTicket(inviteId: string) {
  return D1.deleteInviteTicketV5(inviteId, await getUserIdFallback());
}

export async function approveMember(memberDocId: string) {
  return D1.approveMemberV5(memberDocId, await getUserIdFallback());
}

export async function declineMember(memberDocId: string) {
  return D1.declineMemberV5(memberDocId, await getUserIdFallback());
}

export async function leaveClassroom(classroomId: string) {
  return D1.leaveClassroomV5(classroomId, await getUserIdFallback());
}

export async function listClassroomMembers(classroomId: string) {
  return D1.listClassroomMembersV5(classroomId, await getUserIdFallback());
}

export async function listPendingMembers(classroomId: string) {
  return D1.listPendingMembersV5(classroomId, await getUserIdFallback());
}

export async function removeClassroomMember(classroomId: string, userId: string) {
  return D1.removeClassroomMemberV5(classroomId, userId, await getUserIdFallback());
}

export async function isClassroomMember(classroomId: string) {
  return D1.isClassroomMemberV5(classroomId, await getUserIdFallback());
}
