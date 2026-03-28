"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "@/i18n/routing";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useDialogs } from "@/components/ui/dialog-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  listMySheetMusic,
  listSheetFolders,
  createSheetFolder,
  deleteSheetFolder,
  updateSheetFolder,
  deleteSheetMusic,
  toggleSheetFavorite,
  moveSheetToFolder,
  uploadSheetPdf,
  getThumbnailUrl,
  type SheetMusicDocument,
  type SheetMusicFolderDocument,
} from "@/lib/appwrite";
import { extractPdfMetadata } from "@/lib/pdf-utils";
import {
  Plus,
  Upload,
  Folder,
  FolderPlus,
  Heart,
  Clock,
  Search,
  MoreVertical,
  Trash2,
  Pencil,
  FolderOpen,
  Star,
  StarOff,
  FileText,
  Loader2,
  LayoutGrid,
  List,
  Menu,
  X,
  ChevronRight,
  Eye,
} from "lucide-react";
import { useSearchParams } from "next/navigation";

type FilterMode = "all" | "favorites" | "recent";
type ViewMode = "grid" | "list";

export default function PdfsLibraryPage() {
  const t = useTranslations("Pdfs");
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { confirm } = useDialogs();
  const searchParams = useSearchParams();
  const folderParam = searchParams.get("folder");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data state
  const [sheets, setSheets] = useState<SheetMusicDocument[]>([]);
  const [folders, setFolders] = useState<SheetMusicFolderDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // UI state
  const [filter, setFilter] = useState<FilterMode>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(
    folderParam
  );
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [sheetsResult, foldersResult] = await Promise.all([
        listMySheetMusic(
          currentFolderId,
          {
            favoritesOnly: filter === "favorites",
            sortBy: filter === "recent" ? "lastOpenedAt" : "$createdAt",
            sortOrder: "desc",
            search: searchQuery || undefined,
          }
        ),
        listSheetFolders(),
      ]);
      setSheets(sheetsResult.documents);
      setFolders(foldersResult);
    } catch (err) {
      console.error("Failed to load PDFs:", err);
    } finally {
      setLoading(false);
    }
  }, [user, currentFolderId, filter, searchQuery]);

  useEffect(() => {
    if (!authLoading && user) loadData();
  }, [authLoading, user, loadData]);

  // Upload handler
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf") {
        toast.error(t("invalidFileType"));
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(t("fileTooLarge"));
        continue;
      }

      try {
        // Extract page count + generate thumbnail via pdf.js (CDN)
        const { pageCount, thumbnailBlob } = await extractPdfMetadata(file);

        await uploadSheetPdf(file, {
          title: file.name.replace(/\.pdf$/i, ""),
          pageCount,
          thumbnailBlob,
          folderId: currentFolderId,
        });

        toast.success(t("uploadSuccess"));
      } catch (err) {
        console.error("Upload failed:", err);
        toast.error(String(err));
      }
    }

    setUploading(false);
    loadData();
  };

  // Folder actions
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await createSheetFolder(newFolderName.trim());
      setNewFolderName("");
      setShowNewFolder(false);
      loadData();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const ok = await confirm({
      title: t("delete"),
      description: t("deleteConfirm"),
    });
    if (!ok) return;
    try {
      await deleteSheetFolder(folderId);
      if (currentFolderId === folderId) setCurrentFolderId(null);
      loadData();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!editFolderName.trim()) return;
    try {
      await updateSheetFolder(folderId, editFolderName.trim());
      setEditingFolder(null);
      loadData();
    } catch (err) {
      toast.error(String(err));
    }
  };

  // Sheet actions
  const handleDeleteSheet = async (id: string) => {
    const ok = await confirm({
      title: t("delete"),
      description: t("deleteConfirm"),
    });
    if (!ok) return;
    try {
      await deleteSheetMusic(id);
      toast.success(t("deleteSuccess"));
      loadData();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleToggleFavorite = async (sheet: SheetMusicDocument) => {
    try {
      await toggleSheetFavorite(sheet.$id, !!sheet.favorite);
      loadData();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleMoveToFolder = async (
    sheetId: string,
    folderId: string | null
  ) => {
    try {
      await moveSheetToFolder(sheetId, folderId);
      loadData();
    } catch (err) {
      toast.error(String(err));
    }
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // Redirect if not authenticated
  if (!authLoading && !user) {
    router.push("/");
    return null;
  }

  const currentFolder = folders.find((f) => f.$id === currentFolderId);

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <DashboardSidebar />

      {/* Mobile menu toggle */}
      <button
        className="md:hidden fixed bottom-4 left-4 z-50 bg-zinc-800 text-white p-3 rounded-full shadow-lg"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-zinc-50 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {currentFolderId && (
              <button
                onClick={() => setCurrentFolderId(null)}
                className="text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
            )}
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {currentFolder ? currentFolder.name : t("title")}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {uploading ? t("uploading") : t("upload")}
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            {(["all", "favorites", "recent"] as FilterMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilter(mode)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === mode
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {mode === "all" && t("allPdfs")}
                {mode === "favorites" && (
                  <span className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5" />
                    {t("favorites")}
                  </span>
                )}
                {mode === "recent" && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {t("recent")}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder={t("search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 text-sm border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
              />
            </div>
            <button
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              {viewMode === "grid" ? (
                <List className="w-4 h-4" />
              ) : (
                <LayoutGrid className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Folder cards (only show at root level) */}
        {!currentFolderId && (
          <div className="mb-8">
            <div className="flex flex-wrap gap-3">
              {folders.map((folder) => (
                <div
                  key={folder.$id}
                  className="group relative"
                >
                  {editingFolder === folder.$id ? (
                    <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-3">
                      <input
                        type="text"
                        value={editFolderName}
                        onChange={(e) => setEditFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameFolder(folder.$id);
                          if (e.key === "Escape") setEditingFolder(null);
                        }}
                        className="bg-transparent text-sm text-zinc-900 dark:text-white border-b border-indigo-500 focus:outline-none w-24"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRenameFolder(folder.$id)}
                      >
                        {t("save")}
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCurrentFolderId(folder.$id)}
                      className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 rounded-xl px-4 py-3 transition-colors min-w-[140px]"
                    >
                      <Folder className="w-5 h-5 text-amber-400" />
                      <div className="text-left">
                        <div className="text-sm font-medium text-zinc-900 dark:text-white">
                          {folder.name}
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Folder menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all">
                        <MoreVertical className="w-3.5 h-3.5 text-zinc-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingFolder(folder.$id);
                          setEditFolderName(folder.name);
                        }}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        {t("rename")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDeleteFolder(folder.$id)}
                        className="text-red-500"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t("delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}

              {/* New folder button */}
              {showNewFolder ? (
                <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-4 py-3">
                  <FolderPlus className="w-5 h-5 text-zinc-400" />
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateFolder();
                      if (e.key === "Escape") {
                        setShowNewFolder(false);
                        setNewFolderName("");
                      }
                    }}
                    placeholder={t("newFolder")}
                    className="bg-transparent text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none w-28"
                    autoFocus
                    disabled={creatingFolder}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCreateFolder}
                    disabled={creatingFolder}
                  >
                    {creatingFolder ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      t("save")
                    )}
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewFolder(true)}
                  className="flex items-center gap-2 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors min-w-[140px]"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-sm">{t("newFolder")}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        )}

        {/* Empty state */}
        {!loading && sheets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mb-4" />
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              {t("noPdfs")}
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm">
              {t("noPdfsDesc")}
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              {t("uploadPdf")}
            </Button>
          </div>
        )}

        {/* PDF Grid/List */}
        {!loading && sheets.length > 0 && (
          <>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sheets.map((sheet) => (
                  <div
                    key={sheet.$id}
                    className="group bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/30 transition-all cursor-pointer overflow-hidden"
                    onClick={() =>
                      router.push(`/dashboard/pdfs/view/${sheet.$id}`)
                    }
                  >
                    {/* Thumbnail */}
                    <div className="aspect-[3/4] bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center relative overflow-hidden">
                      {sheet.thumbnailId ? (
                        <img
                          src={getThumbnailUrl(sheet.thumbnailId)}
                          alt={sheet.title}
                          className="w-full h-full object-cover object-top"
                          loading="lazy"
                        />
                      ) : (
                        <FileText className="w-12 h-12 text-zinc-300 dark:text-zinc-600" />
                      )}
                      {sheet.favorite && (
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400 absolute top-2 right-2" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <h3 className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                        {sheet.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {sheet.instrument && <span>{sheet.instrument}</span>}
                        {sheet.instrument && <span>·</span>}
                        <span>
                          {t("pages", { count: sheet.pageCount })}
                        </span>
                        <span>·</span>
                        <span>{formatSize(sheet.fileSize)}</span>
                      </div>
                      {sheet.composer && (
                        <p className="text-xs text-zinc-400 mt-0.5 truncate">
                          {sheet.composer}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="px-3 pb-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                          >
                            <MoreVertical className="w-4 h-4 text-zinc-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                `/dashboard/pdfs/view/${sheet.$id}`
                              );
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            {t("openViewer")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(sheet);
                            }}
                          >
                            {sheet.favorite ? (
                              <>
                                <StarOff className="w-4 h-4 mr-2" />
                                {t("removeFromFavorites")}
                              </>
                            ) : (
                              <>
                                <Star className="w-4 h-4 mr-2" />
                                {t("addToFavorites")}
                              </>
                            )}
                          </DropdownMenuItem>
                          {folders.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              {folders.map((folder) => (
                                <DropdownMenuItem
                                  key={folder.$id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveToFolder(
                                      sheet.$id,
                                      folder.$id
                                    );
                                  }}
                                >
                                  <FolderOpen className="w-4 h-4 mr-2" />
                                  {folder.name}
                                </DropdownMenuItem>
                              ))}
                              {sheet.folderId && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveToFolder(sheet.$id, null);
                                  }}
                                >
                                  <FolderOpen className="w-4 h-4 mr-2" />
                                  {t("unfiled")}
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSheet(sheet.$id);
                            }}
                            className="text-red-500"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* List view */
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                {sheets.map((sheet, idx) => (
                  <div
                    key={sheet.$id}
                    className={`flex items-center gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 cursor-pointer transition-colors ${
                      idx > 0
                        ? "border-t border-zinc-100 dark:border-zinc-800"
                        : ""
                    }`}
                    onClick={() =>
                      router.push(`/dashboard/pdfs/view/${sheet.$id}`)
                    }
                  >
                    <FileText className="w-8 h-8 text-zinc-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                        {sheet.title}
                      </h3>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {sheet.composer && `${sheet.composer} · `}
                        {sheet.instrument && `${sheet.instrument} · `}
                        {t("pages", { count: sheet.pageCount })} ·{" "}
                        {formatSize(sheet.fileSize)}
                      </div>
                    </div>
                    {sheet.favorite && (
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0" />
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <MoreVertical className="w-4 h-4 text-zinc-400" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(sheet);
                          }}
                        >
                          {sheet.favorite ? (
                            <>
                              <StarOff className="w-4 h-4 mr-2" />
                              {t("removeFromFavorites")}
                            </>
                          ) : (
                            <>
                              <Star className="w-4 h-4 mr-2" />
                              {t("addToFavorites")}
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSheet(sheet.$id);
                          }}
                          className="text-red-500"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Drop zone overlay */}
        <div
          className="fixed inset-0 z-40 pointer-events-none"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add("bg-indigo-500/10");
            e.currentTarget.classList.add("pointer-events-auto");
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove("bg-indigo-500/10");
            e.currentTarget.classList.remove("pointer-events-auto");
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("bg-indigo-500/10");
            e.currentTarget.classList.remove("pointer-events-auto");
            handleUpload(e.dataTransfer.files);
          }}
        />
      </main>
    </div>
  );
}
