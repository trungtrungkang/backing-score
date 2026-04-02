"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPost,
  getProject,
  getPlaylist,
  toggleReaction,
  getUserReactionsForPosts,
  addComment,
  getComments,
  getFileViewUrl,
  PostDocument,
  ProjectDocument,
  PlaylistDocument,
  CommentDocument,
} from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReactionButton, ReactionType } from "@/components/ReactionButton";
import {
  MessageSquare,
  ArrowLeft,
  Music,
  ListMusic,
  Send,
  OctagonX,
} from "lucide-react";
import { Music4 } from "lucide-react";
import { getPublicProfile } from "@/app/actions/user";
import { useTranslations } from "next-intl";

type EnrichedPost = PostDocument & {
  authorProfile?: { name: string; prefs: any };
  project?: ProjectDocument;
  playlist?: PlaylistDocument;
  likesCount?: number;
  isLiked?: boolean;
  reactionType?: string | null;
  reactionLike?: number;
  reactionLove?: number;
  reactionHaha?: number;
  reactionWow?: number;
  reactionTotal?: number;
  comments?: (CommentDocument & {
    authorProfile?: { name: string; prefs: any };
  })[];
};

function formatTimeAgo(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return `${Math.floor(diffSec / 86400)}d`;
}

export default function PostDetailPage() {
  const params = useParams();
  const postId = params.postId as string;
  const router = useRouter();
  const t = useTranslations("Feed");
  const { user, loading: authLoading } = useAuth();

  const [post, setPost] = useState<EnrichedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  useEffect(() => {
    if (!postId) return;

    async function loadPost() {
      setLoading(true);
      try {
        const raw = await getPost(postId);
        if (!raw) {
          setError("Post not found");
          setLoading(false);
          return;
        }

        let project: ProjectDocument | undefined;
        let playlist: PlaylistDocument | undefined;

        if (raw.attachmentType === "project" && raw.attachmentId) {
          try {
            project = await getProject(raw.attachmentId);
          } catch {}
        } else if (raw.attachmentType === "playlist" && raw.attachmentId) {
          try {
            playlist = await getPlaylist(raw.attachmentId);
          } catch {}
        }

        let authorProfile: { name: string; prefs: any } | undefined;
        try {
          authorProfile = await getPublicProfile(raw.authorId);
        } catch {}

        let isLiked = false;
        let reactionType: string | null = null;
        if (user) {
          try {
            const userReactionsMap = await getUserReactionsForPosts([raw.$id]);
            isLiked = !!userReactionsMap[raw.$id];
            reactionType = userReactionsMap[raw.$id] || null;
          } catch {}
        }

        // Load comments
        let comments: EnrichedPost["comments"] = [];
        try {
          const rawComments = await getComments(raw.$id);
          comments = await Promise.all(
            rawComments.map(async (c) => {
              let cProfile;
              try {
                cProfile = await getPublicProfile(c.authorId);
              } catch {}
              return { ...c, authorProfile: cProfile };
            })
          );
        } catch {}

        setPost({
          ...raw,
          project,
          playlist,
          authorProfile,
          likesCount: raw.reactionTotal || 0,
          reactionLike: raw.reactionLike || 0,
          reactionLove: raw.reactionLove || 0,
          reactionHaha: raw.reactionHaha || 0,
          reactionWow: raw.reactionWow || 0,
          reactionTotal: raw.reactionTotal || 0,
          isLiked,
          reactionType,
          comments,
        });
      } catch {
        setError("Failed to load post");
      } finally {
        setLoading(false);
      }
    }

    loadPost();
  }, [postId, user]);

  const handleReaction = async (type: ReactionType) => {
    if (!post) return;
    const oldIsLiked = post.isLiked;
    const oldReactionType = post.reactionType;
    const oldLike = post.reactionLike || 0;
    const oldLove = post.reactionLove || 0;
    const oldHaha = post.reactionHaha || 0;
    const oldWow = post.reactionWow || 0;
    const oldTotal = post.reactionTotal || 0;

    // Optimistic Update
    const up: any = { ...post };
    if (oldIsLiked && oldReactionType === type) {
       // Remove
       up.isLiked = false;
       up.reactionType = null;
       up.reactionTotal = oldTotal - 1;
       if (type === "like") up.reactionLike = oldLike - 1;
       else if (type === "love") up.reactionLove = oldLove - 1;
       else if (type === "haha") up.reactionHaha = oldHaha - 1;
       else if (type === "wow") up.reactionWow = oldWow - 1;
    } else if (oldIsLiked && oldReactionType !== type) {
       // Switch
       up.reactionType = type;
       if (oldReactionType === "like") up.reactionLike = oldLike - 1;
       else if (oldReactionType === "love") up.reactionLove = oldLove - 1;
       else if (oldReactionType === "haha") up.reactionHaha = oldHaha - 1;
       else if (oldReactionType === "wow") up.reactionWow = oldWow - 1;
       
       if (type === "like") up.reactionLike = (up.reactionLike||0) + 1;
       else if (type === "love") up.reactionLove = (up.reactionLove||0) + 1;
       else if (type === "haha") up.reactionHaha = (up.reactionHaha||0) + 1;
       else if (type === "wow") up.reactionWow = (up.reactionWow||0) + 1;
    } else {
       // Add
       up.isLiked = true;
       up.reactionType = type;
       up.reactionTotal = oldTotal + 1;
       if (type === "like") up.reactionLike = oldLike + 1;
       else if (type === "love") up.reactionLove = oldLove + 1;
       else if (type === "haha") up.reactionHaha = oldHaha + 1;
       else if (type === "wow") up.reactionWow = oldWow + 1;
    }
    setPost(up);

    try {
      await toggleReaction("post", post.$id, type);
    } catch {
       // Rollback
       setPost(post);
    }
  };

  const handleCreateComment = async () => {
    if (!user || !post || !commentText.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      const newC = await addComment(post.$id, commentText.trim());
      let authorProfile: { name: string; prefs: any } | undefined;
      try {
        authorProfile = await getPublicProfile(user.$id);
      } catch {}
      setPost((p) =>
        p
          ? {
              ...p,
              comments: [...(p.comments || []), { ...newC, authorProfile }],
            }
          : p
      );
      setCommentText("");
    } catch {
      console.error("Failed to add comment");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background dark:bg-[#0E0E11] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-zinc-800 border-t-[#C8A856] rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background dark:bg-[#0E0E11] text-foreground dark:text-white flex flex-col items-center justify-center gap-4">
        <Music4 className="w-12 h-12 text-zinc-400" />
        <p className="text-lg font-medium text-zinc-500">
          {error || "Post not found"}
        </p>
        <Button variant="outline" onClick={() => router.push("/feed")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Feed
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white flex justify-center border-t border-zinc-200 dark:border-zinc-900">
      <main className="w-full max-w-2xl border-x border-zinc-200 dark:border-white/5">
        {/* Back header */}
        <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#0E0E11]/80 backdrop-blur-md border-b border-zinc-200 dark:border-white/5 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/feed")}
            className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Post</h1>
        </div>

        {/* Post */}
        <article className="p-4 sm:p-6 border-b border-zinc-200 dark:border-white/5 bg-white dark:bg-[#151518]">
          <div className="flex gap-3 sm:gap-4">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold border border-indigo-200 dark:border-indigo-500/20 overflow-hidden">
              {post.authorProfile?.prefs?.avatarUrl ? (
                <img
                  src={post.authorProfile.prefs.avatarUrl}
                  className="w-full h-full object-cover"
                  alt="avatar"
                />
              ) : post.authorProfile?.name ? (
                post.authorProfile.name.substring(0, 2).toUpperCase()
              ) : (
                post.authorId.substring(0, 2).toUpperCase()
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Author + time */}
              <div className="flex items-center gap-1.5 mb-2">
                <Link
                  href={`/u/${post.authorId}`}
                  className="font-bold text-zinc-900 dark:text-zinc-100 hover:underline hover:text-[#C8A856]"
                >
                  {post.authorProfile?.name ||
                    `User ${post.authorId.substring(0, 8)}`}
                </Link>
                <span className="text-zinc-400 text-sm">·</span>
                <span className="text-zinc-500 text-sm">
                  {formatTimeAgo(post.$createdAt)}
                </span>
              </div>

              {/* Content */}
              {post.content && (
                <p className="text-zinc-800 dark:text-zinc-300 text-base leading-relaxed mb-4 whitespace-pre-wrap">
                  {post.content}
                </p>
              )}

              {/* Attachment */}
              {post.attachmentType === "project" && post.project && (
                <div
                  onClick={() => router.push(`/play/${post.project?.$id}`)}
                  className="cursor-pointer border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden mb-4 hover:border-zinc-300 dark:hover:border-white/20 transition-all flex flex-col sm:flex-row bg-zinc-50 dark:bg-zinc-900"
                >
                  <div className="sm:w-32 sm:h-32 h-40 bg-zinc-200 dark:bg-black/50 overflow-hidden relative border-b sm:border-b-0 sm:border-r border-zinc-200 dark:border-white/10 shrink-0 flex items-center justify-center group">
                    {post.project.coverUrl ? (
                      <img
                        src={post.project.coverUrl}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        alt="cover"
                      />
                    ) : (
                      <Music4 className="w-8 h-8 text-zinc-400" />
                    )}
                  </div>
                  <div className="p-3 sm:p-4 flex flex-col justify-center flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-[#C8A856] uppercase tracking-wider mb-1">
                      {t("sheetMusic")}
                    </div>
                    <dt className="font-bold text-base text-zinc-900 dark:text-white truncate mb-1">
                      {post.project.name}
                    </dt>
                    <dd className="text-xs text-zinc-500 line-clamp-2">
                      {post.project.description || t("defaultProjectDesc")}
                    </dd>
                  </div>
                </div>
              )}

              {post.attachmentType === "playlist" && post.playlist && (
                <div
                  onClick={() =>
                    router.push(`/collection/${post.playlist?.$id}`)
                  }
                  className="cursor-pointer border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden mb-4 hover:border-zinc-300 dark:hover:border-white/20 transition-all flex flex-col sm:flex-row bg-zinc-50 dark:bg-zinc-900"
                >
                  <div className="sm:w-32 sm:h-32 h-40 bg-zinc-200 dark:bg-black/50 overflow-hidden relative border-b sm:border-b-0 sm:border-r border-zinc-200 dark:border-white/10 shrink-0 flex items-center justify-center group">
                    {post.playlist.coverImageId ? (
                      <img
                        src={getFileViewUrl(
                          post.playlist.coverImageId
                        ).toString()}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        alt="cover"
                      />
                    ) : (
                      <ListMusic className="w-8 h-8 text-zinc-400" />
                    )}
                  </div>
                  <div className="p-3 sm:p-4 flex flex-col justify-center flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">
                      {t("collection")}
                    </div>
                    <dt className="font-bold text-base text-zinc-900 dark:text-white truncate mb-1">
                      {post.playlist.name}
                    </dt>
                    <dd className="text-xs text-zinc-500 font-medium">
                      {post.playlist.projectIds?.length || 0}{" "}
                      {t("tracksIncluded")}
                    </dd>
                  </div>
                </div>
              )}

              {post.attachmentType !== "none" &&
                !post.project &&
                !post.playlist && (
                  <div className="border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 rounded-xl p-4 flex items-center justify-center text-sm text-red-500 font-medium mb-4">
                    <OctagonX className="w-5 h-5 mr-2" />
                    {t("unavailableContent")}
                  </div>
                )}

              {/* Actions */}
              <div className="flex items-center gap-6 py-3 border-y border-zinc-100 dark:border-white/5">
                <ReactionButton 
                  isReacted={post.isLiked || false}
                  reactionType={post.reactionType || null}
                  reactionLike={post.reactionLike || 0}
                  reactionLove={post.reactionLove || 0}
                  reactionHaha={post.reactionHaha || 0}
                  reactionWow={post.reactionWow || 0}
                  reactionTotal={post.reactionTotal || 0}
                  onReact={handleReaction}
                  langLike={t("like") || "Like"}
                  langLove="Love"
                  langHaha="Haha"
                  langWow="Wow"
                />
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-400">
                  <div className="p-1.5">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <span>{post.comments?.length || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </article>

        {/* Comments */}
        <div className="flex flex-col">
          {post.comments &&
            post.comments.map((c) => (
              <div
                key={c.$id}
                className="flex gap-3 p-4 border-b border-zinc-100 dark:border-white/5"
              >
                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-[10px] font-bold overflow-hidden">
                  {c.authorProfile?.prefs?.avatarUrl ? (
                    <img
                      src={c.authorProfile.prefs.avatarUrl}
                      className="w-full h-full object-cover"
                      alt="avatar"
                    />
                  ) : c.authorProfile?.name ? (
                    c.authorProfile.name.substring(0, 2).toUpperCase()
                  ) : (
                    c.authorId.substring(0, 2).toUpperCase()
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Link
                      href={`/u/${c.authorId}`}
                      className="font-bold text-sm text-zinc-900 dark:text-zinc-300 hover:underline"
                    >
                      {c.authorProfile?.name ||
                        `User ${c.authorId.substring(0, 6)}`}
                    </Link>
                    <span className="text-zinc-400 text-xs">
                      {formatTimeAgo(c.$createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-400 whitespace-pre-wrap">
                    {c.content}
                  </p>
                </div>
              </div>
            ))}

          {/* Comment composer */}
          {user && (
            <div className="flex items-center gap-3 p-4 border-b border-zinc-100 dark:border-white/5 sticky bottom-0 bg-white dark:bg-[#151518]">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0 text-[10px] text-indigo-700 dark:text-indigo-400 font-bold overflow-hidden">
                {(user?.prefs as any)?.avatarUrl ? (
                  <img
                    src={(user.prefs as any).avatarUrl}
                    className="w-full h-full object-cover"
                    alt="Avatar"
                  />
                ) : user.name ? (
                  user.name.substring(0, 2).toUpperCase()
                ) : (
                  user.email?.substring(0, 2).toUpperCase() || "ME"
                )}
              </div>
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={t("commentPlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleCreateComment();
                  }
                }}
                className="flex-1 h-9 bg-zinc-100 dark:bg-zinc-900/80 border-transparent focus-visible:ring-blue-500/50 rounded-full text-sm px-4"
              />
              <Button
                disabled={!commentText.trim() || isSubmittingComment}
                onClick={handleCreateComment}
                size="icon"
                className="w-9 h-9 shrink-0 rounded-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubmittingComment ? (
                  <div className="w-4 h-4 border-2 border-blue-200 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5 ml-0.5" />
                )}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
