"use server";

import { getDb } from "@/db";
import { posts, comments, reactions, follows, notifications } from "@/db/schema/social";
import { users } from "@/db/schema/auth";
import { classrooms, classroomMembers } from "@/db/schema/classroom";
import { eq, desc, and, or, inArray, count, sql } from "drizzle-orm";
import { getAuth } from "@/lib/auth/better-auth";
import { headers } from "next/headers";
import type { PostDocument, CommentDocument } from "@/lib/appwrite/types";

// Helper: Ensure request is authenticated
async function requireUser(clientUserId?: string) {
  if (clientUserId) return clientUserId;
  const env = process.env as any;
  const auth = getAuth(env);
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

// Formatters
function mockPost(row: any): PostDocument {
  return {
    $id: row.id,
    $createdAt: new Date(row.createdAt).toISOString(),
    $updatedAt: new Date(row.createdAt).toISOString(),
    authorId: row.authorId,
    content: row.content,
    attachmentType: row.attachmentType || "none",
    attachmentId: row.attachedProjectId || row.attachedSetlistId || "",
    visibility: row.visibility,
    classroomId: row.classroomId || "",
    isPinned: row.isPinned || false,
    reactionLike: row.reactionLike || 0,
    reactionLove: row.reactionLove || 0,
    reactionHaha: row.reactionHaha || 0,
    reactionWow: row.reactionWow || 0,
    reactionTotal: row.reactionTotal || 0,
    commentsCount: row.commentsCount || 0,
  } as unknown as PostDocument;
}

function mockComment(row: any): CommentDocument {
  return {
    $id: row.id,
    $createdAt: new Date(row.createdAt).toISOString(),
    $updatedAt: new Date(row.createdAt).toISOString(),
    postId: row.postId,
    authorId: row.authorId,
    content: row.content,
  } as unknown as CommentDocument;
}

// -------------------------------------------------------------------
// POSTS
// -------------------------------------------------------------------

export async function createPostV5(payload: {
  content?: string;
  attachmentType?: "project" | "playlist" | "none" | "sheet_music" | "assignment" | "recording_score";
  attachmentId?: string;
  visibility?: "public" | "followers" | "classroom";
  classroomId?: string;
  isPinned?: boolean;
  _clientUserId?: string;
}): Promise<PostDocument> {
  const userId = await requireUser(payload._clientUserId);
  const db = getDb();
  
  const newId = crypto.randomUUID();
  
  // Decide attachment logic manually mapping to D1 schema arcs
  let attachedProjectId = null;
  let attachedSetlistId = null;
  
  if (["project", "sheet_music", "assignment", "recording_score"].includes(payload.attachmentType || "")) {
     attachedProjectId = payload.attachmentId;
  } else if (payload.attachmentType === "playlist") {
     attachedSetlistId = payload.attachmentId;
  }
  
  await db.insert(posts).values({
    id: newId,
    authorId: userId,
    content: payload.content || "",
    attachedProjectId,
    attachedSetlistId,
    visibility: payload.visibility || "public",
    classroomId: payload.classroomId || null,
    isPinned: payload.isPinned || false,
    createdAt: new Date()
  });

  return getPostV5(newId) as Promise<PostDocument>;
}

export async function deletePostV5(postId: string, _clientUserId?: string): Promise<void> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  
  // Optional security: Ensure user owns post
  const p = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (p.length === 0) return;
  if (p[0].authorId !== userId) throw new Error("Forbidden");

  await db.delete(posts).where(eq(posts.id, postId));
}

export async function getPostV5(postId: string): Promise<PostDocument | null> {
  const db = getDb();
  const results = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (results.length === 0) return null;
  return mockPost(results[0]);
}

export async function getTimelineV5(limit = 20, cursor?: string, _clientUserId?: string): Promise<PostDocument[]> {
  const env = process.env as any;
  const auth = getAuth(env);
  const session = await auth.api.getSession({ headers: await headers() });
  
  const db = getDb();
  const targetUserId = _clientUserId || session?.user?.id;
  
  let qAuthors: string[] = [];
  let qClassrooms: string[] = [];

  if (targetUserId) {
    // 1. Get authors you follow
    const followsReq = await db.select({ followingId: follows.followingId }).from(follows).where(eq(follows.followerId, targetUserId));
    qAuthors = [targetUserId, ...followsReq.map((f: { followingId: string }) => f.followingId)];
    
    // 2. Get classrooms you're in
    const classesReq = await db.select({ classroomId: classroomMembers.classroomId }).from(classroomMembers).where(eq(classroomMembers.userId, targetUserId));
    qClassrooms = classesReq.map((c: { classroomId: string | null }) => c.classroomId).filter(Boolean) as string[];
  }
  
  // Very complex condition for the unified query
  // Post should be:
  // (visibility == public) OR (visibility == followers AND author in qAuthors) OR (visibility == classroom AND classroom in qClassrooms)
  const isPublic = eq(posts.visibility, "public");
  
  const feedFilter = or(
     isPublic,
     ...(!targetUserId ? [] : [
       qAuthors.length > 0 ? and(eq(posts.visibility, "followers"), inArray(posts.authorId, qAuthors)) : undefined,
       qClassrooms.length > 0 ? and(eq(posts.visibility, "classroom"), inArray(posts.classroomId, qClassrooms)) : undefined
     ].filter(Boolean) as any[])
  );

  let query: any = db.select().from(posts).where(feedFilter);
  // Sort pinned first, then by createdAt desc. Cursor logic intentionally simplified for now in Drizzle.
  query = query.orderBy(desc(posts.isPinned), desc(posts.createdAt)).limit(limit);
  
  const rs = await query;
  return rs.map(mockPost);
}

