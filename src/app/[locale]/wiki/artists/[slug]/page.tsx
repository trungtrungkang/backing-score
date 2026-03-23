"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { getArtistBySlug } from "@/lib/appwrite/artists";
import { listProjectsByArtist } from "@/lib/appwrite/projects";
import { getTranslationsForEntity, applyTranslations } from "@/lib/appwrite/wikiTranslations";
import type { ArtistDocument, ProjectDocument } from "@/lib/appwrite/types";
import { User2, MapPin, Calendar, ArrowLeft, ExternalLink, Globe } from "lucide-react";
import { useParams } from "next/navigation";
import { RichTextRenderer } from "@/components/RichTextRenderer";
import { PracticeCard } from "@/components/wiki/PracticeCard";

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
        const translations = await getTranslationsForEntity(a.$id, locale);
        setArtist(applyTranslations(a, translations));
        try {
          const linked = await listProjectsByArtist(a.$id);
          setProjects(linked);
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
    <div className="min-h-screen bg-[#fdfdfc] dark:bg-[#0E0E11] text-zinc-900 dark:text-white">

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-600/20 via-violet-600/10 to-transparent dark:from-violet-900/30 dark:via-violet-900/10" />
        {artist.imageUrl && (
          <div className="absolute inset-0 opacity-[0.08] dark:opacity-[0.05]">
            <img src={artist.imageUrl} alt="" className="w-full h-full object-cover blur-3xl scale-110" />
          </div>
        )}
        <div className="relative max-w-[1100px] mx-auto px-6 pt-8 pb-12">
          {/* Back link */}
          <Link href="/wiki" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-[#C8A856] transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" /> {t("hubTitle")}
          </Link>

          <div className="flex flex-col md:flex-row items-start gap-8">
            {/* Portrait */}
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center shrink-0 overflow-hidden shadow-xl shadow-violet-500/10 ring-1 ring-white/10">
              {artist.imageUrl ? (
                <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover" />
              ) : (
                <User2 className="w-16 h-16 text-violet-500" />
              )}
            </div>

            {/* Title & Meta */}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl md:text-4xl font-extrabold mb-2 tracking-tight">{artist.name}</h1>
              {artist.nameOriginal && (
                <p className="text-lg text-zinc-400 dark:text-zinc-500 mb-3 font-medium italic">{artist.nameOriginal}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {artist.roles && artist.roles.length > 0 && artist.roles.map(r => (
                  <span key={r} className="px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 text-xs font-bold uppercase tracking-wider">{r}</span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                {artist.nationality && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-violet-400" /> {artist.nationality}
                  </span>
                )}
                {artist.birthDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-violet-400" />
                    {artist.birthDate}{artist.deathDate ? ` — ${artist.deathDate}` : ""}
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
            {/* Bio */}
            {artist.bio && (
              <section className="mb-10">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                  <span className="w-1 h-6 bg-violet-500 rounded-full" />
                  {t("biography")}
                </h2>
                <div className="prose prose-zinc dark:prose-invert max-w-none leading-relaxed">
                  <RichTextRenderer content={artist.bio} />
                </div>
              </section>
            )}

            {/* Practice Projects */}
            <PracticeCard projects={projects} accentColor="violet" />
          </div>

          {/* Sidebar */}
          <aside className="lg:w-[320px] shrink-0">
            {/* Quick Facts Card */}
            <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 rounded-2xl p-6 mb-6 shadow-sm">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4">Quick Facts</h3>
              <dl className="space-y-3">
                {artist.nationality && (
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-zinc-500">Nationality</dt>
                    <dd className="text-sm font-semibold">{artist.nationality}</dd>
                  </div>
                )}
                {artist.birthDate && (
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-zinc-500">Born</dt>
                    <dd className="text-sm font-semibold">{artist.birthDate}</dd>
                  </div>
                )}
                {artist.deathDate && (
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-zinc-500">Died</dt>
                    <dd className="text-sm font-semibold">{artist.deathDate}</dd>
                  </div>
                )}
                {artist.roles && artist.roles.length > 0 && (
                  <div className="flex justify-between items-start">
                    <dt className="text-sm text-zinc-500">Roles</dt>
                    <dd className="text-sm font-semibold text-right">{artist.roles.join(", ")}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* External Links */}
            {externalLinks && Object.keys(externalLinks).length > 0 && (
              <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 rounded-2xl p-6 mb-6 shadow-sm">
                <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4">External Links</h3>
                <div className="flex flex-col gap-2">
                  {Object.entries(externalLinks).map(([label, url]) => (
                    <a key={label} href={url as string} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-[#C8A856] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group">
                      <Globe className="w-4 h-4 text-zinc-400 group-hover:text-[#C8A856] transition-colors" />
                      {label}
                      <ExternalLink className="w-3 h-3 ml-auto text-zinc-300 dark:text-zinc-600" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Projects count badge */}
            {projects.length > 0 && (
              <div className="bg-gradient-to-br from-[#C8A856]/10 to-[#C8A856]/5 border border-[#C8A856]/20 rounded-2xl p-5 text-center">
                <div className="text-3xl font-black text-[#C8A856] mb-1">{projects.length}</div>
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t("relatedProjects")}</div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
