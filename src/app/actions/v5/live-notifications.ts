"use server";

import { getDb } from "@/db";
import { notifications } from "@/db/schema/social";
import { classroomMembers } from "@/db/schema/classroom";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/resend";
import { getAuth } from "@/lib/auth/better-auth";
import { headers } from "next/headers";
import { createId } from "@paralleldrive/cuid2";

export async function dispatchLiveClassNotification(classroomId: string, className: string) {
  const auth = getAuth();
  const requestHeaders = await headers();
  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session || !session.user) return;
  
  const teacherId = session.user.id;
  const teacherName = session.user.name;

  const db = getDb();

  // Lấy toàn bộ học sinh trong lớp (Loại trừ GV)
  const students = await db
    .select()
    .from(classroomMembers)
    .where(eq(classroomMembers.classroomId, classroomId));

  const validStudents = students.filter(s => s.role !== "teacher" && s.userId !== teacherId);

  // 1. Tạo In-App Notification cho từng học sinh
  for (const student of validStudents) {
    await db.insert(notifications).values({
      id: `notif_${createId()}`,
      userId: student.userId,
      actorId: teacherId,
      sourceUserName: teacherName,
      targetType: "live_session",
      targetName: className,
      targetId: classroomId,
      type: "system",
      message: `Giáo viên đang Live màn hình cho bài học. Nhấp để tham gia cùng cả lớp!`,
      read: false,
      createdAt: new Date(),
    });
  }

  // 2. Tạm thời Console.log tính năng gửi Email Broadcast
  // Trong thực tế sẽ map array id ra email để nhồi vào vòng lặp hoặc Resend Batch
  console.log(`[Notification Engine] Dispatched In-App Bells to ${validStudents.length} students in class ${classroomId}.`);
  
  return true;
}