// -------------------------------------------------------------------
// STATS UPDATER 
// -------------------------------------------------------------------

export async function updatePostStatsActionV5(postId: string, updates: { reactionLike?: number, reactionLove?: number, reactionHaha?: number, reactionWow?: number, reactionTotal?: number, commentsCount?: number }) {
  const db = getDb();
  
  const pList = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (pList.length === 0) return false;
  const p = pList[0];
  
  const payload: any = {};
  if (updates.reactionLike !== undefined) payload.reactionLike = Math.max(0, p.reactionLike + updates.reactionLike);
  if (updates.reactionLove !== undefined) payload.reactionLove = Math.max(0, p.reactionLove + updates.reactionLove);
  if (updates.reactionHaha !== undefined) payload.reactionHaha = Math.max(0, p.reactionHaha + updates.reactionHaha);
  if (updates.reactionWow !== undefined) payload.reactionWow = Math.max(0, p.reactionWow + updates.reactionWow);
  if (updates.commentsCount !== undefined) payload.commentsCount = Math.max(0, p.commentsCount + updates.commentsCount);

  const finalLike = payload.reactionLike !== undefined ? payload.reactionLike : p.reactionLike;
  const finalLove = payload.reactionLove !== undefined ? payload.reactionLove : p.reactionLove;
  const finalHaha = payload.reactionHaha !== undefined ? payload.reactionHaha : p.reactionHaha;
  const finalWow  = payload.reactionWow  !== undefined ? payload.reactionWow  : p.reactionWow;
  
  payload.reactionTotal = finalLike + finalLove + finalHaha + finalWow;

  await db.update(posts).set(payload).where(eq(posts.id, postId));
  return true;
}

// -------------------------------------------------------------------
// FOLLOWS
// -------------------------------------------------------------------

export async function followUserV5(targetUserId: string, _clientUserId?: string): Promise<boolean> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  if (userId === targetUserId) throw new Error("Cannot follow yourself");

  // Upsert equivalent manual logic
  const existing = await db.select().from(follows).where(and(eq(follows.followerId, userId), eq(follows.followingId, targetUserId))).limit(1);
  if (existing.length > 0) return true;

  await db.insert(follows).values({
    id: crypto.randomUUID(),
    followerId: userId,
    followingId: targetUserId,
    createdAt: new Date()
  });
  
  // Fire Notification via API layer could happen here.
  db.insert(notifications).values({
     id: crypto.randomUUID(),
     userId: targetUserId,
     actorId: userId,
     type: "follow",
     message: "",
     createdAt: new Date()
  }).catch(() => {});
  
  return true;
}

export async function unfollowUserV5(targetUserId: string, _clientUserId?: string): Promise<boolean> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  await db.delete(follows).where(and(eq(follows.followerId, userId), eq(follows.followingId, targetUserId)));
  return true;
}

export async function checkIsFollowingV5(targetUserId: string, _clientUserId?: string): Promise<boolean> {
  try {
     const userId = await requireUser(_clientUserId);
     const db = getDb();
     const existing = await db.select({ total: count() }).from(follows).where(and(eq(follows.followerId, userId), eq(follows.followingId, targetUserId)));
     return existing[0].total > 0;
  } catch {
     return false;
  }
}

// -------------------------------------------------------------------
// COMMENTS
// -------------------------------------------------------------------

export async function addCommentV5(postId: string, content: string, _clientUserId?: string): Promise<CommentDocument> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  
  const newId = crypto.randomUUID();
  await db.insert(comments).values({
    id: newId,
    postId,
    authorId: userId,
    content,
    createdAt: new Date()
  });

  await updatePostStatsActionV5(postId, { commentsCount: 1 });
  
  const rs = await db.select().from(comments).where(eq(comments.id, newId)).limit(1);
  
  // Notification to post author
  const p = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (p.length && p[0].authorId !== userId) {
     db.insert(notifications).values({
         id: crypto.randomUUID(),
         userId: p[0].authorId,
         actorId: userId,
         type: "comment",
         postId: postId,
         message: "",
         createdAt: new Date()
     }).catch(()=>{});
  }

  return mockComment(rs[0]);
}

export async function deleteCommentV5(commentId: string, postId: string, _clientUserId?: string) {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  await db.delete(comments).where(and(eq(comments.id, commentId), eq(comments.authorId, userId)));
  await updatePostStatsActionV5(postId, { commentsCount: -1 });
}

export async function getCommentsV5(postId: string): Promise<CommentDocument[]> {
  const db = getDb();
  const res = await db.select().from(comments).where(eq(comments.postId, postId)).orderBy(comments.createdAt).limit(100);
  return res.map(mockComment);
}

