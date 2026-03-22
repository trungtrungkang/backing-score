"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import { ShieldAlert, Plus, Trash2, LayoutDashboard, Clock, Globe, PlaySquare, CloudUpload, Heart, ListMusic, Music4, FolderOpen, GraduationCap, MoreVertical } from "lucide-react";
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
  ProjectDocument,
  ProjectPayload
} from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/components/ui/dialog-provider";
import { toast } from "sonner";

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
  const { user, loading: authLoading, sendVerification } = useAuth();
  const [projects, setProjects] = useState<ProjectDocument[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
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
      <aside className="w-64 border-r border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-6 hidden md:flex flex-col gap-8 sticky top-16 h-[calc(100vh-4rem)]">
        <div>
          <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-4">{t("yourLibrary")}</h2>
          <nav className="flex flex-col gap-1">
            <button className="flex items-center gap-3 px-3 py-2 rounded-md bg-zinc-800/80 text-white font-medium transition-colors">
              <CloudUpload className="w-4 h-4 text-blue-400" />
              {t("myUploadsNav")}
            </button>
            <Link href="/dashboard/collections" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors">
              <FolderOpen className="w-4 h-4" />
              {t("collections")}
            </Link>
            <Link href="/dashboard/favorites" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors">
              <Heart className="w-4 h-4" />
              {t("favorites")}
            </Link>
            
            <Link href="/dashboard/courses" className="flex items-center gap-3 px-3 py-2 mt-4 rounded-md hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors border-t border-zinc-800/50 pt-3">
              <GraduationCap className="w-4 h-4 text-[#C8A856]" />
              {t("creatorCourses")}
            </Link>
            
            <Link href="/guide" className="flex items-center gap-3 px-3 py-2 mt-4 rounded-md hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors">
              <Globe className="w-4 h-4" />
              {t("userGuide")}
            </Link>
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 overflow-y-auto py-12 px-6 lg:px-12 relative bg-white dark:bg-zinc-950/30">
        <div className="max-w-6xl mx-auto">
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

          {/* Header Row */}
          <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">{t("myUploads")}</h1>
              <p className="text-zinc-400">{t("manageProjects")}</p>
            </div>
            
            <div className="flex items-center gap-4">
              {(user.labels?.includes("admin") || user.labels?.includes("creator")) && (
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
                 {user.labels?.includes("admin") || user.labels?.includes("creator") 
                   ? t("noProjectsCreator")
                   : t("noProjectsUser")}
               </p>
               {(user.labels?.includes("admin") || user.labels?.includes("creator")) && (
                 <Button onClick={handleNewProject} disabled={creating} className="bg-white dark:bg-zinc-800 text-black dark:text-white hover:bg-zinc-200">
                   <Plus className="w-4 h-4 mr-2" /> {t("createFirstProject")}
                 </Button>
               )}
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
                {projects.map((p, idx) => (
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
                        </div>
                      </div>
                    </div>



                    {/* 3. Date (lg+) */}
                    <div className="hidden lg:block text-left text-xs text-zinc-500 font-mono pl-2">
                      {new Date(p.$updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>

                    {/* 5. Actions */}
                    <div className="flex items-center justify-end shrink-0">
                      {/* Mobile/tablet: single dropdown */}
                      <div className="flex lg:hidden">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-8 w-8 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem asChild>
                              <Link href={`/play/${p.$id}`} className="flex items-center gap-2 cursor-pointer">
                                <PlaySquare className="w-4 h-4" />
                                {t("play")}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/p/${p.$id}`} className="flex items-center gap-2 cursor-pointer">
                                <Music4 className="w-4 h-4" />
                                {t("edit")}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => handleDelete(e as any, p.$id)}
                              disabled={deletingId === p.$id}
                              className="flex items-center gap-2 cursor-pointer text-red-500 focus:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                              {deletingId === p.$id ? "..." : t("deleteCancel").includes("Cancel") ? "Delete" : t("deleteConfirm")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* 4. Actions */}
                      <div className="hidden lg:flex items-center justify-end gap-1.5">
                        <Link
                          href={`/play/${p.$id}`}
                          className="h-8 px-3 rounded text-xs font-bold flex items-center justify-center bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-blue-600 dark:hover:bg-blue-500 transition-colors shadow-sm"
                        >
                          {t("play")}
                        </Link>
                        <Link
                          href={`/p/${p.$id}`}
                          className="h-8 px-3 rounded text-xs font-bold flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-300 transition-colors"
                        >
                          {t("edit")}
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, p.$id)}
                          disabled={deletingId === p.$id}
                          title="Delete"
                          className="h-8 w-8 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0 ml-1"
                        >
                          {deletingId === p.$id ? (
                            <div className="w-3 h-3 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
