"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import { listPublished, listPublishedPlaylists, copyProjectToMine, toggleFavorite, listMyFavorites, getFileViewUrl, type ProjectDocument, type PlaylistDocument } from "@/lib/appwrite";
import { Play, Bookmark, Music4, Search, SlidersHorizontal, ChevronRight, Pencil, Heart, ListMusic, LayoutGrid, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProjectActionsMenu } from "@/components/ProjectActionsMenu";

function formatDate(iso: string | undefined) {
  if (!iso) return "";
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

export default function DiscoverPage() {
  const router = useRouter();
  const t = useTranslations("Discover");
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectDocument[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistDocument[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [togglingFavId, setTogglingFavId] = useState<string | null>(null);

  const handleCopyToMine = async (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || copyingId) return;
    setCopyingId(projectId);
    setCopyError(null);
    try {
      const doc = await copyProjectToMine(projectId);
      router.push(`/p/${doc.$id}`);
      router.refresh();
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : "Failed to copy project");
    } finally {
      setCopyingId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    
    async function loadData() {
      try {
        const [publishedList, publishedCollections, myFavs] = await Promise.all([
          listPublished(activeTags),
          listPublishedPlaylists(),
          user ? listMyFavorites("project") : Promise.resolve([])
        ]);
        
        if (!cancelled) {
          setProjects(publishedList);
          setPlaylists(publishedCollections);
          const favSet = new Set<string>();
          myFavs.forEach(f => favSet.add(f.targetId));
          setFavoritedIds(favSet);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load published projects");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    
    loadData();
    
    return () => {
      cancelled = true;
    };
  }, [activeTags, user]);

  const handleToggleFavorite = async (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || togglingFavId) return;
    
    setTogglingFavId(projectId);
    
    // Optimistic UI Update
    const isCurrentlyFavorited = favoritedIds.has(projectId);
    setFavoritedIds(prev => {
      const next = new Set(prev);
      if (isCurrentlyFavorited) next.delete(projectId);
      else next.add(projectId);
      return next;
    });

    try {
      const result = await toggleFavorite("project", projectId);
      // Sync strictly to server state just in case of race condition
      setFavoritedIds(prev => {
        const next = new Set(prev);
        if (result) next.add(projectId);
        else next.delete(projectId);
        return next;
      });
    } catch (err) {
      // Revert Optimistic UI on Failure
      setFavoritedIds(prev => {
        const next = new Set(prev);
        if (isCurrentlyFavorited) next.add(projectId);
        else next.delete(projectId);
        return next;
      });
      setError("Failed to sync favorite status");
    } finally {
      setTogglingFavId(null);
    }
  };

  const filteredProjects = projects.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.creatorEmail && p.creatorEmail.toLowerCase().includes(q)) ||
      (p.tags && p.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });

  return (
    <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white relative flex flex-col items-center pt-8 pb-32 px-6">
      <div className="w-full max-w-[1200px] z-10 relative">
        
        {/* Search Bar Area */}
        <header className="mb-12 flex justify-center w-full">
          <div className="flex items-center gap-4 w-full max-w-2xl">
            <div className="relative w-full">
              <Input 
                placeholder={t("searchPlaceholder")} 
                className="w-full h-[52px] pl-6 pr-14 bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-white/5 focus-visible:ring-[#C8A856]/50 rounded-full text-[15px] text-zinc-900 dark:text-white placeholder:text-zinc-500 shadow-inner shadow-black/5 dark:shadow-black/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 w-[36px] h-[36px] bg-[#C8A856] hover:bg-[#d4b566] transition-colors rounded-full flex items-center justify-center text-black shadow-md focus:outline-none">
                <Search className="w-[18px] h-[18px]" />
              </button>
            </div>
            
            <button className="w-[52px] h-[52px] shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-white/5 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors focus:outline-none">
              <SlidersHorizontal className="w-[20px] h-[20px]" />
            </button>
          </div>
        </header>

        {/* Quick Filter Groups */}
        <div className="flex flex-col gap-6 pb-6 mb-8 w-full border-b border-zinc-200 dark:border-white/5">
          {/* General Row */}
          <div className="flex items-start gap-4 w-full">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest shrink-0 w-[100px] mt-2">
              {t("filters")}
            </span>
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <button
                onClick={() => setActiveTags([])}
                className={`px-5 py-2 whitespace-nowrap rounded-full text-[13px] font-bold transition-all duration-300 flex items-center gap-2 ${
                  activeTags.length === 0
                    ? "bg-[#C8A856] text-black shadow-[0_0_15px_rgba(200,168,86,0.3)] border border-transparent"
                    : "bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800/70"
                }`}
              >
                {t("allTracks")}
              </button>
            </div>
          </div>

          {/* Category Rows */}
          {Object.entries(TAG_GROUPS).map(([groupName, tags]) => (
            <div key={groupName} className="flex items-start gap-4 w-full">
              <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest shrink-0 w-[100px] mt-2">
                {groupName}
              </span>
              <div className="flex flex-wrap items-center gap-2 flex-1">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                    className={`px-4 py-1.5 whitespace-nowrap rounded-full text-[13px] font-semibold transition-all duration-300 flex items-center gap-2 ${
                      activeTags.includes(tag)
                        ? "bg-[#C8A856] text-black shadow-[0_0_15px_rgba(200,168,86,0.2)] border border-transparent"
                        : "bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800/70"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-950/50 border border-red-900 rounded-xl text-red-400 text-center backdrop-blur-sm">
            {error}
          </div>
        )}
        {copyError && (
          <div className="mb-8 p-4 bg-red-950/50 border border-red-900 rounded-xl text-red-400 text-center backdrop-blur-sm">
            {copyError}
          </div>
        )}


        {/* Featured Collections Section */}
        {(!loading && playlists.length > 0 && !searchQuery) && (
           <div className="mb-12">
             <div className="w-full flex items-center justify-between mb-6">
                <h2 className="text-[22px] font-bold text-zinc-900 dark:text-white tracking-tight">Featured Collections</h2>
                <button className="text-[13px] font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors flex items-center gap-1">
                  See All <ChevronRight className="w-4 h-4" />
                </button>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
               {playlists.slice(0, 3).map((pl) => (
                  <Link href={`/collection/${pl.$id}`} key={pl.$id} className="block group">
                     <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 hover:border-zinc-300 dark:hover:border-white/20 transition-all duration-300 transform-gpu isolate">
                        <div className="h-40 bg-zinc-100 dark:bg-black/50 relative overflow-hidden rounded-t-[15px] flex items-center justify-center p-6 border-b border-zinc-200 dark:border-white/5 z-0">
                           {pl.coverImageId ? (
                             <img src={getFileViewUrl(pl.coverImageId).toString()} alt="cover" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 border-0" />
                           ) : (
                             <LayoutGrid className="w-16 h-16 text-zinc-300 dark:text-zinc-700 opacity-50 transition-transform duration-500 group-hover:scale-110" />
                           )}
                           <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 pointer-events-none mix-blend-overlay"></div>
                           <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider text-white flex items-center gap-1.5 border border-white/10 shadow-lg">
                              <Globe className="w-3 h-3 text-blue-400" /> {t("publicBadge")}
                           </div>
                        </div>
                        <div className="p-5">
                           <div className="flex items-center gap-2 text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2">
                             <ListMusic className="w-3.5 h-3.5" /> {t("curatedPlaylist")}
                           </div>
                           <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 leading-tight group-hover:text-blue-500 transition-colors truncate">
                              {pl.name}
                           </h3>
                           <p className="text-xs text-zinc-500 font-medium">
                              By User {pl.ownerId.substring(0,6)} • {pl.projectIds?.length || 0} Tracks
                           </p>
                        </div>
                     </div>
                  </Link>
               ))}
             </div>
           </div>
        )}

        {/* Featured Section Header */}
        <div className="w-full flex items-center justify-between mb-6 mt-4">
          <h2 className="text-[22px] font-bold text-zinc-900 dark:text-white tracking-tight">{t("interactiveScores")}</h2>
          <button className="text-[13px] font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors flex items-center gap-1">
            {t("seeAll")} <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <div className="w-8 h-8 border-2 border-zinc-800 border-t-[#C8A856] rounded-full animate-spin"></div>
            <p className="text-zinc-500 text-sm font-medium">{t("loadingScores")}</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-20 border border-zinc-200 dark:border-white/5 rounded-3xl bg-zinc-50 dark:bg-zinc-900/20">
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              {t("noProjects")}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProjects.map((p) => {
              const isEasy = p.tags?.includes("Beginner");
              const isIntermediate = p.tags?.includes("Intermediate");
              const isAdvanced = p.tags?.includes("Advanced");
              
              let badgeColor = "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400";
              let badgeText = "";
              if (isEasy) { badgeColor = "bg-[#d4eddb] dark:bg-[#2E5E3D] text-[#2d6a4f] dark:text-[#84E1A6]"; badgeText = "Easy"; }
              else if (isIntermediate) { badgeColor = "bg-[#d0eaf9] dark:bg-[#1E4D6B] text-[#023e8a] dark:text-[#71BCE8]"; badgeText = "Intermediate"; }
              else if (isAdvanced) { badgeColor = "bg-[#fcdede] dark:bg-[#6A2B2B] text-[#9b2226] dark:text-[#FCA6A6]"; badgeText = "Advanced"; }

              const instrumentTags = p.tags?.filter(t => !["Beginner", "Advanced", "Intermediate"].includes(t)) || [];
              const displayTags = instrumentTags.slice(0, 2);
              const remainingCount = instrumentTags.length - 2;

              return (
              <li 
                key={p.$id} 
                className="group bg-white dark:bg-[#1A1A1E] border border-white/5 rounded-[20px] transition-all duration-300 flex flex-col hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50 relative"
              >
                <Link href={`/play/${p.$id}`} className="absolute inset-0 z-0 rounded-[20px]" aria-label={`Play ${p.name}`}></Link>
                <div className="p-4 flex-1 flex flex-col relative w-full pointer-events-none">
                  
                  {/* Inner Image Container */}
                  <div className="relative w-full aspect-[4/3] rounded-[14px] overflow-hidden mb-5 bg-white shadow-inner flex items-center justify-center">
                    {p.coverUrl ? (
                      <img
                        src={p.coverUrl}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-50 relative p-4 flex flex-col border border-zinc-200 shadow-sm">
                         {/* Faux Sheet Music UI overlay */}
                         <div className="w-full h-1 bg-black mb-2 opacity-10"></div>
                         <div className="w-full h-1 bg-black mb-2 opacity-10"></div>
                         <div className="w-full h-1 bg-black mb-2 opacity-10"></div>
                         <div className="w-full h-1 bg-black mb-2 opacity-10"></div>
                         <div className="w-full h-1 bg-black mb-6 opacity-10"></div>
                         <div className="w-full text-center text-black font-serif font-bold text-lg opacity-80 line-clamp-1">{p.name}</div>
                         <div className="w-full font-serif text-right text-black text-[10px] opacity-60 line-clamp-1">{p.creatorEmail?.split('@')[0] || "Unknown"}</div>
                      </div>
                    )}
                  </div>
                  
                  {/* Meta Details */}
                  <h2 className="text-[17px] font-bold text-zinc-900 dark:text-zinc-100 mb-1 line-clamp-1">
                    {p.name}
                  </h2>
                  <p className="text-[14px] text-zinc-400 line-clamp-1 mb-4">
                    {p.creatorEmail ? p.creatorEmail.split('@')[0] : t('communityComposer')}
                  </p>
                  
                  {/* Instruments & Badge */}
                  <div className="flex items-start justify-between mb-4 gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap flex-1">
                      {displayTags.length > 0 ? displayTags.map(tag => (
                        <span key={tag} className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded border border-zinc-200 dark:border-zinc-700/50 tracking-wider">
                          {tag}
                        </span>
                      )) : (
                        <span className="text-[12px] text-zinc-400 dark:text-zinc-600 font-medium">{t("noTags")}</span>
                      )}
                      {remainingCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded">
                          +{remainingCount}
                        </span>
                      )}
                    </div>
                    {badgeText && (
                      <span className={`px-2 py-[2px] rounded-md text-[11px] font-bold uppercase tracking-wider shrink-0 mt-0.5 ${badgeColor}`}>
                        {badgeText}
                      </span>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-px bg-white/5 mb-4 pointer-events-none"></div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end w-full px-4 pb-4 relative z-10">
                  <div className="flex items-center gap-1.5">
                    <ProjectActionsMenu projectId={p.$id} hideFavorite={true} />
                    {user && (
                      <button 
                        onClick={(e) => handleToggleFavorite(e, p.$id)}
                        disabled={togglingFavId === p.$id}
                        title={favoritedIds.has(p.$id) ? t("removeFavorite") : t("addFavorite")}
                        className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                          favoritedIds.has(p.$id) 
                            ? "text-rose-500 bg-rose-500/10 hover:bg-rose-500/20" 
                            : "text-zinc-500 dark:text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-white/5"
                        }`}
                      >
                         <Heart className={`w-[18px] h-[18px] transition-all ${favoritedIds.has(p.$id) ? 'fill-current scale-110' : ''}`} />
                      </button>
                    )}
                    {user && user.$id === p.userId && (
                      <>
                        <Link href={`/p/${p.$id}`}>
                          <button 
                            className="w-9 h-9 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-[#C8A856] dark:hover:text-[#C8A856] hover:bg-zinc-100 dark:hover:bg-white/5 rounded-full transition-colors"
                            title="Edit Project"
                          >
                            <Pencil className="w-[16px] h-[16px]" />
                          </button>
                        </Link>
                        <button 
                          className="w-9 h-9 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 rounded-full transition-colors"
                          onClick={(e) => handleCopyToMine(e, p.$id)}
                          disabled={copyingId === p.$id}
                          title="Duplicate Project (Owner Only)"
                        >
                           <Bookmark className="w-[18px] h-[18px]" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
