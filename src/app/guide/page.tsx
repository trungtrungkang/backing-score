"use client";

import Link from "next/link";
import { ArrowLeft, Play, Music, Edit3, Settings, Grid, Repeat, ListMusic, AudioWaveform, Mic2, Sparkles, CheckCircle2, Circle, GraduationCap, PenTool, Pause } from "lucide-react";

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-[#0E0E11] text-zinc-300 font-sans selection:bg-[#C8A856]/30 selection:text-white">

      <main className="pt-24 pb-32 px-6 max-w-5xl mx-auto space-y-32">
        
        {/* --- Hero Section --- */}
        <section className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#C8A856]/10 border border-[#C8A856]/20 rounded-full text-[#C8A856] text-xs font-bold uppercase tracking-widest mb-4">
            Platform Guide & Workflows
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight">
            Master the <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C8A856] via-amber-400 to-orange-400">Interactive Ecosystem</span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Welcome to the ultimate hub for modern musicians and educators. Learn how to practice with Wait Mode, navigate Interactive Courses, and create your own Masterclasses using our proprietary audio engine.
          </p>
        </section>

        {/* --- Section 1: Play-Along Library & Wait Mode --- */}
        <section className="space-y-8">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <div className="flex-1 space-y-6">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
                <Sparkles className="w-6 h-6 text-amber-500" />
              </div>
              <h2 className="text-3xl font-bold text-white">1. Play-Along & Wait Mode</h2>
              <p className="text-zinc-400 leading-relaxed">
                The <strong className="text-white">Discover</strong> page is your infinite library of Singles and Albums. Connect your Microphone or MIDI Keyboard and let the Audio Engine track your playing. Activate <strong>Wait Mode</strong> to mute the backing tracks and enter pure Acapella practice. The sheet music will patiently listen and only advance when you play the exact correct note.
              </p>
            </div>
            
            {/* CSS UI MOCKUP: Wait Mode Snippet Player */}
            <div className="flex-1 w-full bg-zinc-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden p-6 flex flex-col justify-center items-center relative aspect-video">
               <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/10 to-transparent"></div>
               {/* UI Header */}
               <div className="absolute top-4 left-4 right-4 flex justify-between items-center opacity-80">
                  <div className="flex items-center gap-2">
                    <Mic2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-400 drop-shadow-md">Listening</span>
                  </div>
                  <span className="bg-[#C8A856] text-black text-xs font-bold px-2 py-1 rounded">Wait Mode ON</span>
               </div>
               
               {/* Fake Staves */}
               <div className="w-full h-px bg-white/20 relative mt-4">
                 <div className="absolute top-[-20px] left-10 w-3 h-3 bg-white rounded-full"></div>
                 <div className="absolute top-[-20px] right-20 w-3 h-3 bg-white/30 rounded-full"></div>
               </div>
               <div className="w-full h-px bg-white/20 mt-4 relative">
                 {/* Playhead */}
                 <div className="absolute top-[-30px] left-1/2 w-0.5 h-[60px] bg-[#C8A856] shadow-[0_0_10px_#C8A856] z-10"></div>
                 {/* Current Note */}
                 <div className="absolute top-[-6px] left-1/2 -translate-x-1/2 w-4 h-4 bg-[#C8A856] rounded-full scale-150 shadow-[0_0_15px_#C8A856]"></div>
               </div>
               <div className="w-full h-px bg-white/20 mt-4"></div>
               
               {/* Wait Overlay UI */}
               <div className="absolute bottom-6 bg-red-500/20 border border-red-500/50 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-3 animate-bounce">
                 <Pause className="w-5 h-5 text-red-500" />
                 <div>
                   <div className="text-red-500 font-bold text-sm tracking-widest text-shadow">PITCH ERROR</div>
                   <div className="text-red-300 text-xs">Waiting for exact note to continue...</div>
                 </div>
               </div>
            </div>
          </div>
        </section>

        {/* --- Section 2: Interactive Masterclasses --- */}
        <section className="space-y-8">
          <div className="flex flex-col md:flex-row-reverse gap-12 items-center">
            <div className="flex-1 space-y-6">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
                <GraduationCap className="w-6 h-6 text-blue-400" />
              </div>
              <h2 className="text-3xl font-bold text-white">2. Interactive Masterclasses</h2>
              <p className="text-zinc-400 leading-relaxed">
                The <strong className="text-white">Academy</strong> provides structured curriculum designed by professional educators. Lessons integrate Rich-Text instructions directly alongside the interactive sheet music player. You must pass <strong>Practice Required</strong> segments to unlock sequential lessons.
              </p>
            </div>
            
            {/* CSS UI MOCKUP: Academy Lesson Sidebar */}
            <div className="flex-1 w-full bg-[#15151A] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex relative aspect-video">
              {/* Sidebar */}
              <div className="w-1/3 border-r border-white/10 bg-black/40 p-4 flex flex-col gap-4">
                <div className="h-4 w-2/3 bg-white/20 rounded mb-2"></div>
                <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 p-2 rounded-lg">
                   <CheckCircle2 className="w-4 h-4 text-blue-400" />
                   <div className="h-2 w-1/2 bg-blue-400/50 rounded"></div>
                </div>
                <div className="flex items-center gap-3 border border-white/10 p-2 rounded-lg relative overflow-hidden">
                   <div className="absolute inset-0 bg-white/5"></div>
                   <div className="w-4 h-4 rounded-full border-2 border-[#C8A856] flex items-center justify-center"><div className="w-1.5 h-1.5 bg-[#C8A856] rounded-full"></div></div>
                   <div className="h-2 w-2/3 bg-[#C8A856]/80 rounded relative z-10"></div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg opacity-40">
                   <Circle className="w-4 h-4 text-white/50" />
                   <div className="h-2 w-1/2 bg-white/30 rounded"></div>
                </div>
              </div>
              {/* Main Content Area */}
              <div className="flex-1 p-6 flex flex-col gap-6 items-center justify-center relative">
                 <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/10 to-transparent"></div>
                 <div className="h-3 w-3/4 bg-white/20 rounded"></div>
                 <div className="h-2 w-full bg-white/10 rounded"></div>
                 <div className="h-2 w-5/6 bg-white/10 rounded"></div>
                 
                 {/* Embedded Player Box */}
                 <div className="w-full flex-1 bg-black/50 border border-white/10 rounded-xl mt-4 flex items-center justify-center relative">
                    <Play className="w-10 h-10 text-white/30" />
                    <div className="absolute top-2 right-2 bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] uppercase px-2 py-0.5 rounded font-bold">
                      Practice Required
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- Section 3: Creator Tiptap Editor --- */}
        <section className="space-y-8">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <div className="flex-1 space-y-6">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shrink-0">
                <PenTool className="w-6 h-6 text-purple-400" />
              </div>
              <h2 className="text-3xl font-bold text-white">3. Zero-Code Creator Studio</h2>
              <p className="text-zinc-400 leading-relaxed">
                Teachers and Publishers can digitize PDF curriculum into interactive apps in minutes. Using our seamless <strong>Tiptap Rich-Text Editor</strong>, you write text as if using MS Word, and insert MusicXML files as native blocks. Toggle <kbd className="bg-white/10 rounded px-1">Wait Mode Required</kbd> to enforce grading.
              </p>
            </div>
            
            {/* CSS UI MOCKUP: Tiptap Editor */}
            <div className="flex-1 w-full bg-zinc-950 rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col relative aspect-video">
               <div className="h-10 border-b border-white/10 bg-zinc-900 flex items-center px-4 gap-2">
                 {['B', 'I', 'U'].map(btn => (
                   <div key={btn} className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-xs font-bold text-white/50">{btn}</div>
                 ))}
                 <div className="w-px h-4 bg-white/10 mx-2"></div>
                 <div className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-bold flex items-center gap-1">
                   <Music className="w-3 h-3" /> Insert MusicXML
                 </div>
               </div>
               <div className="flex-1 p-6 flex flex-col gap-4">
                 <div className="text-2xl font-bold text-white/80">Lesson 1: The C Major Scale</div>
                 <div className="h-2 w-full bg-white/10 rounded"></div>
                 <div className="h-2 w-3/4 bg-white/10 rounded"></div>
                 
                 {/* Embedded Custom Node Mockup */}
                 <div className="w-full p-4 border-2 border-dashed border-purple-500/40 bg-purple-500/5 rounded-xl flex items-center justify-between mt-2">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded bg-purple-500/20 flex items-center justify-center">
                       <Music className="w-5 h-5 text-purple-400" />
                     </div>
                     <div>
                       <div className="text-sm font-bold text-white">c-major-exo.xml</div>
                       <div className="text-xs text-white/40">MusicSnippetNode</div>
                     </div>
                   </div>
                   {/* Toggle switch mockup */}
                   <div className="flex items-center gap-2">
                     <span className="text-[10px] text-white/50 font-bold uppercase">Enforce Wait Mode</span>
                     <div className="w-8 h-4 bg-purple-500 rounded-full relative">
                       <div className="w-3 h-3 bg-white rounded-full absolute right-0.5 top-0.5"></div>
                     </div>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </section>

        {/* --- Section 4: Multi-Track Mixer --- */}
        <section className="space-y-8">
          <div className="bg-[#15151A] border border-white/10 rounded-3xl p-8 md:p-12 text-center flex flex-col items-center">
             <AudioWaveform className="w-12 h-12 text-blue-400 mb-6" />
             <h2 className="text-3xl font-bold text-white mb-4">Multi-Track Audio Engine</h2>
             <p className="text-zinc-400 max-w-2xl text-lg mb-10">
               Every song on Backing & Score is a multi-track recording. If you play Guitar, simply open the Mixer and MUTE the Lead Guitar stem. The rest of the studio band keeps playing.
             </p>
             
             {/* Abstract Mixer Mockup */}
             <div className="w-full max-w-lg bg-black border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
                {[
                  { name: "Drums & Percussion", vol: "80%", color: "bg-blue-500" },
                  { name: "Lead Piano", vol: "0%", color: "bg-zinc-600", muted: true },
                  { name: "Bass Guitar", vol: "60%", color: "bg-emerald-500" }
                ].map((track, i) => (
                  <div key={i} className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5">
                     <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center font-bold text-xs ${track.muted ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-white/10 text-white'}`}>
                       {track.muted ? 'M' : 'S'}
                     </div>
                     <span className={`w-32 text-left text-sm font-bold truncate ${track.muted ? 'text-white/30' : 'text-white'}`}>{track.name}</span>
                     <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                       <div className={`h-full ${track.color}`} style={{ width: track.vol }}></div>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </section>

      </main>
    </div>
  );
}
