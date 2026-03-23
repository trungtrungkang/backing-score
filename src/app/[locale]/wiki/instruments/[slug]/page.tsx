"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { getInstrumentBySlug } from "@/lib/appwrite/instruments";
import { listPublished } from "@/lib/appwrite";
import { getTranslationsForEntity, applyTranslations } from "@/lib/appwrite/wikiTranslations";
import type { InstrumentDocument, ProjectDocument } from "@/lib/appwrite/types";
import { Guitar, ArrowLeft, Play, Info } from "lucide-react";
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
            (p: any) => p.instrumentIds?.includes(inst.$id) || p.instruments?.includes(inst.name)
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

  const infoItems = [
    { label: t("family"), value: instrument.family },
    { label: t("tuning"), value: instrument.tuning },
    { label: t("range"), value: instrument.range },
    { label: t("origin"), value: instrument.origin },
  ].filter(i => i.value);

  return (
    <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white pt-8 pb-32 px-6">
      <div className="max-w-[900px] mx-auto">

        <Link href="/wiki" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-[#C8A856] transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> {t("hubTitle")}
        </Link>

        {/* Header */}
        <div className="flex items-start gap-6 mb-10">
          <div className="w-24 h-24 rounded-2xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center shrink-0 overflow-hidden">
            {instrument.imageUrl ? (
              <img src={instrument.imageUrl} alt={instrument.name} className="w-full h-full object-cover" />
            ) : (
              <Guitar className="w-10 h-10 text-amber-500" />
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-1">{instrument.name}</h1>
            {instrument.family && (
              <p className="text-sm text-amber-600 dark:text-amber-400 font-semibold">{instrument.family}</p>
            )}
          </div>
        </div>

        {/* Info Grid */}
        {infoItems.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {infoItems.map((item) => (
              <div key={item.label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-xl p-4">
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-1">{item.label}</p>
                <p className="font-bold text-sm">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Description */}
        {instrument.description && (
          <section className="mb-10">
            <RichTextRenderer content={instrument.description} />
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
