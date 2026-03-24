"use client";

import { useMemo } from "react";
import { Link } from "@/i18n/routing";
import { ArrowLeft, Music } from "lucide-react";
import { MusicXMLVisualizer } from "@/components/editor/MusicXMLVisualizer";
import type { DAWPayload } from "@/lib/daw/types";
import { cn } from "@/lib/utils";
import { PlayerControls } from "./PlayerControls";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "next-themes";
import { ProjectActionsMenu } from "@/components/ProjectActionsMenu";
import { useScoreEngine } from "@/hooks/useScoreEngine";

export interface PlayShellProps {
  projectId: string;
  projectName: string;
  composer?: string;
  payload: DAWPayload;
  difficulty?: number;
  playlistId?: string | null;
  nextProjectId?: string | null;
  prevProjectId?: string | null;
  onNext?: () => void;
  onPrev?: () => void;
  autoplayOnLoad?: boolean;
}

export function PlayShell({
  projectId,
  projectName,
  composer,
  payload,
  difficulty,
  playlistId,
  nextProjectId,
  prevProjectId,
  onNext,
  onPrev,
  autoplayOnLoad
}: PlayShellProps) {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark" || resolvedTheme === "system";

  const { state, refs, actions } = useScoreEngine({ payload, autoplayOnLoad, onNext });

  const scoreFileId = payload.notationData?.fileId;

  // Phase 20: Inject synthetic Score Synth track if MusicXML exists
  const displayTracks = useMemo(() => {
    const tracks = [...payload.audioTracks];
    const autoUnmuteScoreSynth = tracks.length === 0 && !state.isWaitMode;
    
    if (scoreFileId) {
      tracks.push({
        id: "score-midi",
        name: "Score Synth (Piano)",
        type: "midi",
        muted: autoUnmuteScoreSynth ? false : (payload.metadata?.scoreSynthMuted ?? false),
        solo: payload.metadata?.scoreSynthSolo ?? false,
        volume: payload.metadata?.scoreSynthVolume ?? 1.0,
        pan: 0,
        offsetMs: payload.metadata?.scoreSynthOffsetMs ?? 0,
      });
    }
    return tracks;
  }, [payload.audioTracks, scoreFileId, payload.metadata, state.isWaitMode]);

  return (
    <div className="relative flex flex-col h-full w-full bg-[#fdfdfc] dark:bg-[#1A1A1E] text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans">
      {/* 1. Minimal Header */}
      <header className="absolute top-0 left-0 w-full z-20 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-[#151518]/80 to-transparent pointer-events-none transition-opacity duration-300">
        <div className="flex items-center gap-4 pointer-events-auto">
          <Link href="/discover" className="p-2 rounded-full bg-[#1e1e24]/80 text-zinc-300 hover:text-white hover:bg-[#2a2a32] backdrop-blur-md transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-white drop-shadow-md tracking-tight leading-tight line-clamp-2">
              {projectName}
            </h1>
            <span className="hidden sm:block text-sm font-medium text-zinc-300 drop-shadow-sm line-clamp-1">
              {composer}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <ProjectActionsMenu projectId={projectId} />
          <ThemeToggle hideBg className="p-2 w-10 h-10 rounded-full bg-[#1e1e24]/80 text-zinc-300 hover:text-white hover:bg-[#2a2a32] backdrop-blur-md transition-all border-none" />
        </div>
      </header>

      {/* 2. Full Screen Sheet Music Area */}
      <div className={cn("flex-1 min-h-0 w-full h-full pt-16 overflow-hidden relative transition-all duration-300", state.isControlsCollapsed ? "pb-0" : "pb-[120px]")}>
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#fdfdfc] dark:from-[#1A1A1E] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#fdfdfc] dark:from-[#1A1A1E] to-transparent z-10 pointer-events-none" />
        
        {/* Headless MIDI Player for Fallback SoundFont engine */}
        {state.stretchedMidiBase64 && (
          <div className="hidden">
            <midi-player
              ref={refs.midiPlayerRef}
              src={state.stretchedMidiBase64}
              sound-font="https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus"
            />
          </div>
        )}

        {scoreFileId ? (
          <MusicXMLVisualizer
            scoreFileId={scoreFileId}
            positionMs={state.positionMs}
            isPlaying={state.isPlaying}
            timemap={state.correctedTimemap || payload.notationData?.timemap || []}
            measureMap={payload.notationData?.measureMap}
            onSeek={actions.handleSeek}
            onMidiExtracted={actions.handleMidiExtracted}
            isDarkMode={isDarkMode}
            isWaitMode={state.isWaitMode}
            isWaiting={state.isWaiting}
            practiceTrackIds={state.practiceTrackIds}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400">
            <Music className="w-16 h-16 mb-4 opacity-20" />
            <p>No sheet music available for this project.</p>
          </div>
        )}
      </div>

      {/* 4. Telemetry Monitor Overlay */}
      {state.showWaitModeMonitor && (
        <div 
          ref={refs.waitModeMonitorRef}
          className="absolute top-20 left-4 z-[150] w-64 bg-[#18181b]/95 backdrop-blur-xl border border-blue-500/30 rounded-xl p-3 text-xs tracking-wider text-zinc-300 shadow-[0_0_20px_rgba(59,130,246,0.15)] select-none pointer-events-none"
        >
          <div className="animate-pulse flex gap-2 items-center text-blue-400">Loading Telemetry...</div>
        </div>
      )}

      {/* 3. Floating Control Bar (Dock) */}
      <PlayerControls
        bpm={payload.metadata?.tempo || 120}
        positionMs={state.positionMs}
        durationMs={state.totalSongDurationMs}
        isPlaying={state.isPlaying}
        loadingAudio={state.loadingAudio}
        onPlay={actions.handlePlay}
        onPause={actions.handlePause}
        onStop={actions.handleStop}
        onSeek={actions.handleSeek}
        playbackRate={state.playbackRate}
        onPlaybackRateChange={actions.handlePlaybackRateChange}
        pitchShift={state.pitchShift}
        onPitchShiftChange={actions.handlePitchShiftChange}
        isMetronomeEnabled={state.isMetronomeEnabled}
        onMetronomeToggle={actions.handleMetronomeToggle}
        loopState={state.loopState}
        onLoopStateChange={actions.handleLoopStateChange}
        tracks={displayTracks}
        volumes={state.volumes}
        muteByTrackId={state.muteByTrackId}
        soloByTrackId={state.soloByTrackId}
        onMuteToggle={actions.handleMuteToggle}
        onSoloToggle={actions.handleSoloToggle}
        onVolumeChange={actions.handleVolumeChange}
        isCollapsed={state.isControlsCollapsed}
        onCollapseToggle={actions.handleCollapseToggle}
        playlistId={playlistId}
        hasNext={!!nextProjectId}
        hasPrev={!!prevProjectId}
        onNext={onNext}
        onPrev={onPrev}
        isAutoplayEnabled={state.isAutoplayEnabled}
        onAutoplayToggle={actions.setIsAutoplayEnabled}
        isWaitMode={state.isWaitMode}
        onWaitModeToggle={actions.setIsWaitMode}
        isWaitModeLenient={state.isWaitModeLenient}
        onWaitModeLenientToggle={actions.setIsWaitModeLenient}
        isSynthMuted={payload.metadata?.scoreSynthMuted ?? false}
        onSynthMuteToggle={() => {}}
        midiTracks={state.parsedMidi ? state.parsedMidi.tracks.map((t: any, i: number) => ({ id: i, name: t.name || `Instrument ${i+1}` })) : []}
        practiceTrackIds={state.practiceTrackIds}
        onPracticeTrackChange={actions.setPracticeTrackIds}
        showWaitModeMonitor={state.showWaitModeMonitor}
        onWaitModeMonitorToggle={actions.setShowWaitModeMonitor}
        isMidiInitialized={state.isMidiInitialized}
        onInitializeMidi={actions.initializeMidi}
        onDisconnectMidi={actions.disconnectMidi}
        isMicInitialized={state.isMicInitialized}
        onInitializeMic={actions.initializeMic}
        onDisconnectMic={actions.disconnectMic}
      />
    </div>
  );
}
