"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import { useDebounce } from "@/hooks/useDebounce";
import { listPublished, listPublishedPlaylists, copyProjectToMine, toggleFavorite, listMyFavorites, getFileViewUrl, type ProjectDocument, type PlaylistDocument } from "@/lib/appwrite";
import { listInstruments } from "@/lib/appwrite/instruments";
import { listGenres } from "@/lib/appwrite/genres";
import type { InstrumentDocument, GenreDocument } from "@/lib/appwrite/types";
import { Play, Bookmark, Music4, Search, Pencil, ListMusic, ArrowUpDown, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProjectActionsMenu } from "@/components/ProjectActionsMenu";
import { ReportButton } from "@/components/ReportButton";
import { getArtistNamesByIds } from "@/lib/appwrite/artists";

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

const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced"];

export default function DiscoverPage() {
  const router = useRouter();
  const t = useTranslations("Discover");
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectDocument[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistDocument[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 400);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [togglingFavId, setTogglingFavId] = useState<string | null>(null);
  // Wiki-based filter state (Phase 2.5)
  const [wikiInstruments, setWikiInstruments] = useState<InstrumentDocument[]>([]);
  const [wikiGenres, setWikiGenres] = useState<GenreDocument[]>([]);
  const [activeInstrumentIds, setActiveInstrumentIds] = useState<string[]>([]);
  const [activeGenreId, setActiveGenreId] = useState<string | undefined>();
  const [activeDifficulty, setActiveDifficulty] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"newest" | "az" | "oldest" | "popular">("newest");
  const [composerNames, setComposerNames] = useState<Map<string, string>>(new Map());
  const [visibleCount, setVisibleCount] = useState(12);

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
        const wikiFilters = {
          ...(activeGenreId ? { genreId: activeGenreId } : {}),
          ...(activeInstrumentIds.length ? { instrumentIds: activeInstrumentIds } : {}),
        };
        const [publishedList, publishedCollections, myFavs] = await Promise.all([
          listPublished(activeDifficulty.length ? activeDifficulty : undefined, undefined, Object.keys(wikiFilters).length ? wikiFilters : undefined, debouncedSearchQuery),
          listPublishedPlaylists(),
          user ? listMyFavorites("project") : Promise.resolve([])
        ]);
        
        if (!cancelled) {
          setProjects(publishedList);
          setPlaylists(publishedCollections);
          const favSet = new Set<string>();
          myFavs.forEach(f => favSet.add(f.targetId));
          setFavoritedIds(favSet);
          
          // Batch-resolve composer names from wiki
          const allComposerIds = publishedList.flatMap(p => p.wikiComposerIds || []);
          if (allComposerIds.length > 0) {
            getArtistNamesByIds(allComposerIds).then(setComposerNames).catch(() => {});
          }
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
  }, [activeDifficulty, activeGenreId, activeInstrumentIds, user, debouncedSearchQuery]);

  // Load wiki data for filter pills
  useEffect(() => {
    Promise.all([listInstruments(100), listGenres(100)]).then(([insts, gens]) => {
      setWikiInstruments(insts);
      setWikiGenres(gens);
    }).catch(() => {});
  }, []);

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

  // Helper: get composer display name for a project
  const getComposerName = (p: ProjectDocument) => {
    if (p.wikiComposerIds?.length) {
      const names = p.wikiComposerIds.map(id => composerNames.get(id)).filter(Boolean);
      if (names.length) return names.join(", ");
    }
    return p.creatorEmail ? p.creatorEmail.split('@')[0] : t('communityComposer');
  };

  const filteredProjects = [...projects].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime();
      case "oldest":
        return new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime();
      case "az":
        return a.name.localeCompare(b.name);
      case "popular":
        return (b.playCount ?? 0) - (a.playCount ?? 0);
      default:
        return 0;
    }
  });

  // Reset to first page when search/sort changes
  useEffect(() => {
    setVisibleCount(12);
  }, [debouncedSearchQuery, sortBy, activeDifficulty, activeGenreId, activeInstrumentIds]);

  return (
    <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white relative flex flex-col items-center pt-8 pb-32 px-6">
      <div className="w-full max-w-[1200px] z-10 relative">
        
        {/* Search Bar Area */}
        <header className="mb-12 flex justify-center w-full">
          <div className="relative w-full max-w-2xl">
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
        </header>

        {/* Quick Filter Groups */}
        <div className="flex flex-col gap-6 pb-6 mb-8 w-full border-b border-zinc-200 dark:border-white/5">
          {/* General Row */}
          <div className="flex items-start gap-4 w-full">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest shrink-0 w-[100px] mt-2 hidden sm:inline-block">
              {t("filters")}
            </span>
            <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-none pb-1">
              <button
                onClick={() => { setActiveTags([]); setActiveInstrumentIds([]); setActiveGenreId(undefined); setActiveDifficulty([]); }}
                className={`px-5 py-2 whitespace-nowrap rounded-full text-[13px] font-bold transition-all duration-300 flex items-center gap-2 ${
                  activeTags.length === 0 && activeInstrumentIds.length === 0 && !activeGenreId && activeDifficulty.length === 0
                    ? "bg-[#C8A856] text-black shadow-[0_0_15px_rgba(200,168,86,0.3)] border border-transparent"
                    : "bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800/70"
                }`}
              >
                {t("allTracks")}
              </button>
            </div>
          </div>

          {/* Instruments Row (from wiki) */}
          {wikiInstruments.length > 0 && (
            <div className="flex items-start gap-4 w-full">
              <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest shrink-0 w-[100px] mt-2 hidden sm:inline-block">
                Instruments
              </span>
              <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-none pb-1">
                {wikiInstruments.map((inst) => (
                  <button
                    key={inst.$id}
                    onClick={() => setActiveInstrumentIds(prev => prev.includes(inst.$id) ? prev.filter(id => id !== inst.$id) : [...prev, inst.$id])}
                    className={`px-4 py-1.5 whitespace-nowrap rounded-full text-[13px] font-semibold transition-all duration-300 flex items-center gap-2 ${
                      activeInstrumentIds.includes(inst.$id)
                        ? "bg-[#C8A856] text-black shadow-[0_0_15px_rgba(200,168,86,0.2)] border border-transparent"
                        : "bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800/70"
                    }`}
                  >
                    {inst.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Genres Row (from wiki) */}
          {wikiGenres.length > 0 && (
            <div className="flex items-start gap-4 w-full">
              <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest shrink-0 w-[100px] mt-2 hidden sm:inline-block">
                Genres
              </span>
              <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-none pb-1">
                {wikiGenres.map((genre) => (
                  <button
                    key={genre.$id}
                    onClick={() => setActiveGenreId(prev => prev === genre.$id ? undefined : genre.$id)}
                    className={`px-4 py-1.5 whitespace-nowrap rounded-full text-[13px] font-semibold transition-all duration-300 flex items-center gap-2 ${
                      activeGenreId === genre.$id
                        ? "bg-[#C8A856] text-black shadow-[0_0_15px_rgba(200,168,86,0.2)] border border-transparent"
                        : "bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800/70"
                    }`}
                  >
                    {genre.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Difficulty Row */}
          <div className="flex items-start gap-4 w-full">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest shrink-0 w-[100px] mt-2 hidden sm:inline-block">
              Difficulty
            </span>
            <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-none pb-1">
              {DIFFICULTY_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveDifficulty(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                  className={`px-4 py-1.5 whitespace-nowrap rounded-full text-[13px] font-semibold transition-all duration-300 flex items-center gap-2 ${
                    activeDifficulty.includes(tag)
                      ? "bg-[#C8A856] text-black shadow-[0_0_15px_rgba(200,168,86,0.2)] border border-transparent"
                      : "bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800/70"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
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


        {/* Collections Section */}
        {(!loading && playlists.length > 0 && !searchQuery) && (
           <div className="mb-12">
             <div className="w-full flex items-center justify-between mb-6">
                <h2 className="text-[22px] font-bold text-zinc-900 dark:text-white tracking-tight">
                  Collections
                  <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500 ml-2">({playlists.length})</span>
                </h2>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
               {playlists.map((pl) => (
                  <Link href={`/collection/${pl.$id}`} key={pl.$id} className="block group">
                     <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 hover:border-zinc-300 dark:hover:border-white/20 transition-all duration-300 transform-gpu isolate">
                        <div className="h-40 relative overflow-hidden rounded-t-[15px] flex items-center justify-center border-b border-zinc-200 dark:border-white/5 z-0"
                          style={{
                            background: pl.coverImageId ? undefined : `linear-gradient(135deg, hsl(${(pl.name.length * 53 + (pl.name.charCodeAt(0) || 0) * 17) % 360}, 50%, 30%), hsl(${(pl.name.length * 53 + (pl.name.charCodeAt(0) || 0) * 17 + 80) % 360}, 55%, 22%))`,
                          }}
                        >
                           {pl.coverImageId ? (
                             <img src={getFileViewUrl(pl.coverImageId).toString()} alt="cover" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 border-0" />
                           ) : (
                             <div className="flex flex-col items-center gap-2">
                               <ListMusic className="w-12 h-12 text-white/25" />
                               <span className="text-white/50 text-xs font-bold uppercase tracking-widest">{pl.projectIds?.length || 0} Tracks</span>
                             </div>
                           )}
                           <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 pointer-events-none mix-blend-overlay"></div>
                        </div>
                        <div className="p-5">
                           <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 leading-tight group-hover:text-blue-500 transition-colors truncate">
                              {pl.name}
                           </h3>
                           <p className="text-xs text-zinc-500 font-medium">
                              {pl.projectIds?.length || 0} Tracks
                           </p>
                        </div>
                     </div>
                  </Link>
               ))}
             </div>
           </div>
        )}

        {/* All Scores Header */}
        <div className="w-full flex items-center justify-between mb-6 mt-4">
          <h2 className="text-[22px] font-bold text-zinc-900 dark:text-white tracking-tight">
            {t("interactiveScores")}
            {!loading && <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500 ml-2">({filteredProjects.length})</span>}
          </h2>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-zinc-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-sm font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer focus:outline-none appearance-none pr-1"
            >
              <option value="newest">Newest</option>
              <option value="popular">Most Played</option>
              <option value="az">A → Z</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
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
          <>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProjects.slice(0, visibleCount).map((p) => {
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
                      <div className="w-full h-full relative flex flex-col items-center justify-center p-6"
                        style={{
                          background: `linear-gradient(135deg, hsl(${(p.name.length * 47 + (p.name.charCodeAt(0) || 0) * 13) % 360}, 45%, 35%), hsl(${(p.name.length * 47 + (p.name.charCodeAt(0) || 0) * 13 + 60) % 360}, 50%, 25%))`,
                        }}
                      >
                        <Music4 className="w-10 h-10 text-white/20 mb-3" />
                        <div className="text-center text-white font-serif font-bold text-lg leading-tight line-clamp-2 drop-shadow-lg">{p.name}</div>
                        <div className="text-white/60 text-xs font-medium mt-1.5 line-clamp-1">{getComposerName(p)}</div>
                      </div>
                    )}
                  </div>
                  
                  {/* Meta Details */}
                  <h2 className="text-[17px] font-bold text-zinc-900 dark:text-zinc-100 mb-1 line-clamp-1">
                    {p.name}
                  </h2>
                  <p className="text-[14px] text-zinc-400 line-clamp-1 mb-4">
                    {getComposerName(p)}
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
                <div className="flex items-center justify-between w-full px-4 pb-4 relative z-10">
                  <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
                    {(p.playCount ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold">
                        <Play className="w-3 h-3 fill-current" />
                        {(p.playCount ?? 0).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ProjectActionsMenu projectId={p.$id} hideFavorite={true} />
                    {user && (
                      <button 
                        onClick={(e) => handleToggleFavorite(e, p.$id)}
                        disabled={togglingFavId === p.$id}
                        title={favoritedIds.has(p.$id) ? t("removeFavorite") : t("addFavorite")}
                        className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                          favoritedIds.has(p.$id) 
                            ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20" 
                            : "text-zinc-500 dark:text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-white/5"
                        }`}
                      >
                         <Bookmark className={`w-[18px] h-[18px] transition-all ${favoritedIds.has(p.$id) ? 'fill-current scale-110' : ''}`} />
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
                    {user && user.$id !== p.userId && (
                      <ReportButton targetType="project" targetId={p.$id} />
                    )}
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
          {filteredProjects.length > visibleCount && (
            <div className="flex justify-center mt-10">
              <button
                onClick={() => setVisibleCount(prev => prev + 12)}
                className="px-8 py-3 rounded-full bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-white/10 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Load More ({filteredProjects.length - visibleCount} remaining)
              </button>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
