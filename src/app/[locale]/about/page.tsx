"use client";

import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import {
  Target, GraduationCap, Search, Users, Music, Mic2, SlidersHorizontal,
  BookOpen, Bookmark, Rss, Bell, CreditCard, Globe, Moon, Sun,
  Sparkles, School
} from "lucide-react";

/* ──────────────────────────── Pillar Config ──────────────────────────── */

const PILLAR_STYLES = [
  { icon: <Target className="w-7 h-7" />, emoji: "🎯", color: "from-amber-500 to-orange-500", border: "border-amber-500/30", bg: "bg-amber-500/10", text: "text-amber-500",
    featureIcons: [<Music className="w-5 h-5" key="m" />, <Mic2 className="w-5 h-5" key="mi" />, <SlidersHorizontal className="w-5 h-5" key="s" />] },
  { icon: <GraduationCap className="w-7 h-7" />, emoji: "🎓", color: "from-blue-500 to-indigo-500", border: "border-blue-500/30", bg: "bg-blue-500/10", text: "text-blue-500",
    featureIcons: [<GraduationCap className="w-5 h-5" key="g" />, <School className="w-5 h-5" key="sc" />] },
  { icon: <Search className="w-7 h-7" />, emoji: "🔍", color: "from-emerald-500 to-teal-500", border: "border-emerald-500/30", bg: "bg-emerald-500/10", text: "text-emerald-500",
    featureIcons: [<Sparkles className="w-5 h-5" key="sp" />, <BookOpen className="w-5 h-5" key="b" />, <Bookmark className="w-5 h-5" key="bm" />] },
  { icon: <Users className="w-7 h-7" />, emoji: "🤝", color: "from-purple-500 to-pink-500", border: "border-purple-500/30", bg: "bg-purple-500/10", text: "text-purple-500",
    featureIcons: [<Rss className="w-5 h-5" key="r" />, <Bell className="w-5 h-5" key="be" />] },
];

// Key mapping: pillar index → { titleKey, subtitleKey, descKey, features: [{ titleKey, descKey }] }
const PILLAR_KEYS = [
  { t: "p1Title", s: "p1Subtitle", d: "p1Desc", f: [{ t: "p1f1Title", d: "p1f1Desc" }, { t: "p1f2Title", d: "p1f2Desc" }, { t: "p1f3Title", d: "p1f3Desc" }] },
  { t: "p2Title", s: "p2Subtitle", d: "p2Desc", f: [{ t: "p2f1Title", d: "p2f1Desc" }, { t: "p2f2Title", d: "p2f2Desc" }] },
  { t: "p3Title", s: "p3Subtitle", d: "p3Desc", f: [{ t: "p3f1Title", d: "p3f1Desc" }, { t: "p3f2Title", d: "p3f2Desc" }, { t: "p3f3Title", d: "p3f3Desc" }] },
  { t: "p4Title", s: "p4Subtitle", d: "p4Desc", f: [{ t: "p4f1Title", d: "p4f1Desc" }, { t: "p4f2Title", d: "p4f2Desc" }] },
];

/* ──────────────────────────── Page ──────────────────────────── */

