import { ID, Query, Permission, Role } from "node-appwrite"; // We use nod-appwrite? No we use client appwrite
import { 
  databases, 
  account, 
  ID as clientID, 
  Query as clientQuery, 
  Permission as clientPermission, 
  Role as clientRole 
} from "./client";
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_POSTS_COLLECTION_ID,
  APPWRITE_COMMENTS_COLLECTION_ID,
  APPWRITE_REACTIONS_COLLECTION_ID,
  APPWRITE_FOLLOWS_COLLECTION_ID,
  isAppwriteConfigured
} from "./constants";
import { createNotification } from "./notifications";
import type { 
  PostDocument, 
  CommentDocument, 
  ReactionDocument, 
  FollowDocument 
} from "./types";

// ==========================================
// POSTS
// ==========================================

export async function createPost(payload: {
  content?: string;
  attachmentType?: "project" | "playlist" | "none";
  attachmentId?: string;
}): Promise<PostDocument> {
  if (!isAppwriteConfigured()) throw new Error("Appwrite not configured");
  const user = await account.get();
  
  const doc = await databases.createDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_POSTS_COLLECTION_ID,
    clientID.unique(),
    {
      authorId: user.$id,
      content: payload.content || "",
      attachmentType: payload.attachmentType || "none",
      attachmentId: payload.attachmentId || "",
    },
    [
      clientPermission.read(clientRole.any()), // Public timeline
      clientPermission.update(clientRole.user(user.$id)),
      clientPermission.delete(clientRole.user(user.$id)),
    ]
  );
  return doc as unknown as PostDocument;
}

export async function deletePost(postId: string): Promise<void> {
  if (!isAppwriteConfigured()) throw new Error("Appwrite not configured");
  await databases.deleteDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_POSTS_COLLECTION_ID,
    postId
  );
}

/**
 * Gets the chronological timeline of posts from people the user follows AND themselves.
 */
export async function getTimeline(limit = 20, cursor?: string): Promise<PostDocument[]> {
  if (!isAppwriteConfigured()) return [];
  try {
    const user = await account.get();
    
    // First, find who we follow
    const followsReq = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_FOLLOWS_COLLECTION_ID,
      [
        clientQuery.equal("followerId", user.$id),
        clientQuery.limit(500)
      ]
    );
    
    // Extrapolate list of authors we want to see (ourselves + following)
    const authorIds = [user.$id, ...followsReq.documents.map(d => d.followingId)];
    
    // If the list of authorIds is huge, Appwrite limits equal array queries to 100 max usually.
    // For MVP, we pass the first 100.
    const queryAuthors = authorIds.slice(0, 100);

    const queries = [
      clientQuery.equal("authorId", queryAuthors),
      clientQuery.orderDesc("$createdAt"),
      clientQuery.limit(limit)
    ];

    if (cursor) {
      queries.push(clientQuery.cursorAfter(cursor));
    }

    const { documents } = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_POSTS_COLLECTION_ID,
      queries
    );

    return documents as unknown as PostDocument[];
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 401) {
       return [];
    }
    throw e;
  }
}

// ==========================================
// FOLLOWS
// ==========================================

export async function followUser(targetUserId: string): Promise<boolean> {
  if (!isAppwriteConfigured()) throw new Error("Appwrite not configured");
  const user = await account.get();
  if (user.$id === targetUserId) throw new Error("Cannot follow yourself");

  try {
    await databases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_FOLLOWS_COLLECTION_ID,
      clientID.unique(),
      {
        followerId: user.$id,
        followingId: targetUserId
      },
      [
        clientPermission.read(clientRole.any()),
        clientPermission.delete(clientRole.user(user.$id))
      ]
    );
    // Fire-and-forget notification
    createNotification({
      recipientId: targetUserId,
      type: "follow",
      sourceUserName: user.name || user.email?.split("@")[0] || "Someone",
      sourceUserId: user.$id,
    }).catch(() => {});
    return true;
  } catch (e: any) {
    // Unique index conflict = already following
    if (e.code === 409) return true;
    throw e;
  }
}

export async function unfollowUser(targetUserId: string): Promise<boolean> {
  if (!isAppwriteConfigured()) throw new Error("Appwrite not configured");
  const user = await account.get();

  const { documents } = await databases.listDocuments(
    APPWRITE_DATABASE_ID,
    APPWRITE_FOLLOWS_COLLECTION_ID,
    [
      clientQuery.equal("followerId", user.$id),
      clientQuery.equal("followingId", targetUserId),
      clientQuery.limit(1)
    ]
  );

  if (documents.length > 0) {
    await databases.deleteDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_FOLLOWS_COLLECTION_ID,
      documents[0].$id
    );
  }
  return true;
}

