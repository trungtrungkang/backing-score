"use client";

import { useEffect, useState, useMemo } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { listGenres } from "@/lib/appwrite/genres";
import type { GenreDocument } from "@/lib/appwrite/types";
import { ArrowLeft, Tag, Search, ChevronRight } from "lucide-react";

export default function GenresListingPage() {
  const t = useTranslations("Wiki");
  const [genres, setGenres] = useState<GenreDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEra, setFilterEra] = useState("");

  useEffect(() => {
    setLoading(true);
    listGenres(200).then(setGenres).finally(() => setLoading(false));
  }, []);

  const eras = useMemo(() => [...new Set(genres.map(g => g.era).filter(Boolean) as string[])].sort(), [genres]);

  // Build parent-child tree
  const genreTree = useMemo(() => {
    const parentGenres = genres.filter(g => !g.parentGenreId);
    const childMap: Record<string, GenreDocument[]> = {};
    genres.filter(g => g.parentGenreId).forEach(g => {
      if (!childMap[g.parentGenreId!]) childMap[g.parentGenreId!] = [];
      childMap[g.parentGenreId!].push(g);
    });
    return { parentGenres, childMap };
  }, [genres]);

  const filtered = useMemo(() => {
    let items = genres;
    if (filterEra) items = items.filter(g => g.era === filterEra);
    if (search.trim()) items = items.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));
    return items;
  }, [genres, filterEra, search]);

  const showTree = !search.trim() && !filterEra;

  return (
    <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white pt-8 pb-32 px-6">
      <div className="max-w-[1100px] mx-auto">
        <Link href="/wiki" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-[#C8A856] transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> {t("hubTitle")}
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center">
              <Tag className="w-5 h-5 text-emerald-500" />
            </div>
            {t("genres")}
            <span className="text-lg font-normal text-zinc-400 ml-1">({genres.length})</span>
          </h1>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search genres..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-white/5 rounded-xl text-sm outline-none focus:border-[#C8A856] transition-colors"
            />
          </div>
        </div>

        {/* Era filter chips */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setFilterEra("")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${!filterEra ? "bg-emerald-500 text-white border-emerald-500" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-emerald-500/50"}`}
          >All</button>
          {eras.map(era => (
            <button
              key={era}
              onClick={() => setFilterEra(era === filterEra ? "" : era)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${filterEra === era ? "bg-emerald-500 text-white border-emerald-500" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-emerald-500/50"}`}
            >{era}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-zinc-300 dark:border-zinc-700 border-t-[#C8A856] rounded-full animate-spin" />
          </div>
        ) : showTree ? (
          /* Tree View */
          <div className="space-y-4">
            {genreTree.parentGenres.map(parent => (
              <div key={parent.$id} className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 rounded-2xl overflow-hidden">
                <Link href={`/wiki/genres/${parent.slug}`} className="group flex items-center justify-between p-5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <div>
                    <h3 className="font-bold text-lg group-hover:text-[#C8A856] transition-colors">{parent.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {parent.era && (
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                          {parent.era}
                        </span>
                      )}
                      {genreTree.childMap[parent.$id] && (
                        <span className="text-xs text-zinc-400">{genreTree.childMap[parent.$id].length} sub-genres</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:text-[#C8A856] transition-colors" />
                </Link>
                {genreTree.childMap[parent.$id] && genreTree.childMap[parent.$id].length > 0 && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-3 bg-zinc-50/50 dark:bg-zinc-900/30">
                    <div className="flex flex-wrap gap-2">
                      {genreTree.childMap[parent.$id].map(child => (
                        <Link href={`/wiki/genres/${child.slug}`} key={child.$id}>
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                            {child.name}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {/* Orphan genres (no parent, not a parent of anything) */}
            {genres.filter(g => !g.parentGenreId && !genreTree.childMap[g.$id] && !genreTree.parentGenres.some(p => p.$id === g.$id)).length > 0 && null}
          </div>
        ) : (
          /* Flat filtered view */
          filtered.length === 0 ? (
            <div className="text-center py-20 text-zinc-500">{t("noResults")}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(g => (
                <Link href={`/wiki/genres/${g.slug}`} key={g.$id} className="group block">
                  <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all h-full flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Tag className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-[15px] group-hover:text-[#C8A856] transition-colors">{g.name}</h3>
                      {g.era && <p className="text-xs text-zinc-400">{g.era}</p>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600 shrink-0 group-hover:text-[#C8A856] transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
