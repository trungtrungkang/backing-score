"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { 
  CloudUpload, Heart, Globe, ListMusic, Plus,
  FolderOpen, Settings, Eye, EyeOff, Music4, Trash2, GraduationCap
} from "lucide-react";
import {
  listMyPlaylists,
  createPlaylist,
  deletePlaylist,
  getFileViewUrl,
  PlaylistDocument
} from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/components/ui/dialog-provider";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      dateStyle: "medium",
    });
  } catch {
    return iso;
  }
}

export default function CollectionsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [playlists, setPlaylists] = useState<PlaylistDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { confirm } = useDialogs();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!user) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    listMyPlaylists()
      .then((list) => {
        if (!cancelled) setPlaylists(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? "Failed to load playlists");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
      
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router]);

  const handleNewPlaylist = async () => {
    if (!user || creating) return;
    setCreating(true);
    setError(null);
    try {
      const doc = await createPlaylist({
        name: "New Collection",
        description: "My custom playlist.",
      });
      // Redirect to the playlist detail page once it's built
      router.push(`/collection/${doc.$id}`);
    } catch (e) {
      setError(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to create playlist");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, playlistId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (deletingId) return;
    if (!(await confirm({ title: "Delete Collection", description: "Delete this collection? This cannot be undone.", confirmText: "Delete", cancelText: "Cancel" }))) return;
    setDeletingId(playlistId);
    try {
      await deletePlaylist(playlistId);
      setPlaylists((prev) => prev.filter((p) => p.$id !== playlistId));
    } catch {
      setError("Failed to delete collection");
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-zinc-800 border-t-white rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white flex border-t border-zinc-200 dark:border-zinc-900">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-6 hidden md:flex flex-col gap-8 sticky top-16 h-[calc(100vh-4rem)]">
        <div>
          <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-4">Your Library</h2>
          <nav className="flex flex-col gap-1">
            <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors">
              <CloudUpload className="w-4 h-4" />
              My Uploads
            </Link>
            <button className="flex items-center gap-3 px-3 py-2 rounded-md bg-zinc-800/80 text-white font-medium transition-colors">
              <FolderOpen className="w-4 h-4 text-blue-400" />
              Collections
            </button>
            <Link href="/dashboard/favorites" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors">
              <Heart className="w-4 h-4" />
              Favorites
            </Link>
            
            <Link href="/dashboard/courses" className="flex items-center gap-3 px-3 py-2 mt-4 rounded-md hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors border-t border-zinc-800/50 pt-3">
              <GraduationCap className="w-4 h-4 text-[#C8A856]" />
              Creator Courses
            </Link>
            
            <Link href="/discover" className="flex items-center gap-3 px-3 py-2 mt-4 rounded-md hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors">
              <Globe className="w-4 h-4" />
              Global Discover
            </Link>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-y-auto py-12 px-6 lg:px-12 relative bg-white dark:bg-zinc-950/30">
        <div className="max-w-5xl mx-auto">
          {/* Header Row */}
          <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">My Collections</h1>
              <p className="text-zinc-500">Organize and publish playlists for the community.</p>
            </div>
            
            <div className="flex items-center gap-4">
              <Button
                onClick={handleNewPlaylist}
                disabled={creating}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 h-11 shadow-lg shadow-blue-500/20"
              >
                {creating ? "Creating..." : (
                  <>
                    <Plus className="w-5 h-5 mr-2" />
                    New Collection
                  </>
                )}
              </Button>
            </div>
          </header>

          {error && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {/* Table View */}
          <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800/50 overflow-hidden shadow-sm">
            <div className="overflow-x-auto min-h-[60vh]">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-zinc-50 dark:bg-zinc-900/80 text-zinc-500 text-xs uppercase tracking-wider font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-4">Collection Title</th>
                    <th className="px-6 py-4">Items</th>
                    <th className="px-6 py-4">Visibility</th>
                    <th className="px-6 py-4">Created Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/50">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-zinc-500 font-medium">
                        Loading collections...
                      </td>
                    </tr>
                  ) : playlists.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center">
                        <FolderOpen className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">No Collections Yet</h3>
                        <p className="text-zinc-500 max-w-sm mx-auto mb-6 whitespace-normal">
                          Create a collection to bundle multiple backing tracks and scores.
                        </p>
                        <Button
                          onClick={handleNewPlaylist}
                          disabled={creating}
                          variant="outline"
                          className="font-semibold text-zinc-900 dark:text-white rounded-full bg-white dark:bg-zinc-900"
                        >
                          <Plus className="w-4 h-4 mr-2" /> 
                          Create First Collection
                        </Button>
                      </td>
                    </tr>
                  ) : (
                    playlists.map((pl) => (
                      <tr 
                        key={pl.$id} 
                        className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/collection/${pl.$id}`)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700 relative">
                              {pl.coverImageId ? (
                                <img src={getFileViewUrl(pl.coverImageId).toString()} alt="cover" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                              ) : (
                                <ListMusic className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform duration-500" />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-base text-zinc-900 dark:text-white mb-1">
                                {pl.name}
                              </div>
                              <div className="text-xs text-zinc-500 w-48 truncate">
                                {pl.description || "No description provided."}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md text-xs">
                            {pl.projectIds?.length || 0} Tracks
                          </span>
                        </td>
                        <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                              pl.isPublished 
                              ? "bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20" 
                              : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 border-zinc-200 dark:border-zinc-700"}`}
                            >
                                {pl.isPublished ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                {pl.isPublished ? "Public" : "Private"}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-500 font-medium">
                          {formatDate(pl.$createdAt)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/collection/${pl.$id}/settings`);
                              }}
                              variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-white hover:bg-zinc-800"
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={(e) => handleDelete(e, pl.$id)}
                              disabled={deletingId === pl.$id}
                              variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-red-400 hover:bg-red-400/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
