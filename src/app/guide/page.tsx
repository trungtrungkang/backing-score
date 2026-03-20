"use client";

import Link from "next/link";
import { ArrowLeft, Play, Music, Edit3, Settings, Grid, Repeat, ListMusic, AudioWaveform } from "lucide-react";

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-[#0E0E11] text-zinc-300 font-sans selection:bg-blue-500/30 selection:text-white">

      <main className="pt-24 pb-32 px-6 max-w-4xl mx-auto space-y-24">
        
        {/* Hero Section */}
        <section className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-bold uppercase tracking-widest mb-4">
            User Guide
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight">
            Master Your Practice <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-[#00f0ff]">Session Workflows</span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Welcome to the ultimate hub for musicians. Learn how to mix audio multitracks, sync sheet music to live performances, and practice with pinpoint metronome precision.
          </p>
        </section>

        {/* Section 1: Dashboard */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 shrink-0">
              <ListMusic className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">1. The Library & Dashboard</h2>
              <p className="text-zinc-400 mt-1">Discover community scores or manage your private studio.</p>
            </div>
          </div>
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl group">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
            <img src="/guide/dashboard.png" alt="Dashboard" className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-700" />
            <div className="absolute bottom-6 left-6 z-20 max-w-lg">
              <h3 className="text-xl font-bold text-white mb-2">Your Creative Hub</h3>
              <p className="text-sm text-zinc-300">Organize projects, upload MusicXML sheets, and drag-and-drop your audio stems.</p>
            </div>
          </div>
        </section>

        {/* Section 2: Player */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
              <Play className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">2. The Practice Player</h2>
              <p className="text-zinc-400 mt-1">Isolate instruments, repeat tough sections, and follow the sheet music.</p>
            </div>
          </div>
          
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl group">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
            <img src="/guide/play.png" alt="Player Interface" className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-700" />
            <div className="absolute bottom-6 left-6 z-20 max-w-lg">
              <h3 className="text-xl font-bold text-white mb-2">Immersive Reading</h3>
              <p className="text-sm text-zinc-300">The orange playhead glides across your custom MusicXML sheet music. You can click on any measure to instantly jump audio playback to that exact notation.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 pt-6">
             <div className="bg-[#1a1a1f] p-6 rounded-xl border border-white/5 space-y-3">
                <Settings className="w-6 h-6 text-zinc-400" />
                <h4 className="font-bold text-white">Audio Mixer</h4>
                <p className="text-sm text-zinc-400">Solo your instrument or mute the backing track. Adjust the master pitch for transposing without affecting sheet music logic.</p>
             </div>
             <div className="bg-[#1a1a1f] p-6 rounded-xl border border-white/5 space-y-3">
                <Repeat className="w-6 h-6 text-[#C8A856]" />
                <h4 className="font-bold text-white">A-B Looping</h4>
                <p className="text-sm text-zinc-400">Highlight a tough bridge section and loop it continuously. The metronome perfectly resets at the bar boundary.</p>
             </div>
             <div className="bg-[#1a1a1f] p-6 rounded-xl border border-white/5 space-y-3">
                <Music className="w-6 h-6 text-purple-400" />
                <h4 className="font-bold text-white">Score Synth</h4>
                <p className="text-sm text-zinc-400">If your project lacks audio, activate the internal WebAudio Canvas Synth to listen to pure MIDI piano extracted from your sheet music.</p>
             </div>
          </div>
        </section>

        {/* Section 3: Editor */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shrink-0">
              <Edit3 className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">3. Admin Arranger</h2>
              <p className="text-zinc-400 mt-1">Synchronize live recorded audio with rigid sheet music.</p>
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl group">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
            <img src="/guide/editor.png" alt="Editor Interface" className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-700" />
            <div className="absolute bottom-6 left-6 z-20 max-w-lg">
              <h3 className="text-xl font-bold text-white mb-2">Syncing the Impossible</h3>
              <p className="text-sm text-zinc-300">Live performers rarely stick to a strict BPM. Enter <strong>Sync Mode</strong> to tap your Spacebar along with the audio, creating a flexible "Elastic Grid" that bends sheet music timing to match human emotion.</p>
            </div>
          </div>

          <div className="p-8 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20">
            <div className="flex items-center gap-3 mb-4">
              <Grid className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-bold text-white">Advanced Metering (Time Signatures)</h3>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed mb-6">
              Does your song change from 4/4 to 6/4 in the bridge? Not a problem! Once you map your measures, you can open the <strong>Measure Map Editor</strong> and input dynamic overriding Time Signatures on specific measures. The High-Precision WebAudio Metronome and the Transport LED readout will seamlessly intercept these changes and adjust their "tick" cadences precisely on the fly.
            </p>
            <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-colors">
              Start Arranging Now
            </Link>
          </div>
        </section>

      </main>
    </div>
  );
}
