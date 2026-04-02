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
  APPWRITE_PROJECTS_COLLECTION_ID,
  isAppwriteConfigured
} from "./constants";
import { createNotification } from "./notifications";
import { updatePostStatsAction } from "@/app/actions/social";
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
  attachmentType?: "project" | "playlist" | "none" | "sheet_music" | "assignment" | "recording_score";
  attachmentId?: string;
  visibility?: "public" | "followers" | "classroom";
  classroomId?: string;
  isPinned?: boolean;
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
      visibility: payload.visibility || "public",
      classroomId: payload.classroomId || "",
      isPinned: payload.isPinned || false,
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
 * Gets the dual-path aggregated timeline: (1) Followers and (2) Active Classrooms.
 */
export async function getTimeline(limit = 20, cursor?: string): Promise<PostDocument[]> {
  if (!isAppwriteConfigured()) return [];
  try {
    const user = await account.get();
    
    // Luồng 1 (Bạn bè):
    const followsReq = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_FOLLOWS_COLLECTION_ID,
      [
        clientQuery.equal("followerId", user.$id),
        clientQuery.limit(500)
      ]
    );
    const authorIds = [user.$id, ...followsReq.documents.map(d => d.followingId)];
    const queryAuthors = authorIds.slice(0, 50);

    const queries1 = [
      clientQuery.equal("authorId", queryAuthors),
      clientQuery.orderDesc("$createdAt"),
      clientQuery.limit(limit)
    ];
    if (cursor) queries1.push(clientQuery.cursorAfter(cursor));

    // Luồng 2 (Cộng đồng Lớp):
    const { listMyClassrooms } = await import("./classrooms");
    const myClasses = await listMyClassrooms();
    const classIds = myClasses.map(c => c.$id).slice(0, 50);

    let queries2: string[] = [];
    if (classIds.length > 0) {
      queries2 = [
        clientQuery.equal("classroomId", classIds),
        clientQuery.orderDesc("$createdAt"),
        clientQuery.limit(limit)
      ];
      if (cursor) queries2.push(clientQuery.cursorAfter(cursor));
    }

    // Call both queries concurrently (Dual Feed Aggregator)
    const [res1, res2] = await Promise.all([
      databases.listDocuments(APPWRITE_DATABASE_ID, APPWRITE_POSTS_COLLECTION_ID, queries1),
      classIds.length > 0 
        ? databases.listDocuments(APPWRITE_DATABASE_ID, APPWRITE_POSTS_COLLECTION_ID, queries2)
        : Promise.resolve({ documents: [] })
    ]);

    const allDocs = [...res1.documents, ...res2.documents] as unknown as PostDocument[];

    // Merge and dedup
    const dedupedMap = new Map<string, PostDocument>();
    for (const doc of allDocs) {
      if (doc.visibility === "classroom") {
        if (!doc.classroomId || !classIds.includes(doc.classroomId)) {
           continue; // We follow them, but this post is restricted to a classroom we are not inside
        }
      }
      dedupedMap.set(doc.$id, doc);
    }

    // Sort: Pinned first, then by date descending
    const merged = Array.from(dedupedMap.values()).sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime();
    });

    return merged.slice(0, limit);
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
      targetType: "user",
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

/** Fetch a single post by ID */
export async function getPost(postId: string): Promise<PostDocument | null> {
  if (!isAppwriteConfigured()) return null;
  try {
    const doc = await databases.getDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_POSTS_COLLECTION_ID,
      postId
    );
    return doc as unknown as PostDocument;
  } catch {
    return null;
  }
}

// ==========================================
// COMMENTS & REACTIONS

export async function updatePostStats(postId: string, updates: { reactionLike?: number, reactionLove?: number, reactionHaha?: number, reactionWow?: number, reactionTotal?: number, commentsCount?: number }) {
  await updatePostStatsAction(postId, updates);
}

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

  // Notify the post author about the comment
  try {
    const post = await databases.getDocument(APPWRITE_DATABASE_ID, APPWRITE_POSTS_COLLECTION_ID, postId);
    if (post.authorId && post.authorId !== user.$id) {
      createNotification({
        recipientId: post.authorId,
        type: "comment",
        sourceUserName: user.name || user.email?.split("@")[0] || "Someone",
        sourceUserId: user.$id,
        targetType: "post",
        targetName: (post.content || "").slice(0, 50) || "a post",
        targetId: postId,
      }).catch(() => {});
    }
  } catch { /* post lookup failed, skip notification */ }

  await updatePostStats(postId, { commentsCount: 1 });

  return doc as unknown as CommentDocument;
}


