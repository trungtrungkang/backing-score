/**
 * Favorites CRUD API for Backing & Score.
 * Call from client only (session required). Uses document permissions for owner access.
 */

import { account, databases, ID, Query, Permission, Role } from "./client";
import { APPWRITE_DATABASE_ID, APPWRITE_FAVORITES_COLLECTION_ID, APPWRITE_PROJECTS_COLLECTION_ID } from "./constants";
import type { FavoriteDocument } from "./types";

const dbId = APPWRITE_DATABASE_ID;
const collId = APPWRITE_FAVORITES_COLLECTION_ID;

/** 
 * Toggle favorite on a project or playlist.
 * Returns boolean: true if it is now favorited, false if unfavorited.
 */
export async function toggleFavorite(
  targetType: "project" | "playlist",
  targetId: string
): Promise<boolean> {
  const user = await account.get();

  // Check if it already exists
  const { documents } = await databases.listDocuments(dbId, collId, [
    Query.equal("userId", user.$id),
    Query.equal("targetType", targetType),
    Query.equal("targetId", targetId),
    Query.limit(1)
  ]);

  if (documents.length > 0) {
    // Already favorited, so unfavorite it
    await databases.deleteDocument(dbId, collId, documents[0].$id);
    // Decrement favoriteCount on target (fire-and-forget)
    if (targetType === "project") {
      syncFavoriteCount(targetId, -1);
    }
    return false; // Now unfavorited
  } else {
    // Add favorite
    await databases.createDocument(
      dbId,
      collId,
      ID.unique(),
      {
        userId: user.$id,
        targetType,
        targetId,
      },
      [
        Permission.read(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id))
      ]
    );
    // Increment favoriteCount on target (fire-and-forget)
    if (targetType === "project") {
      syncFavoriteCount(targetId, 1);
    }
    return true; // Now favorited
  }
}

/** Fire-and-forget helper to sync favoriteCount on a project document. */
function syncFavoriteCount(projectId: string, delta: number) {
  databases.getDocument(dbId, APPWRITE_PROJECTS_COLLECTION_ID, projectId)
    .then((doc) => {
      const current = (doc as any).favoriteCount ?? 0;
      return databases.updateDocument(dbId, APPWRITE_PROJECTS_COLLECTION_ID, projectId, {
        favoriteCount: Math.max(0, current + delta),
      });
    })
    .catch(() => { /* non-critical */ });
}

/** Check if the current user has favorited a specific item. */
export async function checkIsFavorited(
  targetType: "project" | "playlist",
  targetId: string
): Promise<boolean> {
  try {
    const user = await account.get();
    const { total } = await databases.listDocuments(dbId, collId, [
      Query.equal("userId", user.$id),
      Query.equal("targetType", targetType),
      Query.equal("targetId", targetId),
      Query.limit(1)
    ]);
    return total > 0;
  } catch {
    return false; // Not logged in or error
  }
}

/** List private favorites owned by the authenticated user */
export async function listMyFavorites(targetType?: "project" | "playlist"): Promise<FavoriteDocument[]> {
  const user = await account.get();
  
  const queries = [
    Query.equal("userId", user.$id),
    Query.orderDesc("$createdAt"), // Uses user_favorites_index
    Query.limit(100),
  ];
  
  if (targetType) {
      queries.push(Query.equal("targetType", targetType));
  }

  const { documents } = await databases.listDocuments(dbId, collId, queries);
  return documents as unknown as FavoriteDocument[];
}
