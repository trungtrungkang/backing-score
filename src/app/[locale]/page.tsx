import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Music4, Mic2, Layers, PlaySquare, ArrowRight, Play, SlidersHorizontal, AudioWaveform, Sparkles, Moon, Smartphone, Pause, GraduationCap, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const t = useTranslations("Home");
  return (
    <div className="min-h-screen bg-background dark:bg-[#0E0E11] text-foreground dark:text-white selection:bg-[#C8A856]/30 overflow-hidden font-sans">

      {/* --- HERO SECTION --- */}
      <main className="relative pt-32 pb-24 md:pt-48 md:pb-32 px-6 lg:px-12 flex flex-col items-center text-center">
        {/* Ambient Hero Glows */}
        <div className="absolute top-[-10%] md:top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#C8A856]/20 dark:bg-[#C8A856]/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-[20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/10 dark:bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-5xl w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-1000">

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-8 shadow-sm backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-[#C8A856] animate-pulse"></span>
            {t('betaBadge')}
          </div>

          <h1 className="text-[3rem] sm:text-[4rem] lg:text-[5.5rem] font-black tracking-tight mb-8 leading-[1.05] text-zinc-900 dark:text-white">
            {t('heroTitle')}
          </h1>

          <p className="text-lg md:text-2xl text-zinc-600 dark:text-zinc-400 font-medium max-w-3xl mb-12 leading-relaxed">
            {t('heroSubtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-5 w-full justify-center">
            <Link href="/discover">
              {/* Primary B2C Call to action */}
              <Button size="lg" className="bg-zinc-900 hover:bg-black dark:bg-[#C8A856] dark:hover:bg-[#d4b566] text-white dark:text-black font-black rounded-full px-10 py-7 h-auto text-lg w-full sm:w-auto transition-transform hover:scale-105 shadow-xl shadow-zinc-900/20 dark:shadow-[#C8A856]/20">
                {t('btnExplore')}
              </Button>
            </Link>
            <Link href="/dashboard/classrooms">
              {/* Secondary EdTech call to action - Private Classrooms */}
              <Button size="lg" variant="outline" className="bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-white/10 rounded-full px-10 py-7 h-auto text-lg w-full sm:w-auto font-bold backdrop-blur-md transition-all">
                LMS / Classrooms
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Hero Abstract UI Mockup */}
        <div className="relative w-full max-w-6xl mt-24 perspective-[2000px] z-20 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300 pb-20">
          <div className="w-full aspect-[16/9] md:aspect-[21/9] bg-zinc-100/80 dark:bg-black/60 rounded-t-3xl border-t border-x border-zinc-200 dark:border-white/10 shadow-[0_-20px_80px_rgba(0,0,0,0.1)] dark:shadow-[0_-20px_80px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col transform rotate-x-[5deg] transition-transform hover:rotate-x-[2deg] duration-700 backdrop-blur-xl">
            {/* Mock Header */}
            <div className="w-full h-12 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-white/5 flex items-center px-4 gap-4 shrink-0">
              <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400"></div><div className="w-3 h-3 rounded-full bg-amber-400"></div><div className="w-3 h-3 rounded-full bg-green-400"></div></div>
              <div className="flex-1 flex justify-center">
                <div className="w-48 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full bg-zinc-400 dark:bg-zinc-600 mr-2 flex items-center justify-center"><Play className="w-3 h-3 text-white" /></div>
                  <div className="w-24 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full"></div>
                </div>
              </div>
            </div>
            {/* Mock Body */}
            <div className="flex-1 flex">
              {/* Mock Mixer Sidebar */}
              <div className="w-1/4 hidden md:flex border-r border-zinc-200 dark:border-white/5 flex-col p-4 gap-3 bg-zinc-50/50 dark:bg-zinc-950/50">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-full h-12 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-white/5 p-2 flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#C8A856]/20 flex items-center justify-center"><Music4 className="w-3 h-3 text-[#C8A856]" /></div>
                    <div className="flex-1 space-y-1.5">
                      <div className="w-16 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full"></div>
                      <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-[#C8A856]" style={{ width: `${Math.random() * 60 + 20}%` }}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Mock Sheet Music */}
              <div className="flex-1 p-6 md:p-10 relative bg-white dark:bg-[#151515] flex flex-col justify-center items-center gap-12 overflow-hidden">
                {/* Fake playhead */}
                <div className="absolute top-0 bottom-0 left-1/3 w-0.5 bg-[#C8A856] shadow-[0_0_10px_#C8A856] z-10 hidden sm:block"></div>
                {/* Fake Practice Mode Interruption */}
                <div className="absolute top-1/2 left-1/3 -translate-y-1/2 -translate-x-1/2 z-30 p-4 bg-red-500/10 border border-red-500 rounded-xl backdrop-blur-sm animate-pulse flex items-center gap-2">
                  <Pause className="w-5 h-5 text-red-500" />
                  <span className="text-red-500 font-bold text-sm">PRACTICE MODE</span>
                </div>

                {/* Fake staves */}
                {[1, 2, 3].map((i, idx) => (
                  <div key={i} className={`w-full max-w-2xl h-12 border-y border-black/10 dark:border-white/10 flex items-center justify-between px-8 relative ${idx === 1 ? 'opacity-100' : 'opacity-40'}`}>
                    <div className="w-4 h-12 border-l-2 border-black/20 dark:border-white/20"></div>
                    <div className="w-full h-px bg-black/10 dark:bg-white/10 absolute top-1/4"></div>
                    <div className="w-full h-px bg-black/10 dark:bg-white/10 absolute top-2/4"></div>
                    <div className="w-full h-px bg-black/10 dark:bg-white/10 absolute top-3/4"></div>
                    {/* Fake Notes */}
                    <div className="w-2.5 h-2.5 rounded-full bg-black dark:bg-white absolute left-10 top-1/4"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-black dark:bg-white absolute left-32 top-3/4"><div className="w-0.5 h-6 bg-black dark:bg-white absolute bottom-1 right-0"></div></div>
                    {idx === 1 && (
                      <div className="w-3.5 h-3.5 rounded-full bg-[#C8A856] absolute left-1/3 top-2/4 scale-150 shadow-[0_0_20px_#C8A856] z-20"><div className="w-0.5 h-6 bg-[#C8A856] absolute bottom-1 right-0"></div></div>
                    )}
                    <div className="w-2.5 h-2.5 rounded-full bg-black dark:bg-white absolute right-32 top-1/4"></div>
                    <div className="w-4 h-12 border-r-2 border-black/20 dark:border-white/20"></div>
                  </div>
                ))}

                {/* Bottom Ambient Glow in mockup */}
                <div className="absolute -bottom-20 left-1/3 w-[300px] h-[150px] bg-red-500/20 blur-[60px]"></div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* --- ZIG-ZAG FEATURE SHOWCASE --- */}
      <section className="py-24 px-6 lg:px-12 relative z-30 bg-zinc-50 dark:bg-transparent">
        <div className="max-w-6xl mx-auto flex flex-col gap-32">

          {/* Feature 1: Wait Mode (New) */}
          <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-20">
            <div className="w-full md:w-1/2 order-2 md:order-1">
              <div className="aspect-square bg-gradient-to-tr from-zinc-200 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 rounded-3xl p-8 relative overflow-hidden flex items-center justify-center border border-zinc-200 dark:border-white/5 shadow-2xl shadow-black/5 dark:shadow-none transition-transform hover:-translate-y-2 duration-500">
                <div className="absolute inset-0 opacity-20 dark:opacity-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/40 to-transparent"></div>
                <div className="w-[80%] h-[80%] bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-8 flex flex-col items-center justify-center gap-6 relative z-10">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-amber-500/30 flex items-center justify-center relative z-10 bg-black/5 dark:bg-white/5">
                      <Mic2 className="w-8 h-8 text-amber-500" />
                    </div>
                    <div className="absolute inset-0 border-4 border-amber-500 rounded-full animate-ping opacity-20"></div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{t('analyzingPitch')}</div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">{t('waitingForNote')}</div>
                  </div>
                  <div className="w-full bg-zinc-100 dark:bg-zinc-900 h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-500 w-1/3 h-full rounded-full transition-all"></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="w-full md:w-1/2 order-1 md:order-2 flex flex-col items-start text-left">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center mb-6 border border-amber-200 dark:border-amber-500/20">
                <Sparkles className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-3xl md:text-5xl font-black mb-6 text-zinc-900 dark:text-white">
                {t('waitModeTitle')}
              </h2>
              <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">
                {t('waitModeDesc')}
              </p>
            </div>
          </div>

          {/* Feature 2: Interactive Masterclass (New) */}
          <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-20">
            <div className="w-full md:w-1/2 flex flex-col items-start text-left">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center mb-6 border border-blue-200 dark:border-blue-500/20">
                <GraduationCap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-3xl md:text-5xl font-black mb-6 text-zinc-900 dark:text-white">{t('f2Title')}</h2>
              <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">
                {t('f2Desc')}
              </p>
              <Link href="/dashboard/classrooms" className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1">
                Teacher Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="w-full md:w-1/2">
              <div className="aspect-square bg-gradient-to-bl from-zinc-200 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 rounded-3xl p-8 relative overflow-hidden flex items-center justify-center border border-zinc-200 dark:border-white/5 shadow-2xl shadow-black/5 dark:shadow-none transition-transform hover:-translate-y-2 duration-500">
                <div className="absolute inset-0 opacity-20 dark:opacity-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/30 to-transparent"></div>

                {/* Abstract Masterclass Sidebar */}
                <div className="w-4/5 h-[90%] bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col relative z-10">
                  <div className="h-32 bg-zinc-100 dark:bg-zinc-900 flex justify-center items-center">
                    <PlaySquare className="w-10 h-10 text-zinc-300 dark:text-zinc-700" />
                  </div>
                  <div className="flex-1 p-6 space-y-4">
                    <div className="w-32 h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full mb-6"></div>
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex gap-4 items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${i === 1 ? 'bg-green-500text-white' : i === 2 ? 'border-2 border-blue-500' : 'border-2 border-zinc-300 dark:border-zinc-700'}`}>
                          {i === 1 && <span className="w-2 h-2 rounded-full bg-white"></span>}
                          {i === 2 && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                        </div>
                        <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full"></div>
                      </div>
                    ))}
                  </div>
                  {/* Gamification Badge Overlay */}
                  <div className="absolute bottom-6 right-6 w-16 h-16 bg-[#C8A856] rounded-full shadow-[0_10px_30px_rgba(200,168,86,0.4)] flex items-center justify-center border-4 border-white dark:border-zinc-950">
                    <span className="text-black font-black text-xl">A+</span>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Feature 3: Multi-Track Identity */}
          <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-20">
            <div className="w-full md:w-1/2 order-2 md:order-1">
              <div className="aspect-square bg-gradient-to-tr from-zinc-200 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 rounded-3xl p-8 relative overflow-hidden flex items-center justify-center border border-zinc-200 dark:border-white/5 shadow-2xl shadow-black/5 dark:shadow-none transition-transform hover:-translate-y-2 duration-500">
                <div className="absolute inset-0 opacity-20 dark:opacity-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-500/40 to-transparent"></div>
                <div className="w-4/5 bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-4 relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{t('mixerConsole')}</span>
                    <AudioWaveform className="w-4 h-4 text-purple-500" />
                  </div>
                  {[
                    { nameKey: "trackRhythmDrums", active: true },
                    { nameKey: "trackLeadGuitar", active: false }, // muted
                    { nameKey: "trackBass", active: true },
                  ].map((trk, idx) => (
                    <div key={idx} className={`flex items-center gap-3 p-2 rounded border ${trk.active ? 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50'}`}>
                      <div className="w-8 text-xs font-bold text-zinc-400">{trk.active ? 'M' : <span className="text-red-500">M</span>}</div>
                      <div className="text-xs font-semibold flex-1 truncate dark:text-zinc-300">{t(trk.nameKey as any)}</div>
                      <div className={`w-1/3 h-1.5 rounded-full ${trk.active ? 'bg-purple-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="w-full md:w-1/2 order-1 md:order-2 flex flex-col items-start text-left">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center mb-6 border border-purple-200 dark:border-purple-500/20">
                <Layers className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-3xl md:text-5xl font-black mb-6 text-zinc-900 dark:text-white">{t('f3Title')}</h2>
              <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">
                {t('f3Desc')}
              </p>
            </div>
          </div>

          {/* Feature 4: Music Encyclopedia (New) */}
          <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-20">
            <div className="w-full md:w-1/2 flex flex-col items-start text-left">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-200 dark:border-emerald-500/20">
                <BookOpen className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-3xl md:text-5xl font-black mb-6 text-zinc-900 dark:text-white">{t('f4Title')}</h2>
              <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">
                {t('f4Desc')}
              </p>
              <Link href="/wiki" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1">
                {t('f4Link')} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="w-full md:w-1/2">
              <div className="aspect-square bg-gradient-to-br from-zinc-200 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 rounded-3xl p-8 relative overflow-hidden flex items-center justify-center border border-zinc-200 dark:border-white/5 shadow-2xl shadow-black/5 dark:shadow-none transition-transform hover:-translate-y-2 duration-500">
                <div className="absolute inset-0 opacity-20 dark:opacity-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/30 to-transparent"></div>

                {/* Abstract Wiki Hub Mockup */}
                <div className="w-full h-[90%] bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col relative z-10 p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div className="w-1/2 h-8 bg-zinc-100 dark:bg-zinc-900 rounded-lg"></div>
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className={`h-24 rounded-xl border-2 flex flex-col p-3 justify-end ${i === 1 ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20' : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50'}`}>
                        <div className={`w-3/4 h-2 rounded-full mb-2 ${i === 1 ? 'bg-emerald-400' : 'bg-zinc-200 dark:bg-zinc-700'}`}></div>
                        <div className={`w-1/2 h-2 rounded-full ${i === 1 ? 'bg-emerald-300' : 'bg-zinc-100 dark:bg-zinc-800'}`}></div>
                      </div>
                    ))}
                  </div>
                  {/* Gamification/Info Badge Overlay */}
                  <div className="absolute bottom-8 right-1/2 translate-x-1/2 w-3/4 h-16 bg-zinc-900 dark:bg-zinc-800 rounded-xl shadow-2xl flex items-center px-4 gap-4 border border-zinc-700">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-400 to-sky-400 flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 text-white ml-0.5" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="w-3/4 h-1.5 bg-zinc-600 rounded-full"></div>
                      <div className="w-1/2 h-1.5 bg-zinc-700 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* --- CTA SECTION --- */}
      <section className="relative z-20 py-32 px-6">
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-zinc-900 to-black dark:from-[#15151A] dark:to-black rounded-[3rem] p-12 md:p-20 text-center border border-zinc-800 shadow-2xl relative overflow-hidden flex flex-col items-center">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#C8A856]/10 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>

          <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight relative z-10">{t('ctaTitle1')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-400 to-zinc-600 italic">{t('ctaTitle2')}</span></h2>
          <p className="text-xl text-zinc-400 mb-12 max-w-2xl relative z-10 font-medium">{t('ctaSubtitleFull')}</p>
          <div className="flex flex-col sm:flex-row gap-4 relative z-10 w-full sm:w-auto">
            <Link href="/discover" className="w-full sm:w-auto">
              <Button size="lg" className="w-full bg-[#C8A856] hover:bg-[#d4b566] text-black font-black rounded-full px-12 py-8 text-xl transition-transform hover:scale-105 shadow-[0_0_40px_rgba(200,168,86,0.3)]">
                {t('ctaStart')}
              </Button>
            </Link>
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white font-bold rounded-full px-12 py-8 text-xl transition-transform">
                {t('ctaTeacher')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="w-full border-t border-zinc-200 dark:border-white/5 py-12 text-zinc-500 dark:text-zinc-600 text-sm bg-zinc-50 dark:bg-transparent relative z-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between px-6 gap-6">
          <p className="font-bold flex items-center gap-2">
            <Music4 className="w-4 h-4 text-[#C8A856]" />
            Backing & Score
          </p>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href="/about" className="hover:text-zinc-900 dark:hover:text-white transition-colors">About</Link>
            <Link href="/discover" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Discover</Link>
            <Link href="/wiki" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Wiki</Link>
            <Link href="/user-guide" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Guide</Link>
          </nav>
          <p>{t('footerCopy')}</p>
        </div>
      </footer>
    </div>
  );
}
