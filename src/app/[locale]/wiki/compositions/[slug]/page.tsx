"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { getCompositionBySlug } from "@/lib/appwrite/compositions";
import { listProjectsByComposition } from "@/lib/appwrite/projects";
import { getTranslationsForEntity, applyTranslations } from "@/lib/appwrite/wikiTranslations";
import type { CompositionDocument, ProjectDocument } from "@/lib/appwrite/types";
import { ArrowLeft, Disc3, Calendar, Music2, Gauge } from "lucide-react";
import { useParams } from "next/navigation";
import { RichTextRenderer } from "@/components/RichTextRenderer";
import { PracticeCard } from "@/components/wiki/PracticeCard";

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
        try {
          const linked = await listProjectsByComposition(comp.$id);
          setProjects(linked);
        } catch {}
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

  const difficultyColor = (d?: string) => {
    if (!d) return "text-zinc-400 bg-zinc-100 dark:bg-zinc-800";
    const lower = d.toLowerCase();
    if (lower.includes("easy") || lower.includes("beginner")) return "text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400";
    if (lower.includes("intermediate") || lower.includes("medium")) return "text-amber-600 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400";
    if (lower.includes("advanced") || lower.includes("hard")) return "text-red-600 bg-red-100 dark:bg-red-500/15 dark:text-red-400";
    return "text-sky-600 bg-sky-100 dark:bg-sky-500/15 dark:text-sky-400";
  };

  return (
    <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white">

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sky-500/15 via-sky-500/5 to-transparent dark:from-sky-900/20 dark:via-sky-900/5" />
        <div className="relative max-w-[1100px] mx-auto px-6 pt-8 pb-12">
          <Link href="/wiki" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-[#C8A856] transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" /> {t("hubTitle")}
          </Link>

          <div className="flex flex-col md:flex-row items-start gap-8">
            {/* Icon */}
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl bg-sky-100 dark:bg-sky-500/10 flex items-center justify-center shrink-0 shadow-xl shadow-sky-500/10 ring-1 ring-white/10">
              <Disc3 className="w-14 h-14 text-sky-500 animate-[spin_8s_linear_infinite]" />
            </div>

            {/* Title & Meta */}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl md:text-4xl font-extrabold mb-3 tracking-tight">{composition.title}</h1>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {composition.period && (
                  <span className="px-3 py-1 rounded-full bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 text-xs font-bold uppercase tracking-wider">{composition.period}</span>
                )}
                {composition.difficulty && (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${difficultyColor(composition.difficulty)}`}>
                    {composition.difficulty}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                {composition.year && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-sky-400" /> {composition.year}
                  </span>
                )}
                {composition.keySignature && (
                  <span className="flex items-center gap-1.5">
                    <Music2 className="w-4 h-4 text-sky-400" /> {composition.keySignature}
                  </span>
                )}
                {composition.tempo && (
                  <span className="flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-sky-400" /> {composition.tempo}
                  </span>
                )}
              </div>
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
            {composition.description && (
              <section className="mb-10">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                  <span className="w-1 h-6 bg-sky-500 rounded-full" />
                  About this Composition
                </h2>
                <div className="prose prose-zinc dark:prose-invert max-w-none leading-relaxed">
                  <RichTextRenderer content={composition.description} />
                </div>
              </section>
            )}

            {/* Practice Projects */}
            <PracticeCard projects={projects} compositionTitle={composition.title} accentColor="sky" />
          </div>

          {/* Sidebar */}
          <aside className="lg:w-[320px] shrink-0">
            {/* Metadata Card */}
            <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 rounded-2xl p-6 mb-6 shadow-sm">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4">Details</h3>
              <dl className="space-y-4">
                {composition.period && (
                  <div>
                    <dt className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-1">{t("period")}</dt>
                    <dd className="text-sm font-bold">{composition.period}</dd>
                  </div>
                )}
                {composition.year && (
                  <div>
                    <dt className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-1">{t("year")}</dt>
                    <dd className="text-sm font-bold">{composition.year}</dd>
                  </div>
                )}
                {composition.keySignature && (
                  <div>
                    <dt className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-1">{t("key")}</dt>
                    <dd className="text-sm font-bold">{composition.keySignature}</dd>
                  </div>
                )}
                {composition.tempo && (
                  <div>
                    <dt className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-1">{t("tempo")}</dt>
                    <dd className="text-sm font-bold">{composition.tempo}</dd>
                  </div>
                )}
                {composition.timeSignature && (
                  <div>
                    <dt className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-1">Time Signature</dt>
                    <dd className="text-sm font-bold">{composition.timeSignature}</dd>
                  </div>
                )}
                {composition.difficulty && (
                  <div>
                    <dt className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-1">{t("difficulty")}</dt>
                    <dd><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${difficultyColor(composition.difficulty)}`}>{composition.difficulty}</span></dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Projects count */}
            {projects.length > 0 && (
              <div className="bg-gradient-to-br from-sky-500/10 to-sky-500/5 border border-sky-500/20 rounded-2xl p-5 text-center">
                <div className="text-3xl font-black text-sky-500 mb-1">{projects.length}</div>
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Practice Tracks</div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
