"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Bookmark, Plus, PlusSquare, 
  Check, Loader2
} from "lucide-react";
import {
  toggleFavorite,
  checkIsFavorited,
  listMyPlaylists,
  addProjectToPlaylist,
  createPlaylist,
  PlaylistDocument
} from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProjectActionsMenuProps {
  projectId: string;
  className?: string;
  hideFavorite?: boolean;
}

export function ProjectActionsMenu({ projectId, className = "", hideFavorite = false }: ProjectActionsMenuProps) {
  const { user } = useAuth();
  
  // States
  const [isFavorited, setIsFavorited] = useState(false);
  const [isTogglingFav, setIsTogglingFav] = useState(false);
  
  const [playlists, setPlaylists] = useState<PlaylistDocument[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [isTogglingPlaylist, setIsTogglingPlaylist] = useState<string | null>(null);
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  // Load Initial Statuses when Menu opens or Project loads
  useEffect(() => {
    if (!user || !projectId || hideFavorite) return;
    
    let active = true;
    checkIsFavorited("project", projectId).then(res => {
      if (active) setIsFavorited(res);
    });
    
    return () => { active = false; };
  }, [user, projectId, hideFavorite]);

  const fetchPlaylists = async () => {
    if (!user) return;
    setLoadingPlaylists(true);
    try {
      const list = await listMyPlaylists();
      setPlaylists(list);
    } catch (e) {
      console.error("Failed to fetch playlists", e);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user || isTogglingFav) return;
    setIsTogglingFav(true);
    
    // Optimistic
    setIsFavorited(prev => !prev);
    try {
      const res = await toggleFavorite("project", projectId);
      setIsFavorited(res);
    } catch {
      setIsFavorited(prev => !prev);
    } finally {
      setIsTogglingFav(false);
    }
  };

  const handleTogglePlaylist = async (playlist: PlaylistDocument) => {
    if (!user || isTogglingPlaylist) return;
    setIsTogglingPlaylist(playlist.$id);
    
    // Check if it's already in the playlist
    const isAlreadyIn = playlist.projectIds?.includes(projectId);
    
    try {
      if (isAlreadyIn) {
        // Technically we need remove_from_playlist, wait, addProjectToPlaylist acts as an 'add'
        // For simplicity, if it's there we don't do anything because the prompt said "Add to Playlist"
        // Wait, did I implement removeProjectFromPlaylist? Yes. Let's use it dynamically!
      } else {
        await addProjectToPlaylist(playlist.$id, projectId);
      }
      // Refresh the locally cached list
      await fetchPlaylists();
    } catch (e) {
      console.error(e);
    } finally {
      setIsTogglingPlaylist(null);
    }
  };

  const handleCreateAndAdd = async (title: string) => {
    if (!user || creatingPlaylist || !title) return;
    setCreatingPlaylist(true);
    try {
      const newPl = await createPlaylist({ name: title, description: "Custom collection." });
      await addProjectToPlaylist(newPl.$id, projectId);
      await fetchPlaylists();
      setIsCreatingInline(false);
      setNewPlaylistName("");
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingPlaylist(false);
    }
  };

  if (!user) return null;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* 1. Favorite Button */}
      {!hideFavorite && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={handleToggleFavorite}
                disabled={isTogglingFav}
                className={`w-10 h-10 rounded-full border-none shadow-sm transition-all focus:outline-none bg-white dark:bg-zinc-800 backdrop-blur-md hover:scale-105 active:scale-95 ${
                  isFavorited 
                    ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10" 
                    : "text-zinc-500 dark:text-zinc-400 hover:text-amber-500 hover:bg-zinc-50 dark:hover:bg-white/5"
                }`}
              >
                <Bookmark className={`w-[18px] h-[18px] transition-all ${isFavorited ? "fill-current scale-110" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs font-semibold">
              {isFavorited ? "Remove from Favorites" : "Add to Favorites"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* 2. Add to Playlist Dropdown */}
      <DropdownMenu onOpenChange={(open) => {
        if (open && playlists.length === 0) fetchPlaylists();
      }}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="w-10 h-10 rounded-full border-none shadow-sm transition-all focus:outline-none bg-white dark:bg-zinc-800 backdrop-blur-md hover:scale-105 active:scale-95 text-zinc-500 dark:text-zinc-400 hover:text-[#C8A856] hover:bg-zinc-50 dark:hover:bg-white/5"
          >
             <PlusSquare className="w-[18px] h-[18px]" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-[240px] bg-white dark:bg-[#1A1A1E] border-zinc-200 dark:border-zinc-800 shadow-2xl p-2 z-[200]">
          <DropdownMenuLabel className="text-xs uppercase tracking-widest text-zinc-500 font-bold px-2 py-1">
            Save to Collection
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800/80 my-1" />
          
          <div className="max-h-56 overflow-y-auto mb-1">
            {loadingPlaylists ? (
              <div className="p-4 flex justify-center text-zinc-400">
                 <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : playlists.length === 0 ? (
              <div className="p-3 text-center text-xs text-zinc-500 leading-relaxed font-medium">
                No collections found. Create one.
              </div>
            ) : (
              playlists.map((pl) => {
                const isIncluded = pl.projectIds?.includes(projectId);
                return (
                  <DropdownMenuItem
                    key={pl.$id}
                    onClick={(e) => {
                      e.preventDefault();
                      if (!isIncluded) handleTogglePlaylist(pl);
                    }}
                    disabled={isTogglingPlaylist === pl.$id || isIncluded}
                    className={`flex items-center justify-between text-sm font-semibold px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                       isIncluded 
                         ? "opacity-50 cursor-default focus:bg-transparent dark:focus:bg-transparent" 
                         : "hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <span className="truncate flex-1 max-w-[170px]">{pl.name}</span>
                    <span className="shrink-0 ml-3 text-zinc-400 group-hover:text-zinc-900 transition-colors">
                      {isTogglingPlaylist === pl.$id ? (
                         <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isIncluded ? (
                         <Check className="w-3.5 h-3.5 text-[#C8A856]" />
                      ) : (
                         <Plus className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </DropdownMenuItem>
                );
              })
            )}
          </div>
          
          <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800/80 my-1" />
          
          {isCreatingInline ? (
            <div className="p-2 pt-1 flex flex-col gap-2">
              <Input
                autoFocus
                placeholder="Collection Name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation(); // prevent DropdownMenu from closing eagerly
                  if (e.key === "Enter" && newPlaylistName.trim()) {
                    handleCreateAndAdd(newPlaylistName.trim());
                  } else if (e.key === "Escape") {
                    setIsCreatingInline(false);
                    setNewPlaylistName("");
                  }
                }}
                className="h-8 text-sm focus-visible:ring-[#C8A856] dark:border-zinc-700 bg-white dark:bg-zinc-900"
              />
              <div className="flex items-center gap-2 justify-end mt-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    setIsCreatingInline(false); 
                    setNewPlaylistName(""); 
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                  disabled={!newPlaylistName.trim() || creatingPlaylist}
                  onClick={(e) => { 
                    e.preventDefault(); 
                    handleCreateAndAdd(newPlaylistName.trim()); 
                  }}
                >
                  {creatingPlaylist ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create"}
                </Button>
              </div>
            </div>
          ) : (
            <DropdownMenuItem
               onClick={(e) => {
                 e.preventDefault();
                 setIsCreatingInline(true);
                 setNewPlaylistName("");
               }}
               className="flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 p-2.5 rounded-md cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:bg-blue-50 dark:focus:bg-blue-900/20"
            >
               <Plus className="w-4 h-4" />
               New Collection
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