export async function getCommentsCountV5(postId: string): Promise<number> {
  const db = getDb();
  const res = await db.select({ val: count() }).from(comments).where(eq(comments.postId, postId));
  return res[0].val;
}

// -------------------------------------------------------------------
// REACTIONS
// -------------------------------------------------------------------

export async function toggleReactionV5(targetType: "post"|"comment"|"project"|"playlist", targetId: string, type: string = "like", _clientUserId?: string): Promise<boolean> {
  const userId = await requireUser(_clientUserId);
  const db = getDb();
  
  const c = and(
    // Manual mapping for exclusive arcs because targetType string is a construct
    targetType === "post" ? eq(reactions.postId, targetId) :
    targetType === "comment" ? eq(reactions.commentId, targetId) :
    targetType === "project" ? eq(reactions.projectId, targetId) :
    eq(reactions.setlistId, targetId),
    eq(reactions.userId, userId)
  );

  const existing = await db.select().from(reactions).where(c).limit(1);
  
  if (existing.length > 0) {
      if (existing[0].type === type) {
          // Unlike
          await db.delete(reactions).where(eq(reactions.id, existing[0].id));
          if (targetType === "post") {
              const payload = { reactionLike: 0, reactionLove: 0, reactionHaha: 0, reactionWow: 0 };
              if (type === "like") payload.reactionLike = -1;
              if (type === "love") payload.reactionLove = -1;
              if (type === "haha") payload.reactionHaha = -1;
              if (type === "wow") payload.reactionWow = -1;
              await updatePostStatsActionV5(targetId, payload);
          }
          return false;
      } else {
          // Switch Reaction
          await db.update(reactions).set({ type }).where(eq(reactions.id, existing[0].id));
          if (targetType === "post") {
              const oldType = existing[0].type;
              const payload = { reactionLike: 0, reactionLove: 0, reactionHaha: 0, reactionWow: 0 };
              if (oldType === "like") payload.reactionLike = -1;
              if (oldType === "love") payload.reactionLove = -1;
              if (oldType === "haha") payload.reactionHaha = -1;
              if (oldType === "wow") payload.reactionWow = -1;
              
              if (type === "like") payload.reactionLike += 1;
              if (type === "love") payload.reactionLove += 1;
              if (type === "haha") payload.reactionHaha += 1;
              if (type === "wow") payload.reactionWow += 1;
              await updatePostStatsActionV5(targetId, payload);
          }
          return true;
      }
  } else {
      // Add
      await db.insert(reactions).values({
         id: crypto.randomUUID(),
         userId,
         type,
         postId: targetType === "post" ? targetId : null,
         commentId: targetType === "comment" ? targetId : null,
         projectId: targetType === "project" ? targetId : null,
         setlistId: targetType === "playlist" ? targetId : null,
         createdAt: new Date()
      });
      
      if (targetType === "post") {
          const payload = { reactionLike: 0, reactionLove: 0, reactionHaha: 0, reactionWow: 0 };
          if (type === "like") payload.reactionLike = 1;
          if (type === "love") payload.reactionLove = 1;
          if (type === "haha") payload.reactionHaha = 1;
          if (type === "wow") payload.reactionWow = 1;
          await updatePostStatsActionV5(targetId, payload);
      }
      return true;
  }
}

export async function getReactionsCountV5(targetType: "post"|"comment"|"project"|"playlist", targetId: string): Promise<number> {
  const db = getDb();
  const c = targetType === "post" ? eq(reactions.postId, targetId) :
    targetType === "comment" ? eq(reactions.commentId, targetId) :
    targetType === "project" ? eq(reactions.projectId, targetId) :
    eq(reactions.setlistId, targetId);
    
  const res = await db.select({ val: count() }).from(reactions).where(c);
  return res[0].val;
}

export async function checkIsReactedV5(targetType: "post"|"comment"|"project"|"playlist", targetId: string, _clientUserId?: string): Promise<boolean> {
  try {
     const userId = await requireUser(_clientUserId);
     const db = getDb();
     const c = targetType === "post" ? eq(reactions.postId, targetId) :
              targetType === "comment" ? eq(reactions.commentId, targetId) :
              targetType === "project" ? eq(reactions.projectId, targetId) :
              eq(reactions.setlistId, targetId);
     const existing = await db.select({ total: count() }).from(reactions).where(and(c, eq(reactions.userId, userId)));
     return existing[0].total > 0;
  } catch {
     return false;
  }
}

export async function getUserReactionsForPostsV5(postIds: string[], _clientUserId?: string): Promise<Record<string, string>> {
  if (!postIds || postIds.length === 0) return {};
  try {
     const userId = await requireUser(_clientUserId);
     const db = getDb();
     const res = await db.select().from(reactions).where(and(inArray(reactions.postId, postIds), eq(reactions.userId, userId)));
     const map: Record<string, string> = {};
     for (const r of res) {
         if (r.postId) map[r.postId] = r.type;
     }
     return map;
  } catch {
     return {};
  }
}
