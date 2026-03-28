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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
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
  Grid3X3,
} from "lucide-react";
import { useSearchParams } from "next/navigation";

type FilterMode = "all" | "favorites" | "recent";
type ViewMode = "grid" | "compact" | "list";

// Mini tree node for folder picker in context menu
function FolderPickerNode({
  folder,
  allFolders,
  excludeFolderId,
  depth,
  onSelect,
}: {
  folder: SheetMusicFolderDocument;
  allFolders: SheetMusicFolderDocument[];
  excludeFolderId: string | null;
  depth: number;
  onSelect: (folderId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const children = allFolders.filter(
    f => (f.parentFolderId || null) === folder.$id && f.$id !== excludeFolderId
  );
  const hasChildren = children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-sm cursor-pointer text-sm"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded(v => !v);
            }}
            className="p-0.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex-shrink-0"
          >
            <ChevronRight
              className={`w-3 h-3 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
            />
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(folder.$id);
          }}
          className="flex items-center gap-1.5 flex-1 truncate"
        >
          <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="truncate">{folder.name}</span>
        </button>
      </div>
      {expanded && hasChildren && (
        <div>
          {children.map(child => (
            <FolderPickerNode
              key={child.$id}
              folder={child}
              allFolders={allFolders}
              excludeFolderId={excludeFolderId}
              depth={depth + 1}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);

  // UI state
  const filter = (searchParams.get("filter") as FilterMode) || "all";
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(
    folderParam
  );

  // Sync with URL ?folder param (e.g., from sidebar clicks)
  useEffect(() => {
    setCurrentFolderId(folderParam);
  }, [folderParam]);
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
          filter === "all" ? (currentFolderId ?? undefined) : undefined,
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

  // Upload handler — sequential with progress
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const pdfFiles = Array.from(files).filter((f) => {
      if (f.type !== "application/pdf") {
        toast.error(`${f.name}: ${t("invalidFileType")}`);
        return false;
      }
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`${f.name}: ${t("fileTooLarge")}`);
        return false;
      }
      return true;
    });

    if (pdfFiles.length === 0) return;
    setUploading(true);

    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      setUploadProgress({
        current: i + 1,
        total: pdfFiles.length,
        fileName: file.name,
      });

      try {
        const { pageCount, thumbnailBlob } = await extractPdfMetadata(file);

        const doc = await uploadSheetPdf(file, {
          title: file.name.replace(/\.pdf$/i, ""),
          pageCount,
          thumbnailBlob,
          folderId: currentFolderId,
        });

        // Immediately add to grid
        setSheets((prev) => [doc, ...prev]);
        toast.success(`${file.name.replace(/\.pdf$/i, "")}`);
      } catch (err) {
        console.error("Upload failed:", err);
        toast.error(`${file.name}: ${String(err)}`);
      }
    }

    setUploading(false);
    setUploadProgress(null);
    // Reset file input so same files can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
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
            {(currentFolderId || filter !== "all") && (
              <button
                onClick={() => router.push("/dashboard/pdfs")}
                className="text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
            )}
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {filter === "favorites"
                ? t("favorites")
                : filter === "recent"
                  ? t("recent")
                  : currentFolder
                    ? currentFolder.name
                    : t("title")}
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

        {/* Upload progress bar */}
        {uploadProgress && (
          <div className="mb-4 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span className="truncate max-w-xs">{uploadProgress.fileName}</span>
              </div>
              <span className="text-xs text-zinc-500 flex-shrink-0">
                {uploadProgress.current} / {uploadProgress.total}
              </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Search + View mode */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder={t("search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 text-sm border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 sm:w-80"
            />
          </div>
          <button
            onClick={() =>
              setViewMode(
                viewMode === "grid"
                  ? "compact"
                  : viewMode === "compact"
                    ? "list"
                    : "grid"
              )
            }
            className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            title={viewMode === "grid" ? "Compact" : viewMode === "compact" ? "List" : "Grid"}
          >
            {viewMode === "grid" ? (
              <Grid3X3 className="w-4 h-4" />
            ) : viewMode === "compact" ? (
              <List className="w-4 h-4" />
            ) : (
              <LayoutGrid className="w-4 h-4" />
            )}
          </button>
        </div>



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
            {filter === "favorites" ? (
              <>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                  {t("noFavorites")}
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 max-w-sm">
                  {t("noFavoritesDesc")}
                </p>
              </>
            ) : filter === "recent" ? (
              <>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                  {t("noRecent")}
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 max-w-sm">
                  {t("noRecentDesc")}
                </p>
              </>
            ) : searchQuery ? (
              <>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                  {t("noSearchResults")}
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 max-w-sm">
                  {t("noSearchResultsDesc")}
                </p>
              </>
            ) : currentFolderId ? (
              <>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                  {t("emptyFolder")}
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 max-w-sm">
                  {t("emptyFolderDesc")}
                </p>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}

        {/* PDF Grid/List */}
        {!loading && sheets.length > 0 && (
          <>
            {viewMode === "grid" || viewMode === "compact" ? (
              <div
                className={
                  viewMode === "compact"
                    ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
                    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                }
              >
                {sheets.map((sheet) => (
                  <div
                    key={sheet.$id}
                    className="group bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/30 transition-all cursor-pointer overflow-hidden"
                    onClick={() =>
                      router.push(`/dashboard/pdfs/view/${sheet.$id}`)
                    }
                  >
                    {/* Thumbnail */}
                    <div className={`${viewMode === "compact" ? "aspect-[4/3]" : "aspect-[3/4]"} bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center relative overflow-hidden`}>
                      {sheet.thumbnailId ? (
                        <img
                          src={getThumbnailUrl(sheet.thumbnailId)}
                          alt={sheet.title}
                          className="w-full h-full object-cover object-top"
                          loading="lazy"
                        />
                      ) : (
                        <FileText className={`${viewMode === "compact" ? "w-8 h-8" : "w-12 h-12"} text-zinc-300 dark:text-zinc-600`} />
                      )}
                      {sheet.favorite && (
                        <Star className={`${viewMode === "compact" ? "w-3 h-3 top-1.5 right-1.5" : "w-4 h-4 top-2 right-2"} text-amber-400 fill-amber-400 absolute`} />
                      )}
                    </div>

                    {/* Info + Actions */}
                    <div className={viewMode === "compact" ? "p-2" : "p-3"}>
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <h3 className={`${viewMode === "compact" ? "text-xs" : "text-sm"} font-medium text-zinc-900 dark:text-white truncate`}>
                            {sheet.title}
                          </h3>
                          {viewMode !== "compact" && (
                            <>
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
                            </>
                          )}
                          {viewMode === "compact" && (
                            <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                              {t("pages", { count: sheet.pageCount })}
                            </p>
                          )}
                        </div>

                        {/* Three-dot menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex-shrink-0"
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
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                              {t("openViewer")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleFavorite(sheet);
                              }}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              {sheet.favorite ? (
                                <>
                                  <StarOff className="w-4 h-4" />
                                  {t("removeFromFavorites")}
                                </>
                              ) : (
                                <>
                                  <Star className="w-4 h-4" />
                                  {t("addToFavorites")}
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {folders.length > 0 && (
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
                                  <FolderOpen className="w-4 h-4" />
                                  {t("moveToFolder")}
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="max-h-60 overflow-y-auto">
                                  {folders
                                    .filter(f => !f.parentFolderId && f.$id !== sheet.folderId)
                                    .map(f => (
                                      <FolderPickerNode
                                        key={f.$id}
                                        folder={f}
                                        allFolders={folders}
                                        excludeFolderId={sheet.folderId ?? null}
                                        depth={0}
                                        onSelect={(folderId) => {
                                          handleMoveToFolder(sheet.$id, folderId);
                                        }}
                                      />
                                    ))
                                  }
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            )}
                            {sheet.folderId && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveToFolder(sheet.$id, null);
                                }}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <Folder className="w-4 h-4" />
                                {t("unfiled")}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSheet(sheet.$id);
                              }}
                              className="flex items-center gap-2 cursor-pointer text-red-500 focus:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                              {t("delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
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
