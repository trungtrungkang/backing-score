"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { getGenreBySlug, listSubGenres } from "@/lib/appwrite/genres";
import { listCompositionsByGenre } from "@/lib/appwrite/compositions";
import { listPublished } from "@/lib/appwrite";
import { getTranslationsForEntity, applyTranslations } from "@/lib/appwrite/wikiTranslations";
import type { GenreDocument, CompositionDocument, ProjectDocument } from "@/lib/appwrite/types";
import { Tag, ArrowLeft, Play, Disc3, ChevronRight } from "lucide-react";
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
        setProjects(allProjects.filter((p: any) => p.genreId === g.$id));
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
    <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white pt-8 pb-32 px-6">
      <div className="max-w-[900px] mx-auto">

        <Link href="/wiki" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-[#C8A856] transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> {t("hubTitle")}
        </Link>

        {/* Header */}
        <div className="flex items-start gap-6 mb-10">
          <div className="w-20 h-20 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Tag className="w-10 h-10 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-1">{genre.name}</h1>
            {genre.era && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">{genre.era}</p>
            )}
          </div>
        </div>

        {/* Description */}
        {genre.description && (
          <section className="mb-10">
            <RichTextRenderer content={genre.description} />
          </section>
        )}

        {/* Sub-genres */}
        {subGenres.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-bold mb-4">{t("subGenres")}</h2>
            <div className="flex flex-wrap gap-2">
              {subGenres.map((sg) => (
                <Link href={`/wiki/genres/${sg.slug}`} key={sg.$id}>
                  <span className="px-4 py-2 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 text-sm font-semibold hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1.5">
                    {sg.name} <ChevronRight className="w-3 h-3" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Compositions in this genre */}
        {compositions.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-bold mb-4">{t("compositions")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {compositions.map((comp) => (
                <Link href={`/wiki/compositions/${comp.slug}`} key={comp.$id} className="group block">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center gap-3">
                      <Disc3 className="w-6 h-6 text-sky-500 shrink-0" />
                      <div className="min-w-0">
                        <h3 className="font-bold text-[15px] truncate group-hover:text-[#C8A856] transition-colors">{comp.title}</h3>
                        <div className="text-xs text-zinc-500 flex gap-2">
                          {comp.period && <span>{comp.period}</span>}
                          {comp.year && <span>• {comp.year}</span>}
                        </div>
                      </div>
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
            <h2 className="text-lg font-bold mb-4">{t("relatedProjects")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {projects.map((p) => (
                <Link href={`/play/${p.$id}`} key={p.$id} className="group block">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-2xl p-5 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                    <div className="w-10 h-10 rounded-lg bg-[#C8A856]/10 flex items-center justify-center shrink-0">
                      <Play className="w-4 h-4 text-[#C8A856]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-[15px] truncate group-hover:text-[#C8A856] transition-colors">{p.name}</h3>
                      <p className="text-xs text-zinc-500">{t("practiceNow")}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
