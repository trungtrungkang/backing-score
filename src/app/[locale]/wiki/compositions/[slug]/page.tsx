"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { getCompositionBySlug } from "@/lib/appwrite/compositions";
import { listPublished } from "@/lib/appwrite";
import { getTranslationsForEntity, applyTranslations } from "@/lib/appwrite/wikiTranslations";
import type { CompositionDocument, ProjectDocument } from "@/lib/appwrite/types";
import { Music, ArrowLeft, Play, Disc3, Calendar, Clock } from "lucide-react";
import { useParams } from "next/navigation";
import { RichTextRenderer } from "@/components/RichTextRenderer";

export default function CompositionDetailPage() {
  const t = useTranslations("Wiki");
  const locale = useLocale();
  const params = useParams<{ slug: string }>();
  const [composition, setComposition] = useState<CompositionDocument | null>(null);
  const [projects, setProjects] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.slug) return;
    setLoading(true);
    getCompositionBySlug(params.slug).then(async (comp) => {
      if (comp) {
        const translations = await getTranslationsForEntity(comp.$id, locale);
        setComposition(applyTranslations(comp, translations));
        if (comp.projectIds && comp.projectIds.length > 0) {
          try {
            const all = await listPublished();
            const related = all.filter((p: any) => comp.projectIds?.includes(p.$id));
            setProjects(related);
          } catch {}
        }
      } else {
        setComposition(null);
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

  if (!composition) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-500">
        <p className="text-lg mb-4">{t("noResults")}</p>
        <Link href="/wiki" className="text-[#C8A856] hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Wiki
        </Link>
      </div>
    );
  }

  const infoItems = [
    { label: t("period"), value: composition.period },
    { label: t("year"), value: composition.year?.toString() },
    { label: t("key"), value: composition.keySignature },
    { label: t("tempo"), value: composition.tempo },
    { label: t("difficulty"), value: composition.difficulty },
    { label: "Time Signature", value: composition.timeSignature },
  ].filter(i => i.value);

  return (
    <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white pt-8 pb-32 px-6">
      <div className="max-w-[900px] mx-auto">

        <Link href="/wiki" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-[#C8A856] transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> {t("hubTitle")}
        </Link>

        {/* Header */}
        <div className="flex items-start gap-6 mb-10">
          <div className="w-20 h-20 rounded-2xl bg-sky-100 dark:bg-sky-500/10 flex items-center justify-center shrink-0">
            <Disc3 className="w-10 h-10 text-sky-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">{composition.title}</h1>
            <div className="flex flex-wrap gap-2 text-sm text-zinc-500">
              {composition.period && <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-semibold">{composition.period}</span>}
              {composition.year && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {composition.year}</span>}
            </div>
          </div>
        </div>

        {/* Info Grid */}
        {infoItems.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
            {infoItems.map((item) => (
              <div key={item.label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-xl p-4">
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-1">{item.label}</p>
                <p className="font-bold text-sm">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Description */}
        {composition.description && (
          <section className="mb-10">
            <RichTextRenderer content={composition.description} />
          </section>
        )}


        {/* Practice Projects */}
        {projects.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Play className="w-5 h-5 text-[#C8A856]" /> {t("practiceNow")}
            </h2>
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
