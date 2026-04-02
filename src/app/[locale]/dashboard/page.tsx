"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import { ShieldAlert, Plus, Trash2, LayoutDashboard, Clock, Globe, PlaySquare, CloudUpload, ListMusic, Music4, FolderOpen, GraduationCap, MoreVertical, Settings2, Crown, Eye, EyeOff, Play, Pencil, Search, Menu, X, FolderPlus, Folder, Loader2, ChevronRight, PanelLeftOpen } from "lucide-react";
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
  listProjectFolders,
  createProjectFolder,
  deleteProjectFolder,
  moveProjectToFolder,
  ProjectDocument,
  ProjectPayload,
  PlaylistDocument,
  ProjectFolderDocument,
} from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/components/ui/dialog-provider";
import { toast } from "sonner";
import SubscriptionCard from "@/components/SubscriptionCard";
import { useSearchParams } from "next/navigation";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { canCreate } from "@/lib/auth/roles";
import { QuickEditModal } from "@/components/QuickEditModal";
import { DriveManager } from "@/components/DriveManager";
import { DailyChallengeCard } from "@/components/gamification/DailyChallengeCard";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistDocument[]>([]);
  const { confirm } = useDialogs();

  // Folder state
  const searchParams = useSearchParams();
  const folderParam = searchParams.get("folder");
  const [folders, setFolders] = useState<ProjectFolderDocument[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(folderParam);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [moveModalProject, setMoveModalProject] = useState<string | null>(null);

  // Sync with URL ?folder param (e.g., from sidebar clicks)
  useEffect(() => {
    setCurrentFolderId(folderParam);
  }, [folderParam]);

  // Load playlists + folders once
  useEffect(() => {
    if (user) {
      listMyPlaylists().then(setPlaylists).catch(() => {});
      listProjectFolders().then(setFolders).catch(() => {});
    }
  }, [user]);

  // Folder helpers
  const getChildFolders = (parentId: string | null) =>
    folders.filter(f => (f.parentFolderId || null) === parentId);

  const getBreadcrumb = (folderId: string | null): ProjectFolderDocument[] => {
    const path: ProjectFolderDocument[] = [];
    let id = folderId;
    while (id) {
      const folder = folders.find(f => f.$id === id);
      if (!folder) break;
      path.unshift(folder);
      id = folder.parentFolderId || null;
    }
    return path;
  };

  // Collect all descendant folder IDs (for cascade local delete)
  const getDescendantIds = (folderId: string): string[] => {
    const children = folders.filter(f => f.parentFolderId === folderId);
    return children.reduce<string[]>(
      (acc, c) => [...acc, c.$id, ...getDescendantIds(c.$id)],
      []
    );
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || creatingFolder) return;
    setCreatingFolder(true);
    try {
      const folder = await createProjectFolder(newFolderName.trim(), currentFolderId);
      setFolders((prev) => [...prev, folder]);
      setNewFolderName("");
      setShowNewFolder(false);
      toast.success(t("folderCreated"));
    } catch {
      toast.error(t("failedCreateFolder"));
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!(await confirm({ title: t("deleteFolder"), description: t("deleteFolderDesc"), confirmText: t("deleteConfirm"), cancelText: t("deleteCancel") }))) return;
    try {
      await deleteProjectFolder(folderId);
      const allDeletedIds = [folderId, ...getDescendantIds(folderId)];
      setFolders((prev) => prev.filter((f) => !allDeletedIds.includes(f.$id)));
      setProjects((prev) => prev.map((p) => allDeletedIds.includes(p.folderId || "") ? { ...p, folderId: null } : p));
      if (allDeletedIds.includes(currentFolderId || "")) setCurrentFolderId(null);
      toast.success(t("folderDeleted"));
    } catch {
      toast.error(t("failedDeleteFolder"));
    }
  };

  const handleMoveToFolder = async (projectId: string, folderId: string | null) => {
    try {
      await moveProjectToFolder(projectId, folderId);
      setProjects((prev) => prev.map((p) => p.$id === projectId ? { ...p, folderId } : p));
      setMoveModalProject(null);
      toast.success(t("movedToFolder"));
    } catch {
      toast.error(t("failedMoveToFolder"));
    }
  };

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
      <DashboardSidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 overflow-y-auto py-12 px-6 lg:px-10 xl:px-12 relative bg-white dark:bg-zinc-950/30">
        <div className="max-w-[1400px] mx-auto">
          {/* Mobile sidebar toggle */}
          <button onClick={() => setMobileMenuOpen(true)} className="md:hidden mb-6 flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
            <PanelLeftOpen className="w-5 h-5" /> <span className="text-sm font-medium">{t("yourLibrary")}</span>
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] gap-8 xl:gap-12 items-start">
            {/* LEFT COLUMN: Main Workspace */}
            <div className="flex flex-col gap-8 min-w-0">
              <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">{t("myUploads")}</h1>
                  <p className="text-zinc-400">{t("manageProjects")}</p>
                </div>
              </header>

              {/* Stats Summary */}
              {!loading && projects.length > 0 && (
                <div className="grid grid-cols-3 gap-3 md:gap-4">
                  <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-4 md:px-5 flex items-center gap-3 shadow-sm">
                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Music4 className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg md:text-xl font-black text-zinc-900 dark:text-white truncate">{projects.length}</div>
                      <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-zinc-500 font-bold truncate">{t("totalProjects")}</div>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-4 md:px-5 flex items-center gap-3 shadow-sm">
                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-green-50 dark:bg-green-500/10 flex items-center justify-center shrink-0">
                      <Globe className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg md:text-xl font-black text-zinc-900 dark:text-white truncate">{projects.filter(p => p.published).length}</div>
                      <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-zinc-500 font-bold truncate">{t("publishedCount")}</div>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-4 md:px-5 flex items-center gap-3 shadow-sm">
                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center shrink-0">
                      <Play className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg md:text-xl font-black text-zinc-900 dark:text-white truncate">{projects.reduce((sum, p) => sum + ((p as any).playCount || 0), 0)}</div>
                      <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-zinc-500 font-bold truncate">{t("totalPlays")}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Drive Manager Workspace */}
              <div className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-950/50 shadow-sm">
                 <DriveManager />
              </div>
            </div>

            {/* RIGHT COLUMN: Widgets & Gamification */}
            <aside className="flex flex-col gap-6 w-full lg:sticky lg:top-12">
              {!user.emailVerification && (
                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      {t("verifyEmailPrompt", { email: user.email })}
                    </p>
                  </div>
                  <Button 
                    onClick={() => sendVerification().then(() => toast.success("Verification email sent!"))} 
                    variant="outline" 
                    size="sm" 
                    className="w-full bg-white dark:bg-zinc-900"
                  >
                    {t("resendEmail")}
                  </Button>
                </div>
              )}

              <SubscriptionCard />
              <DailyChallengeCard />
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

/** Recursive tree node for folder picker */
function FolderTreeNode({
  folder,
  allFolders,
  depth,
  onSelect,
  currentFolderId,
}: {
  folder: ProjectFolderDocument;
  allFolders: ProjectFolderDocument[];
  depth: number;
  onSelect: (folderId: string) => void;
  currentFolderId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const children = allFolders.filter(f => (f.parentFolderId || null) === folder.$id);
  const isCurrent = currentFolderId === folder.$id;

  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded-lg transition-colors ${
          isCurrent ? "bg-blue-500/10" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {children.length > 0 ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors"
          >
            <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="w-5" />
        )}
        <button
          onClick={() => onSelect(folder.$id)}
          disabled={isCurrent}
          className={`flex-1 flex items-center gap-2 py-2 pr-3 text-sm font-medium text-left transition-colors ${
            isCurrent
              ? "text-blue-500 cursor-default"
              : "text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
          }`}
        >
          <Folder className="w-4 h-4 text-amber-500 shrink-0" />
          {folder.name}
          {isCurrent && <span className="text-[10px] text-blue-400 ml-auto">• current</span>}
        </button>
      </div>
      {expanded && children.map(child => (
        <FolderTreeNode
          key={child.$id}
          folder={child}
          allFolders={allFolders}
          depth={depth + 1}
          onSelect={onSelect}
          currentFolderId={currentFolderId}
        />
      ))}
    </div>
  );
}
