"use client";

import { useMemo, useState, useCallback } from "react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { ArrowLeft, Music, MoreVertical, Share2, Bookmark, Sun, Moon, Link2, Check } from "lucide-react";
import { MusicXMLVisualizer } from "@/components/editor/MusicXMLVisualizer";
import type { DAWPayload } from "@/lib/daw/types";
import { cn } from "@/lib/utils";
import { PlayerControls } from "./PlayerControls";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toggleFavorite, checkIsFavorited } from "@/lib/appwrite";
import { useEffect } from "react";
import { ProjectActionsMenu } from "@/components/ProjectActionsMenu";
import { ShareButton } from "@/components/ShareButton";
import { useScoreEngine } from "@/hooks/useScoreEngine";
import { useAuth } from "@/contexts/AuthContext";
import UpgradePrompt from "@/components/UpgradePrompt";
import { incrementPlayCount as incrementServerPlayCount } from "@/lib/appwrite/projects";

// Mobile-only consolidated actions menu for Play page header
function MobileActionsMenu({ projectId, projectName }: { projectId: string; projectName: string }) {
  const { user } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [isFavorited, setIsFavorited] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkIsFavorited("project", projectId).then(setIsFavorited).catch(() => {});
  }, [user, projectId]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  };

  const handleFavorite = async () => {
    if (!user) return;
    setIsFavorited(prev => !prev);
    try {
      const res = await toggleFavorite("project", projectId);
      setIsFavorited(res);
    } catch {
      setIsFavorited(prev => !prev);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="p-2 rounded-full bg-[#1e1e24]/80 text-zinc-300 hover:text-white hover:bg-[#2a2a32] backdrop-blur-md transition-all focus:outline-none">
        <MoreVertical className="w-5 h-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-[#1A1A1E] border-zinc-200 dark:border-zinc-800 shadow-2xl z-[200]">
        <DropdownMenuItem onClick={handleShare} className="flex items-center gap-3 text-sm font-medium cursor-pointer">
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
          {copied ? "Copied!" : "Share Link"}
        </DropdownMenuItem>
        {user && (
          <DropdownMenuItem onClick={handleFavorite} className="flex items-center gap-3 text-sm font-medium cursor-pointer">
            <Bookmark className={`w-4 h-4 ${isFavorited ? "fill-amber-500 text-amber-500" : ""}`} />
            {isFavorited ? "Remove Favorite" : "Add to Favorites"}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex items-center gap-3 text-sm font-medium cursor-pointer"
        >
          {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const FREE_DAILY_WAIT_MODE_LIMIT = 3;

function getWaitModeCount(): { count: number; date: string } {
  try {
    const raw = localStorage.getItem("bs_wait_mode_count");
    if (raw) {
      const data = JSON.parse(raw);
      const today = new Date().toISOString().slice(0, 10);
      if (data.date === today) return data;
    }
  } catch { }
  return { count: 0, date: new Date().toISOString().slice(0, 10) };
}

function incrementWaitModeCount(): void {
  const today = new Date().toISOString().slice(0, 10);
  const current = getWaitModeCount();
  const newCount = current.date === today ? current.count + 1 : 1;
  localStorage.setItem("bs_wait_mode_count", JSON.stringify({ count: newCount, date: today }));
}

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
  /** Enable the Record button in PlayerControls (assignment context) */
  enableRecording?: boolean;
  /** Callback when student has a recording ready to submit */
  onRecordingReady?: (blob: Blob) => void;
  /** Force Wait Mode on (for assessments with waitModeRequired) */
  forceWaitMode?: boolean;
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
  autoplayOnLoad,
  enableRecording = false,
  onRecordingReady,
  forceWaitMode = false,
}: PlayShellProps) {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark" || resolvedTheme === "system";
  const { isPremium } = useAuth();
  const tc = useTranslations("Classroom");
  const [showUpgrade, setShowUpgrade] = useState<"playLimit" | "waitMode" | null>(null);

  const { state, refs, actions } = useScoreEngine({ payload, autoplayOnLoad, onNext });
  const recorder = useAudioRecorder();

  // Auto-enable Wait Mode when forced by assignment
  useEffect(() => {
    if (forceWaitMode && !state.isWaitMode) {
      actions.setIsWaitMode(true);
    }
  }, [forceWaitMode]);

  const handleRecordToggle = useCallback((shouldRecord: boolean) => {
    if (shouldRecord) {
      recorder.startRecording();
    } else {
      recorder.stopRecording();
    }
  }, [recorder]);

  // Play handler — no limit for free users, just track server play count
  const gatedHandlePlay = useCallback(() => {
    actions.handlePlay();
    incrementServerPlayCount(projectId); // fire-and-forget
  }, [actions, projectId]);

  // Gated Wait Mode toggle — 3/day for free users, unlimited for premium
  // If forceWaitMode, prevent turning off
  const gatedWaitModeToggle = useCallback((enabled: boolean) => {
    if (forceWaitMode && !enabled) return; // can't disable when forced
    if (enabled && !isPremium) {
      const { count } = getWaitModeCount();
      if (count >= FREE_DAILY_WAIT_MODE_LIMIT) {
        setShowUpgrade("waitMode");
        return;
      }
      incrementWaitModeCount();
    }
    actions.setIsWaitMode(enabled);
  }, [forceWaitMode, isPremium, actions]);

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
          <button onClick={() => window.history.back()} className="p-2 rounded-full bg-[#1e1e24]/80 text-zinc-300 hover:text-white hover:bg-[#2a2a32] backdrop-blur-md transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
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
          {/* Desktop: show all buttons */}
          <div className="hidden sm:flex items-center gap-2">
            <ShareButton title={projectName} />
            <ProjectActionsMenu projectId={projectId} />
            <ThemeToggle hideBg className="p-2 w-10 h-10 rounded-full bg-[#1e1e24]/80 text-zinc-300 hover:text-white hover:bg-[#2a2a32] backdrop-blur-md transition-all border-none" />
          </div>
          {/* Mobile: consolidated three-dot menu */}
          <div className="sm:hidden">
            <MobileActionsMenu projectId={projectId} projectName={projectName} />
          </div>
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
            timemap={payload.notationData?.timemap || []}
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

      {/* 4. Practice Mode Monitor Overlay */}
      {state.showWaitModeMonitor && (
        <div
          ref={refs.waitModeMonitorRef}
          className="absolute top-20 left-4 z-[150] w-64 bg-[#18181b]/95 backdrop-blur-xl border border-blue-500/30 rounded-xl p-3 text-xs tracking-wider text-zinc-300 shadow-[0_0_20px_rgba(59,130,246,0.15)] select-none pointer-events-none"
        >
          <div className="flex gap-2 items-center text-blue-400">Practice Mode Active</div>
        </div>
      )}

      {/* 3. Floating Control Bar (Dock) */}
      <PlayerControls
        bpm={payload.metadata?.tempo || 120}
        positionMs={state.positionMs}
        durationMs={state.totalSongDurationMs}
        isPlaying={state.isPlaying}
        loadingAudio={state.loadingAudio}
        onPlay={gatedHandlePlay}
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
        onWaitModeToggle={gatedWaitModeToggle}
        isPremium={isPremium}
        isWaitModeLenient={state.isWaitModeLenient}
        onWaitModeLenientToggle={actions.setIsWaitModeLenient}
        isSynthMuted={payload.metadata?.scoreSynthMuted ?? false}
        onSynthMuteToggle={() => { }}
        midiTracks={state.parsedMidi ? state.parsedMidi.tracks.map((t: any, i: number) => ({ id: i, name: state.partNames?.[i] || t.name || `Instrument ${i + 1}` })) : []}
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
        {...(enableRecording ? {
          isRecording: recorder.isRecording,
          onRecordToggle: handleRecordToggle,
        } : {})}
      />

      {/* Recording Preview Overlay */}
      {enableRecording && recorder.recordingUrl && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-[130] w-full max-w-md px-4">
          <div className="bg-white/95 dark:bg-[#1e1e24]/95 backdrop-blur-xl border border-zinc-300 dark:border-zinc-700 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                <span className="text-red-500 text-sm">🎙</span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-zinc-900 dark:text-white">{tc("recordingReady")}</div>
                <div className="text-xs text-zinc-500">{Math.round(recorder.durationMs / 1000)}s</div>
              </div>
            </div>
            <audio src={recorder.recordingUrl} controls className="w-full h-8 mb-3" />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (recorder.recordingBlob && onRecordingReady) {
                    onRecordingReady(recorder.recordingBlob);
                  }
                  recorder.discardRecording();
                }}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg py-2 transition-colors"
              >
                {tc("submitRecording")}
              </button>
              <button
                onClick={recorder.discardRecording}
                className="px-4 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-sm font-bold rounded-lg py-2 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
              >
                {tc("discardRecording")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recording Error Toast */}
      {recorder.error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[150] bg-red-500/90 text-white text-sm px-4 py-2 rounded-lg shadow-xl">
          {recorder.error}
        </div>
      )}

      {/* Upgrade Prompt */}
      {showUpgrade && (
        <UpgradePrompt feature={showUpgrade} onClose={() => setShowUpgrade(null)} />
      )}
    </div>
  );
}
