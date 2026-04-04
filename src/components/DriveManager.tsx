"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "@/i18n/routing";
import { useDropzone } from "react-dropzone";
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
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  listMyProjects,
  listProjectFolders,
  createProjectFolder,
  deleteProjectFolder,
  updateProjectFolder, // We should ensure we have this or just remove rename
  deleteProject,
  toggleFavorite,
  moveProjectToFolder,
  createProject,
  listMyPlaylists,
  addProjectToPlaylist,
  ProjectDocument,
  ProjectFolderDocument,
  PlaylistDocument,
  ProjectPayload
} from "@/lib/appwrite";

import { uploadProjectFile } from "@/lib/appwrite/upload";
import {
  CloudUpload,
  Folder,
  FolderPlus,
  Search,
  MoreVertical,
  Trash2,
  Pencil,
  FolderOpen,
  Star,
  FileText,
  Loader2,
  LayoutGrid,
  List,
  ChevronRight,
  Grid3X3,
  PlaySquare,
  Music4,
  Check,
  Eye,
  EyeOff,
  X,
  CheckSquare,
  Square,
  Globe
} from "lucide-react";
import { useSearchParams } from "next/navigation";

type ViewMode = "grid" | "list";

export function DriveManager() {
  const t = useTranslations("Dashboard");
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { confirm, prompt } = useDialogs();
  const searchParams = useSearchParams();
  const folderParam = searchParams.get("folder");

  // Data state
  const [projects, setProjects] = useState<ProjectDocument[]>([]);
  const [folders, setFolders] = useState<ProjectFolderDocument[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistDocument[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Upload State
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(folderParam);
  
  // Folders
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedIds.size > 0;

  // Sync folder parameter
  useEffect(() => { setCurrentFolderId(folderParam); }, [folderParam]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [projectsResult, foldersResult, playlistsResult] = await Promise.all([
        listMyProjects(),
        listProjectFolders(),
        listMyPlaylists()
      ]);
      setProjects(projectsResult);
      setFolders(foldersResult);
      setPlaylists(playlistsResult);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user?.$id]);

  useEffect(() => {
    if (!authLoading && user?.$id) loadData();
  }, [authLoading, user?.$id, loadData]);

  const toggleSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // --- DROPZONE UPLOADING ---
  const handleUploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop()?.toLowerCase();
        
        let type: 'none' | 'music-xml' | 'pdf' | 'audio' = 'none';
        if (ext === 'pdf') type = 'pdf';
        else if (['xml', 'musicxml', 'mxl'].includes(ext || '')) type = 'music-xml';
        else if (['mp3', 'wav', 'm4a', 'flac'].includes(ext || '')) type = 'audio';
        
        if (type === 'none') {
            toast.error(`Unsupported file type: ${file.name}`);
            continue;
        }

        setUploadProgress({ current: i + 1, total: files.length, fileName: file.name });
        try {
            // Upload Raw Asset
            const { fileId } = await uploadProjectFile("new", file);
            
            // Generate Payload Context
            const payload: ProjectPayload = {
              version: 1,
              name: file.name.replace(/\.[^/.]+$/, ""),
              mode: "practice",
              tempo: 120,
              timeSignature: { numerator: 4, denominator: 4 },
              tracks: [],
              notationData: { type, fileId, timemap: [], measureMap: [] }
            };

            let coverUrl: string | undefined = undefined;
            if (type === 'pdf') {
              try {
                const { extractPdfMetadata } = await import("@/lib/pdf-utils");
                const { thumbnailBlob } = await extractPdfMetadata(file);

                const thumbFile = new File([thumbnailBlob], `thumb_${fileId}.jpg`, { type: "image/jpeg" });
                const headers: Record<string, string> = { "Content-Type": "application/json" };

                const thumbRes = await fetch("/api/r2/upload", {
                  method: "POST",
                  headers,
                  body: JSON.stringify({ filename: thumbFile.name, contentType: "image/jpeg", fileSize: thumbFile.size })
                });

                if (thumbRes.ok) {
                  const { fileId: thumbId, uploadUrl: thumbUploadUrl } = (await thumbRes.json()) as any;
                  await fetch(thumbUploadUrl, { method: "PUT", body: thumbFile, headers: { "Content-Type": "image/jpeg" } });
                  coverUrl = `/api/r2/download/${thumbId}`;
                }
              } catch (e) {
                console.warn(`Failed to auto-generate thumbnail for PDF ${file.name}`, e);
              }
            }

            // Register Project
            const doc = await createProject({
              name: payload.name,
              mode: "practice",
              payload,
              folderId: currentFolderId || undefined,
              coverUrl
            });

            setProjects(prev => [doc, ...prev]);
            toast.success(`Uploaded: ${file.name}`);
        } catch (e: any) {
            toast.error(`Failed ${file.name}: ${e.message}`);
        }
    }
    setUploadProgress(null);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleUploadFiles,
    noClick: true,
  });

  // --- FOLDER ACTIONS ---
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const folder = await createProjectFolder(newFolderName.trim(), currentFolderId);
      setFolders(prev => [...prev, folder]);
      setNewFolderName("");
      setShowNewFolder(false);
    } catch { toast.error("Failed to create folder"); }
    finally { setCreatingFolder(false); }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!(await confirm({ title: "Delete Folder", description: "Delete this folder and ALL its sub-folders? Projects will be unfiled." }))) return;
    try {
      await deleteProjectFolder(folderId);
      if (currentFolderId === folderId) setCurrentFolderId(null);
      loadData();
    } catch { toast.error("Failed"); }
  };

  const handleRenameFolder = async (folderId: string, oldName: string) => {
    const newName = await prompt({ title: "Rename Folder", defaultValue: oldName, confirmText: "Save" });
    if (!newName || newName === oldName) return;
    try {
      await updateProjectFolder(folderId, newName);
      setFolders(prev => prev.map(f => f.$id === folderId ? { ...f, name: newName } : f));
      toast.success("Renamed successfully");
    } catch { toast.error("Failed to rename"); }
  };

  const handleMoveFolder = async (folderId: string, newParentId: string | null) => {
    try {
      await updateProjectFolder(folderId, undefined, newParentId);
      setFolders(prev => prev.map(f => f.$id === folderId ? { ...f, parentFolderId: newParentId } : f));
      toast.success("Folder moved");
    } catch { toast.error("Failed to move folder"); }
  };

  // --- PROJECT ACTIONS ---
  const handleDeleteProject = async (id: string) => {
    if (!(await confirm({ title: "Delete", description: "Are you sure?" }))) return;
    try {
      await deleteProject(id);
      setProjects(prev => prev.filter(p => p.$id !== id));
      toast.success("Deleted successfully");
    } catch { toast.error("Failed to delete"); }
  };

  const handleToggleFavorite = async (project: ProjectDocument) => {
    try {
      await toggleFavorite("project", project.$id);
      loadData();
    } catch { toast.error("Failed"); }
  };

  const handleMoveToFolder = async (projectId: string, targetFolderId: string | null) => {
    try {
      await moveProjectToFolder(projectId, targetFolderId);
      setProjects(prev => prev.map(p => p.$id === projectId ? { ...p, folderId: targetFolderId } : p));
      toast.success("Moved");
    } catch { toast.error("Failed to move"); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!(await confirm({ title: "Delete Multiple Items", description: `Are you sure you want to delete ${selectedIds.size} items?` }))) return;
    const loadingToast = toast.loading(`Deleting ${selectedIds.size} items...`);
    try {
      await Promise.all(Array.from(selectedIds).map(id => deleteProject(id)));
      setProjects(prev => prev.filter(p => !selectedIds.has(p.$id)));
      clearSelection();
      toast.dismiss(loadingToast);
      toast.success("Deleted successfully");
    } catch { 
      toast.dismiss(loadingToast);
      toast.error("Failed to delete some items"); 
    }
  };

  const handleBulkMove = async (targetFolderId: string | null) => {
    if (selectedIds.size === 0) return;
    const loadingToast = toast.loading(`Moving ${selectedIds.size} items...`);
    try {
      await Promise.all(Array.from(selectedIds).map(id => moveProjectToFolder(id, targetFolderId)));
      setProjects(prev => prev.map(p => selectedIds.has(p.$id) ? { ...p, folderId: targetFolderId } : p));
      clearSelection();
      toast.dismiss(loadingToast);
      toast.success("Moved successfully");
    } catch { 
      toast.dismiss(loadingToast);
      toast.error("Failed to move some items"); 
    }
  };

  // --- HELPERS ---
  const getChildFolders = (parentId: string | null) => folders.filter(f => (f.parentFolderId || null) === parentId);
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

  const filteredProjects = projects.filter(p => {
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = currentFolderId === null || p.folderId === currentFolderId;
    return matchesSearch && matchesFolder;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProjects.length && filteredProjects.length > 0) {
      clearSelection();
    } else {
      setSelectedIds(new Set(filteredProjects.map(p => p.$id)));
    }
  };

  return (
    <div {...getRootProps()} className="w-full relative outline-none pb-20">
      <input {...getInputProps()} />
      
      {/* Drop overlay */}
      {isDragActive && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-blue-500/20 backdrop-blur-sm rounded-xl m-4">
          <div className="bg-white dark:bg-zinc-900 px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/40 text-blue-500 rounded-full flex items-center justify-center">
              <CloudUpload className="w-8 h-8" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-xl text-zinc-900 dark:text-white">Drop to Upload to Drive</h3>
              <p className="text-sm text-zinc-500">Supports PDF, MusicXML, and Audio tracks</p>
            </div>
          </div>
        </div>
      )}

      {/* Header controls layout can go here if needed, but in our design Dashboard injects the header. We'll include standalone toolbar */}
      <div className="flex flex-col gap-6 p-6">
        
        {/* Stats Summary */}
        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-3 gap-3 md:gap-4 mb-2">
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
                <PlaySquare className="w-4 h-4 text-purple-500" />
              </div>
              <div className="min-w-0">
                <div className="text-lg md:text-xl font-black text-zinc-900 dark:text-white truncate">{projects.reduce((sum, p) => sum + ((p as any).playCount || 0), 0)}</div>
                <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-zinc-500 font-bold truncate">{t("totalPlays")}</div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploadProgress && (
          <div className="bg-zinc-100 dark:bg-zinc-800/80 rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
               <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
               <span className="font-medium">Uploading {uploadProgress.fileName} ({uploadProgress.current}/{uploadProgress.total})</span>
            </div>
            <div className="w-48 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
               <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(uploadProgress.current/uploadProgress.total)*100}%` }} />
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm font-bold flex-wrap">
              <button 
                onClick={() => setCurrentFolderId(null)}
                className={`${currentFolderId === null ? "text-zinc-900 dark:text-white" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white"}`}
              >
                  Drive Root
              </button>
              {getBreadcrumb(currentFolderId).map(folder => (
                  <span key={folder.$id} className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                      <button 
                        onClick={() => setCurrentFolderId(folder.$id)}
                        className={`${currentFolderId === folder.$id ? "text-zinc-900 dark:text-white" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white"}`}
                      >
                          {folder.name}
                      </button>
                  </span>
              ))}
          </div>

          {/* Search & View Modes */}
          <div className="flex items-center gap-2">
            
            {filteredProjects.length > 0 && (
              <button onClick={toggleSelectAll} className="h-9 px-3 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
                {selectedIds.size === filteredProjects.length ? "Deselect All" : "Select All"}
              </button>
            )}

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="pl-9 pr-3 py-1.5 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-blue-500 w-48 transition-all focus:w-64"
              />
            </div>
            <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
               {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Folders List */}
        {getChildFolders(currentFolderId).length > 0 && (
          <div className="flex flex-wrap gap-3">
             {getChildFolders(currentFolderId).map(folder => (
                 <div key={folder.$id} className="group relative">
                     <button 
                        onClick={() => setCurrentFolderId(folder.$id)}
                        className="flex items-center gap-3 pl-3 pr-8 py-2 rounded-xl bg-zinc-50 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 hover:border-blue-500/50 transition-colors"
                     >
                         <Folder className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                         <span className="text-sm font-bold">{folder.name}</span>
                     </button>
                     <FolderContextMenu folder={folder} folders={folders} onDelete={handleDeleteFolder} onRename={handleRenameFolder} onMove={handleMoveFolder} />
                 </div>
             ))}
          </div>
        )}

        <div className="flex items-center gap-2">
            {!showNewFolder ? (
                <button onClick={() => setShowNewFolder(true)} className="flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                    <FolderPlus className="w-4 h-4" /> New Folder
                </button>
            ) : (
                <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-lg p-1.5 w-72 border border-zinc-200 dark:border-zinc-800">
                    <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); else if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(""); } }} className="flex-1 bg-transparent px-2 text-sm outline-none" placeholder="Folder name" />
                    <button onClick={handleCreateFolder} className="bg-blue-600 text-white rounded p-1.5 hover:bg-blue-500 transition-colors">
                        <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setShowNewFolder(false); setNewFolderName(''); }} className="bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded p-1.5 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
        </div>

        {/* Assets List */}
        {loading ? (
             <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-zinc-300" /></div>
        ) : filteredProjects.length === 0 ? (
             <div className="text-center py-20">
                 <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
                     <FileText className="w-8 h-8 text-zinc-300" />
                 </div>
                 <h3 className="font-bold text-zinc-500">No projects here</h3>
             </div>
        ) : (
             viewMode === "grid" ? (
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                     {filteredProjects.map(p => (
                         <div key={p.$id} className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden hover:border-blue-500/50 transition-colors shadow-sm cursor-pointer relative" onClick={() => { if (isSelectionMode) { setSelectedIds(prev => { const next = new Set(prev); if (next.has(p.$id)) next.delete(p.$id); else next.add(p.$id); return next; }); } else { router.push(`/play/${p.$id}`); } }}>
                             
                             <button onClick={(e) => toggleSelection(e, p.$id)} className={`absolute top-2 left-2 z-10 w-6 h-6 rounded bg-black/60 flex items-center justify-center transition-opacity text-white ${selectedIds.has(p.$id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                 {selectedIds.has(p.$id) ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                             </button>

                             <div className="aspect-square bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center relative">
                                 {p.coverUrl ? (
                                     <img src={p.coverUrl} className="w-full h-full object-cover" />
                                 ) : (
                                     <FileText className="w-10 h-10 text-zinc-300" />
                                 )}
                             </div>
                             <div className="p-3">
                                 <h4 className="font-bold text-sm truncate">{p.name}</h4>
                                 <div className="flex items-center justify-between mt-1">
                                    <span className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 rounded">{((typeof p.payload === 'string' ? JSON.parse(p.payload) : p.payload) as any)?.notationData?.type?.toUpperCase() || 'AUDIO'}</span>
                                    {/* Stop click propagation on menu */}
                                    <div onClick={e => e.stopPropagation()}>
                                       <ProjectContextMenu project={p} folders={folders} playlists={playlists} onDelete={handleDeleteProject} onMove={handleMoveToFolder} onFavorite={handleToggleFavorite} />
                                    </div>
                                 </div>
                             </div>
                         </div>
                     ))}
                 </div>
             ) : (
                 <div className="flex flex-col gap-2">
                     {filteredProjects.map(p => (
                         <div key={p.$id} className="group flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 hover:border-blue-500/50 transition-colors cursor-pointer" onClick={() => { if (isSelectionMode) { setSelectedIds(prev => { const next = new Set(prev); if (next.has(p.$id)) next.delete(p.$id); else next.add(p.$id); return next; }); } else { router.push(`/play/${p.$id}`); } }}>
                             <div className="flex items-center gap-4 min-w-0">
                                 
                                 <button onClick={(e) => toggleSelection(e, p.$id)} className={`w-6 h-6 rounded flex items-center justify-center transition-opacity text-zinc-400 hover:text-zinc-600 ${selectedIds.has(p.$id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${isSelectionMode && !selectedIds.has(p.$id) ? 'opacity-100' : ''}`}>
                                     {selectedIds.has(p.$id) ? <CheckSquare className="w-5 h-5 text-blue-500" /> : <Square className="w-5 h-5" />}
                                 </button>

                                 <div className="w-10 h-10 rounded bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center overflow-hidden shrink-0">
                                     {p.coverUrl ? <img src={p.coverUrl} className="w-full h-full object-cover" /> : <FileText className="w-5 h-5 text-zinc-300" />}
                                 </div>
                                 <div className="min-w-0">
                                     <h4 className="font-bold text-sm truncate">{p.name}</h4>
                                     <span className="text-xs text-zinc-500">{((typeof p.payload === 'string' ? JSON.parse(p.payload) : p.payload) as any)?.notationData?.type?.toUpperCase() || 'AUDIO'}</span>
                                 </div>
                             </div>
                             <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <ProjectContextMenu project={p} folders={folders} playlists={playlists} onDelete={handleDeleteProject} onMove={handleMoveToFolder} onFavorite={handleToggleFavorite} />
                             </div>
                         </div>
                     ))}
                 </div>
             )
        )}
      </div>

      {/* Floating Action Bar */}
      {isSelectionMode && (
         <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl text-zinc-900 dark:text-white rounded-full px-6 py-3 z-[60] flex items-center gap-6 animate-in slide-in-from-bottom-5">
            <span className="font-semibold text-sm whitespace-nowrap">{selectedIds.size} Selected</span>
            <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700" />
            
            <div className="flex items-center gap-1">
               <button onClick={clearSelection} className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium">
                  <X className="w-4 h-4" /> Cancel
               </button>

               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <button className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium text-blue-500">
                        <Folder className="w-4 h-4" /> Move
                     </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" side="top" className="w-48 mb-2">
                     <DropdownMenuItem onClick={() => handleBulkMove(null)} className="cursor-pointer text-zinc-500">
                        Drive Root
                     </DropdownMenuItem>
                     {folders.length > 0 && <DropdownMenuSeparator />}
                     {folders.map(f => (
                        <DropdownMenuItem key={f.$id} onClick={() => handleBulkMove(f.$id)} className="cursor-pointer">
                           {f.name}
                        </DropdownMenuItem>
                     ))}
                  </DropdownMenuContent>
               </DropdownMenu>

               <button onClick={handleBulkDelete} className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium text-red-500">
                  <Trash2 className="w-4 h-4" /> Delete
               </button>
            </div>
         </div>
      )}

    </div>
  );
}

// Extracted ContextMenu for cleanliness
function ProjectContextMenu({ project, folders, playlists, onDelete, onMove, onFavorite }: any) {
  const router = useRouter();
  
  return (
      <DropdownMenu>
          <DropdownMenuTrigger asChild>
             <button onClick={e => e.stopPropagation()} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400">
                <MoreVertical className="w-4 h-4" />
             </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48" onClick={e => e.stopPropagation()}>
             <DropdownMenuItem onClick={() => router.push(`/play/${project.$id}`)} className="gap-2 cursor-pointer">
                 <PlaySquare className="w-4 h-4" /> Play
             </DropdownMenuItem>
             <DropdownMenuItem onClick={() => router.push(`/p/${project.$id}`)} className="gap-2 cursor-pointer">
                 <Pencil className="w-4 h-4" /> Edit Configuration
             </DropdownMenuItem>
             <DropdownMenuItem onClick={() => onFavorite(project)} className="gap-2 cursor-pointer">
                 <Star className="w-4 h-4" /> Favorite
             </DropdownMenuItem>
             <DropdownMenuSeparator />
             
             {/* Submenu for Playlists */}
             <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                    <FolderOpen className="w-4 h-4" /> Save to Playlist
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                         {playlists.length === 0 ? (
                             <DropdownMenuItem disabled className="text-xs">No playlists</DropdownMenuItem>
                         ) : playlists.map((pl: any) => (
                             <DropdownMenuItem key={pl.$id} onClick={() => { addProjectToPlaylist(pl.$id, project.$id); toast.success("Added to playlist"); }} className="gap-2 text-xs cursor-pointer">
                                 {pl.name}
                             </DropdownMenuItem>
                         ))}
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
             </DropdownMenuSub>

             {/* Submenu for Folders */}
             <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                    <Folder className="w-4 h-4" /> Move to
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                         <DropdownMenuItem onClick={() => onMove(project.$id, null)} className="gap-2 text-xs cursor-pointer text-zinc-500">
                             Drive Root
                         </DropdownMenuItem>
                         {folders.length > 0 && <DropdownMenuSeparator />}
                         {folders.map((f: any) => (
                             <DropdownMenuItem key={f.$id} onClick={() => onMove(project.$id, f.$id)} className="gap-2 text-xs cursor-pointer">
                                 {f.name}
                             </DropdownMenuItem>
                         ))}
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
             </DropdownMenuSub>

             <DropdownMenuSeparator />
             <DropdownMenuItem onClick={() => onDelete(project.$id)} className="gap-2 text-red-500 cursor-pointer">
                 <Trash2 className="w-4 h-4" /> Delete
             </DropdownMenuItem>
          </DropdownMenuContent>
      </DropdownMenu>
  );
}

// Context Menu cho Các Folder
function FolderContextMenu({ folder, folders, onDelete, onRename, onMove }: any) {
  const otherFolders = (folders || []).filter((f: any) => f.$id !== folder.$id);
  
  return (
      <DropdownMenu>
          <DropdownMenuTrigger asChild>
             <button onClick={e => e.stopPropagation()} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all">
                 <MoreVertical className="w-4 h-4" />
             </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48" onClick={e => e.stopPropagation()}>
             <DropdownMenuItem onClick={() => onRename(folder.$id, folder.name)} className="gap-2 cursor-pointer">
                 <Pencil className="w-4 h-4" /> Rename
             </DropdownMenuItem>
             <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                    <FolderOpen className="w-4 h-4" /> Move to
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                         <DropdownMenuItem onClick={() => onMove(folder.$id, null)} className="gap-2 text-xs cursor-pointer text-zinc-500">
                             Drive Root
                         </DropdownMenuItem>
                         {otherFolders.length > 0 && <DropdownMenuSeparator />}
                         {otherFolders.map((f: any) => (
                             <DropdownMenuItem key={f.$id} onClick={() => onMove(folder.$id, f.$id)} className="gap-2 text-xs cursor-pointer">
                                 {f.name}
                             </DropdownMenuItem>
                         ))}
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
             </DropdownMenuSub>
             <DropdownMenuSeparator />
             <DropdownMenuItem onClick={() => onDelete(folder.$id)} className="gap-2 text-red-500 cursor-pointer">
                 <Trash2 className="w-4 h-4" /> Delete
             </DropdownMenuItem>
          </DropdownMenuContent>
      </DropdownMenu>
  );
}
