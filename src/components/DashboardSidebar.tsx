"use client";

import { useState, useEffect, useCallback } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { usePathname } from "next/navigation";
import { useSearchParams } from "next/navigation";
import {
  Music4,
  Bookmark,
  FolderOpen,
  Globe,
  GraduationCap,
  Crown,
  BarChart3,
  FileText,
  ChevronRight,
  Folder,
  FolderPlus,
  Plus,
  X,
  Clock,
  MoreVertical,
  Pencil,
  Trash2,
  Check,
  ListMusic,
  Mic,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useDialogs } from "@/components/ui/dialog-provider";
import { MicCalibrationWizard } from "@/components/player/MicCalibrationWizard";
import {
  listProjectFolders,
  listSheetFolders,
  createProjectFolder,
  createSheetFolder,
  deleteProjectFolder,
  deleteSheetFolder,
  updateProjectFolder,
  updateSheetFolder,
  type ProjectFolderDocument,
  type SheetMusicFolderDocument,
} from "@/lib/appwrite";

type FolderNode = { $id: string; name: string; parentFolderId?: string | null };

const MAX_DEPTH = 3;

// ─── Recursive Folder Node ───
function FolderTreeNode({
  folder,
  allFolders,
  depth,
  basePath,
  activeFolderId,
  sectionActive,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onDropSheet,
  t,
}: {
  folder: FolderNode;
  allFolders: FolderNode[];
  depth: number;
  basePath: string;
  activeFolderId: string | null;
  sectionActive: boolean;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onRenameFolder: (folderId: string, newName: string) => Promise<void>;
  onDropSheet?: (sheetId: string, folderId: string | null) => void;
  t: (key: string, values?: Record<string, string>) => string;
}) {
  const router = useRouter();
  const { confirm } = useDialogs();
  const children = allFolders.filter((f) => f.parentFolderId === folder.$id);
  const hasChildren = children.length > 0;
  const isActive = sectionActive && activeFolderId === folder.$id;

  const [expanded, setExpanded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState(folder.name);
  const [showMenu, setShowMenu] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Auto-expand if active child
  useEffect(() => {
    if (sectionActive && activeFolderId) {
      // Check if any descendant is active
      const isDescendantActive = (folderId: string): boolean => {
        return allFolders.some(
          (f) =>
            f.parentFolderId === folderId &&
            (f.$id === activeFolderId || isDescendantActive(f.$id))
        );
      };
      if (isDescendantActive(folder.$id)) setExpanded(true);
    }
  }, [sectionActive, activeFolderId, folder.$id, allFolders]);

  const handleCreate = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      await onCreateFolder(newName.trim(), folder.$id);
      setNewName("");
      setCreating(false);
      setExpanded(true);
    } catch {
      /* */
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setShowMenu(false);
    const ok = await confirm({
      title: t("deleteFolderTitle"),
      description: t("sidebarDeleteFolderDesc", { name: folder.name }),
    });
    if (ok) await onDeleteFolder(folder.$id);
  };

  const canCreateChild = depth < MAX_DEPTH;

  return (
    <div className={depth === 1 ? "ml-3" : ""}>
      <div
        className={`flex items-center group ${dragOver ? "bg-indigo-50 dark:bg-indigo-500/10 rounded" : ""}`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("text/sheet-id")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const sheetId = e.dataTransfer.getData("text/sheet-id");
          if (sheetId && onDropSheet) onDropSheet(sheetId, folder.$id);
        }}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
            />
          </button>
        ) : (
          <span className="w-3.5" />
        )}

        {/* Folder label */}
        {renaming ? (
          <div className="flex-1 flex items-center gap-1.5 px-1 py-0.5">
            <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <input
              type="text"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && renameName.trim()) {
                  await onRenameFolder(folder.$id, renameName.trim());
                  setRenaming(false);
                }
                if (e.key === "Escape") {
                  setRenaming(false);
                  setRenameName(folder.name);
                }
              }}
              className="bg-transparent text-[13px] text-zinc-900 dark:text-white border-b border-indigo-400 focus:outline-none flex-1 py-0.5"
              autoFocus
            />
            <button
              onClick={async () => {
                if (renameName.trim()) {
                  await onRenameFolder(folder.$id, renameName.trim());
                  setRenaming(false);
                }
              }}
              className="text-indigo-500 hover:text-indigo-400"
            >
              <Check className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={() => { setRenaming(false); setRenameName(folder.name); }}
              className="text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => router.push(`${basePath}?folder=${folder.$id}`)}
            className={`flex-1 flex items-center gap-2 px-2 py-1 rounded transition-colors text-left truncate text-[13px] ${
              isActive
                ? "text-zinc-900 dark:text-white font-medium underline underline-offset-2 decoration-indigo-500"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
            }`}
          >
            <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="truncate">{folder.name}</span>
          </button>
        )}

        {/* Actions menu */}
        {!renaming && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v); }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-all"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {showMenu && (
              <div
                className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg py-1 z-50 whitespace-nowrap"
                onMouseLeave={() => setShowMenu(false)}
              >
                {canCreateChild && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      setCreating(true);
                      setExpanded(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <Plus className="w-3 h-3" />
                    {t("newSubfolder")}
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    setRenameName(folder.name);
                    setRenaming(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Pencil className="w-3 h-3" />
                  {t("renameSidebar")}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-3 h-3" />
                  {t("deleteSidebar")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      {expanded && (hasChildren || creating) && (
        <div className="ml-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-800 mt-0.5">
          {children.map((child) => (
            <FolderTreeNode
              key={child.$id}
              folder={child}
              allFolders={allFolders}
              depth={depth + 1}
              basePath={basePath}
              activeFolderId={activeFolderId}
              sectionActive={sectionActive}
              onCreateFolder={onCreateFolder}
              onDeleteFolder={onDeleteFolder}
              onRenameFolder={onRenameFolder}
              onDropSheet={onDropSheet}
              t={t}
            />
          ))}

          {/* Inline create */}
          {creating && (
            <div className="flex items-center gap-1.5 px-2 py-1">
              <FolderPlus className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewName("");
                  }
                }}
                placeholder="Name"
                className="bg-transparent text-[13px] text-zinc-900 dark:text-white border-b border-indigo-400 focus:outline-none w-20 py-0.5"
                autoFocus
                disabled={saving}
              />
              <button
                onClick={handleCreate}
                disabled={saving || !newName.trim()}
                className="text-[10px] text-indigo-500 hover:text-indigo-400 disabled:opacity-40"
              >
                OK
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                }}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tree Section Component ───
function TreeSection({
  label,
  icon: Icon,
  iconColor,
  href,
  basePath,
  folders,
  activeFolderId,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onDropSheet,
  isActive,
  specialNodes,
  t,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  href: string;
  basePath: string;
  folders: FolderNode[];
  activeFolderId: string | null;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onRenameFolder: (folderId: string, newName: string) => Promise<void>;
  onDropSheet?: (sheetId: string, folderId: string | null) => void;
  isActive: boolean;
  specialNodes?: { key: string; label: string; icon: React.ComponentType<{ className?: string }>; href: string }[];
  t: (key: string, values?: Record<string, string>) => string;
}) {
  const [expanded, setExpanded] = useState(isActive);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const searchParams = useSearchParams();
  const currentPath = usePathname();

  useEffect(() => {
    if (isActive) setExpanded(true);
  }, [isActive]);

  const handleCreate = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      await onCreateFolder(newName.trim(), null);
      setNewName("");
      setCreating(false);
    } catch {
      /* */
    } finally {
      setSaving(false);
    }
  };

  // Root-level folders (no parent)
  const rootFolders = folders.filter((f) => !f.parentFolderId);

  return (
    <div className="mb-1">
      {/* Section header */}
      <div className="flex items-center group">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-0.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          <ChevronRight
            className={`w-3 h-3 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
          />
        </button>
        <Link
          href={href}
          className={`flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-sm ${
            isActive && !activeFolderId
              ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-white font-medium"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white"
          }`}
        >
          <Icon className={`w-4 h-4 ${isActive ? iconColor : ""}`} />
          {label}
        </Link>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
            setCreating(true);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
          title="New folder"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Expanded tree */}
      {expanded && (
        <>
          {/* Special nodes (Favorites, Recent) — same indent as header */}
          {specialNodes?.map((node) => {
            const NodeIcon = node.icon;
            
            // Replaces window.location with safe Next.js hydration-friendly checks
            const url = new URL(node.href, "http://localhost");
            const filterParam = new URLSearchParams(url.search).get("filter");
            
            let isNodeActive = false;
            if (filterParam) {
              isNodeActive = currentPath === url.pathname && searchParams.get("filter") === filterParam;
            } else {
              isNodeActive = currentPath === url.pathname && !searchParams.has("filter");
            }
            
            return (
              <div key={node.key} className="flex items-center ml-3">
                <span className="w-3.5 flex-shrink-0" />
                <Link
                  href={node.href}
                  className={`flex-1 flex items-center gap-2 px-2 py-1 rounded text-[13px] transition-colors ${isNodeActive
                    ? "text-zinc-900 dark:text-white font-medium underline underline-offset-2 decoration-indigo-500"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                  }`}
                >
                  <NodeIcon className="w-4 h-4 flex-shrink-0" />
                  {node.label}
                </Link>
              </div>
            );
          })}

          {/* Folder nodes — same level as special nodes */}
          {rootFolders.map((folder) => (
            <FolderTreeNode
              key={folder.$id}
              folder={folder}
              allFolders={folders}
              depth={1}
              basePath={basePath}
              activeFolderId={activeFolderId}
              sectionActive={isActive}
              onCreateFolder={onCreateFolder}
              onDeleteFolder={onDeleteFolder}
              onRenameFolder={onRenameFolder}
              onDropSheet={onDropSheet}
              t={t}
            />
          ))}

          {/* Inline create root folder */}
          {creating && (
            <div className="flex items-center gap-1 px-1 py-0.5 mt-0.5 ml-4">
              <FolderPlus className="w-3 h-3 text-zinc-400 flex-shrink-0" />
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewName("");
                  }
                }}
                placeholder="Folder name"
                className="bg-transparent text-xs text-zinc-900 dark:text-white border-b border-indigo-400 focus:outline-none w-20 py-0.5"
                autoFocus
                disabled={saving}
              />
              <button
                onClick={handleCreate}
                disabled={saving || !newName.trim()}
                className="text-[10px] text-indigo-500 hover:text-indigo-400 disabled:opacity-40"
              >
                OK
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                }}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Sidebar ───
export function DashboardSidebar({ mobileOpen, onMobileClose, onDropSheet }: { mobileOpen?: boolean; onMobileClose?: () => void; onDropSheet?: (sheetId: string, folderId: string | null) => void } = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("Dashboard");
  const tPdfs = useTranslations("Pdfs");
  const { user } = useAuth();

  const cleanPath = pathname.replace(/^\/[a-z]{2}(?=\/)/, "");
  const folderParam = searchParams.get("folder");

  const isActive = (href: string) => {
    if (href === "/dashboard") return cleanPath === "/dashboard";
    return cleanPath.startsWith(href);
  };

  // Folder data
  const [projectFolders, setProjectFolders] = useState<ProjectFolderDocument[]>([]);
  const [sheetFolders, setSheetFolders] = useState<SheetMusicFolderDocument[]>([]);

  const loadFolders = useCallback(async () => {
    if (!user) return;
    try {
      const [pf, sf] = await Promise.all([
        listProjectFolders(),
        listSheetFolders(),
      ]);
      setProjectFolders(pf);
      setSheetFolders(sf);
    } catch {
      /* silent */
    }
  }, [user]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const handleCreateProjectFolder = async (name: string, parentId: string | null) => {
    await createProjectFolder(name, parentId);
    loadFolders();
  };

  const handleCreateSheetFolder = async (name: string, parentId: string | null) => {
    await createSheetFolder(name, parentId);
    loadFolders();
  };

  const handleDeleteProjectFolder = async (folderId: string) => {
    await deleteProjectFolder(folderId);
    loadFolders();
  };

  const handleDeleteSheetFolder = async (folderId: string) => {
    await deleteSheetFolder(folderId);
    loadFolders();
  };

  const handleRenameProjectFolder = async (folderId: string, newName: string) => {
    await updateProjectFolder(folderId, newName);
    loadFolders();
  };

  const handleRenameSheetFolder = async (folderId: string, newName: string) => {
    await updateSheetFolder(folderId, newName);
    loadFolders();
  };

  const libraryItems = [
    { href: "/dashboard/collections", icon: FolderOpen, labelKey: "collections", iconColor: "" },
    { href: "/dashboard/favorites", icon: Bookmark, labelKey: "favorites", iconColor: "" },
  ];

  const teachItems = [
    { href: "/classroom", labelKey: "classroom", iconColor: "text-indigo-400", icon: GraduationCap },
    { href: "/dashboard/courses", icon: GraduationCap, labelKey: "creatorCourses", iconColor: "text-[#C8A856]" },
  ];

  const otherItems = [
    { href: "/dashboard/analytics", icon: BarChart3, label: "Analytics", iconColor: "text-purple-400" },
    { action: "calibrate_mic", icon: Mic, label: "Mic Calibration", iconColor: "text-blue-400" },
    { href: "/guide", icon: Globe, labelKey: "userGuide", iconColor: "" },
    { href: "/pricing", icon: Crown, label: "Premium", iconColor: "text-[#C8A856]" },
  ];

  const [showMicWizard, setShowMicWizard] = useState(false);

  const renderNavItems = (items: Array<{href?: string, action?: string, icon: any, labelKey?: string, label?: string, iconColor?: string}>, paddingLeft: string = "px-2") => items.map((item, i) => {
    if (item.action === "calibrate_mic") {
      return (
        <button
          key={`action-${i}`}
          onClick={() => {
            if (onMobileClose) onMobileClose();
            setShowMicWizard(true);
          }}
          className={`w-full flex items-center gap-2.5 py-1.5 rounded-md transition-colors text-sm ${paddingLeft} text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white`}
        >
          <item.icon className={`w-4 h-4 ${item.iconColor}`} />
          {item.label}
        </button>
      );
    }
    const active = item.href ? isActive(item.href) : false;
    const ItemIcon = item.icon;
    return (
      <Link
        key={item.href || i}
        href={item.href || "#"}
        onClick={onMobileClose}
        className={`flex items-center gap-2.5 py-1.5 rounded-md transition-colors text-sm ${paddingLeft} ${
          active
            ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-white font-medium"
            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white"
        }`}
      >
        <ItemIcon className={`w-4 h-4 ${active && item.iconColor ? item.iconColor : ""}`} />
        {item.label || t(item.labelKey || "")}
      </Link>
    );
  });

  const sidebarContent = (
    <>
      {/* GROUP 1: LIBRARY */}
      <div className="mb-2">
        <h2 className="text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500 font-bold mb-3 px-1">
          LIBRARY
        </h2>
        <nav className="flex flex-col gap-0.5">
          {/* Projects tree */}
          <TreeSection
            label={t("projectsNav")}
            icon={Music4}
            iconColor="text-blue-400"
            href="/dashboard"
            basePath="/dashboard"
            folders={projectFolders}
            activeFolderId={
              isActive("/dashboard") &&
              !isActive("/dashboard/pdfs") &&
              !isActive("/dashboard/collections") &&
              !isActive("/dashboard/favorites") &&
              !isActive("/dashboard/analytics") &&
              !isActive("/dashboard/courses")
                ? folderParam
                : null
            }
            onCreateFolder={handleCreateProjectFolder}
            onDeleteFolder={handleDeleteProjectFolder}
            onRenameFolder={handleRenameProjectFolder}
            isActive={
              isActive("/dashboard") &&
              !isActive("/dashboard/pdfs") &&
              !isActive("/dashboard/collections") &&
              !isActive("/dashboard/favorites") &&
              !isActive("/dashboard/analytics") &&
              !isActive("/dashboard/courses")
            }
            t={t}
            />


          {/* PDFs tree */}
          <TreeSection
            label={tPdfs("title")}
            icon={FileText}
            iconColor="text-amber-400"
            href="/dashboard/pdfs"
            basePath="/dashboard/pdfs"
            folders={sheetFolders}
            activeFolderId={isActive("/dashboard/pdfs") ? folderParam : null}
            onCreateFolder={handleCreateSheetFolder}
            onDeleteFolder={handleDeleteSheetFolder}
            onRenameFolder={handleRenameSheetFolder}
            isActive={isActive("/dashboard/pdfs")}
            specialNodes={[
              { key: "favorites", label: tPdfs("favorites"), icon: Bookmark, href: "/dashboard/pdfs?filter=favorites" },
              { key: "recent", label: tPdfs("recent"), icon: Clock, href: "/dashboard/pdfs?filter=recent" },
              { key: "setlists", label: tPdfs("setlists") || "Setlists", icon: ListMusic, href: "/dashboard/pdfs/setlists" },
            ]}
            onDropSheet={onDropSheet}
            t={t}
          />

          {/* Static items - Collections, Favorites */}
          {renderNavItems(libraryItems, "px-2 ml-4")}
        </nav>
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800/50 my-4" />

      {/* GROUP 2: TEACH & LEARN */}
      <div className="mb-2">
        <h2 className="text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500 font-bold mb-3 px-1">
          TEACH & LEARN
        </h2>
        <nav className="flex flex-col gap-0.5">
          {renderNavItems(teachItems)}
        </nav>
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800/50 my-4" />

      {/* GROUP 3: OTHER */}
      <div>
        <h2 className="text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500 font-bold mb-3 px-1">
          OTHER
        </h2>
        <nav className="flex flex-col gap-0.5">
          {renderNavItems(otherItems)}
        </nav>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="w-64 border-r border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-5 hidden md:flex flex-col gap-6 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          {/* Slide-in panel */}
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-zinc-950 p-5 pt-3 flex flex-col gap-4 overflow-y-auto shadow-xl animate-in slide-in-from-left duration-200">
            <div className="flex justify-end">
              <button onClick={onMobileClose} className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Settings / Calibration Modal globally mounted for sidebar context */}
      <MicCalibrationWizard 
        isOpen={showMicWizard}
        onClose={() => setShowMicWizard(false)}
      />
    </>
  );
}
