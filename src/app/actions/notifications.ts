"use server";

import { getDb } from "@/db";
import { notifications } from "@/db/schema/social";

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
