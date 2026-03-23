"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { searchArtists, listArtists } from "@/lib/appwrite/artists";
import { listInstruments } from "@/lib/appwrite/instruments";
import { searchCompositions, listCompositions } from "@/lib/appwrite/compositions";
import { listGenres } from "@/lib/appwrite/genres";
import type { ArtistDocument, InstrumentDocument, CompositionDocument, GenreDocument } from "@/lib/appwrite/types";
import { Search, User2, Guitar, Music, Tag, X } from "lucide-react";

interface WikiSearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export function WikiSearchDialog({ open, onClose }: WikiSearchDialogProps) {
  const t = useTranslations("Wiki");
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [artists, setArtists] = useState<ArtistDocument[]>([]);
  const [instruments, setInstruments] = useState<InstrumentDocument[]>([]);
  const [compositions, setCompositions] = useState<CompositionDocument[]>([]);
  const [genres, setGenres] = useState<GenreDocument[]>([]);
  const [loading, setLoading] = useState(false);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 100);
      // Load default results
      setLoading(true);
      Promise.all([listArtists(5), listInstruments(5), listCompositions(5), listGenres(10)])
        .then(([a, i, c, g]) => { setArtists(a); setInstruments(i); setCompositions(c); setGenres(g); })
        .finally(() => setLoading(false));
    }
  }, [open]);

  // ESC key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) return;
    setLoading(true);
    const timer = setTimeout(async () => {
      const [a, c] = await Promise.all([searchArtists(query, 5), searchCompositions(query, 5)]);
      setArtists(a);
      setCompositions(c);
      // Filter instruments and genres client-side
      const allInst = await listInstruments(50);
      const allGen = await listGenres(50);
      const q = query.toLowerCase();
      setInstruments(allInst.filter(i => i.name.toLowerCase().includes(q)).slice(0, 5));
      setGenres(allGen.filter(g => g.name.toLowerCase().includes(q)).slice(0, 10));
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  if (!open) return null;

  const hasResults = artists.length > 0 || instruments.length > 0 || compositions.length > 0 || genres.length > 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Dialog */}
      <div className="fixed inset-x-0 top-0 z-[90] mx-auto mt-[72px] w-full max-w-2xl px-4">
        <div className="bg-white dark:bg-[#1A1A1E] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[70vh] flex flex-col">

          {/* Search Input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-200 dark:border-white/5">
            <Search className="w-5 h-5 text-zinc-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="flex-1 bg-transparent outline-none text-[15px] text-zinc-900 dark:text-white placeholder:text-zinc-400"
            />
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Results */}
          <div className="overflow-y-auto flex-1 p-2">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-zinc-300 dark:border-zinc-700 border-t-[#C8A856] rounded-full animate-spin" />
              </div>
            ) : !hasResults ? (
              <div className="text-center py-10 text-zinc-400 text-sm">{t("noResults")}</div>
            ) : (
              <>
                {artists.length > 0 && (
                  <SearchGroup label={t("artists")} icon={<User2 className="w-3.5 h-3.5 text-violet-500" />}>
                    {artists.map((a) => (
                      <SearchItem key={a.$id} href={`/wiki/artists/${a.slug}`} onClick={onClose}
                        title={a.name} subtitle={a.roles?.join(", ")} icon={<User2 className="w-4 h-4 text-violet-500" />} />
                    ))}
                  </SearchGroup>
                )}
                {instruments.length > 0 && (
                  <SearchGroup label={t("instruments")} icon={<Guitar className="w-3.5 h-3.5 text-amber-500" />}>
                    {instruments.map((i) => (
                      <SearchItem key={i.$id} href={`/wiki/instruments/${i.slug}`} onClick={onClose}
                        title={i.name} subtitle={i.family ?? undefined} icon={<Guitar className="w-4 h-4 text-amber-500" />} />
                    ))}
                  </SearchGroup>
                )}
                {compositions.length > 0 && (
                  <SearchGroup label={t("compositions")} icon={<Music className="w-3.5 h-3.5 text-sky-500" />}>
                    {compositions.map((c) => (
                      <SearchItem key={c.$id} href={`/wiki/compositions/${c.slug}`} onClick={onClose}
                        title={c.title} subtitle={[c.period, c.year?.toString()].filter(Boolean).join(" • ")} icon={<Music className="w-4 h-4 text-sky-500" />} />
                    ))}
                  </SearchGroup>
                )}
                {genres.length > 0 && (
                  <SearchGroup label={t("genres")} icon={<Tag className="w-3.5 h-3.5 text-emerald-500" />}>
                    {genres.map((g) => (
                      <SearchItem key={g.$id} href={`/wiki/genres/${g.slug}`} onClick={onClose}
                        title={g.name} subtitle={g.era ?? undefined} icon={<Tag className="w-4 h-4 text-emerald-500" />} />
                    ))}
                  </SearchGroup>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-zinc-200 dark:border-white/5 text-[11px] text-zinc-400">
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono mr-1">ESC</kbd> to close
          </div>
        </div>
      </div>
    </>
  );
}

function SearchGroup({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
        {icon} {label}
      </div>
      {children}
    </div>
  );
}

function SearchItem({ href, onClick, title, subtitle, icon }: { href: string; onClick: () => void; title: string; subtitle?: string; icon: React.ReactNode }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors group">
      <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-zinc-900 dark:text-white truncate group-hover:text-[#C8A856] transition-colors">{title}</p>
        {subtitle && <p className="text-xs text-zinc-400 truncate">{subtitle}</p>}
      </div>
    </Link>
  );
}