export async function checkIsFollowing(targetUserId: string): Promise<boolean> {
  if (!isAppwriteConfigured()) return false;
  try {
    const user = await account.get();
    const { total } = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_FOLLOWS_COLLECTION_ID,
      [
        clientQuery.equal("followerId", user.$id),
        clientQuery.equal("followingId", targetUserId),
        clientQuery.limit(1)
      ]
    );
    return total > 0;
  } catch {
    return false;
  }
}

// ==========================================
// COMMENTS & REACTIONS
// ==========================================

export async function addComment(postId: string, content: string): Promise<CommentDocument> {
  if (!isAppwriteConfigured()) throw new Error("Appwrite not configured");
  const user = await account.get();
  
  const doc = await databases.createDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_COMMENTS_COLLECTION_ID,
    clientID.unique(),
    {
      postId,
      authorId: user.$id,
      content,
    },
    [
      clientPermission.read(clientRole.any()),
      clientPermission.update(clientRole.user(user.$id)),
      clientPermission.delete(clientRole.user(user.$id)),
    ]
  );
  return doc as unknown as CommentDocument;
}

export async function getComments(postId: string): Promise<CommentDocument[]> {
  if (!isAppwriteConfigured()) return [];
  const { documents } = await databases.listDocuments(
    APPWRITE_DATABASE_ID,
    APPWRITE_COMMENTS_COLLECTION_ID,
    [
      clientQuery.equal("postId", postId),
      clientQuery.orderAsc("$createdAt"),
      clientQuery.limit(100)
    ]
  );
  return documents as unknown as CommentDocument[];
}

export async function getCommentsCount(postId: string): Promise<number> {
  if (!isAppwriteConfigured()) return 0;
  const { total } = await databases.listDocuments(
    APPWRITE_DATABASE_ID,
    APPWRITE_COMMENTS_COLLECTION_ID,
    [
      clientQuery.equal("postId", postId)
    ]
  );
  return total;
}

export async function toggleReaction(targetType: "post"|"comment"|"project"|"playlist", targetId: string, type: string = "like"): Promise<boolean> {
  if (!isAppwriteConfigured()) throw new Error("Appwrite not configured");
  const user = await account.get();

  const { documents } = await databases.listDocuments(
    APPWRITE_DATABASE_ID,
    APPWRITE_REACTIONS_COLLECTION_ID,
    [
      clientQuery.equal("targetType", targetType),
      clientQuery.equal("targetId", targetId),
      clientQuery.equal("userId", user.$id),
      clientQuery.limit(1)
    ]
  );

  if (documents.length > 0) {
    // Unlike
    await databases.deleteDocument(APPWRITE_DATABASE_ID, APPWRITE_REACTIONS_COLLECTION_ID, documents[0].$id);
    return false; // Not reacted
  } else {
    // Like
    await databases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_REACTIONS_COLLECTION_ID,
      clientID.unique(),
      { targetType, targetId, userId: user.$id, type },
      [
        clientPermission.read(clientRole.any()),
        clientPermission.delete(clientRole.user(user.$id))
      ]
    );
    // Fire-and-forget notification for likes
    // Note: targetOwnerId would need to be resolved by the caller or a lookup
    // For now, we skip notification here — it will be triggered by the UI component
    return true; // Reacted
  }
}

export async function getReactionsCount(targetType: "post"|"comment"|"project"|"playlist", targetId: string): Promise<number> {
    if (!isAppwriteConfigured()) return 0;
    const { total } = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_REACTIONS_COLLECTION_ID,
      [
        clientQuery.equal("targetType", targetType),
        clientQuery.equal("targetId", targetId),
      ]
    );
    // Note: Appwrite listDocuments 'total' is capped to limit+1 conventionally, but for small numbers it works perfectly.
    // However Appwrite 1.4+ fixed total counts if you just request 0 items.
    return total;
}

export async function checkIsReacted(targetType: "post"|"comment"|"project"|"playlist", targetId: string): Promise<boolean> {
  if (!isAppwriteConfigured()) return false;
  try {
    const user = await account.get();
    const { total } = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_REACTIONS_COLLECTION_ID,
      [
        clientQuery.equal("targetType", targetType),
        clientQuery.equal("targetId", targetId),
        clientQuery.equal("userId", user.$id),
        clientQuery.limit(1)
      ]
    );
    return total > 0;
  } catch {
    return false;
  }
}
