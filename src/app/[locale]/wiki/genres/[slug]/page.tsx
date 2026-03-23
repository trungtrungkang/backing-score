"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { getGenreBySlug, listSubGenres } from "@/lib/appwrite/genres";
import { listCompositionsByGenre } from "@/lib/appwrite/compositions";
import { listPublished } from "@/lib/appwrite";
import { getTranslationsForEntity, applyTranslations } from "@/lib/appwrite/wikiTranslations";
import type { GenreDocument, CompositionDocument, ProjectDocument } from "@/lib/appwrite/types";
import { Tag, ArrowLeft, Play, Disc3, ChevronRight, Music } from "lucide-react";
import { useParams } from "next/navigation";
import { RichTextRenderer } from "@/components/RichTextRenderer";

export default function GenreDetailPage() {
  const t = useTranslations("Wiki");
  const locale = useLocale();
  const params = useParams<{ slug: string }>();
  const [genre, setGenre] = useState<GenreDocument | null>(null);
  const [subGenres, setSubGenres] = useState<GenreDocument[]>([]);
  const [compositions, setCompositions] = useState<CompositionDocument[]>([]);
  const [projects, setProjects] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.slug) return;
    setLoading(true);
    getGenreBySlug(params.slug).then(async (g) => {
      if (g) {
        const translations = await getTranslationsForEntity(g.$id, locale);
        setGenre(applyTranslations(g, translations));
        const [subs, comps, allProjects] = await Promise.all([
          listSubGenres(g.$id),
          listCompositionsByGenre(g.$id),
          listPublished(),
        ]);
        setSubGenres(subs);
        setCompositions(comps);
        setProjects(allProjects.filter((p: any) => p.genreId === g.$id || p.wikiGenreId === g.$id));
      } else {
        setGenre(null);
      }
    }).finally(() => setLoading(false));
  }, [params.slug, locale]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdfdfc] dark:bg-[#0E0E11]">
        <div className="w-8 h-8 border-2 border-zinc-300 dark:border-zinc-700 border-t-[#C8A856] rounded-full animate-spin" />
      </div>
    );
  }

  if (!genre) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-500">
        <p className="text-lg mb-4">{t("noResults")}</p>
        <Link href="/wiki" className="text-[#C8A856] hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Wiki
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white">

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/15 via-emerald-500/5 to-transparent dark:from-emerald-900/20 dark:via-emerald-900/5" />
        <div className="relative max-w-[1100px] mx-auto px-6 pt-8 pb-12">
          <Link href="/wiki" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-[#C8A856] transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" /> {t("hubTitle")}
          </Link>

          <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0 shadow-xl shadow-emerald-500/10 ring-1 ring-white/10">
              <Tag className="w-14 h-14 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl md:text-4xl font-extrabold mb-3 tracking-tight">{genre.name}</h1>
              {genre.era && (
                <span className="inline-flex px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-sm font-bold uppercase tracking-wider">
                  {genre.era}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content + Sidebar */}
      <div className="max-w-[1100px] mx-auto px-6 pb-32">
        <div className="flex flex-col lg:flex-row gap-10 -mt-2">

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Description */}
            {genre.description && (
              <section className="mb-10">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                  <span className="w-1 h-6 bg-emerald-500 rounded-full" />
                  About
                </h2>
                <div className="prose prose-zinc dark:prose-invert max-w-none leading-relaxed">
                  <RichTextRenderer content={genre.description} />
                </div>
              </section>
            )}

            {/* Compositions in this genre */}
            {compositions.length > 0 && (
              <section className="mb-10">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                  <span className="w-1 h-6 bg-sky-500 rounded-full" />
                  {t("compositions")} ({compositions.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {compositions.map((comp) => (
                    <Link href={`/wiki/compositions/${comp.slug}`} key={comp.$id} className="group block">
                      <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-500/10 flex items-center justify-center shrink-0">
                            <Disc3 className="w-5 h-5 text-sky-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-[15px] truncate group-hover:text-[#C8A856] transition-colors">{comp.title}</h3>
                            <div className="text-xs text-zinc-500 flex gap-2 mt-0.5">
                              {comp.period && <span>{comp.period}</span>}
                              {comp.year && <span>• {comp.year}</span>}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600 shrink-0 group-hover:text-[#C8A856] transition-colors" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Related Projects */}
            {projects.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                  <span className="w-1 h-6 bg-[#C8A856] rounded-full" />
                  {t("relatedProjects")}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {projects.map((p) => (
                    <Link href={`/play/${p.$id}`} key={p.$id} className="group block">
                      <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 rounded-2xl p-5 flex items-center gap-4 hover:shadow-lg hover:shadow-[#C8A856]/5 hover:-translate-y-0.5 transition-all">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#C8A856]/20 to-[#C8A856]/5 flex items-center justify-center shrink-0">
                          <Play className="w-5 h-5 text-[#C8A856]" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-[15px] truncate group-hover:text-[#C8A856] transition-colors">{p.name}</h3>
                          <p className="text-xs text-zinc-500 mt-0.5">{t("practiceNow")}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600 ml-auto shrink-0 group-hover:text-[#C8A856] transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <aside className="lg:w-[320px] shrink-0">
            {/* Sub-genres */}
            {subGenres.length > 0 && (
              <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 rounded-2xl p-6 mb-6 shadow-sm">
                <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4">{t("subGenres")}</h3>
                <div className="flex flex-col gap-2">
                  {subGenres.map((sg) => (
                    <Link href={`/wiki/genres/${sg.slug}`} key={sg.$id} className="group">
                      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors">
                        <Tag className="w-4 h-4 text-emerald-400" />
                        {sg.name}
                        <ChevronRight className="w-3 h-3 ml-auto text-zinc-300 dark:text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {compositions.length > 0 && (
                <div className="bg-gradient-to-br from-sky-500/10 to-sky-500/5 border border-sky-500/20 rounded-2xl p-4 text-center">
                  <div className="text-2xl font-black text-sky-500 mb-0.5">{compositions.length}</div>
                  <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{t("compositions")}</div>
                </div>
              )}
              {projects.length > 0 && (
                <div className="bg-gradient-to-br from-[#C8A856]/10 to-[#C8A856]/5 border border-[#C8A856]/20 rounded-2xl p-4 text-center">
                  <div className="text-2xl font-black text-[#C8A856] mb-0.5">{projects.length}</div>
                  <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Projects</div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
