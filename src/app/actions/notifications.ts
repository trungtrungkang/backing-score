"use server";

import { getDb } from "@/db";
import { notifications } from "@/db/schema/social";
import { eq, desc, and } from "drizzle-orm";

export interface NotificationDoc {
  $id: string;
  $createdAt: string;
  recipientId: string;
  type: "like" | "follow" | "comment" | "report_resolved" | "assignment_new" | "submission_new" | "feedback_new" | "material_new" | "classroom_join_request" | "classroom_join_approved";
  sourceUserName: string;
  sourceUserId: string;
  targetType?: string; // 'post' | 'project' | 'user'
  targetName?: string;
  targetId?: string;
  read: boolean;
}

/**
 * Creates a notification using D1 DB.
 */
export async function createNotificationAction(data: {
  recipientId: string;
  type: string;
  sourceUserName: string;
  sourceUserId: string;
  targetType?: string;
  targetName?: string;
  targetId?: string;
}) {
  // Prevent self-notifications
  if (data.recipientId === data.sourceUserId) return null;

  try {
    const db = getDb();
    
    // Insert new notification
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      userId: data.recipientId,
      type: data.type,
      sourceUserId: data.sourceUserId,
      sourceUserName: data.sourceUserName,
      targetType: data.targetType || null,
      targetName: data.targetName || null,
      targetId: data.targetId || null,
      read: false,
      createdAt: new Date()
    });

    return { success: true };
  } catch (error) {
    console.error("[notifications Server Action] Failed to create D1 notification:", error);
    return null;
  }
}

export async function listMyNotifications(userId: string, limitNum: number = 20) {
  if (!userId) return [];
  
  try {
    const db = getDb();
    const rows = await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limitNum);
    return rows.map((r: any) => ({
      ...r,
      $id: r.id,
      $createdAt: new Date(r.createdAt).toISOString(),
      recipientId: r.userId
    }));
  } catch (error) {
    console.error("[listMyNotifications] Error fetching notifications:", error);
    return [];
  }
}

export async function markNotificationRead(notificationId: string) {
  const db = getDb();
  await db.update(notifications).set({ read: true }).where(eq(notifications.id, notificationId));
  return true;
}

export async function markAllNotificationsRead(userId: string) {
  const db = getDb();
  await db.update(notifications).set({ read: true }).where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return true;
}
