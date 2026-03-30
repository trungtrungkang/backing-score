"use server";

import { Client, Databases, ID, Permission, Role } from "node-appwrite";

/**
 * Creates a notification using the Server Admin API, tightly restricting Document-Level Security (DLS).
 * Only the recipient will be able to read/update/delete the notification.
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
  if (!process.env.APPWRITE_API_KEY) {
    console.warn("Skipping notification creation: APPWRITE_API_KEY is not defined.");
    return null;
  }

  // Prevent self-notifications
  if (data.recipientId === data.sourceUserId) return null;

  try {
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);

    const doc = await databases.createDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db",
      "notifications",
      ID.unique(),
      { ...data, read: false },
      [
        // Tightly restrict read/update/delete to the specific recipient only
        Permission.read(Role.user(data.recipientId)),
        Permission.update(Role.user(data.recipientId)),
        Permission.delete(Role.user(data.recipientId)),
      ]
    );

    return JSON.parse(JSON.stringify(doc));
  } catch (error) {
    console.error("[notifications Server Action] Failed to create tightly scoped notification:", error);
    return null;
  }
}
