"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Bookmark, PlaySquare, Globe,
  Trash2, Music4, ListMusic, ExternalLink, PanelLeftOpen
} from "lucide-react";
import {
  listMyFavorites,
  toggleFavorite,
  getProject,
  getPlaylist,
  FavoriteDocument,
  ProjectDocument,
  PlaylistDocument
} from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { DashboardSidebar } from "@/components/DashboardSidebar";

type EnrichedFavorite = FavoriteDocument & {
  projectDetails?: ProjectDocument;
  playlistDetails?: PlaylistDocument;
};

export default function FavoritesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [favorites, setFavorites] = useState<EnrichedFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unfavoritingId, setUnfavoritingId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!user) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function loadFavorites() {
      try {
        const rawFavorites = await listMyFavorites();
        
        // Enrich concurrently
        const enriched = await Promise.all(
          rawFavorites.map(async (fav) => {
            try {
              if (fav.targetType === "project") {
                const project = await getProject(fav.targetId);
                return { ...fav, projectDetails: project };
              } else if (fav.targetType === "playlist") {
                const playlist = await getPlaylist(fav.targetId);
                return { ...fav, playlistDetails: playlist };
              }
              return fav;
            } catch (err) {
              // If the underlying item was deleted by its owner, the favorite is 'dead'
              return { ...fav };
            }
          })
        );
        
        if (!cancelled) setFavorites(enriched);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to load favorites.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFavorites();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router]);

  const handleUnfavorite = async (e: React.MouseEvent, fav: EnrichedFavorite) => {
    e.preventDefault();
    e.stopPropagation();
    if (unfavoritingId) return;
    
    setUnfavoritingId(fav.$id);
    try {
      await toggleFavorite(fav.targetType, fav.targetId); // Toggles it off
      setFavorites(prev => prev.filter(f => f.$id !== fav.$id));
    } catch {
      setError("Failed to remove favorite.");
    } finally {
      setUnfavoritingId(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-zinc-800 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white flex border-t border-zinc-200 dark:border-zinc-900">
      {/* Sidebar */}
      <DashboardSidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-y-auto py-12 px-6 lg:px-12 relative bg-white dark:bg-zinc-950/30">
        <div className="max-w-5xl mx-auto">
          {/* Mobile sidebar toggle */}
          <button onClick={() => setMobileMenuOpen(true)} className="md:hidden mb-4 flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
            <PanelLeftOpen className="w-5 h-5" /> <span className="text-sm font-medium">Menu</span>
          </button>
          {/* Header Row */}
          <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">My Favorites</h1>
              <p className="text-zinc-500">Bookmarked tracks and collections from the community.</p>
            </div>
          </header>

          {error && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {loading ? (
              <div className="col-span-full py-24 text-center text-zinc-500 font-medium">
                Loading saved items...
              </div>
            ) : favorites.length === 0 ? (
              <div className="col-span-full py-24 text-center">
                <Bookmark className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">No Favorites Yet</h3>
                <p className="text-zinc-500 max-w-sm mx-auto mb-8">
                  Browse the Global Discover feed and hit the bookmark icon to save tracks and playlists here.
                </p>
                <Link href="/discover">
                  <Button variant="outline" className="font-semibold rounded-full bg-white dark:bg-zinc-900">
                    <Globe className="w-4 h-4 mr-2" /> 
                    Explore Discover
                  </Button>
                </Link>
              </div>
            ) : (
              favorites.map((fav) => {
                // If item is dead (author deleted original)
                const isDead = !fav.projectDetails && !fav.playlistDetails;
                
                return (
                  <div 
                    key={fav.$id}
                    onClick={() => {
                        if (isDead) return;
                        if (fav.targetType === "project") router.push(`/p/${fav.targetId}`);
                        if (fav.targetType === "playlist") router.push(`/collection/${fav.targetId}`);
                    }}
                    className={`group relative flex flex-col bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg transition-all ${isDead ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {/* Cover Art Area */}
                    <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center relative overflow-hidden">
                       {fav.targetType === "project" ? (
                           <Music4 className="w-8 h-8 text-zinc-300 dark:text-zinc-600" />
                       ) : (
                           <ListMusic className="w-8 h-8 text-zinc-300 dark:text-zinc-600" />
                       )}
                       
                       <div className="absolute top-2 right-2 flex gap-1 z-10">
                          <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-sm uppercase tracking-wider">
                            {fav.targetType}
                          </span>
                       </div>
                    </div>
                    
                    {/* Content */}
                    <div className="p-4 flex flex-col flex-1">
                      <h3 className="font-bold text-zinc-900 dark:text-white truncate mb-1">
                        {isDead ? "Item Unavailable" : (fav.projectDetails?.name || fav.playlistDetails?.name || "Untitled")}
                      </h3>
                      {fav.targetType === "project" && fav.projectDetails && (
                         <p className="text-xs text-zinc-500 mb-4 truncate uppercase tracking-wider font-semibold">
                            Mode: {fav.projectDetails.mode}
                         </p>
                      )}
                      {fav.targetType === "playlist" && fav.playlistDetails && (
                         <p className="text-xs text-zinc-500 mb-4 truncate">
                            {fav.playlistDetails.projectIds?.length || 0} Tracks
                         </p>
                      )}
                      
                      <div className="mt-auto flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800/80">
                         <span className="text-xs text-zinc-400 font-medium truncate">
                            {isDead ? 'Deleted by author' : 'Added to library'}
                         </span>
                         
                         <Button
                           onClick={(e) => handleUnfavorite(e, fav)}
                           disabled={unfavoritingId === fav.$id}
                           variant="ghost" 
                           size="icon" 
                           className="h-8 w-8 text-rose-500 hover:text-white hover:bg-rose-500"
                           title="Remove from block"
                         >
                           <Trash2 className="w-4 h-4" />
                         </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
