"use client";

import { useEffect, useState, useMemo } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { listInstruments } from "@/lib/appwrite/instruments";
import type { InstrumentDocument } from "@/lib/appwrite/types";
import { ArrowLeft, Guitar, Search } from "lucide-react";

export default function InstrumentsListingPage() {
  const t = useTranslations("Wiki");
  const [instruments, setInstruments] = useState<InstrumentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterFamily, setFilterFamily] = useState("");

  useEffect(() => {
    setLoading(true);
    listInstruments(200).then(setInstruments).finally(() => setLoading(false));
  }, []);

  const families = useMemo(() => [...new Set(instruments.map(i => i.family).filter(Boolean) as string[])].sort(), [instruments]);

  const filtered = useMemo(() => {
    return instruments.filter(i => {
      if (filterFamily && i.family !== filterFamily) return false;
      if (search.trim() && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [instruments, filterFamily, search]);

  return (
    <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white pt-8 pb-32 px-6">
      <div className="max-w-[1100px] mx-auto">
        <Link href="/wiki" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-[#C8A856] transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> {t("hubTitle")}
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center">
              <Guitar className="w-5 h-5 text-amber-500" />
            </div>
            {t("instruments")}
            <span className="text-lg font-normal text-zinc-400 ml-1">({filtered.length})</span>
          </h1>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search instruments..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-white/5 rounded-xl text-sm outline-none focus:border-[#C8A856] transition-colors"
            />
          </div>
        </div>

        {/* Family filter chips */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setFilterFamily("")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${!filterFamily ? "bg-amber-500 text-white border-amber-500" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-amber-500/50"}`}
          >All</button>
          {families.map(f => (
            <button
              key={f}
              onClick={() => setFilterFamily(f === filterFamily ? "" : f)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${filterFamily === f ? "bg-amber-500 text-white border-amber-500" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-amber-500/50"}`}
            >{f}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-zinc-300 dark:border-zinc-700 border-t-[#C8A856] rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">{t("noResults")}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(inst => (
              <Link href={`/wiki/instruments/${inst.slug}`} key={inst.$id} className="group block">
                <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all h-full">
                  <div className="w-14 h-14 rounded-xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center mb-4 overflow-hidden">
                    {inst.imageUrl ? (
                      <img src={inst.imageUrl} alt={inst.name} className="w-full h-full rounded-xl object-cover" />
                    ) : (
                      <Guitar className="w-6 h-6 text-amber-500" />
                    )}
                  </div>
                  <h3 className="font-bold text-[15px] mb-1 group-hover:text-[#C8A856] transition-colors">{inst.name}</h3>
                  {inst.family && (
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                      {inst.family}
                    </span>
                  )}
                  {inst.origin && (
                    <p className="text-[11px] text-zinc-400 mt-2">{inst.origin}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
