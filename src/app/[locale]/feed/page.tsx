"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { 
  getTimeline, 
  createPost, 
  getProject, 
  getPlaylist,
  toggleReaction,
  getReactionsCount,
  checkIsReacted,
  addComment,
  getComments,
  getCommentsCount,
  listMyProjects,
  getFileViewUrl,
  PostDocument,
  ProjectDocument,
  PlaylistDocument,
  CommentDocument,
  getUserReactionsForPosts
} from "@/lib/appwrite";
import { listMyClassrooms } from "@/lib/appwrite/classrooms";
import type { ClassroomDocument } from "@/lib/appwrite/types";
import { deletePost } from "@/lib/appwrite/social";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { 
  Heart, MessageSquare, Share2, Music, ListMusic, 
  Globe, Clock, PenTool, Image as ImageIcon, Send, X, Loader2, OctagonX, Trash2, MoreVertical,
  Users, KeyRound, Shield
} from "lucide-react";
import { Music4 } from "lucide-react";
import { getPublicProfile, getPublicProfiles } from "@/app/actions/user";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useDialogs } from "@/components/ui/dialog-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReactionButton, ReactionType } from "@/components/ReactionButton";

type EnrichedPost = PostDocument & {
  authorProfile?: { name: string; prefs: any };
  authorName?: string;
  project?: ProjectDocument;
  playlist?: PlaylistDocument;
  likesCount?: number;
  isLiked?: boolean;
  reactionType?: string | null;
  commentsCount?: number;
  comments?: (CommentDocument & { authorProfile?: { name: string; prefs: any } })[];
  loadingComments?: boolean;
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

export default function FeedPage() {
  const router = useRouter();
  const t = useTranslations("Feed");
  const { user, loading: authLoading } = useAuth();
  
  const [posts, setPosts] = useState<EnrichedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Composer State
  const [composeText, setComposeText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<{ type: "project" | "playlist", id: string, name: string } | null>(null);

  // Attachment Modal State
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [myProjects, setMyProjects] = useState<ProjectDocument[]>([]);
  const [loadingAttach, setLoadingAttach] = useState(false);

  // Visibility & Classroom
  const [visibility, setVisibility] = useState<"followers" | "classroom">("followers");
  const [classroomId, setClassroomId] = useState<string>("");
  const [myClassrooms, setMyClassrooms] = useState<ClassroomDocument[]>([]);
  
  const { prompt, confirm } = useDialogs();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!user) return;

    let cancelled = false;

    async function loadFeed() {
      setLoading(true);
      try {
        const rawPosts = await getTimeline(20);
        if (rawPosts.length === 0) {
           if (!cancelled) setPosts([]);
           return;
        }

        // 1. Batch Authors
        const authorIds = [...new Set(rawPosts.map(p => p.authorId))];
        const profilesMap = await getPublicProfiles(authorIds);

        // 2. Batch Attachments (Projects & Playlists)
        const projectIds = [...new Set(rawPosts.filter(p => p.attachmentType === "project" && p.attachmentId).map(p => p.attachmentId as string))];
        const playlistIds = [...new Set(rawPosts.filter(p => p.attachmentType === "playlist" && p.attachmentId).map(p => p.attachmentId as string))];
        
        const projectsMap: Record<string, ProjectDocument> = {};
        const playlistsMap: Record<string, PlaylistDocument> = {};
        
        await Promise.all([
          ...projectIds.map(async id => {
             try { projectsMap[id] = await getProject(id); } catch {}
          }),
          ...playlistIds.map(async id => {
             try { playlistsMap[id] = await getPlaylist(id); } catch {}
          })
        ]);

        // 3. Batch Reactions for current user
        let userReactionsMap: Record<string, string> = {};
        if (user) {
           userReactionsMap = await getUserReactionsForPosts(rawPosts.map(p => p.$id));
        }

        // 4. Map Enriched Data
        const enriched = rawPosts.map((p) => {
          return {
            ...p,
            project: p.attachmentType === "project" && p.attachmentId ? projectsMap[p.attachmentId] : undefined,
            playlist: p.attachmentType === "playlist" && p.attachmentId ? playlistsMap[p.attachmentId] : undefined,
            authorProfile: profilesMap[p.authorId],
            // Use denormalized counts or default to 0
            likesCount: p.reactionTotal || 0,
            commentsCount: p.commentsCount || 0,
            isLiked: !!userReactionsMap[p.$id],
            reactionType: userReactionsMap[p.$id] || null,
          };
        });

        if (!cancelled) setPosts(enriched);
      } catch (e: any) {
        if (!cancelled) setError("Failed to construct feed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFeed();

    async function loadClasses() {
      try {
        const cls = await listMyClassrooms();
        setMyClassrooms(cls);
        if (cls.length > 0) setClassroomId(cls[0].$id);
      } catch (e) {}
    }
    loadClasses();

    return () => { cancelled = true; };
  }, [user, authLoading, router]);

  const handlePostSubmit = async () => {
    if (!user || isPosting || (!composeText.trim() && !selectedAttachment)) return;
    setIsPosting(true);
    try {
      const newPost = await createPost({
        content: composeText.trim(),
        attachmentType: selectedAttachment ? selectedAttachment.type : "none",
        attachmentId: selectedAttachment ? selectedAttachment.id : "",
        visibility: visibility === "classroom" ? "classroom" : "followers",
        classroomId: visibility === "classroom" ? classroomId : undefined
      });
      // Pushing optimistic feed
      let projObj: ProjectDocument | undefined = undefined;
      if (selectedAttachment?.type === "project") {
         projObj = myProjects.find(p => p.$id === selectedAttachment.id);
      }
      setPosts(prev => [{
        ...newPost,
        likesCount: 0,
        isLiked: false,
        project: projObj,
        authorProfile: { name: user.name, prefs: user.prefs }
      }, ...prev]);
      setComposeText("");
      setSelectedAttachment(null);
    } catch {
      setError("Failed to broadcast post.");
    } finally {
      setIsPosting(false);
    }
  };

  const handleReaction = async (postIndex: number, postId: string, type: string) => {
    const post = posts[postIndex];
    const oldIsLiked = post.isLiked;
    const oldReactionType = post.reactionType;
    const oldLike = post.reactionLike || 0;
    const oldLove = post.reactionLove || 0;
    const oldHaha = post.reactionHaha || 0;
    const oldWow = post.reactionWow || 0;
    const oldTotal = post.reactionTotal || 0;

    // Optimistic Update
    setPosts(prev => prev.map((p, i) => {
       if (i !== postIndex) return p;
       const up: any = { ...p };
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
       return up;
    }));

    await toggleReaction("post", postId, type).catch(() => {
       // Rollback
       setPosts(prev => prev.map((p, i) => i === postIndex ? {
          ...p,
          isLiked: oldIsLiked,
          reactionType: oldReactionType,
          reactionLike: oldLike,
          reactionLove: oldLove,
          reactionHaha: oldHaha,
          reactionWow: oldWow,
          reactionTotal: oldTotal
       } : p));
    });
  };

  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const handleToggleComments = async (postIndex: number, postId: string) => {
    if (activeCommentPostId === postId) {
       setActiveCommentPostId(null);
       return;
    }
    setActiveCommentPostId(postId);
    setCommentText("");
    
    // Fetch comments if empty
    if (!posts[postIndex].comments) {
       setPosts(prev => prev.map((p, i) => i === postIndex ? { ...p, loadingComments: true } : p));
       try {
          const fetched = await getComments(postId);
          const enrichedComments = await Promise.all(fetched.map(async (c) => {
             let authorProfile;
             try { authorProfile = await getPublicProfile(c.authorId); } catch {}
             return { ...c, authorProfile };
          }));
          setPosts(prev => prev.map((p, i) => i === postIndex ? { ...p, comments: enrichedComments, loadingComments: false } : p));
       } catch {
          setPosts(prev => prev.map((p, i) => i === postIndex ? { ...p, loadingComments: false } : p));
       }
    }
  };

  const handleCreateComment = async (postIndex: number, postId: string) => {
    if (!user || !commentText.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      const newC = await addComment(postId, commentText.trim());
      let authorProfile;
      try { authorProfile = await getPublicProfile(user.$id); } catch {}
      const enrichedNewC = { ...newC, authorProfile };
      setPosts(prev => prev.map((p, i) => i === postIndex ? { 
         ...p, 
         comments: [...(p.comments || []), enrichedNewC],
         commentsCount: (p.commentsCount || 0) + 1 
      } : p));
      setCommentText("");
    } catch {
      console.error("Failed to add comment");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background dark:bg-[#0E0E11] text-foreground dark:text-white flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-zinc-800 border-t-[#C8A856] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white flex border-t border-zinc-200 dark:border-zinc-900 justify-center">
      
      {/* Main Timeline Column */}
      <main className="w-full max-w-2xl border-x border-zinc-200 dark:border-white/5 min-h-0 overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#0E0E11]/80 backdrop-blur-md border-b border-zinc-200 dark:border-white/5 px-6 py-4 flex items-center justify-between cursor-pointer">
           <h1 className="text-xl font-bold tracking-tight">{t("timeline")}</h1>
        </div>

        {/* Composer Box */}
        <div className="p-4 sm:p-6 border-b border-zinc-200 dark:border-white/5 bg-white dark:bg-[#151518]">
           <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                 <Globe className="w-5 h-5 text-zinc-400" />
              </div>
              <div className="flex-1 flex flex-col gap-3">
                 <Textarea 
                   value={composeText}
                   onChange={e => setComposeText(e.target.value)}
                   placeholder={t("composerPlaceholder")}
                   className="resize-none border-none bg-transparent focus-visible:ring-0 px-0 text-lg md:text-xl placeholder:text-zinc-400 dark:placeholder:text-zinc-600 shadow-none mt-1 h-16 max-h-48"
                 />
                 
                 {error && (
                    <div className="text-red-500 text-xs font-medium py-1">{error}</div>
                 )}

                 {selectedAttachment && (
                    <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg text-sm text-blue-700 dark:text-blue-300 font-medium mb-3 relative group w-max max-w-full">
                       <Music className="w-4 h-4 shrink-0" />
                       <span className="truncate">{selectedAttachment.name}</span>
                       <button onClick={() => setSelectedAttachment(null)} className="ml-2 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center hover:bg-blue-200 dark:hover:bg-blue-700">
                         <X className="w-3 h-3" />
                       </button>
                    </div>
                 )}

                 <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-white/5">
                    <div className="flex gap-3 items-center">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                             <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-8 rounded-full text-zinc-500 hover:text-indigo-500 hover:bg-indigo-500/10 font-medium px-3"
                             >
                                <span className="flex items-center gap-1.5"><Music4 className="w-4 h-4" /> Attach</span>
                             </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-48 bg-white dark:bg-[#1A1A1E] border-zinc-200 dark:border-white/10 rounded-xl">
                             <DropdownMenuItem onClick={() => {
                               setShowAttachModal(true);
                               setLoadingAttach(true);
                               listMyProjects().then(setMyProjects).finally(() => setLoadingAttach(false));
                             }} className="cursor-pointer font-medium py-2">
                                <Music className="w-4 h-4 mr-2 text-indigo-500" /> Interactive Score
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => toast.info("Coming soon: PDF Sheet Music support")} className="cursor-pointer font-medium py-2">
                                <ImageIcon className="w-4 h-4 mr-2 text-amber-500" /> Sheet Music PDF
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => toast.info("Coming soon: Video & Audio recording")} className="cursor-pointer font-medium py-2">
                                <span className="w-4 h-4 mr-2 text-rose-500 bg-rose-500/20 rounded-full flex items-center justify-center shrink-0"><span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span></span> Performance Record
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => toast.info("Coming soon: Classroom Assignments")} className="cursor-pointer font-medium py-2">
                                <PenTool className="w-4 h-4 mr-2 text-blue-500" /> Assignment
                             </DropdownMenuItem>
                          </DropdownMenuContent>
                       </DropdownMenu>

                       <DropdownMenu>
                         <DropdownMenuTrigger asChild>
                           <Button variant="outline" size="sm" className="h-8 rounded-full border-zinc-200 dark:border-white/10 bg-transparent text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 font-medium px-3 flex items-center gap-1.5">
                             {visibility === "followers" ? <Users className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5 text-amber-500" />}
                             {visibility === "followers" ? "Followers" : "Classroom"}
                           </Button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent align="start" className="w-48 bg-white dark:bg-[#1A1A1E] border-zinc-200 dark:border-white/10 rounded-xl">
                           <DropdownMenuItem onClick={() => setVisibility("followers")} className="cursor-pointer font-medium py-2">
                             <Users className="w-4 h-4 mr-2 text-zinc-500" /> Followers Only
                           </DropdownMenuItem>
                           {myClassrooms.length > 0 && (
                             <DropdownMenuItem onClick={() => setVisibility("classroom")} className="cursor-pointer font-medium py-2">
                               <Shield className="w-4 h-4 mr-2 text-amber-500" /> Classroom Group
                             </DropdownMenuItem>
                           )}
                         </DropdownMenuContent>
                       </DropdownMenu>

                       {visibility === "classroom" && myClassrooms.length > 0 && (
                         <div className="relative">
                           <select 
                             value={classroomId}
                             onChange={(e) => setClassroomId(e.target.value)}
                             className="appearance-none bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-full pl-3 pr-8 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer truncate max-w-[140px]"
                           >
                             {myClassrooms.map(c => <option key={c.$id} value={c.$id}>{c.name}</option>)}
                           </select>
                           <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-amber-700 dark:text-amber-400">
                             <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
                           </div>
                         </div>
                       )}
                    </div>
                    
                    <Button 
                       onClick={handlePostSubmit}
                       disabled={isPosting || !composeText.trim()}
                       className="rounded-full font-bold px-6 bg-[#C8A856] text-black hover:bg-[#d4b566] disabled:opacity-50 transition-colors"
                    >
                        {isPosting ? t("posting") : t("post")}
                    </Button>
                 </div>
              </div>
           </div>
        </div>

        {/* Feed Stream */}
        <div className="flex flex-col pb-32">
           {loading ? (
             <div className="py-20 flex justify-center">
                <div className="w-8 h-8 border-2 border-zinc-800 border-t-[#C8A856] rounded-full animate-spin"></div>
             </div>
           ) : posts.length === 0 ? (
             <div className="py-24 text-center">
                <Music4 className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
                 <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{t("emptyTitle")}</h3>
                 <p className="text-zinc-500 max-w-sm mx-auto">
                   {t("emptySubtitle")}
                 </p>
             </div>
           ) : (
             posts.map((post, index) => (
                <article key={post.$id} className="p-4 sm:p-6 border-b border-zinc-200 dark:border-white/5 bg-white dark:bg-[#151518] hover:bg-zinc-50 dark:hover:bg-[#1a1c23] transition-colors">
                   <div className="flex gap-3 sm:gap-4">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold border border-indigo-200 dark:border-indigo-500/20 relative overflow-hidden">
                         {post.authorProfile?.prefs?.avatarUrl ? (
                            <img src={post.authorProfile.prefs.avatarUrl} className="w-full h-full object-cover" alt="avatar" />
                         ) : (
                            post.authorProfile?.name ? post.authorProfile.name.substring(0,2).toUpperCase() : post.authorId.substring(0,2).toUpperCase()
                         )}
                      </div>
                      
                      <div className="flex-1 flex flex-col min-w-0">
                         {/* Header */}
                         <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5 truncate">
                              <Link href={`/u/${post.authorId}`} className="font-bold text-zinc-900 dark:text-zinc-100 hover:underline hover:text-[#C8A856] truncate">
                                {post.authorProfile?.name || `User ${post.authorId.substring(0, 8)}`}
                              </Link>
                              
                              {post.visibility === "followers" && (
                                <span title="Followers Only"><Shield className="w-3.5 h-3.5 text-green-500 inline-block mx-1" /></span>
                              )}
                              {post.visibility === "classroom" && (
                                <span title="Classroom Only"><Users className="w-3.5 h-3.5 text-amber-500 inline-block mx-1" /></span>
                              )}

                              <span className="text-zinc-400 dark:text-zinc-600 text-sm shrink-0">·</span>
                              <span className="text-zinc-400 dark:text-zinc-500 text-sm hover:underline cursor-pointer shrink-0">
                                {formatTimeAgo(post.$createdAt)}
                              </span>
                            </div>
                            {user && user.$id === post.authorId && (
                               <DropdownMenu>
                                 <DropdownMenuTrigger asChild>
                                   <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ml-2 flex items-center justify-center">
                                     <MoreVertical className="w-4 h-4" />
                                   </button>
                                 </DropdownMenuTrigger>
                                 <DropdownMenuContent align="end" className="w-40 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-xl">
                                   <DropdownMenuItem 
                                     onClick={async () => {
                                        if (await confirm({ title: "Delete Post", description: "Are you sure you want to delete this timeline post?", confirmText: "Delete", cancelText: "Cancel" })) {
                                           try {
                                              await deletePost(post.$id);
                                              setPosts(prev => prev.filter(p => p.$id !== post.$id));
                                              toast.success("Post deleted successfully.");
                                           } catch {
                                              toast.error("Failed to delete post.");
                                           }
                                        }
                                     }}
                                     className="text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer font-medium"
                                   >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      {t("deletePost")}
                                   </DropdownMenuItem>
                                 </DropdownMenuContent>
                               </DropdownMenu>
                            )}
                         </div>
                         
                         {/* Body */}
                         {post.content && (
                           <p className="text-zinc-800 dark:text-zinc-300 text-[15px] leading-relaxed mb-3 whitespace-pre-wrap word-break">
                             {post.content}
                           </p>
                         )}

                         {/* Rich Attachment Card */}
                         {post.attachmentType === "project" && post.project && (
                           <div onClick={() => router.push(`/play/${post.project?.$id}`)} className="cursor-pointer border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden mb-3 hover:border-zinc-300 dark:hover:border-white/20 transition-all flex flex-col sm:flex-row bg-zinc-50 dark:bg-zinc-900">
                              <div className="sm:w-32 sm:h-32 h-40 bg-zinc-200 dark:bg-black/50 overflow-hidden relative border-b sm:border-b-0 sm:border-r border-zinc-200 dark:border-white/10 shrink-0 flex items-center justify-center group overflow-hidden">
                                 {post.project.coverUrl ? (
                                    <img src={post.project.coverUrl} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="cover" />
                                 ) : (
                                    <Music4 className="w-8 h-8 text-zinc-400 transition-transform duration-500 group-hover:scale-110" />
                                 )}
                              </div>
                              <div className="p-3 sm:p-4 flex flex-col justify-center flex-1 min-w-0">
                                  <div className="text-[10px] font-bold text-[#C8A856] uppercase tracking-wider mb-1">{t("sheetMusic")}</div>
                                 <dt className="font-bold text-base text-zinc-900 dark:text-white truncate mb-1">{post.project.name}</dt>
                                  <dd className="text-xs text-zinc-500 line-clamp-2">
                                     {post.project.description || t("defaultProjectDesc")}
                                  </dd>
                              </div>
                           </div>
                         )}

                         {post.attachmentType === "playlist" && post.playlist && (
                           <div onClick={() => router.push(`/collection/${post.playlist?.$id}`)} className="cursor-pointer border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden mb-3 hover:border-zinc-300 dark:hover:border-white/20 transition-all flex flex-col sm:flex-row bg-zinc-50 dark:bg-zinc-900">
                              <div className="sm:w-32 sm:h-32 h-40 bg-zinc-200 dark:bg-black/50 overflow-hidden relative border-b sm:border-b-0 sm:border-r border-zinc-200 dark:border-white/10 shrink-0 flex items-center justify-center group overflow-hidden">
                                 {post.playlist.coverImageId ? (
                                    <img src={getFileViewUrl(post.playlist.coverImageId).toString()} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="cover" />
                                 ) : (
                                    <ListMusic className="w-8 h-8 text-zinc-400 transition-transform duration-500 group-hover:scale-110" />
                                 )}
                              </div>
                              <div className="p-3 sm:p-4 flex flex-col justify-center flex-1 min-w-0">
                                  <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">{t("collection")}</div>
                                 <dt className="font-bold text-base text-zinc-900 dark:text-white truncate mb-1">{post.playlist.name}</dt>
                                  <dd className="text-xs text-zinc-500 font-medium">
                                     {post.playlist.projectIds?.length || 0} {t("tracksIncluded")}
                                  </dd>
                              </div>
                           </div>
                         )}

                         {post.attachmentType !== "none" && !post.project && !post.playlist && (
                           <div className="border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 rounded-xl p-4 flex items-center justify-center text-sm text-red-500 font-medium mb-3">
                              <OctagonX className="w-5 h-5 mr-2" />
                               {t("unavailableContent")}
                           </div>
                         )}

                         {/* Action Footer */}
                         <div className="flex items-center gap-6 mt-1 text-zinc-400">
                             <ReactionButton
                                isReacted={post.isLiked || false}
                                reactionType={post.reactionType || null}
                                reactionLike={post.reactionLike || 0}
                                reactionLove={post.reactionLove || 0}
                                reactionHaha={post.reactionHaha || 0}
                                reactionWow={post.reactionWow || 0}
                                reactionTotal={post.reactionTotal || 0}
                                onReact={(type) => handleReaction(index, post.$id, type)}
                                langLike={t("like") || "Like"}
                                langLove="Love"
                                langHaha="Haha"
                                langWow="Wow"
                             />

                             <button 
                               onClick={() => handleToggleComments(index, post.$id)}
                              className={`flex items-center gap-2 text-[13px] font-semibold transition-colors group ${activeCommentPostId === post.$id ? 'text-blue-500' : 'hover:text-blue-500'}`}
                            >
                               <div className={`p-1.5 rounded-full group-hover:bg-blue-500/10 transition-colors ${activeCommentPostId === post.$id ? 'bg-blue-500/10' : ''}`}>
                                  <MessageSquare className="w-4 h-4" />
                               </div>
                               <span className={(post.commentsCount || post.comments?.length || 0) > 0 ? '' : 'opacity-0'}>
                                 {post.comments ? post.comments.length : (post.commentsCount || 0)}
                               </span>
                            </button>

                             <button 
                               onClick={async () => {
                                 if (!user) {
                                   toast.error("Please login to share posts.");
                                   return;
                                 }
                                 if (post.attachmentType === "none" || (!post.project && !post.playlist)) {
                                   toast.error("This post cannot be shared.");
                                   return; 
                                 }
                                 const caption = await prompt({ title: "Share to Feed", description: `Add a caption for this ${post.attachmentType}:`, confirmText: "Share", cancelText: "Cancel" });
                                 if (caption !== null) {
                                   try {
                                     const newPost = await createPost({
                                       content: caption.trim() || `Check out this ${post.attachmentType}!`,
                                       attachmentType: post.attachmentType,
                                       attachmentId: post.attachmentId
                                     });
                                     setPosts(prev => [{ ...newPost, project: post.project, playlist: post.playlist, authorProfile: { name: user.name, prefs: user.prefs }, isLiked: false, likesCount: 0 }, ...prev]);
                                     toast.success("Successfully shared to your Activity Feed!");
                                   } catch {
                                     toast.error("Failed to share to feed.");
                                   }
                                 }
                               }} 
                               className="flex items-center gap-2 text-[13px] font-semibold transition-colors hover:text-green-500 group ml-auto"
                             >
                                <div className="p-1.5 rounded-full group-hover:bg-green-500/10 transition-colors">
                                   <Share2 className="w-4 h-4" />
                                </div>
                             </button>
                         </div>
                         
                         {/* Threading UI */}
                         {activeCommentPostId === post.$id && (
                           <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-white/5 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                              {post.loadingComments ? (
                                <div className="py-4 flex justify-center">
                                  <div className="w-4 h-4 border-2 border-zinc-800 border-t-blue-500 rounded-full animate-spin"></div>
                                </div>
                              ) : post.comments && post.comments.length > 0 ? (
                                <div className="flex flex-col gap-3">
                                  {post.comments.map(c => (
                                     <div key={c.$id} className="flex gap-2">
                                        <div className="mt-2.5 w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-[10px] font-bold overflow-hidden relative">
                                           {c.authorProfile?.prefs?.avatarUrl ? (
                                              <img src={c.authorProfile.prefs.avatarUrl} className="w-full h-full object-cover" alt="avatar" />
                                           ) : (
                                              c.authorProfile?.name ? c.authorProfile.name.substring(0,2).toUpperCase() : c.authorId.substring(0,2).toUpperCase()
                                           )}
                                        </div>
                                        <div className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl rounded-tl-sm p-3 text-sm">
                                           <div className="font-bold text-zinc-900 dark:text-zinc-300 mb-0.5 text-xs">
                                              {c.authorProfile?.name || `User ${c.authorId.substring(0,6)}`} <span className="font-normal text-zinc-400 ml-1">{formatTimeAgo(c.$createdAt)}</span>
                                           </div>
                                           <div className="text-zinc-700 dark:text-zinc-400 whitespace-pre-wrap">{c.content}</div>
                                        </div>
                                     </div>
                                  ))}
                                </div>
                              ) : null}
                              
                              {/* Composer */}
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0 text-[10px] text-indigo-700 dark:text-indigo-400 font-bold overflow-hidden relative">
                                  {(user?.prefs as any)?.avatarUrl ? (
                                    <img src={(user.prefs as any).avatarUrl} className="w-full h-full object-cover" alt="Avatar" />
                                  ) : (
                                    user.name ? user.name.substring(0,2).toUpperCase() : user.email?.substring(0,2).toUpperCase() || "ME"
                                  )}
                                </div>
                                <Input 
                                  value={commentText}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCommentText(e.target.value)}
                                   placeholder={t("commentPlaceholder")}
                                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                     if(e.key === 'Enter' && !e.shiftKey) {
                                       e.preventDefault();
                                       handleCreateComment(index, post.$id);
                                     }
                                  }}
                                  className="flex-1 h-9 bg-zinc-100 dark:bg-zinc-900/80 border-transparent focus-visible:ring-blue-500/50 rounded-full text-sm px-4"
                                />
                                <Button 
                                  disabled={!commentText.trim() || isSubmittingComment}
                                  onClick={() => handleCreateComment(index, post.$id)}
                                  size="icon" 
                                  className="w-9 h-9 shrink-0 rounded-full bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                  {isSubmittingComment ? (
                                    <div className="w-4 h-4 border-2 border-blue-200 border-t-white rounded-full animate-spin"></div>
                                  ) : (
                                    <Send className="w-3.5 h-3.5 ml-0.5" />
                                  )}
                                </Button>
                              </div>
                           </div>
                         )}

                      </div>
                   </div>
                </article>
             ))
           )}
        </div>

      </main>

      {/* Attachment Modal */}
      {showAttachModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
           <div className="bg-white dark:bg-[#151518] border border-zinc-200 dark:border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="p-4 border-b border-zinc-200 dark:border-white/5 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
                     <h3 className="font-bold text-lg flex items-center gap-2 text-zinc-900 dark:text-white">
                     <Music className="w-4 h-4 text-blue-500" />
                     {t("attachScore")}
                  </h3>
                 <Button variant="ghost" size="icon" onClick={() => setShowAttachModal(false)} className="w-8 h-8 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                    <X className="w-4 h-4" />
                 </Button>
              </div>
              
              <div className="p-4 overflow-y-auto flex-1">
                 {loadingAttach ? (
                    <div className="py-12 flex justify-center">
                       <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                    </div>
                 ) : myProjects.length === 0 ? (
                    <div className="py-12 flex flex-col items-center text-center">
                       <Music4 className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
                        <p className="text-zinc-500 font-medium">{t("noScoresYet")}</p>
                        <Button variant="link" onClick={() => router.push("/dashboard")} className="text-blue-500">{t("goToDashboard")}</Button>
                    </div>
                 ) : (
                    <div className="flex flex-col gap-2">
                       {myProjects.map(p => (
                          <div 
                             key={p.$id} 
                             onClick={() => {
                                setSelectedAttachment({ type: "project", id: p.$id, name: p.name });
                                setShowAttachModal(false);
                             }}
                             className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-white/10 group"
                          >
                             <div className="w-12 h-12 bg-zinc-200 dark:bg-black/50 rounded flex items-center justify-center shrink-0 overflow-hidden">
                                {p.coverUrl ? (
                                  <img src={p.coverUrl} className="w-full h-full object-cover" alt="cover" />
                                ) : (
                                  <Music4 className="w-6 h-6 text-zinc-400" />
                                )}
                             </div>
                             <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm text-zinc-900 dark:text-white truncate group-hover:text-blue-500 transition-colors">{p.name}</div>
                                <div className="text-xs text-zinc-500 truncate mt-0.5">{p.instruments?.[0] || 'Piano'} • {p.mode}</div>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

    </div>
  );
}
