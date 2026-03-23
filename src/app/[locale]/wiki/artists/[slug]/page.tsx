"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { getArtistBySlug } from "@/lib/appwrite/artists";
import { listPublished } from "@/lib/appwrite";
import { getTranslationsForEntity, applyTranslations } from "@/lib/appwrite/wikiTranslations";
import type { ArtistDocument, ProjectDocument } from "@/lib/appwrite/types";
import { User2, MapPin, Calendar, ArrowLeft, Play, ExternalLink } from "lucide-react";
import { useParams } from "next/navigation";
import { RichTextRenderer } from "@/components/RichTextRenderer";

export default function ArtistDetailPage() {
  const t = useTranslations("Wiki");
  const locale = useLocale();
  const params = useParams<{ slug: string }>();
  const [artist, setArtist] = useState<ArtistDocument | null>(null);
  const [projects, setProjects] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.slug) return;
    setLoading(true);
    getArtistBySlug(params.slug).then(async (a) => {
      if (a) {
        // Apply translations overlay
        const translations = await getTranslationsForEntity(a.$id, locale);
        setArtist(applyTranslations(a, translations));
        // Load related projects
        try {
          const all = await listPublished();
          const related = all.filter(
            (p: any) =>
              p.composerIds?.includes(a.$id) || p.performerIds?.includes(a.$id)
          );
          setProjects(related);
        } catch {}
      } else {
        setArtist(null);
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

  if (!artist) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-500">
        <p className="text-lg mb-4">{t("noResults")}</p>
        <Link href="/wiki" className="text-[#C8A856] hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Wiki
        </Link>
      </div>
    );
  }

  const externalLinks = artist.externalLinks ? (() => { try { return JSON.parse(artist.externalLinks); } catch { return null; } })() : null;

  return (
    <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white pt-8 pb-32 px-6">
      <div className="max-w-[900px] mx-auto">

        {/* Back link */}
        <Link href="/wiki" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-[#C8A856] transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> {t("hubTitle")}
        </Link>

        {/* Header */}
        <div className="flex items-start gap-6 mb-10">
          <div className="w-24 h-24 rounded-2xl bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center shrink-0 overflow-hidden">
            {artist.imageUrl ? (
              <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover" />
            ) : (
              <User2 className="w-10 h-10 text-violet-500" />
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-1">{artist.name}</h1>
            {artist.nameOriginal && (
              <p className="text-lg text-zinc-400 mb-2">{artist.nameOriginal}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
              {artist.roles && artist.roles.length > 0 && (
                <span className="flex items-center gap-1">
                  {artist.roles.map(r => (
                    <span key={r} className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-semibold">{r}</span>
                  ))}
                </span>
              )}
              {artist.nationality && (
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {artist.nationality}</span>
              )}
              {artist.birthDate && (
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {artist.birthDate}{artist.deathDate ? ` — ${artist.deathDate}` : ""}</span>
              )}
            </div>
          </div>
        </div>

        {/* Bio */}
        {artist.bio && (
          <section className="mb-10">
            <h2 className="text-lg font-bold mb-4">{t("biography")}</h2>
            <RichTextRenderer content={artist.bio} />
          </section>
        )}

        {/* External links */}
        {externalLinks && (
          <section className="mb-10">
            <div className="flex flex-wrap gap-2">
              {Object.entries(externalLinks).map(([label, url]) => (
                <a key={label} href={url as string} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-[#C8A856] transition-colors">
                  <ExternalLink className="w-3 h-3" /> {label}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Related Projects */}
        {projects.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-4">{t("works")}</h2>
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
