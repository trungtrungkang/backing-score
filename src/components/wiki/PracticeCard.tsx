"use client";

import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import type { ProjectDocument } from "@/lib/appwrite/types";
import { Play, Music2, ChevronRight, Headphones, Clock } from "lucide-react";

interface PracticeCardProps {
  projects: ProjectDocument[];
  compositionTitle?: string;
  accentColor?: string; // e.g. "sky", "violet", "amber"
}

/**
 * PracticeCard — displayed on wiki detail pages to show available practice tracks
 * for a given composition or artist. Shows a list of linked projects with "Play" CTAs.
 */
export function PracticeCard({ projects, compositionTitle, accentColor = "sky" }: PracticeCardProps) {
  const t = useTranslations("Wiki");

  if (projects.length === 0) return null;

  const colorMap: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
    sky: {
      bg: "bg-sky-500/10",
      text: "text-sky-500",
      border: "border-sky-500/20",
      gradient: "from-sky-500/15 to-sky-500/5",
    },
    violet: {
      bg: "bg-violet-500/10",
      text: "text-violet-500",
      border: "border-violet-500/20",
      gradient: "from-violet-500/15 to-violet-500/5",
    },
    amber: {
      bg: "bg-amber-500/10",
      text: "text-amber-500",
      border: "border-amber-500/20",
      gradient: "from-amber-500/15 to-amber-500/5",
    },
    emerald: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-500",
      border: "border-emerald-500/20",
      gradient: "from-emerald-500/15 to-emerald-500/5",
    },
    gold: {
      bg: "bg-[#C8A856]/10",
      text: "text-[#C8A856]",
      border: "border-[#C8A856]/20",
      gradient: "from-[#C8A856]/15 to-[#C8A856]/5",
    },
  };
  const c = colorMap[accentColor] || colorMap.gold;

  return (
    <section>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span className={`w-1 h-6 rounded-full bg-[#C8A856]`} />
          <Headphones className="w-5 h-5 text-[#C8A856]" />
          {t("practiceNow")}
        </h2>
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          {projects.length} {projects.length === 1 ? "track" : "tracks"}
        </span>
      </div>

      {/* Featured CTA (first project) */}
      <Link href={`/play/${projects[0].$id}`} className="group block mb-4">
        <div className={`bg-gradient-to-br ${c.gradient} border ${c.border} rounded-2xl p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all`}>
          <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-xl ${c.bg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
              <Play className={`w-7 h-7 ${c.text}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg truncate group-hover:text-[#C8A856] transition-colors">
                {projects[0].name}
              </h3>
              <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                {projects[0].creatorEmail && (
                  <span>by {projects[0].creatorEmail.split("@")[0]}</span>
                )}
                {projects[0].tags && projects[0].tags.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Music2 className="w-3 h-3" />
                    {projects[0].tags.slice(0, 2).join(", ")}
                  </span>
                )}
              </div>
            </div>
            <div className={`px-4 py-2 rounded-full bg-[#C8A856] text-white text-sm font-bold shrink-0 group-hover:bg-[#b8963e] transition-colors`}>
              ▶ Play
            </div>
          </div>
        </div>
      </Link>

      {/* Additional tracks */}
      {projects.length > 1 && (
        <div className="grid grid-cols-1 gap-3">
          {projects.slice(1).map((p) => (
            <Link href={`/play/${p.$id}`} key={p.$id} className="group block">
              <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 rounded-xl p-4 flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#C8A856]/20 to-[#C8A856]/5 flex items-center justify-center shrink-0">
                  <Play className="w-4 h-4 text-[#C8A856]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-sm truncate group-hover:text-[#C8A856] transition-colors">{p.name}</h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {p.creatorEmail ? `by ${p.creatorEmail.split("@")[0]}` : t("practiceNow")}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600 shrink-0 group-hover:text-[#C8A856] transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