export async function deleteComment(commentId: string, postId: string) {
  if (!isAppwriteConfigured()) throw new Error("Appwrite not configured");
  await databases.deleteDocument(APPWRITE_DATABASE_ID, APPWRITE_COMMENTS_COLLECTION_ID, commentId);
  await updatePostStats(postId, { commentsCount: -1 });
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
    const existing = documents[0];
    if (existing.type === type) {
       // Unlike / Remove
       await databases.deleteDocument(APPWRITE_DATABASE_ID, APPWRITE_REACTIONS_COLLECTION_ID, existing.$id);
       if (targetType === "post") {
          const up: any = { reactionTotal: -1 };
          if (type === "like") up.reactionLike = -1;
          else if (type === "love") up.reactionLove = -1;
          else if (type === "haha") up.reactionHaha = -1;
          else if (type === "wow") up.reactionWow = -1;
          await updatePostStats(targetId, up);
       }
       return false;
    } else {
       // Switch reaction
       try {
          await databases.updateDocument(APPWRITE_DATABASE_ID, APPWRITE_REACTIONS_COLLECTION_ID, existing.$id, { type });
       } catch (e: any) {
          if (e.code === 401) {
             // Legacy fallback: old reactions don't have update permissions. 
             // Delete the old one and create a new one!
             await databases.deleteDocument(APPWRITE_DATABASE_ID, APPWRITE_REACTIONS_COLLECTION_ID, existing.$id);
             await databases.createDocument(APPWRITE_DATABASE_ID, APPWRITE_REACTIONS_COLLECTION_ID, clientID.unique(), { targetType, targetId, userId: user.$id, type }, [
               clientPermission.read(clientRole.any()),
               clientPermission.update(clientRole.user(user.$id)),
               clientPermission.delete(clientRole.user(user.$id))
             ]);
          } else {
             throw e;
          }
       }
       if (targetType === "post") {
          const up: any = {};
          if (existing.type === "like") up.reactionLike = -1;
          else if (existing.type === "love") up.reactionLove = -1;
          else if (existing.type === "haha") up.reactionHaha = -1;
          else if (existing.type === "wow") up.reactionWow = -1;
          
          if (type === "like") up.reactionLike = (up.reactionLike||0) + 1;
          else if (type === "love") up.reactionLove = (up.reactionLove||0) + 1;
          else if (type === "haha") up.reactionHaha = (up.reactionHaha||0) + 1;
          else if (type === "wow") up.reactionWow = (up.reactionWow||0) + 1;
          
          await updatePostStats(targetId, up);
       }
       return true;
    }
  } else {
    // Like / Add
    await databases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_REACTIONS_COLLECTION_ID,
      clientID.unique(),
      { targetType, targetId, userId: user.$id, type },
      [
        clientPermission.read(clientRole.any()),
        clientPermission.update(clientRole.user(user.$id)),
        clientPermission.delete(clientRole.user(user.$id))
      ]
    );

    if (targetType === "post") {
       const up: any = { reactionTotal: 1 };
       if (type === "like") up.reactionLike = 1;
       else if (type === "love") up.reactionLove = 1;
       else if (type === "haha") up.reactionHaha = 1;
       else if (type === "wow") up.reactionWow = 1;
       await updatePostStats(targetId, up);
    }
    
    // Fire-and-forget notification for likes
    (async () => {
      try {
        let ownerId: string | null = null;
        let targetName = "";
        if (targetType === "post") {
          const post = await databases.getDocument(APPWRITE_DATABASE_ID, APPWRITE_POSTS_COLLECTION_ID, targetId);
          ownerId = post.authorId;
          targetName = (post.content || "").slice(0, 50) || "a post";
        } else if (targetType === "project") {
          const proj = await databases.getDocument(APPWRITE_DATABASE_ID, APPWRITE_PROJECTS_COLLECTION_ID, targetId);
          ownerId = proj.userId || proj.ownerId;
          targetName = proj.name || proj.title || "a project";
        }
        if (ownerId && ownerId !== user.$id) {
          await createNotification({
            recipientId: ownerId,
            type: "like",
            sourceUserName: user.name || user.email?.split("@")[0] || "Someone",
            sourceUserId: user.$id,
            targetType,
            targetName,
            targetId,
          });
        }
      } catch {}
    })();
    return true; 
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


export async function getUserReactionsForPosts(postIds: string[]): Promise<Record<string, string>> {
   if (!isAppwriteConfigured() || postIds.length === 0) return {};
   try {
     const user = await account.get();
     const { documents } = await databases.listDocuments(
       APPWRITE_DATABASE_ID,
       APPWRITE_REACTIONS_COLLECTION_ID,
       [
         clientQuery.equal("targetType", "post"),
         clientQuery.equal("targetId", postIds),
         clientQuery.equal("userId", user.$id),
         clientQuery.limit(postIds.length + 10)
       ]
     );
     const map: Record<string, string> = {};
     for (const doc of documents) {
        map[doc.targetId] = doc.type || "like";
     }
     return map;
   } catch {
     return {};
   }
}
