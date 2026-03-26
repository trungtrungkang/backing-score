"use client";

import { useEffect, useState, useMemo } from "react";
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import { useDebounce } from "@/hooks/useDebounce";
import {
  listPublished,
  listPublishedPlaylists,
  listFeatured,
  listRecentlyPublished,
  listTrending,
  listMostFavorited,
  copyProjectToMine,
  toggleFavorite,
  listMyFavorites,
  getFileViewUrl,
  type ProjectDocument,
  type PlaylistDocument,
} from "@/lib/appwrite";
import { listInstruments } from "@/lib/appwrite/instruments";
import { listGenres } from "@/lib/appwrite/genres";
import type { InstrumentDocument, GenreDocument } from "@/lib/appwrite/types";
import {
  Play,
  Bookmark,
  Music4,
  Search,
  Pencil,
  ListMusic,
  ArrowUpDown,
  Star,
  Clock,
  Flame,
  Heart,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProjectActionsMenu } from "@/components/ProjectActionsMenu";
import { ReportButton } from "@/components/ReportButton";
import { getArtistNamesByIds } from "@/lib/appwrite/artists";
import { HorizontalScroll } from "@/components/HorizontalScroll";

const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced"];

// ==========================================
// Score Card Component (reusable across sections)
// ==========================================
function ScoreCard({
  project,
  composerName,
  isFavorited,
  onToggleFavorite,
  togglingFavId,
  user,
  variant = "default",
}: {
  project: ProjectDocument;
  composerName: string;
  isFavorited: boolean;
  onToggleFavorite: (e: React.MouseEvent, id: string) => void;
  togglingFavId: string | null;
  user: any;
  variant?: "default" | "featured";
}) {
  const t = useTranslations("Discover");

  const isEasy = project.tags?.includes("Beginner");
  const isIntermediate = project.tags?.includes("Intermediate");
  const isAdvanced = project.tags?.includes("Advanced");

  let badgeColor =
    "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400";
  let badgeText = "";
  if (isEasy) {
    badgeColor =
      "bg-[#d4eddb] dark:bg-[#2E5E3D] text-[#2d6a4f] dark:text-[#84E1A6]";
    badgeText = "Easy";
  } else if (isIntermediate) {
    badgeColor =
      "bg-[#d0eaf9] dark:bg-[#1E4D6B] text-[#023e8a] dark:text-[#71BCE8]";
    badgeText = "Intermediate";
  } else if (isAdvanced) {
    badgeColor =
      "bg-[#fcdede] dark:bg-[#6A2B2B] text-[#9b2226] dark:text-[#FCA6A6]";
    badgeText = "Advanced";
  }

  const width = variant === "featured" ? "w-[280px] sm:w-[320px]" : "w-[220px] sm:w-[260px]";

  return (
    <div
      className={`${width} shrink-0 snap-start group bg-white dark:bg-[#1A1A1E] border border-zinc-200 dark:border-white/5 rounded-[20px] transition-all duration-300 flex flex-col hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/20 relative`}
    >
      <Link
        href={`/play/${project.$id}`}
        className="absolute inset-0 z-0 rounded-[20px]"
        aria-label={`Play ${project.name}`}
      />
      <div className="p-4 flex-1 flex flex-col relative w-full pointer-events-none">
        {/* Image */}
        <div className={`relative w-full ${variant === "featured" ? "aspect-[3/2]" : "aspect-[4/3]"} rounded-[14px] overflow-hidden mb-4 bg-white shadow-inner flex items-center justify-center`}>
          {project.coverUrl ? (
            <img
              src={project.coverUrl}
              alt={project.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            />
          ) : (
            <div
              className="w-full h-full relative flex flex-col items-center justify-center p-6"
              style={{
                background: `linear-gradient(135deg, hsl(${(project.name.length * 47 + (project.name.charCodeAt(0) || 0) * 13) % 360}, 45%, 35%), hsl(${(project.name.length * 47 + (project.name.charCodeAt(0) || 0) * 13 + 60) % 360}, 50%, 25%))`,
              }}
            >
              <Music4 className="w-10 h-10 text-white/20 mb-3" />
              <div className="text-center text-white font-serif font-bold text-lg leading-tight line-clamp-2 drop-shadow-lg">
                {project.name}
              </div>
              <div className="text-white/60 text-xs font-medium mt-1.5 line-clamp-1">
                {composerName}
              </div>
            </div>
          )}
          {/* Featured badge */}
          {project.featured && variant === "featured" && (
            <div className="absolute top-2 left-2 bg-amber-500 text-black text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
              <Star className="w-3 h-3 fill-current" /> Featured
            </div>
          )}
        </div>

        {/* Title & Composer */}
        <h2 className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100 mb-0.5 line-clamp-1">
          {project.name}
        </h2>
        <p className="text-[13px] text-zinc-400 line-clamp-1 mb-3">
          {composerName}
        </p>

        {/* Difficulty badge */}
        {badgeText && (
          <span
            className={`self-start px-2 py-[2px] rounded-md text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}
          >
            {badgeText}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="w-full h-px bg-zinc-100 dark:bg-white/5 pointer-events-none" />
      <div className="flex items-center justify-between w-full px-4 py-3 relative z-10">
        <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
          {(project.playCount ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-semibold">
              <Play className="w-3 h-3 fill-current" />
              {(project.playCount ?? 0).toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <ProjectActionsMenu projectId={project.$id} hideFavorite={true} />
          {user && (
            <button
              onClick={(e) => onToggleFavorite(e, project.$id)}
              disabled={togglingFavId === project.$id}
              title={
                isFavorited ? t("removeFavorite") : t("addFavorite")
              }
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                isFavorited
                  ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-white/5"
              }`}
            >
              <Bookmark
                className={`w-4 h-4 transition-all ${isFavorited ? "fill-current scale-110" : ""}`}
              />
            </button>
          )}
          {user && user.$id !== project.userId && (
            <ReportButton targetType="project" targetId={project.$id} />
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Section Header Component
// ==========================================
function SectionHeader({
  icon,
  title,
  count,
  iconColor = "text-zinc-500",
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-[20px] font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2.5">
        <span className={iconColor}>{icon}</span>
        {title}
        {count !== undefined && count > 0 && (
          <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500">
            ({count})
          </span>
        )}
      </h2>
    </div>
  );
}

// ==========================================
// Discover Page
// ==========================================
export default function DiscoverPage() {
  const router = useRouter();
  const t = useTranslations("Discover");
  const { user } = useAuth();

  // Section data
  const [featuredProjects, setFeaturedProjects] = useState<ProjectDocument[]>([]);
  const [recentProjects, setRecentProjects] = useState<ProjectDocument[]>([]);
  const [trendingProjects, setTrendingProjects] = useState<ProjectDocument[]>([]);
  const [favoritedProjects, setFavoritedProjects] = useState<ProjectDocument[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistDocument[]>([]);

  // All scores (filter/search section)
  const [allProjects, setAllProjects] = useState<ProjectDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 400);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Favorites state
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [togglingFavId, setTogglingFavId] = useState<string | null>(null);

  // Filter state
  const [wikiInstruments, setWikiInstruments] = useState<InstrumentDocument[]>([]);
  const [wikiGenres, setWikiGenres] = useState<GenreDocument[]>([]);
  const [activeInstrumentIds, setActiveInstrumentIds] = useState<string[]>([]);
  const [activeGenreId, setActiveGenreId] = useState<string | undefined>();
  const [activeDifficulty, setActiveDifficulty] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"newest" | "az" | "oldest" | "popular">("newest");
  const [composerNames, setComposerNames] = useState<Map<string, string>>(new Map());
  const [visibleCount, setVisibleCount] = useState(12);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  // Load curated sections (once on mount)
  useEffect(() => {
    async function loadSections() {
      try {
        const [featured, recent, trending, popular, collections, myFavs] =
          await Promise.all([
            listFeatured(6),
            listRecentlyPublished(12),
            listTrending(12),
            listMostFavorited(12),
            listPublishedPlaylists(),
            user ? listMyFavorites("project") : Promise.resolve([]),
          ]);

        setFeaturedProjects(featured);
        setRecentProjects(recent);
        setTrendingProjects(trending);
        setFavoritedProjects(popular);
        setPlaylists(collections);

        const favSet = new Set<string>();
        myFavs.forEach((f) => favSet.add(f.targetId));
        setFavoritedIds(favSet);

        // Batch-resolve composer names from all loaded projects
        const allLoaded = [...featured, ...recent, ...trending, ...popular];
        const allComposerIds = allLoaded.flatMap((p) => p.wikiComposerIds || []);
        if (allComposerIds.length > 0) {
          getArtistNamesByIds(allComposerIds)
            .then(setComposerNames)
            .catch(() => {});
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to load discover sections");
      }
    }

    loadSections();
  }, [user]);

  // Load "All scores" section (with filters)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function loadAll() {
      try {
        const wikiFilters = {
          ...(activeGenreId ? { genreId: activeGenreId } : {}),
          ...(activeInstrumentIds.length ? { instrumentIds: activeInstrumentIds } : {}),
        };
        const list = await listPublished(
          activeDifficulty.length ? activeDifficulty : undefined,
          undefined,
          Object.keys(wikiFilters).length ? wikiFilters : undefined,
          debouncedSearchQuery
        );
        if (!cancelled) {
          setAllProjects(list);

          // Resolve any new composer names
          const newIds = list.flatMap((p) => p.wikiComposerIds || []);
          if (newIds.length > 0) {
            getArtistNamesByIds(newIds)
              .then((map) =>
                setComposerNames((prev) => new Map([...prev, ...map]))
              )
              .catch(() => {});
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => { cancelled = true; };
  }, [activeDifficulty, activeGenreId, activeInstrumentIds, debouncedSearchQuery]);

  // Load wiki data for filter pills
  useEffect(() => {
    Promise.all([listInstruments(100), listGenres(100)])
      .then(([insts, gens]) => {
        setWikiInstruments(insts);
        setWikiGenres(gens);
      })
      .catch(() => {});
  }, []);

  // Favorite toggle
  const handleToggleFavorite = async (
    e: React.MouseEvent,
    projectId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || togglingFavId) return;

    setTogglingFavId(projectId);
    const isCurrentlyFavorited = favoritedIds.has(projectId);
    setFavoritedIds((prev) => {
      const next = new Set(prev);
      if (isCurrentlyFavorited) next.delete(projectId);
      else next.add(projectId);
      return next;
    });

    try {
      const result = await toggleFavorite("project", projectId);
      setFavoritedIds((prev) => {
        const next = new Set(prev);
        if (result) next.add(projectId);
        else next.delete(projectId);
        return next;
      });
    } catch {
      setFavoritedIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlyFavorited) next.add(projectId);
        else next.delete(projectId);
        return next;
      });
    } finally {
      setTogglingFavId(null);
    }
  };

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

  // Helper: get composer display name
  const getComposerName = (p: ProjectDocument) => {
    if (p.wikiComposerIds?.length) {
      const names = p.wikiComposerIds
        .map((id) => composerNames.get(id))
        .filter(Boolean);
      if (names.length) return names.join(", ");
    }
    return p.creatorEmail ? p.creatorEmail.split("@")[0] : t("communityComposer");
  };

  // Hybrid dedup: featured IDs excluded from other sections
  const featuredIds = useMemo(
    () => new Set(featuredProjects.map((p) => p.$id)),
    [featuredProjects]
  );
  const dedupRecent = useMemo(
    () => recentProjects.filter((p) => !featuredIds.has(p.$id)),
    [recentProjects, featuredIds]
  );
  const dedupTrending = useMemo(
    () => trendingProjects.filter((p) => !featuredIds.has(p.$id)),
    [trendingProjects, featuredIds]
  );
  const dedupFavorited = useMemo(
    () => favoritedProjects.filter((p) => !featuredIds.has(p.$id)),
    [favoritedProjects, featuredIds]
  );

  // All scores sorting
  const sortedAllScores = useMemo(() => {
    return [...allProjects].sort((a, b) => {
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
  }, [allProjects, sortBy]);

  useEffect(() => {
    setVisibleCount(12);
  }, [debouncedSearchQuery, sortBy, activeDifficulty, activeGenreId, activeInstrumentIds]);

  // ==========================================
  //  RENDER
  // ==========================================
  return (
    <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white relative flex flex-col items-center pt-8 pb-32 px-6">
      <div className="w-full max-w-[1200px] z-10 relative">
        {/* Search Bar */}
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

        {error && (
          <div className="mb-8 p-4 bg-red-950/50 border border-red-900 rounded-xl text-red-400 text-center backdrop-blur-sm">
            {error}
          </div>
        )}

        {/* ===== CURATED SECTIONS (only when not searching) ===== */}
        {!searchQuery && (
          <>
            {/* ⭐ Featured Section */}
            {featuredProjects.length > 0 && (
              <section className="mb-14">
                <SectionHeader
                  icon={<Star className="w-5 h-5" />}
                  title="Featured"
                  iconColor="text-amber-500"
                />
                <HorizontalScroll>
                  {featuredProjects.map((p) => (
                    <ScoreCard
                      key={p.$id}
                      project={p}
                      composerName={getComposerName(p)}
                      isFavorited={favoritedIds.has(p.$id)}
                      onToggleFavorite={handleToggleFavorite}
                      togglingFavId={togglingFavId}
                      user={user}
                      variant="featured"
                    />
                  ))}
                </HorizontalScroll>
              </section>
            )}

            {/* 🆕 Recently Added */}
            {dedupRecent.length > 0 && (
              <section className="mb-14">
                <SectionHeader
                  icon={<Clock className="w-5 h-5" />}
                  title={t("recentlyAdded") || "Recently Added"}
                  count={dedupRecent.length}
                  iconColor="text-blue-500"
                />
                <HorizontalScroll>
                  {dedupRecent.map((p) => (
                    <ScoreCard
                      key={p.$id}
                      project={p}
                      composerName={getComposerName(p)}
                      isFavorited={favoritedIds.has(p.$id)}
                      onToggleFavorite={handleToggleFavorite}
                      togglingFavId={togglingFavId}
                      user={user}
                    />
                  ))}
                </HorizontalScroll>
              </section>
            )}

            {/* 🔥 Trending */}
            {dedupTrending.length > 0 && (
              <section className="mb-14">
                <SectionHeader
                  icon={<Flame className="w-5 h-5" />}
                  title={t("trending") || "Trending"}
                  count={dedupTrending.length}
                  iconColor="text-orange-500"
                />
                <HorizontalScroll>
                  {dedupTrending.map((p) => (
                    <ScoreCard
                      key={p.$id}
                      project={p}
                      composerName={getComposerName(p)}
                      isFavorited={favoritedIds.has(p.$id)}
                      onToggleFavorite={handleToggleFavorite}
                      togglingFavId={togglingFavId}
                      user={user}
                    />
                  ))}
                </HorizontalScroll>
              </section>
            )}

            {/* 🔖 Most Favorited */}
            {dedupFavorited.length > 0 && (
              <section className="mb-14">
                <SectionHeader
                  icon={<Heart className="w-5 h-5" />}
                  title={t("popularFavorites") || "Popular Favorites"}
                  count={dedupFavorited.length}
                  iconColor="text-pink-500"
                />
                <HorizontalScroll>
                  {dedupFavorited.map((p) => (
                    <ScoreCard
                      key={p.$id}
                      project={p}
                      composerName={getComposerName(p)}
                      isFavorited={favoritedIds.has(p.$id)}
                      onToggleFavorite={handleToggleFavorite}
                      togglingFavId={togglingFavId}
                      user={user}
                    />
                  ))}
                </HorizontalScroll>
              </section>
            )}

            {/* 📚 Collections */}
            {playlists.length > 0 && (
              <section className="mb-14">
                <SectionHeader
                  icon={<ListMusic className="w-5 h-5" />}
                  title="Collections"
                  count={playlists.length}
                  iconColor="text-indigo-500"
                />
                <HorizontalScroll>
                  {playlists.map((pl) => (
                    <Link
                      href={`/collection/${pl.$id}`}
                      key={pl.$id}
                      className="block group w-[260px] sm:w-[300px] shrink-0 snap-start"
                    >
                      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 hover:border-zinc-300 dark:hover:border-white/20 transition-all duration-300 transform-gpu">
                        <div
                          className="h-36 relative overflow-hidden flex items-center justify-center border-b border-zinc-200 dark:border-white/5"
                          style={{
                            background: pl.coverImageId
                              ? undefined
                              : `linear-gradient(135deg, hsl(${(pl.name.length * 53 + (pl.name.charCodeAt(0) || 0) * 17) % 360}, 50%, 30%), hsl(${(pl.name.length * 53 + (pl.name.charCodeAt(0) || 0) * 17 + 80) % 360}, 55%, 22%))`,
                          }}
                        >
                          {pl.coverImageId ? (
                            <img
                              src={getFileViewUrl(pl.coverImageId).toString()}
                              alt="cover"
                              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 border-0"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <ListMusic className="w-10 h-10 text-white/25" />
                              <span className="text-white/50 text-xs font-bold uppercase tracking-widest">
                                {pl.projectIds?.length || 0} Tracks
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1 leading-tight group-hover:text-blue-500 transition-colors truncate">
                            {pl.name}
                          </h3>
                          <p className="text-xs text-zinc-500 font-medium">
                            {pl.projectIds?.length || 0} Tracks
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </HorizontalScroll>
              </section>
            )}
          </>
        )}

        {/* ===== ALL SCORES with filters ===== */}
        <section>
          {/* Quick Filter Groups */}
          <div className="flex flex-col gap-6 pb-6 mb-8 w-full border-b border-zinc-200 dark:border-white/5">
            {/* General Row */}
            <div className="flex items-start gap-4 w-full">
              <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest shrink-0 w-[100px] mt-2 hidden sm:inline-block">
                {t("filters")}
              </span>
              <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-none pb-1">
                <button
                  onClick={() => { setActiveInstrumentIds([]); setActiveGenreId(undefined); setActiveDifficulty([]); }}
                  className={`px-5 py-2 whitespace-nowrap rounded-full text-[13px] font-bold transition-all duration-300 flex items-center gap-2 ${
                    activeInstrumentIds.length === 0 && !activeGenreId && activeDifficulty.length === 0
                      ? "bg-[#C8A856] text-black shadow-[0_0_15px_rgba(200,168,86,0.3)] border border-transparent"
                      : "bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800/70"
                  }`}
                >
                  {t("allTracks")}
                </button>
              </div>
            </div>

            {/* Instruments Row */}
            {wikiInstruments.length > 0 && (
              <div className="flex items-start gap-4 w-full">
                <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest shrink-0 w-[100px] mt-2 hidden sm:inline-block">
                  Instruments
                </span>
                <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-none pb-1">
                  {wikiInstruments.map((inst) => (
                    <button
                      key={inst.$id}
                      onClick={() => setActiveInstrumentIds((prev) => prev.includes(inst.$id) ? prev.filter((id) => id !== inst.$id) : [...prev, inst.$id])}
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

            {/* Genres Row */}
            {wikiGenres.length > 0 && (
              <div className="flex items-start gap-4 w-full">
                <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest shrink-0 w-[100px] mt-2 hidden sm:inline-block">
                  Genres
                </span>
                <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-none pb-1">
                  {wikiGenres.map((genre) => (
                    <button
                      key={genre.$id}
                      onClick={() => setActiveGenreId((prev) => prev === genre.$id ? undefined : genre.$id)}
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
                    onClick={() => setActiveDifficulty((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])}
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

          {/* All Scores Header */}
          <div className="w-full flex items-center justify-between mb-6 mt-4">
            <h2 className="text-[22px] font-bold text-zinc-900 dark:text-white tracking-tight">
              {t("interactiveScores")}
              {!loading && (
                <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500 ml-2">
                  ({sortedAllScores.length})
                </span>
              )}
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
              <div className="w-8 h-8 border-2 border-zinc-800 border-t-[#C8A856] rounded-full animate-spin" />
              <p className="text-zinc-500 text-sm font-medium">{t("loadingScores")}</p>
            </div>
          ) : sortedAllScores.length === 0 ? (
            <div className="text-center py-20 border border-zinc-200 dark:border-white/5 rounded-3xl bg-zinc-50 dark:bg-zinc-900/20">
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">{t("noProjects")}</p>
            </div>
          ) : (
            <>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {sortedAllScores.slice(0, visibleCount).map((p) => {
                  const isEasy = p.tags?.includes("Beginner");
                  const isIntermediate = p.tags?.includes("Intermediate");
                  const isAdvanced = p.tags?.includes("Advanced");

                  let badgeColor = "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400";
                  let badgeText = "";
                  if (isEasy) { badgeColor = "bg-[#d4eddb] dark:bg-[#2E5E3D] text-[#2d6a4f] dark:text-[#84E1A6]"; badgeText = "Easy"; }
                  else if (isIntermediate) { badgeColor = "bg-[#d0eaf9] dark:bg-[#1E4D6B] text-[#023e8a] dark:text-[#71BCE8]"; badgeText = "Intermediate"; }
                  else if (isAdvanced) { badgeColor = "bg-[#fcdede] dark:bg-[#6A2B2B] text-[#9b2226] dark:text-[#FCA6A6]"; badgeText = "Advanced"; }

                  const instrumentTags = p.tags?.filter((t) => !["Beginner", "Advanced", "Intermediate"].includes(t)) || [];
                  const displayTags = instrumentTags.slice(0, 2);
                  const remainingCount = instrumentTags.length - 2;

                  return (
                    <li
                      key={p.$id}
                      className="group bg-white dark:bg-[#1A1A1E] border border-white/5 rounded-[20px] transition-all duration-300 flex flex-col hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50 relative"
                    >
                      <Link href={`/play/${p.$id}`} className="absolute inset-0 z-0 rounded-[20px]" aria-label={`Play ${p.name}`} />
                      <div className="p-4 flex-1 flex flex-col relative w-full pointer-events-none">
                        <div className="relative w-full aspect-[4/3] rounded-[14px] overflow-hidden mb-5 bg-white shadow-inner flex items-center justify-center">
                          {p.coverUrl ? (
                            <img src={p.coverUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                          ) : (
                            <div
                              className="w-full h-full relative flex flex-col items-center justify-center p-6"
                              style={{ background: `linear-gradient(135deg, hsl(${(p.name.length * 47 + (p.name.charCodeAt(0) || 0) * 13) % 360}, 45%, 35%), hsl(${(p.name.length * 47 + (p.name.charCodeAt(0) || 0) * 13 + 60) % 360}, 50%, 25%))` }}
                            >
                              <Music4 className="w-10 h-10 text-white/20 mb-3" />
                              <div className="text-center text-white font-serif font-bold text-lg leading-tight line-clamp-2 drop-shadow-lg">{p.name}</div>
                              <div className="text-white/60 text-xs font-medium mt-1.5 line-clamp-1">{getComposerName(p)}</div>
                            </div>
                          )}
                        </div>
                        <h2 className="text-[17px] font-bold text-zinc-900 dark:text-zinc-100 mb-1 line-clamp-1">{p.name}</h2>
                        <p className="text-[14px] text-zinc-400 line-clamp-1 mb-4">{getComposerName(p)}</p>
                        <div className="flex items-start justify-between mb-4 gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap flex-1">
                            {displayTags.length > 0 ? displayTags.map((tag) => (
                              <span key={tag} className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded border border-zinc-200 dark:border-zinc-700/50 tracking-wider">{tag}</span>
                            )) : (
                              <span className="text-[12px] text-zinc-400 dark:text-zinc-600 font-medium">{t("noTags")}</span>
                            )}
                            {remainingCount > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded">+{remainingCount}</span>
                            )}
                          </div>
                          {badgeText && (
                            <span className={`px-2 py-[2px] rounded-md text-[11px] font-bold uppercase tracking-wider shrink-0 mt-0.5 ${badgeColor}`}>{badgeText}</span>
                          )}
                        </div>
                      </div>
                      <div className="w-full h-px bg-white/5 mb-4 pointer-events-none" />
                      <div className="flex items-center justify-between w-full px-4 pb-4 relative z-10">
                        <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
                          {(p.playCount ?? 0) > 0 && (
                            <span className="flex items-center gap-1 text-[11px] font-semibold">
                              <Play className="w-3 h-3 fill-current" /> {(p.playCount ?? 0).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <ProjectActionsMenu projectId={p.$id} hideFavorite={true} />
                          {user && (
                            <button
                              onClick={(e) => handleToggleFavorite(e, p.$id)}
                              disabled={togglingFavId === p.$id}
                              className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                                favoritedIds.has(p.$id)
                                  ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                                  : "text-zinc-500 dark:text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-white/5"
                              }`}
                            >
                              <Bookmark className={`w-[18px] h-[18px] transition-all ${favoritedIds.has(p.$id) ? "fill-current scale-110" : ""}`} />
                            </button>
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
              {sortedAllScores.length > visibleCount && (
                <div className="flex justify-center mt-10">
                  <button
                    onClick={() => setVisibleCount((prev) => prev + 12)}
                    className="px-8 py-3 rounded-full bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-white/10 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Load More ({sortedAllScores.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
