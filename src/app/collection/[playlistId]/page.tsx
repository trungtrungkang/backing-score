"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { 
  getPlaylist, 
  getProject, 
  deletePlaylist,
  updatePlaylist,
  removeProjectFromPlaylist,
  toggleFavorite,
  toggleReaction,
  checkIsReacted,
  createPost,
  ProjectDocument,
  PlaylistDocument,
  uploadProjectFile,
  getFileViewUrl
} from "@/lib/appwrite";
import { getPublicProfile } from "@/app/actions/user";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/components/ui/dialog-provider";
import { toast } from "sonner";
import { Play, Share2, MoreVertical, Music4, ListMusic, Globe, Lock, Trash2, Edit2, X, Heart, Image as ImageIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

export default function CollectionPage() {
  const params = useParams();
  const playlistId = params.playlistId as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { confirm, prompt } = useDialogs();

  const [playlist, setPlaylist] = useState<PlaylistDocument | null>(null);
  const [projects, setProjects] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [authorProfile, setAuthorProfile] = useState<{name: string, prefs: any} | null>(null);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCollection() {
      setLoading(true);
      setError(null);
      try {
        const pl = await getPlaylist(playlistId);
        if (cancelled) return;
        setPlaylist(pl);

        if (pl.projectIds && pl.projectIds.length > 0) {
           const fetchedProjs = await Promise.all(
              pl.projectIds.map(id => getProject(id).catch(() => null))
           );
           if (!cancelled) {
              setProjects(fetchedProjs.filter((p): p is ProjectDocument => p !== null));
           }
        }
        
        try {
          const profile = await getPublicProfile(pl.ownerId);
          if (!cancelled) setAuthorProfile(profile as any);
        } catch {}

        if (user) {
          try {
            const liked = await checkIsReacted("playlist", playlistId);
            if (!cancelled) setIsLiked(liked);
          } catch {}
        }
      } catch (err: any) {
        if (!cancelled) setError("Collection not found or access denied.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (!authLoading) {
      loadCollection();
    }

    return () => { cancelled = true; };
  }, [playlistId, authLoading]);

  const handleDelete = async () => {
    if (!(await confirm({ title: "Delete Collection", description: "Are you sure you want to delete this collection?", confirmText: "Delete", cancelText: "Cancel" }))) return;
    setIsDeleting(true);
    try {
      await deletePlaylist(playlistId);
      router.push("/dashboard/collections");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete playlist.");
      setIsDeleting(false);
    }
  };

  const [uploadingCover, setUploadingCover] = useState(false);
  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !playlist || !isOwner || uploadingCover) return;
    e.target.value = "";
    setUploadingCover(true);
    try {
      const { fileId } = await uploadProjectFile(playlistId, file);
      const updated = await updatePlaylist(playlistId, { coverImageId: fileId });
      setPlaylist(updated);
      toast.success("Collection cover uploaded successfully.");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ? `Failed to upload: ${err.message}` : "Failed to upload cover.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!playlist) return;
    setIsPublishing(true);
    try {
      const updated = await updatePlaylist(playlistId, { isPublished: !playlist.isPublished });
      setPlaylist(updated);
    } catch (err) {
      console.error(err);
      toast.error("Failed to toggle publish status.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRemoveTrack = async (projectId: string) => {
    if (!user || user.$id !== playlist?.ownerId) return;
    if (!(await confirm({ title: "Remove Track", description: "Remove this track from the playlist?", confirmText: "Remove", cancelText: "Cancel" }))) return;
    try {
      const updated = await removeProjectFromPlaylist(playlistId, projectId);
      setPlaylist(updated);
      setProjects(prev => prev.filter(p => p.$id !== projectId));
    } catch {
      toast.error("Failed to remove track.");
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-zinc-800 border-t-[#C8A856] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] flex flex-col items-center justify-center text-zinc-500">
        <ListMusic className="w-16 h-16 text-zinc-300 dark:text-zinc-800 mb-4" />
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Collection Not Found</h1>
        <p className="mb-6">{error || "This link might be broken, or the collection is private."}</p>
        <Link href="/discover">
          <Button variant="outline" className="rounded-full">Return to Discovery</Button>
        </Link>
      </div>
    );
  }

  const isOwner = user ? user.$id === playlist.ownerId : false;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white flex flex-col md:flex-row">
      
      {/* Left Sidebar Details */}
      <aside className="w-full md:w-[400px] shrink-0 bg-zinc-50 dark:bg-zinc-900/30 border-r border-zinc-200 dark:border-white/5 p-6 sm:p-10 flex flex-col gap-8 min-h-[50vh] md:min-h-[calc(100vh-4rem)] md:sticky md:top-16 relative">
         {/* Background blur decorative element */}
         <div className="absolute top-0 left-0 w-full h-80 bg-gradient-to-br from-[#C8A856]/20 to-transparent blur-[100px] -z-10 pointer-events-none opacity-50"></div>

         <div className="w-full aspect-square bg-white dark:bg-black/50 border border-zinc-200 dark:border-white/10 rounded-2xl shadow-xl flex items-center justify-center overflow-hidden shrink-0 relative group">
            {playlist.coverImageId ? (
              <img src={getFileViewUrl(playlist.coverImageId)} alt="cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            ) : (
              <ListMusic className="w-24 h-24 text-zinc-300 dark:text-zinc-800" />
            )}

            {/* Prominent Overlay Cover Upload Button */}
            {isOwner && (
               <label 
                 onClick={(e) => e.stopPropagation()}
                 className="absolute top-4 right-4 z-[200] px-3 py-2 rounded-full bg-white/95 dark:bg-zinc-900/95 hover:bg-white dark:hover:bg-black backdrop-blur-md flex items-center justify-center gap-2 text-zinc-900 dark:text-white cursor-pointer shadow-2xl border border-zinc-200 dark:border-zinc-800 transition-all hover:scale-105 group/upload"
               >
                 <ImageIcon className={`w-4 h-4 ${uploadingCover ? 'animate-pulse' : 'text-[#C8A856]'}`} />
                 <span className="text-xs font-bold whitespace-nowrap overflow-hidden transition-all duration-300 max-w-[0px] group-hover/upload:max-w-[100px] opacity-0 group-hover/upload:opacity-100">
                    {uploadingCover ? "Uploading..." : "Change Cover"}
                 </span>
                 <input type="file" className="hidden" accept="image/*" onChange={(e) => { e.stopPropagation(); handleUploadCover(e); }} disabled={uploadingCover} />
               </label>
            )}
            
            {/* Play Overlay */}
            <div 
               className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm cursor-pointer z-10"
               onClick={(e) => {
                  e.stopPropagation();
                  if (projects.length > 0) {
                     router.push(`/play/${projects[0].$id}?list=${playlist.$id}`);
                  } else {
                     toast.info("No tracks in this collection to play.");
                  }
               }}
            >
               <button className="w-16 h-16 rounded-full bg-[#C8A856] text-black shadow-2xl flex items-center justify-center transform scale-90 group-hover:scale-100 transition-all hover:bg-white focus:outline-none">
                 <Play className="w-8 h-8 ml-1" />
               </button>
            </div>
         </div>

         <div className="flex flex-col gap-2 relative z-10">
            <div className="flex items-center gap-2 text-xs font-bold text-[#C8A856] uppercase tracking-widest">
               {playlist.isPublished ? (
                 <><Globe className="w-3.5 h-3.5" /> Public Collection</>
               ) : (
                 <><Lock className="w-3.5 h-3.5" /> Private Collection</>
               )}
            </div>
            <h1 className="text-3xl font-black tracking-tight leading-tight">{playlist.name}</h1>
            <p className="text-zinc-500 font-medium my-2 flex items-center gap-2">
               <span className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold overflow-hidden">
                 {authorProfile?.prefs?.avatarUrl ? (
                   <img src={authorProfile.prefs.avatarUrl} className="w-full h-full object-cover" alt="avatar" />
                 ) : (
                   authorProfile?.name ? authorProfile.name.substring(0,2).toUpperCase() : playlist.ownerId.substring(0,2).toUpperCase()
                 )}
               </span>
               Created by <Link href={`/u/${playlist.ownerId}`} className="text-zinc-900 dark:text-white hover:underline hover:text-[#C8A856] transition-colors">{authorProfile?.name || playlist.ownerId.substring(0,8)}</Link>
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed mb-4">
               {playlist.description || "No description provided."}
            </p>

            <div className="flex items-center gap-3 mt-4">
               <Button 
                  onClick={() => {
                     if (projects.length > 0) {
                        router.push(`/play/${projects[0].$id}?list=${playlist.$id}`);
                     }
                  }}
                  disabled={projects.length === 0}
                  className="flex-1 rounded-full font-bold h-12 bg-[#C8A856] text-black hover:bg-[#d4b566] text-base gap-2"
               >
                 <Play className="w-5 h-5 fill-current" /> Play All
               </Button>
               <Button 
                onClick={async () => {
                  if (!user) return toast.error("Please login to like collections.");
                  setIsLiked(!isLiked);
                  await toggleReaction("playlist", playlistId, "like").catch(() => setIsLiked(isLiked));
                }}
                variant="ghost" 
                size="icon" 
                className={`w-12 h-12 rounded-full border border-zinc-200 dark:border-zinc-800 hover:border-rose-500 transition-colors ${isLiked ? 'text-rose-500 border-rose-500 bg-rose-500/10' : 'hover:text-rose-500'}`}
               >
                 <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
               </Button>
               {/* Context Menu */}
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <Button variant="ghost" size="icon" className="w-12 h-12 rounded-full border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                       <MoreVertical className="w-5 h-5" />
                     </Button>
                  </DropdownMenuTrigger>
                   <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-xl">
                     <DropdownMenuItem onClick={async () => {
                        if (!user) {
                           toast.error("Please login to share to feed.");
                           return;
                        }
                        const caption = await prompt({ title: "Share Collection", description: "Say something about this collection:", defaultValue: `Check out this collection: ${playlist.name}`, confirmText: "Share", cancelText: "Cancel" });
                        if (caption !== null) {
                           try {
                              await createPost({
                                 content: caption.trim() || `Check out this collection: ${playlist.name}`,
                                 attachmentType: "playlist",
                                 attachmentId: playlist.$id
                              });
                              toast.success("Successfully shared to your Activity Feed!");
                           } catch {
                              toast.error("Failed to share collection. Please try again.");
                           }
                        }
                     }} className="py-2.5 font-medium cursor-pointer">
                        <Share2 className="w-4 h-4 mr-2" /> Share to Feed
                     </DropdownMenuItem>
                     
                     {isOwner && (
                       <>
                         <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
                         <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()} className="py-2.5 font-medium cursor-pointer">
                            <label className="flex w-full cursor-pointer items-center text-zinc-900 dark:text-zinc-100 m-0">
                               <ImageIcon className="w-4 h-4 mr-2" /> {uploadingCover ? "Uploading..." : "Upload Cover Art"}
                               <input type="file" className="hidden" accept="image/*" onChange={handleUploadCover} disabled={uploadingCover} />
                            </label>
                         </DropdownMenuItem>
                         <DropdownMenuItem onClick={handleTogglePublish} className="py-2.5 font-medium cursor-pointer">
                            {playlist.isPublished ? <Lock className="w-4 h-4 mr-2" /> : <Globe className="w-4 h-4 mr-2" />}
                            {playlist.isPublished ? "Make Private" : "Make Public"}
                         </DropdownMenuItem>
                         <DropdownMenuItem className="py-2.5 font-medium cursor-pointer text-zinc-500">
                            <Edit2 className="w-4 h-4 mr-2" /> Edit Details
                         </DropdownMenuItem>
                         <DropdownMenuItem onClick={handleDelete} className="py-2.5 font-medium cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50">
                            <Trash2 className="w-4 h-4 mr-2" /> Delete Collection
                         </DropdownMenuItem>
                       </>
                     )}
                  </DropdownMenuContent>
               </DropdownMenu>
            </div>
         </div>
         
         <div className="mt-auto pt-8 border-t border-zinc-200 dark:border-white/5 flex items-center gap-4 text-xs font-semibold text-zinc-500">
            <div>{projects.length} Tracks</div>
            <div className={`w-1.5 h-1.5 rounded-full ${playlist.isPublished ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <div>Updated {new Date(playlist.$updatedAt).toLocaleDateString()}</div>
         </div>
      </aside>

      {/* Main Content Area (Tracklist) */}
      <main className="flex-1 p-6 md:p-10 lg:p-14 min-w-0">
         <div className="w-full max-w-4xl mx-auto">
            <h2 className="text-xl font-bold mb-8 flex items-center gap-3 text-zinc-900 dark:text-white">
               Repertoire
            </h2>

            {projects.length === 0 ? (
               <div className="py-20 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center">
                  <Music4 className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Empty Collection</h3>
                  <p className="text-zinc-500 mb-6 max-w-sm">
                    No musical scores have been added to this collection yet.
                  </p>
                  {isOwner && (
                    <Link href="/dashboard">
                       <Button variant="outline" className="rounded-full">Browse Your Uploads</Button>
                    </Link>
                  )}
               </div>
            ) : (
               <div className="flex flex-col gap-3">
                  {/* Tracklist Header */}
                  <div className="flex items-center px-4 py-2 text-xs font-bold text-zinc-500 uppercase tracking-widest invisible sm:visible">
                     <div className="w-12 text-center">#</div>
                     <div className="flex-1 min-w-0 pl-4">Title</div>
                     <div className="w-48 xl:w-64 pl-4 hidden md:block">Composer</div>
                     <div className="w-24 text-right pr-12">Actions</div>
                  </div>

                  {projects.map((proj, index) => (
                    <div 
                      key={proj.$id} 
                      className="group flex flex-col sm:flex-row sm:items-center px-4 py-4 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-white/10"
                    >
                       <div className="hidden sm:flex w-12 items-center justify-center font-bold text-zinc-400 group-hover:hidden text-lg">
                         {index + 1}
                       </div>
                       <div className="hidden sm:flex w-12 items-center justify-center group-hover:flex">
                         <button onClick={() => router.push(`/play/${proj.$id}`)} className="text-zinc-900 dark:text-white hover:text-[#C8A856] dark:hover:text-[#C8A856] transition-colors">
                           <Play className="w-5 h-5 fill-current" />
                         </button>
                       </div>
                       
                       <div className="flex items-center gap-4 flex-1 min-w-0 pl-0 sm:pl-4 mb-3 sm:mb-0 cursor-pointer" onClick={() => router.push(`/play/${proj.$id}`)}>
                          <div className="w-12 h-12 bg-zinc-200 dark:bg-black/50 rounded flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                             {proj.coverUrl ? (
                               <img src={proj.coverUrl} className="w-full h-full object-cover" alt="cover" />
                             ) : (
                               <Music4 className="w-6 h-6 text-zinc-400" />
                             )}
                          </div>
                          <div className="flex flex-col min-w-0 pr-4">
                             <div className="font-bold text-zinc-900 dark:text-white truncate group-hover:text-[#C8A856] transition-colors text-base">
                               {proj.name}
                             </div>
                             <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mt-0.5">
                               {proj.mode}
                             </div>
                          </div>
                       </div>
                       
                       <div className="w-48 xl:w-64 pl-4 hidden md:flex items-center text-sm text-zinc-500 truncate cursor-pointer" onClick={() => router.push(`/u/${proj.userId}`)}>
                          {proj.creatorEmail ? proj.creatorEmail.split('@')[0] : 'Community User'}
                       </div>
                       
                       <div className="w-full sm:w-24 mt-2 sm:mt-0 flex items-center justify-end gap-2 text-zinc-400">
                          {isOwner && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-8 h-8 rounded-full sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-rose-500/10 hover:text-rose-500"
                              onClick={() => handleRemoveTrack(proj.$id)}
                              title="Remove from Playlist"
                            >
                               <X className="w-4 h-4" />
                            </Button>
                          )}
                       </div>
                    </div>
                  ))}
               </div>
            )}
         </div>
      </main>
    </div>
  );
}
