"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import { ShieldAlert, Plus, Trash2, LayoutDashboard, Clock, Globe, PlaySquare, CloudUpload, ListMusic, Music4, FolderOpen, GraduationCap, MoreVertical, Settings2, Crown, Eye, EyeOff, Play, Pencil, Search, Menu, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  listMyProjects,
  createProject,
  deleteProject,
  publishMyProject,
  listMyPlaylists,
  addProjectToPlaylist,
  ProjectDocument,
  ProjectPayload,
  PlaylistDocument
} from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/components/ui/dialog-provider";
import { toast } from "sonner";
import SubscriptionCard from "@/components/SubscriptionCard";
import { useSearchParams } from "next/navigation";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { canCreate } from "@/lib/auth/roles";
import { QuickEditModal } from "@/components/QuickEditModal";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      dateStyle: "medium",
    });
  } catch {
    return iso;
  }
}

const TAG_GROUPS = {
  Instruments: ["Piano", "Acoustic Guitar", "Electric Guitar", "Bass", "Violin", "Cello", "Trumpet", "Saxophone", "Drums", "Vocals", "Flute", "Clarinet"],
  Genres: ["Pop", "Rock", "Jazz", "Classical", "Blues", "R&B", "Country", "Folk", "Latin", "Electronic", "Hip Hop"],
  Difficulty: ["Beginner", "Intermediate", "Advanced"],
};

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations("Dashboard");
  const { user, loading: authLoading, sendVerification, getJWT, refreshSubscription } = useAuth();
  const [projects, setProjects] = useState<ProjectDocument[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistDocument[]>([]);
  const { confirm } = useDialogs();
  const searchParams = useSearchParams();

  // Load playlists once for add-to-collection feature
  useEffect(() => {
    if (user) listMyPlaylists().then(setPlaylists).catch(() => {});
  }, [user]);

  // After checkout success: sync subscription from LS and refresh premium status
  useEffect(() => {
    if (searchParams.get("checkout") === "success" && user) {
      toast.success("🎉 Welcome to Premium! Your subscription is now active.");
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);

      // Sync subscription from LemonSqueezy (in case webhook hasn't fired yet)
      (async () => {
        try {
          const jwt = await getJWT();
          await fetch("/api/subscription/sync", {
            method: "POST",
            headers: { Authorization: `Bearer ${jwt}` },
          });
          // Refresh premium status in AuthContext
          await refreshSubscription();
        } catch (err) {
          console.error("[Dashboard] Subscription sync failed:", err);
        }
      })();
    }
  }, [searchParams, user, getJWT, refreshSubscription]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!user) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    listMyProjects(activeTags)
      .then((list) => {
        if (!cancelled) setProjects(list);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e?.message ?? "Failed to load projects");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router, activeTags]);

  const handleNewProject = async () => {
    if (!user || creating) return;
    setCreating(true);
    setError(null);
    try {
      const payload: ProjectPayload = {
        version: 1,
        name: "Untitled",
        mode: "practice",
        tempo: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        tracks: [],
      };
      const doc = await createProject({
        name: "Untitled",
        mode: "practice",
        payload,
      });
      router.push(`/p/${doc.$id}`);
      router.refresh();
    } catch (e) {
      setError(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const handlePublishToggle = async (e: React.MouseEvent, project: ProjectDocument) => {
    e.preventDefault();
    e.stopPropagation();
    if (publishingId) return;
    const newState = !project.published;
    if (newState) {
      if (!(await confirm({ title: "Publish Project", description: `Publish "${project.name}" to Discover? Everyone will be able to see and play it.`, confirmText: "Publish", cancelText: "Cancel" }))) return;
    }
    setPublishingId(project.$id);
    try {
      await publishMyProject(project.$id, newState);
      setProjects((prev) => prev.map((p) => p.$id === project.$id ? { ...p, published: newState, publishedAt: newState ? new Date().toISOString() : p.publishedAt } : p));
      toast.success(newState ? "Published ✓" : "Unpublished");
    } catch (err: any) {
      toast.error("Failed: " + (err?.message || "Unknown error"));
    } finally {
      setPublishingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (deletingId) return;
    if (!(await confirm({ title: t("deleteConfirmTitle"), description: t("deleteConfirmDesc"), confirmText: t("deleteConfirm"), cancelText: t("deleteCancel") }))) return;
    setDeletingId(projectId);
    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.$id !== projectId));
    } catch {
      setError("Failed to delete project");
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-zinc-800 border-t-white rounded-full animate-spin"></div>
          <p className="text-zinc-500 tracking-widest uppercase font-medium">{t("verifyingAccess")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white flex">
      {/* Sidebar */}
      <DashboardSidebar />

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-900 shadow-2xl">
            <div className="p-4 flex justify-end">
              <button onClick={() => setMobileMenuOpen(false)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <DashboardSidebar />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 overflow-y-auto py-12 px-6 lg:px-12 relative bg-white dark:bg-zinc-950/30">
        <div className="max-w-6xl mx-auto">
          {/* Mobile sidebar toggle */}
          <button onClick={() => setMobileMenuOpen(true)} className="md:hidden mb-4 flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
            <Menu className="w-5 h-5" /> <span className="text-sm font-medium">{t("yourLibrary")}</span>
          </button>


          {!user.emailVerification && (
            <div className="mb-6 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  {t("verifyEmailPrompt").replace("{email}", user.email)}
                </p>
              </div>
              <Button 
                onClick={() => sendVerification().then(() => toast.success("Verification email sent!"))} 
                variant="outline" 
                size="sm" 
                className="shrink-0 bg-white dark:bg-zinc-900"
              >
                {t("resendEmail")}
              </Button>
            </div>
          )}

          {/* Subscription Status */}
          <SubscriptionCard />

          {/* Header Row */}
          <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
            <div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">{t("myUploads")}</h1>
              <p className="text-zinc-400">{t("manageProjects")}</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 shrink-0">
              <Link href={`/u/${user.$id}`}>
                <Button
                  variant="outline"
                  className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 shadow-sm"
                >
                  <Settings2 className="w-4 h-4 mr-2" />
                  {t("editProfile") || "Edit Profile"}
                </Button>
              </Link>
              
              {canCreate(user.labels) && (
                <Button
                  onClick={handleNewProject}
                  disabled={creating}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-blue-600 dark:hover:bg-blue-500 dark:text-white font-bold px-6 h-11 shadow-lg shadow-black/10 dark:shadow-blue-500/20"
                >
                  {creating ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5 mr-2" />
                      {t("createProject")}
                    </>
                  )}
                </Button>
              )}
            </div>
          </header>

          {/* Stats Summary */}
          {!loading && projects.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                  <Music4 className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <div className="text-xl font-black text-zinc-900 dark:text-white">{projects.length}</div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{t("totalProjects")}</div>
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <div className="text-xl font-black text-zinc-900 dark:text-white">{projects.filter(p => p.published).length}</div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{t("publishedCount")}</div>
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                  <Play className="w-4 h-4 text-purple-500" />
                </div>
                <div>
                  <div className="text-xl font-black text-zinc-900 dark:text-white">{projects.reduce((sum, p) => sum + ((p as any).playCount || 0), 0)}</div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{t("totalPlays")}</div>
                </div>
              </div>
            </div>
          )}

          {/* Search + Filter Bar */}
          {!loading && projects.length > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="w-full h-10 pl-10 pr-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden shrink-0">
                {(["all", "published", "draft"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                      statusFilter === f
                        ? "bg-zinc-900 dark:bg-white text-white dark:text-black"
                        : "bg-white dark:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                  >
                    {t(f === "all" ? "filterAll" : f === "published" ? "filterPublished" : "filterDraft")}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-8 p-4 bg-red-950/50 border border-red-900 rounded-xl text-red-400 text-center backdrop-blur-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
               <div className="w-10 h-10 border-4 border-zinc-200 dark:border-zinc-800 border-t-blue-500 rounded-full animate-spin mb-4"></div>
               <p className="text-zinc-500 font-medium">{t("loadingLibrary")}</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950/50 text-center px-4">
               <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
                 <CloudUpload className="w-8 h-8 text-zinc-600" />
               </div>
               <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">{t("noProjectsTitle")}</h3>
               <p className="text-zinc-400 max-w-sm mb-6">
                 {canCreate(user.labels)
                   ? t("noProjectsCreator")
                   : t("noProjectsUser")}
               </p>
               {canCreate(user.labels) && (
                 <Button onClick={handleNewProject} disabled={creating} className="bg-white dark:bg-zinc-800 text-black dark:text-white hover:bg-zinc-200">
                   <Plus className="w-4 h-4 mr-2" /> {t("createFirstProject")}
                 </Button>
               )}
            </div>
          ) : (() => {
            const filtered = projects.filter(p => {
              const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
              const matchesStatus = statusFilter === "all" || (statusFilter === "published" ? p.published : !p.published);
              return matchesSearch && matchesStatus;
            });
            return filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mb-4" />
                <p className="text-zinc-500 font-medium">{t("noMatchingProjects")}</p>
              </div>
            ) : (
            <div className="w-full text-left">
              {/* Table Header */}
              <div className="grid grid-cols-[auto_1fr_auto] lg:grid-cols-[48px_2fr_100px_140px] items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <div className="text-center">#</div>
                <div>{t("titleArtist")}</div>
                <div className="hidden lg:block text-left pl-2">{t("date")}</div>
                <div className="hidden lg:block text-right">{t("actions")}</div>
              </div>

              {/* Table Body (List) */}
              <div className="flex flex-col">
                {filtered.map((p, idx) => (
                  <div key={p.$id} className="group grid grid-cols-[auto_1fr_auto] lg:grid-cols-[48px_2fr_100px_140px] items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 transition-colors">
                    
                    {/* 1. Index */}
                    <div className="w-10 lg:w-12 flex justify-center relative">
                      <span className="text-zinc-500 font-mono text-xs group-hover:opacity-0 transition-opacity">{idx + 1}</span>
                      <button className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-zinc-900 dark:text-white">
                        <PlaySquare className="w-5 h-5" />
                      </button>
                    </div>

                    {/* 2. Title & Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 lg:w-10 lg:h-10 shrink-0 bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden flex items-center justify-center border border-zinc-200 dark:border-zinc-700/50 shadow-sm">
                        {p.coverUrl ? (
                          <img src={p.coverUrl} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <Music4 className="w-4 h-4 lg:w-5 lg:h-5 text-zinc-400 dark:text-zinc-600" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <Link href={`/play/${p.$id}`} className="text-sm lg:text-base font-bold text-zinc-900 dark:text-white hover:underline truncate">
                          {p.name}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-zinc-500 truncate">
                            {p.tags?.length ? p.tags.slice(0, 2).join(", ") : t("untagged")}
                          </span>
                          <span className="text-zinc-300 dark:text-zinc-700 text-xs">•</span>
                          {p.published ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-green-500 dark:text-green-400">
                              Published
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                              Draft
                            </span>
                          )}
                          {(p as any).playCount > 0 && (
                            <>
                              <span className="text-zinc-300 dark:text-zinc-700 text-xs">•</span>
                              <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                                <Play className="w-2.5 h-2.5" />
                                {(p as any).playCount}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>



                    {/* 3. Date (lg+) */}
                    <div className="hidden lg:block text-left text-xs text-zinc-500 font-mono pl-2">
                      {new Date(p.$updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>

                    {/* 5. Actions */}
                    <div className="flex items-center justify-end shrink-0 gap-1.5">
                      <Link
                        href={`/play/${p.$id}`}
                        className="h-8 px-3 rounded text-xs font-bold flex items-center justify-center bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-blue-600 dark:hover:bg-blue-500 transition-colors shadow-sm"
                      >
                        {t("play")}
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-8 w-8 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem asChild>
                            <Link href={`/p/${p.$id}`} className="flex items-center gap-2 cursor-pointer">
                              <Music4 className="w-4 h-4" />
                              {t("edit")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); setEditingProject(p); }}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                            Quick Edit
                          </DropdownMenuItem>
                          {canCreate(user.labels) && (
                            <DropdownMenuItem
                              onClick={(e) => handlePublishToggle(e as any, p)}
                              disabled={publishingId === p.$id}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              {p.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              {publishingId === p.$id ? "..." : p.published ? "Unpublish" : "Publish"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {/* Add to Collection sub-menu */}
                          {playlists.length > 0 && (
                            <>
                              {playlists.map(pl => (
                                <DropdownMenuItem
                                  key={pl.$id}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await addProjectToPlaylist(pl.$id, p.$id);
                                      toast.success(t("addedToCollection"));
                                    } catch { toast.error("Failed"); }
                                  }}
                                  className="flex items-center gap-2 cursor-pointer text-xs"
                                >
                                  <FolderOpen className="w-3 h-3" /> {pl.name}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem
                            onClick={(e) => handleDelete(e as any, p.$id)}
                            disabled={deletingId === p.$id}
                            className="flex items-center gap-2 cursor-pointer text-red-500 focus:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                            {deletingId === p.$id ? "..." : "Delete"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            );
          })()}
        </div>

        {/* Quick Edit Modal */}
        {editingProject && (
          <QuickEditModal
            project={editingProject}
            onClose={() => setEditingProject(null)}
            onSaved={(updated) => {
              setProjects(prev => prev.map(p => p.$id === updated.$id ? { ...p, ...updated } : p));
            }}
          />
        )}
      </main>
    </div>
  );
}
