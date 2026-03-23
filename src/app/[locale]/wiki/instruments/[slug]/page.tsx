"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { getInstrumentBySlug } from "@/lib/appwrite/instruments";
import { listPublished } from "@/lib/appwrite";
import { getTranslationsForEntity, applyTranslations } from "@/lib/appwrite/wikiTranslations";
import type { InstrumentDocument, ProjectDocument } from "@/lib/appwrite/types";
import { Guitar, ArrowLeft, Play, ChevronRight } from "lucide-react";
import { useParams } from "next/navigation";
import { RichTextRenderer } from "@/components/RichTextRenderer";

export default function InstrumentDetailPage() {
  const t = useTranslations("Wiki");
  const locale = useLocale();
  const params = useParams<{ slug: string }>();
  const [instrument, setInstrument] = useState<InstrumentDocument | null>(null);
  const [projects, setProjects] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.slug) return;
    setLoading(true);
    getInstrumentBySlug(params.slug).then(async (inst) => {
      if (inst) {
        const translations = await getTranslationsForEntity(inst.$id, locale);
        setInstrument(applyTranslations(inst, translations));
        try {
          const all = await listPublished();
          const related = all.filter(
            (p: any) => p.instrumentIds?.includes(inst.$id) || p.instruments?.includes(inst.name) || p.wikiInstrumentIds?.includes(inst.$id)
          );
          setProjects(related);
        } catch {}
      } else {
        setInstrument(null);
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

  if (!instrument) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-500">
        <p className="text-lg mb-4">{t("noResults")}</p>
        <Link href="/wiki" className="text-[#C8A856] hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Wiki
        </Link>
      </div>
    );
  }

  const specItems = [
    { label: t("family"), value: instrument.family, color: "text-amber-500" },
    { label: t("tuning"), value: instrument.tuning, color: "text-sky-500" },
    { label: t("range"), value: instrument.range, color: "text-emerald-500" },
    { label: t("origin"), value: instrument.origin, color: "text-violet-500" },
  ].filter(i => i.value);

  return (
    <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white">

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent dark:from-amber-900/20 dark:via-amber-900/5" />
        {instrument.imageUrl && (
          <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.03]">
            <img src={instrument.imageUrl} alt="" className="w-full h-full object-cover blur-3xl scale-125" />
          </div>
        )}
        <div className="relative max-w-[1100px] mx-auto px-6 pt-8 pb-12">
          <Link href="/wiki" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-[#C8A856] transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" /> {t("hubTitle")}
          </Link>

          <div className="flex flex-col md:flex-row items-start gap-8">
            {/* Image */}
            <div className="w-36 h-36 md:w-44 md:h-44 rounded-2xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center shrink-0 overflow-hidden shadow-xl shadow-amber-500/10 ring-1 ring-white/10">
              {instrument.imageUrl ? (
                <img src={instrument.imageUrl} alt={instrument.name} className="w-full h-full object-cover" />
              ) : (
                <Guitar className="w-16 h-16 text-amber-500" />
              )}
            </div>

            {/* Title & Family */}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl md:text-4xl font-extrabold mb-2 tracking-tight">{instrument.name}</h1>
              {instrument.family && (
                <span className="inline-flex px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 text-sm font-bold uppercase tracking-wider mb-4">
                  {instrument.family}
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
            {instrument.description && (
              <section className="mb-10">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                  <span className="w-1 h-6 bg-amber-500 rounded-full" />
                  About
                </h2>
                <div className="prose prose-zinc dark:prose-invert max-w-none leading-relaxed">
                  <RichTextRenderer content={instrument.description} />
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
            {/* Specs Card */}
            {specItems.length > 0 && (
              <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 rounded-2xl p-6 mb-6 shadow-sm">
                <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4">Specifications</h3>
                <dl className="space-y-4">
                  {specItems.map((item) => (
                    <div key={item.label}>
                      <dt className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-1">{item.label}</dt>
                      <dd className="text-sm font-bold">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Projects count */}
            {projects.length > 0 && (
              <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-2xl p-5 text-center">
                <div className="text-3xl font-black text-amber-500 mb-1">{projects.length}</div>
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t("relatedProjects")}</div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
