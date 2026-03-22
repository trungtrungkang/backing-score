"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Search, Play, Mic2, SlidersHorizontal, Library, LayoutDashboard,
  Rss, GraduationCap, FolderPlus, PenTool, Music, Layers,
  Tag, Shuffle, Image, Upload, Share2, FolderCog, BookOpen,
  Keyboard, ChevronDown, ChevronUp, Lock, Star
} from "lucide-react";
import { cn } from "@/lib/utils";

type Section = {
  icon: React.ReactNode;
  titleKey: string;
  bodyKey: string;
  color: string;
};

const USER_SECTIONS: Section[] = [
  { icon: <Search className="w-5 h-5" />, titleKey: "discoverTitle", bodyKey: "discoverBody", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  { icon: <Play className="w-5 h-5" />, titleKey: "playTitle", bodyKey: "playBody", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  { icon: <Mic2 className="w-5 h-5" />, titleKey: "waitModeTitle", bodyKey: "waitModeBody", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  { icon: <SlidersHorizontal className="w-5 h-5" />, titleKey: "mixerTitle", bodyKey: "mixerBody", color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
  { icon: <Library className="w-5 h-5" />, titleKey: "collectionsTitle", bodyKey: "collectionsBody", color: "text-pink-500 bg-pink-500/10 border-pink-500/20" },
  { icon: <LayoutDashboard className="w-5 h-5" />, titleKey: "dashboardTitle", bodyKey: "dashboardBody", color: "text-sky-500 bg-sky-500/10 border-sky-500/20" },
  { icon: <Rss className="w-5 h-5" />, titleKey: "feedTitle", bodyKey: "feedBody", color: "text-rose-500 bg-rose-500/10 border-rose-500/20" },
  { icon: <GraduationCap className="w-5 h-5" />, titleKey: "academyTitle", bodyKey: "academyBody", color: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
];

const CREATOR_SECTIONS: Section[] = [
  { icon: <FolderPlus className="w-5 h-5" />, titleKey: "createProjectTitle", bodyKey: "createProjectBody", color: "text-[#C8A856] bg-[#C8A856]/10 border-[#C8A856]/20" },
  { icon: <PenTool className="w-5 h-5" />, titleKey: "editorTitle", bodyKey: "editorBody", color: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
  { icon: <Music className="w-5 h-5" />, titleKey: "uploadScoreTitle", bodyKey: "uploadScoreBody", color: "text-teal-500 bg-teal-500/10 border-teal-500/20" },
  { icon: <Layers className="w-5 h-5" />, titleKey: "uploadStemsTitle", bodyKey: "uploadStemsBody", color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20" },
  { icon: <Tag className="w-5 h-5" />, titleKey: "tagsTitle", bodyKey: "tagsBody", color: "text-lime-600 bg-lime-500/10 border-lime-500/20" },
  { icon: <Shuffle className="w-5 h-5" />, titleKey: "syncModeTitle", bodyKey: "syncModeBody", color: "text-red-500 bg-red-500/10 border-red-500/20" },
  { icon: <Image className="w-5 h-5" />, titleKey: "coverArtTitle", bodyKey: "coverArtBody", color: "text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20" },
  { icon: <Upload className="w-5 h-5" />, titleKey: "publishTitle", bodyKey: "publishBody", color: "text-[#C8A856] bg-[#C8A856]/10 border-[#C8A856]/30" },
  { icon: <Share2 className="w-5 h-5" />, titleKey: "shareToFeedTitle", bodyKey: "shareToFeedBody", color: "text-sky-500 bg-sky-500/10 border-sky-500/20" },
  { icon: <FolderCog className="w-5 h-5" />, titleKey: "manageCollectionsTitle", bodyKey: "manageCollectionsBody", color: "text-pink-500 bg-pink-500/10 border-pink-500/20" },
  { icon: <BookOpen className="w-5 h-5" />, titleKey: "createCourseTitle", bodyKey: "createCourseBody", color: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
];

function AccordionItem({ section, t }: { section: Section; t: ReturnType<typeof useTranslations> }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "border rounded-xl overflow-hidden transition-all duration-200",
        open
          ? "border-zinc-300 bg-zinc-100 dark:border-white/20 dark:bg-white/5"
          : "border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:bg-white/5 dark:hover:border-white/15"
      )}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border", section.color)}>
          {section.icon}
        </div>
        <span className="flex-1 font-semibold text-zinc-900 dark:text-white text-sm">{t(section.titleKey as any)}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1">
          <div className="ml-[52px] text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
            {t(section.bodyKey as any)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function UserGuidePage() {
  const t = useTranslations("UserGuide");
  const [tab, setTab] = useState<"user" | "creator">("user");

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-700 dark:bg-[#0E0E11] dark:text-zinc-300">
      <main className="max-w-3xl mx-auto px-4 pt-20 pb-32">

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#C8A856]/10 border border-[#C8A856]/30 rounded-full text-[#C8A856] text-xs font-bold uppercase tracking-widest mb-5">
            <BookOpen className="w-3.5 h-3.5" />
            {t("pageTitle")}
          </div>
          <h1 className="text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight mb-3">
            {t("pageTitle")}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-lg">{t("pageSubtitle")}</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 p-1.5 bg-zinc-200/60 border border-zinc-300 dark:bg-white/5 dark:border-white/10 rounded-xl mb-8">
          <button
            onClick={() => setTab("user")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
              tab === "user"
                ? "bg-white text-zinc-900 shadow"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            )}
          >
            <Star className="w-4 h-4" />
            {t("userSection")}
          </button>
          <button
            onClick={() => setTab("creator")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
              tab === "creator"
                ? "bg-[#C8A856] text-black shadow"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            )}
          >
            <Lock className="w-4 h-4" />
            {t("creatorSection")}
          </button>
        </div>

        {/* Sections */}
        {tab === "user" ? (
          <div className="space-y-2">
            {USER_SECTIONS.map((s) => (
              <AccordionItem key={s.titleKey} section={s} t={t} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 rounded-xl mb-4 text-sm text-amber-700 dark:text-amber-300">
              <Lock className="w-4 h-4 shrink-0" />
              {t("creatorOnlyNote")}
            </div>
            {CREATOR_SECTIONS.map((s) => (
              <AccordionItem key={s.titleKey} section={s} t={t} />
            ))}
          </div>
        )}

        {/* Keyboard Shortcuts */}
        <div className="mt-10 border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.03]">
            <Keyboard className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            <span className="font-semibold text-zinc-900 dark:text-white text-sm">{t("keyboardTitle")}</span>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-white/5">
            <div className="flex items-center justify-between px-5 py-3 text-sm bg-white dark:bg-transparent">
              <kbd className="px-2 py-1 bg-zinc-100 border border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 rounded text-xs font-mono text-zinc-700 dark:text-zinc-300">Space</kbd>
              <span className="text-zinc-500 dark:text-zinc-400 text-right max-w-xs">{t("shortcutSpace")}</span>
            </div>
            <div className="flex items-center justify-between px-5 py-3 text-sm bg-white dark:bg-transparent">
              <kbd className="px-2 py-1 bg-zinc-100 border border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 rounded text-xs font-mono text-zinc-700 dark:text-zinc-300">Click</kbd>
              <span className="text-zinc-500 dark:text-zinc-400 text-right max-w-xs">{t("shortcutClick")}</span>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
