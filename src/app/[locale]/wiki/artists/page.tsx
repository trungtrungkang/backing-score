"use client";

import { useEffect, useState, useMemo } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { listArtists, searchArtists } from "@/lib/appwrite/artists";
import type { ArtistDocument } from "@/lib/appwrite/types";
import { ArrowLeft, User2, Search, MapPin, Calendar } from "lucide-react";

export default function ArtistsListingPage() {
  const t = useTranslations("Wiki");
  const [artists, setArtists] = useState<ArtistDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterNationality, setFilterNationality] = useState("");
  const [filterRole, setFilterRole] = useState("");

  useEffect(() => {
    setLoading(true);
    listArtists(200).then(setArtists).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!search.trim()) return;
    const timer = setTimeout(() => {
      searchArtists(search, 50).then(setArtists);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Derive filter options from data
  const nationalities = useMemo(() => [...new Set(artists.map(a => a.nationality).filter(Boolean) as string[])].sort(), [artists]);
  const roles = useMemo(() => [...new Set(artists.flatMap(a => a.roles || []))].sort(), [artists]);

  const filtered = useMemo(() => {
    return artists.filter(a => {
      if (filterNationality && a.nationality !== filterNationality) return false;
      if (filterRole && !(a.roles || []).includes(filterRole)) return false;
      return true;
    });
  }, [artists, filterNationality, filterRole]);

  return (
    <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white pt-8 pb-32 px-6">
      <div className="max-w-[1100px] mx-auto">
        {/* Header */}
        <Link href="/wiki" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-[#C8A856] transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> {t("hubTitle")}
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center">
                <User2 className="w-5 h-5 text-violet-500" />
              </div>
              {t("artists")}
              <span className="text-lg font-normal text-zinc-400 ml-1">({filtered.length})</span>
            </h1>
          </div>
          {/* Search */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); if (!e.target.value.trim()) listArtists(200).then(setArtists); }}
              placeholder="Search artists..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-white/5 rounded-xl text-sm outline-none focus:border-[#C8A856] transition-colors"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          <select
            value={filterNationality}
            onChange={e => setFilterNationality(e.target.value)}
            className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-semibold outline-none focus:border-[#C8A856]"
          >
            <option value="">All nationalities</option>
            {nationalities.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-semibold outline-none focus:border-[#C8A856]"
          >
            <option value="">All roles</option>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {(filterNationality || filterRole) && (
            <button onClick={() => { setFilterNationality(""); setFilterRole(""); }} className="px-3 py-1.5 text-xs font-semibold text-[#C8A856] hover:underline">
              Clear filters
            </button>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-zinc-300 dark:border-zinc-700 border-t-[#C8A856] rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">{t("noResults")}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(a => (
              <Link href={`/wiki/artists/${a.slug}`} key={a.$id} className="group block">
                <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all h-full">
                  <div className="w-14 h-14 rounded-full bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center mb-4 overflow-hidden">
                    {a.imageUrl ? (
                      <img src={a.imageUrl} alt={a.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User2 className="w-6 h-6 text-violet-500" />
                    )}
                  </div>
                  <h3 className="font-bold text-[15px] mb-1 group-hover:text-[#C8A856] transition-colors">{a.name}</h3>
                  {a.roles && a.roles.length > 0 && (
                    <p className="text-xs text-zinc-500 mb-2">{a.roles.join(", ")}</p>
                  )}
                  <div className="flex flex-wrap gap-2 text-[11px] text-zinc-400">
                    {a.nationality && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a.nationality}</span>
                    )}
                    {a.birthDate && (
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{a.birthDate}{a.deathDate ? ` – ${a.deathDate}` : ""}</span>
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
