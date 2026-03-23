"use client";

import { useEffect, useState, useMemo } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { listCompositions, searchCompositions } from "@/lib/appwrite/compositions";
import { listGenres } from "@/lib/appwrite/genres";
import type { CompositionDocument, GenreDocument } from "@/lib/appwrite/types";
import { ArrowLeft, Music, Search, Disc3, Calendar } from "lucide-react";

export default function CompositionsListingPage() {
  const t = useTranslations("Wiki");
  const [compositions, setCompositions] = useState<CompositionDocument[]>([]);
  const [genres, setGenres] = useState<GenreDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterGenre, setFilterGenre] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([listCompositions(200), listGenres(100)])
      .then(([c, g]) => { setCompositions(c); setGenres(g); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!search.trim()) return;
    const timer = setTimeout(() => {
      searchCompositions(search, 50).then(setCompositions);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const periods = useMemo(() => [...new Set(compositions.map(c => c.period).filter(Boolean) as string[])].sort(), [compositions]);
  const difficulties = useMemo(() => [...new Set(compositions.map(c => c.difficulty).filter(Boolean) as string[])].sort(), [compositions]);

  const genreMap = useMemo(() => Object.fromEntries(genres.map(g => [g.$id, g.name])), [genres]);

  const filtered = useMemo(() => {
    return compositions.filter(c => {
      if (filterGenre && c.genreId !== filterGenre) return false;
      if (filterDifficulty && c.difficulty !== filterDifficulty) return false;
      if (filterPeriod && c.period !== filterPeriod) return false;
      return true;
    });
  }, [compositions, filterGenre, filterDifficulty, filterPeriod]);

  const difficultyColor = (d: string) => {
    const lower = d.toLowerCase();
    if (lower.includes("beginner") || lower.includes("easy")) return "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400";
    if (lower.includes("intermediate") || lower.includes("medium")) return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
    return "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400";
  };

  return (
    <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white pt-8 pb-32 px-6">
      <div className="max-w-[1100px] mx-auto">
        <Link href="/wiki" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-[#C8A856] transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> {t("hubTitle")}
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-500/10 flex items-center justify-center">
              <Music className="w-5 h-5 text-sky-500" />
            </div>
            {t("compositions")}
            <span className="text-lg font-normal text-zinc-400 ml-1">({filtered.length})</span>
          </h1>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); if (!e.target.value.trim()) listCompositions(200).then(setCompositions); }}
              placeholder="Search compositions..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-white/5 rounded-xl text-sm outline-none focus:border-[#C8A856] transition-colors"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          <select
            value={filterGenre}
            onChange={e => setFilterGenre(e.target.value)}
            className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-semibold outline-none focus:border-[#C8A856]"
          >
            <option value="">All genres</option>
            {genres.map(g => <option key={g.$id} value={g.$id}>{g.name}</option>)}
          </select>
          <select
            value={filterPeriod}
            onChange={e => setFilterPeriod(e.target.value)}
            className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-semibold outline-none focus:border-[#C8A856]"
          >
            <option value="">All periods</option>
            {periods.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={filterDifficulty}
            onChange={e => setFilterDifficulty(e.target.value)}
            className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-semibold outline-none focus:border-[#C8A856]"
          >
            <option value="">All difficulties</option>
            {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {(filterGenre || filterPeriod || filterDifficulty) && (
            <button onClick={() => { setFilterGenre(""); setFilterPeriod(""); setFilterDifficulty(""); }} className="px-3 py-1.5 text-xs font-semibold text-[#C8A856] hover:underline">
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-zinc-300 dark:border-zinc-700 border-t-[#C8A856] rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">{t("noResults")}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(comp => (
              <Link href={`/wiki/compositions/${comp.slug}`} key={comp.$id} className="group block">
                <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all h-full">
                  <Disc3 className="w-8 h-8 text-sky-500 mb-3" />
                  <h3 className="font-bold text-[15px] mb-1 group-hover:text-[#C8A856] transition-colors">{comp.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 mb-2">
                    {comp.period && <span>{comp.period}</span>}
                    {comp.year && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{comp.year}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {comp.genreId && genreMap[comp.genreId] && (
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                        {genreMap[comp.genreId]}
                      </span>
                    )}
                    {comp.difficulty && (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${difficultyColor(comp.difficulty)}`}>
                        {comp.difficulty}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
