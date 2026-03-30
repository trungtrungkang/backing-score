/**
 * Appwrite CRUD for the "notifications" collection.
 * Schema:
 *   recipientId  (string) — userId of the recipient
 *   type         (string) — "like" | "follow" | "comment" | "report_resolved"
 *   sourceUserName (string) — display name of the triggering user
 *   sourceUserId (string) — userId of the triggering user
 *   targetName   (string) — project/post name (optional)
 *   targetId     (string) — related resource ID (optional)
 *   read         (boolean) — default false
 */

import { databases, Query, ID, Permission, Role } from "./client";
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_NOTIFICATIONS_COLLECTION_ID,
} from "./constants";
import { createNotificationAction } from "@/app/actions/notifications";

const DB = APPWRITE_DATABASE_ID;
const COLL = APPWRITE_NOTIFICATIONS_COLLECTION_ID;

export interface NotificationDoc {
  $id: string;
  $createdAt: string;
  recipientId: string;
  type: "like" | "follow" | "comment" | "report_resolved" | "assignment_new" | "submission_new" | "feedback_new" | "material_new";
  sourceUserName: string;
  sourceUserId: string;
  targetType?: string; // 'post' | 'project' | 'user'
  targetName?: string;
  targetId?: string;
  read: boolean;
}

/** Fetch recent notifications for the current user */
export async function listMyNotifications(
  userId: string,
  limit = 20
): Promise<NotificationDoc[]> {
  try {
    const res = await databases.listDocuments(DB, COLL, [
      Query.equal("recipientId", userId),
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
    ]);
    return res.documents as unknown as NotificationDoc[];
  } catch (err) {
    console.warn("[notifications] Failed to list notifications:", err);
    return [];
  }
}

export async function createNotification(data: {
  recipientId: string;
  type: NotificationDoc["type"];
  sourceUserName: string;
  sourceUserId: string;
  targetType?: string;
  targetName?: string;
  targetId?: string;
}) {
  return await createNotificationAction(data);
}

/** Mark a single notification as read */
export async function markNotificationRead(notificationId: string) {
  try {
    return await databases.updateDocument(DB, COLL, notificationId, {
      read: true,
    });
  } catch (err) {
    console.warn("[notifications] Failed to mark read:", err);
  }
}

/** Mark all notifications as read for a user */
export async function markAllNotificationsRead(userId: string) {
  try {
    const unread = await databases.listDocuments(DB, COLL, [
      Query.equal("recipientId", userId),
      Query.equal("read", false),
      Query.limit(100),
    ]);
    await Promise.all(
      unread.documents.map((doc) =>
        databases.updateDocument(DB, COLL, doc.$id, { read: true })
      )
    );
  } catch (err) {
    console.warn("[notifications] Failed to mark all read:", err);
  }
}
