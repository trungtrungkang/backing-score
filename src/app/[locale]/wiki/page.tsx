"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { searchArtists, listArtists } from "@/lib/appwrite/artists";
import { listInstruments } from "@/lib/appwrite/instruments";
import { searchCompositions, listCompositions } from "@/lib/appwrite/compositions";
import { listGenres } from "@/lib/appwrite/genres";
import type { ArtistDocument, InstrumentDocument, CompositionDocument, GenreDocument } from "@/lib/appwrite/types";
import { Search, Music, Guitar, BookOpen, Tag, ChevronRight, ChevronDown, User2, Disc3, Settings2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

export default function WikiPage() {
  const t = useTranslations("Wiki");
  const { user } = useAuth();
  const canManage = user?.labels?.includes("admin") || user?.labels?.includes("wiki_editor");
  const [search, setSearch] = useState("");
  const [artists, setArtists] = useState<ArtistDocument[]>([]);
  const [instruments, setInstruments] = useState<InstrumentDocument[]>([]);
  const [compositions, setCompositions] = useState<CompositionDocument[]>([]);
  const [genres, setGenres] = useState<GenreDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listArtists(100),
      listInstruments(100),
      listCompositions(100),
      listGenres(100),
    ]).then(([a, i, c, g]) => {
      setArtists(a);
      setInstruments(i);
      setCompositions(c);
      setGenres(g);
    }).finally(() => setLoading(false));
  }, []);

  const PREVIEW_COUNT = 8;
  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  const visible = <T,>(items: T[], key: string) => expanded[key] ? items : items.slice(0, PREVIEW_COUNT);

  useEffect(() => {
    if (!search.trim()) return;
    const timer = setTimeout(async () => {
      const [a, c] = await Promise.all([
        searchArtists(search, 8),
        searchCompositions(search, 8),
      ]);
      setArtists(a);
      setCompositions(c);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const categoryCards = [
    { key: "artists", icon: User2, href: "/wiki/artists", count: artists.length, color: "from-violet-500/20 to-purple-500/20 dark:from-violet-500/10 dark:to-purple-500/10", iconColor: "text-violet-500" },
    { key: "instruments", icon: Guitar, href: "/wiki/instruments", count: instruments.length, color: "from-amber-500/20 to-orange-500/20 dark:from-amber-500/10 dark:to-orange-500/10", iconColor: "text-amber-500" },
    { key: "compositions", icon: Music, href: "/wiki/compositions", count: compositions.length, color: "from-sky-500/20 to-blue-500/20 dark:from-sky-500/10 dark:to-blue-500/10", iconColor: "text-sky-500" },
    { key: "genres", icon: Tag, href: "/wiki/genres", count: genres.length, color: "from-emerald-500/20 to-teal-500/20 dark:from-emerald-500/10 dark:to-teal-500/10", iconColor: "text-emerald-500" },
  ];

  return (
    <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white pt-8 pb-32 px-6">
      <div className="max-w-[1100px] mx-auto">

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#C8A856]/10 text-[#C8A856] text-xs font-bold tracking-widest uppercase mb-6 border border-[#C8A856]/20">
            <BookOpen className="w-3.5 h-3.5" /> Encyclopedia
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-b from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
            {t("hubTitle")}
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
            {t("hubSubtitle")}
          </p>
          {canManage && (
            <Link href="/admin/wiki" className="inline-flex items-center gap-2 mt-5 px-4 py-2 bg-[#C8A856]/10 hover:bg-[#C8A856]/20 text-[#C8A856] text-sm font-semibold rounded-xl border border-[#C8A856]/20 transition-colors">
              <Settings2 className="w-4 h-4" /> Manage Content
            </Link>
          )}
        </div>

        {/* Search */}
        <div className="flex justify-center mb-14">
          <div className="relative w-full max-w-xl">
            <Input
              placeholder={t("searchPlaceholder")}
              className="w-full h-[52px] pl-6 pr-14 bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-white/5 focus-visible:ring-[#C8A856]/50 rounded-full text-[15px] placeholder:text-zinc-500 shadow-inner"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-[#C8A856] rounded-full flex items-center justify-center text-black">
              <Search className="w-4 h-4" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <div className="w-8 h-8 border-2 border-zinc-300 dark:border-zinc-700 border-t-[#C8A856] rounded-full animate-spin" />
            <p className="text-zinc-500 text-sm">{t("loading")}</p>
          </div>
        ) : (
          <>
            {/* Category Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
              {categoryCards.map((cat) => (
                <Link
                  key={cat.key}
                  href={cat.href}
                  className={`bg-gradient-to-br ${cat.color} border border-zinc-200 dark:border-white/5 rounded-2xl p-6 text-center hover:scale-[1.02] transition-transform block`}
                >
                  <cat.icon className={`w-8 h-8 mx-auto mb-3 ${cat.iconColor}`} />
                  <h3 className="font-bold text-lg mb-1">{t(cat.key)}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{cat.count} entries</p>
                </Link>
              ))}
            </div>

            {/* Artists Section */}
            {artists.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <User2 className="w-5 h-5 text-violet-500" /> {t("artists")}
                    <span className="text-sm font-normal text-zinc-400 ml-1">({artists.length})</span>
                  </h2>
                  {artists.length > PREVIEW_COUNT && (
                    <button onClick={() => toggle("artists")} className="flex items-center gap-1 text-sm font-semibold text-[#C8A856] hover:text-[#b8983e] transition-colors">
                      {expanded.artists ? "Show Less" : `View All (${artists.length})`}
                      <ChevronDown className={`w-4 h-4 transition-transform ${expanded.artists ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {visible(artists, "artists").map((a) => (
                    <Link href={`/wiki/artists/${a.slug}`} key={a.$id} className="group block">
                      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                        <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center mb-3">
                          {a.imageUrl ? (
                            <img src={a.imageUrl} alt={a.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <User2 className="w-5 h-5 text-violet-500" />
                          )}
                        </div>
                        <h3 className="font-bold text-[15px] mb-1 group-hover:text-[#C8A856] transition-colors truncate">{a.name}</h3>
                        {a.roles && a.roles.length > 0 && (
                          <p className="text-xs text-zinc-500 truncate">{a.roles.join(", ")}</p>
                        )}
                        {a.nationality && (
                          <p className="text-xs text-zinc-400 mt-1">{a.nationality}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Instruments Section */}
            {instruments.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Guitar className="w-5 h-5 text-amber-500" /> {t("instruments")}
                    <span className="text-sm font-normal text-zinc-400 ml-1">({instruments.length})</span>
                  </h2>
                  {instruments.length > PREVIEW_COUNT && (
                    <button onClick={() => toggle("instruments")} className="flex items-center gap-1 text-sm font-semibold text-[#C8A856] hover:text-[#b8983e] transition-colors">
                      {expanded.instruments ? "Show Less" : `View All (${instruments.length})`}
                      <ChevronDown className={`w-4 h-4 transition-transform ${expanded.instruments ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {visible(instruments, "instruments").map((inst) => (
                    <Link href={`/wiki/instruments/${inst.slug}`} key={inst.$id} className="group block">
                      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center mb-3">
                          {inst.imageUrl ? (
                            <img src={inst.imageUrl} alt={inst.name} className="w-full h-full rounded-xl object-cover" />
                          ) : (
                            <Guitar className="w-5 h-5 text-amber-500" />
                          )}
                        </div>
                        <h3 className="font-bold text-[15px] mb-1 group-hover:text-[#C8A856] transition-colors truncate">{inst.name}</h3>
                        {inst.family && (
                          <p className="text-xs text-zinc-500">{inst.family}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Compositions Section */}
            {compositions.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Music className="w-5 h-5 text-sky-500" /> {t("compositions")}
                    <span className="text-sm font-normal text-zinc-400 ml-1">({compositions.length})</span>
                  </h2>
                  {compositions.length > PREVIEW_COUNT && (
                    <button onClick={() => toggle("compositions")} className="flex items-center gap-1 text-sm font-semibold text-[#C8A856] hover:text-[#b8983e] transition-colors">
                      {expanded.compositions ? "Show Less" : `View All (${compositions.length})`}
                      <ChevronDown className={`w-4 h-4 transition-transform ${expanded.compositions ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {visible(compositions, "compositions").map((comp) => (
                    <Link href={`/wiki/compositions/${comp.slug}`} key={comp.$id} className="group block">
                      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                        <Disc3 className="w-8 h-8 text-sky-500 mb-3" />
                        <h3 className="font-bold text-[15px] mb-1 group-hover:text-[#C8A856] transition-colors truncate">{comp.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          {comp.period && <span>{comp.period}</span>}
                          {comp.year && <span>• {comp.year}</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Genres Section */}
            {genres.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Tag className="w-5 h-5 text-emerald-500" /> {t("genres")}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  {genres.map((g) => (
                    <Link href={`/wiki/genres/${g.slug}`} key={g.$id}>
                      <span className="px-4 py-2 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 text-sm font-semibold hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer">
                        {g.name}
                        {g.era && <span className="text-zinc-400 ml-1 text-xs">({g.era})</span>}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {artists.length === 0 && instruments.length === 0 && compositions.length === 0 && genres.length === 0 && (
              <div className="text-center py-20 border border-zinc-200 dark:border-white/5 rounded-3xl bg-zinc-50 dark:bg-zinc-900/20">
                <BookOpen className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
                <p className="text-zinc-500 dark:text-zinc-400">{t("noResults")}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