export default function AboutPage() {
  const t = useTranslations("About");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0E0E11] text-zinc-700 dark:text-zinc-300 font-sans selection:bg-[#C8A856]/30 selection:text-white">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-32">

        {/* ── Hero ── */}
        <section className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#C8A856]/10 border border-[#C8A856]/30 rounded-full text-[#C8A856] text-xs font-bold uppercase tracking-widest mb-6">
            <Music className="w-3.5 h-3.5" />
            {t("badge")}
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-zinc-900 dark:text-white tracking-tight mb-4 leading-tight">
            Backing & Score
          </h1>
          <p className="text-xl md:text-2xl font-medium text-transparent bg-clip-text bg-gradient-to-r from-[#C8A856] via-amber-400 to-orange-400 mb-4">
            {t("slogan")}
          </p>
          <p className="text-zinc-500 dark:text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed">
            {t("heroDesc")}
          </p>
        </section>

        {/* ── 4 Pillars Overview ── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-20">
          {PILLAR_KEYS.map((pk, i) => {
            const s = PILLAR_STYLES[i];
            return (
              <a key={i} href={`#pillar-${i}`} className={`group flex flex-col items-center gap-3 p-5 rounded-2xl border ${s.border} ${s.bg} hover:scale-[1.03] transition-all duration-200 cursor-pointer`}>
                <div className={s.text}>{s.icon}</div>
                <span className="font-bold text-zinc-900 dark:text-white text-sm">{t(pk.t as any)}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 text-center leading-snug">{t(pk.d as any)}</span>
              </a>
            );
          })}
        </section>

        {/* ── Pillar Sections ── */}
        {PILLAR_KEYS.map((pk, pi) => {
          const s = PILLAR_STYLES[pi];
          return (
            <section key={pi} id={`pillar-${pi}`} className="mb-20 scroll-mt-24">
              <div className="flex items-center gap-4 mb-8">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white shadow-lg`}>
                  {s.icon}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {t(pk.t as any)}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{t(pk.s as any)}</p>
                </div>
              </div>
              <div className="space-y-3">
                {pk.f.map((fk, fi) => (
                  <div key={fi} className="flex gap-4 p-5 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] hover:border-zinc-300 dark:hover:border-white/15 transition-all">
                    <div className={`w-10 h-10 rounded-lg ${s.bg} ${s.text} flex items-center justify-center shrink-0 border ${s.border}`}>
                      {s.featureIcons[fi]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-1">{t(fk.t as any)}</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{t(fk.d as any)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {/* ── Pricing ── */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-[#C8A856]" />
            {t("pricing")}
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-6 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.02]">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">{t("free")}</h3>
              <p className="text-3xl font-extrabold text-zinc-900 dark:text-white mb-4">$0</p>
              <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
                <li className="flex items-center gap-2">✅ {t("freeFeature1")}</li>
                <li className="flex items-center gap-2">✅ {t("freeFeature2")}</li>
                <li className="flex items-center gap-2">✅ {t("freeFeature3")}</li>
                <li className="flex items-center gap-2">❌ {t("freeNo")}</li>
              </ul>
            </div>
            <div className="p-6 rounded-2xl border-2 border-[#C8A856]/50 bg-[#C8A856]/5 relative">
              <div className="absolute -top-3 right-4 px-3 py-1 bg-[#C8A856] text-black text-xs font-bold rounded-full">PREMIUM</div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Premium</h3>
              <p className="text-3xl font-extrabold text-zinc-900 dark:text-white mb-1">$4.99<span className="text-base font-normal text-zinc-500">{t("premiumPrice")}</span></p>
              <p className="text-xs text-zinc-500 mb-4">{t("premiumSub")}</p>
              <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
                <li className="flex items-center gap-2">✅ {t("premiumFeature1")}</li>
                <li className="flex items-center gap-2">✅ {t("premiumFeature2")}</li>
                <li className="flex items-center gap-2">✅ {t("premiumFeature3")}</li>
                <li className="flex items-center gap-2">✅ {t("premiumFeature4")}</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Extras ── */}
        <section className="mb-20 grid md:grid-cols-2 gap-4">
          <div className="flex items-start gap-4 p-5 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02]">
            <Globe className="w-6 h-6 text-sky-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-1">{t("langTitle")}</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">English · Tiếng Việt · 简体中文 · 繁體中文 · Español · Français · Deutsch · 日本語 · 한국어</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-5 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02]">
            <div className="flex gap-1 shrink-0 mt-0.5">
              <Sun className="w-5 h-5 text-amber-500" />
              <Moon className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-1">{t("themeTitle")}</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("themeDesc")}</p>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="text-center bg-gradient-to-br from-[#C8A856]/10 via-amber-500/5 to-orange-500/10 border border-[#C8A856]/20 rounded-3xl p-10 md:p-14">
          <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
            {t("ctaTitle")}
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-lg mx-auto">
            {t("ctaDesc")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/discover" className="px-6 py-3 bg-[#C8A856] hover:bg-[#b8983e] text-black font-bold rounded-xl transition-colors flex items-center gap-2 justify-center">
              <Search className="w-4 h-4" />
              {t("ctaExplore")}
            </Link>
            <Link href="/pricing" className="px-6 py-3 bg-zinc-900 dark:bg-white/10 hover:bg-zinc-800 dark:hover:bg-white/15 text-white font-bold rounded-xl transition-colors flex items-center gap-2 justify-center">
              <CreditCard className="w-4 h-4" />
              {t("ctaPricing")}
            </Link>
          </div>
          <p className="text-xs text-zinc-400 mt-6">
            🎵 {t("ctaFooter")}
          </p>
        </section>

      </main>
    </div>
  );
}
