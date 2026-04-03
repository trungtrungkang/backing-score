import { account } from "./client";
import { isAppwriteConfigured } from "./constants";
import * as D1 from "@/app/actions/v5/social";

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

export async function createPost(payload: any) {
  return D1.createPostV5({ ...payload, _clientUserId: await getUserIdFallback() });
}

export async function deletePost(postId: string) {
  return D1.deletePostV5(postId, await getUserIdFallback());
}

export async function getTimeline(limit = 20, cursor?: string) {
  return D1.getTimelineV5(limit, cursor, await getUserIdFallback());
}

export async function followUser(targetUserId: string) {
  return D1.followUserV5(targetUserId, await getUserIdFallback());
}

export async function unfollowUser(targetUserId: string) {
  return D1.unfollowUserV5(targetUserId, await getUserIdFallback());
}

export async function checkIsFollowing(targetUserId: string) {
  return D1.checkIsFollowingV5(targetUserId, await getUserIdFallback());
}

export async function addComment(postId: string, content: string) {
  return D1.addCommentV5(postId, content, await getUserIdFallback());
}

export async function deleteComment(commentId: string, postId: string) {
  return D1.deleteCommentV5(commentId, postId, await getUserIdFallback());
}

export async function toggleReaction(targetType: "post"|"comment"|"project"|"playlist", targetId: string, type: string = "like") {
  return D1.toggleReactionV5(targetType, targetId, type, await getUserIdFallback());
}

export async function checkIsReacted(targetType: "post"|"comment"|"project"|"playlist", targetId: string) {
  return D1.checkIsReactedV5(targetType, targetId, await getUserIdFallback());
}

export async function getUserReactionsForPosts(postIds: string[]) {
  return D1.getUserReactionsForPostsV5(postIds, await getUserIdFallback());
}

// Gọi thẳng D1 không cần Auth
export const getPost = D1.getPostV5;
export const getComments = D1.getCommentsV5;
export const getCommentsCount = D1.getCommentsCountV5;
export const updatePostStats = D1.updatePostStatsActionV5;
export const getReactionsCount = D1.getReactionsCountV5;
