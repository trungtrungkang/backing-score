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
import { MicCalibrationWizard } from "./MicCalibrationWizard";
import { VirtualKeyboard } from "./VirtualKeyboard";
import { useMicProfile } from "@/hooks/useMicProfile";
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
import { useEffect, useRef } from "react";
import { ProjectActionsMenu } from "@/components/ProjectActionsMenu";
import { ShareButton } from "@/components/ShareButton";
import { useScoreEngine } from "@/hooks/useScoreEngine";
import { useAuth } from "@/contexts/AuthContext";
import UpgradePrompt from "@/components/UpgradePrompt";
import { incrementPlayCount as incrementServerPlayCount } from "@/lib/appwrite/projects";
import { GamificationCelebration } from "@/components/gamification/GamificationCelebration";
import { toast } from "sonner";

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

const FREE_DAILY_WAIT_MODE_LIMIT = 5;

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
  const { isPremium, user } = useAuth();
  const tc = useTranslations("Classroom");
  const [showUpgrade, setShowUpgrade] = useState<"playLimit" | "waitMode" | null>(null);

  // --- Gamification Tracking ---
  const [sessionMaxSpeed, setSessionMaxSpeed] = useState(1.0);
  const sessionStartTimeRef = useRef<number | null>(null);
  const accumulatedTimeMsRef = useRef<number>(0);
  const userRef = useRef(user);
  const maxSpeedRef = useRef(1.0);

  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { maxSpeedRef.current = sessionMaxSpeed; }, [sessionMaxSpeed]);

  const submitPracticeSession = useCallback(async (waitModeScore?: number) => {
    if (!userRef.current?.$id) return;
    
    let finalDuration = accumulatedTimeMsRef.current;
    if (sessionStartTimeRef.current !== null) {
      finalDuration += performance.now() - sessionStartTimeRef.current;
      sessionStartTimeRef.current = performance.now(); // reset timer
    }
    
    if (finalDuration < 10000) return; // avoid submitting spam
    
    // Lock the time so we don't double count if we submit midway
    accumulatedTimeMsRef.current = 0;
    
    try {
      const res = await fetch("/api/gamification/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userRef.current.$id,
          projectId,
          durationMs: Math.round(finalDuration),
          maxSpeed: maxSpeedRef.current,
          waitModeScore
        })
      });
      const data = await res.json();
      if (data.addedXP) {
        // Dispatch global event for header to animate
        window.dispatchEvent(new CustomEvent("gamification-xp-earned", { detail: data }));
      }
    } catch { }
  }, [projectId]);

  // Unmount tracker
  useEffect(() => {
    return () => {
      let finalDuration = accumulatedTimeMsRef.current;
      if (sessionStartTimeRef.current !== null) {
        finalDuration += performance.now() - sessionStartTimeRef.current;
      }
      if (finalDuration >= 10000 && userRef.current?.$id) {
        fetch("/api/gamification/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            userId: userRef.current.$id,
            projectId,
            durationMs: Math.round(finalDuration),
            maxSpeed: maxSpeedRef.current,
          })
        }).catch(() => {});
      }
    };
  }, [projectId]);

  const { state, refs, actions } = useScoreEngine({ 
    payload, 
    autoplayOnLoad, 
    onNext,
    onWaitModeComplete: (score) => submitPracticeSession(score)
  });
  const recorder = useAudioRecorder();
  
  const { profile, loading: profileLoading } = useMicProfile();
  const [showMicWizard, setShowMicWizard] = useState(false);

  // Auto-enable Wait Mode when forced by assignment
  useEffect(() => {
    if (forceWaitMode && !state.isWaitMode) {
      actions.setIsWaitMode(true);
    }
  }, [forceWaitMode]);

  // Warn Apple users about Voice Isolation when Mic activates
  useEffect(() => {
    if (state.isMicInitialized) {
      // Basic check for macOS/iOS. Since navigator.platform is deprecated, using userAgent
      const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
      if (isApple) {
        toast.info("Apple Users: Please turn off 'Voice Isolation' Mic Mode in your Control Center if you lose high notes (E7+).", {
          duration: 8000,
          position: "top-center"
        });
      }
    }
  }, [state.isMicInitialized, tc]);

  // Track playback time
  useEffect(() => {
    if (state.isPlaying) {
      if (sessionStartTimeRef.current === null) {
        sessionStartTimeRef.current = performance.now();
      }
    } else {
      if (sessionStartTimeRef.current !== null) {
        accumulatedTimeMsRef.current += performance.now() - sessionStartTimeRef.current;
        sessionStartTimeRef.current = null;
      }
    }
  }, [state.isPlaying]);

  useEffect(() => {
    if (state.playbackRate > sessionMaxSpeed) {
      setSessionMaxSpeed(state.playbackRate);
    }
  }, [state.playbackRate, sessionMaxSpeed]);

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
        onInitializeMic={async () => {
          const success = await actions.initializeMic();
          if (success && !profile && !profileLoading) {
            setShowMicWizard(true);
          }
          return success;
        }}
        onDisconnectMic={actions.disconnectMic}
        onMicCalibrate={() => setShowMicWizard(true)}
        {...(enableRecording ? {
          isRecording: recorder.isRecording,
          onRecordToggle: handleRecordToggle,
        } : {})}
        leftSlot={
          <>
            <button onClick={() => window.history.back()} className="p-2 sm:p-2.5 shrink-0 rounded-full bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {projectName}
              </h1>
              {composer && (
                <span className="hidden sm:block text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
                  {composer}
                </span>
              )}
            </div>
          </>
        }
        rightSlot={
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden sm:flex items-center gap-1 sm:gap-2">
              <ShareButton title={projectName} />
              <ProjectActionsMenu projectId={projectId} />
              <ThemeToggle hideBg className="p-2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 dark:hover:text-white transition-all border-none" />
            </div>
            <div className="sm:hidden">
              <MobileActionsMenu projectId={projectId} projectName={projectName} />
            </div>
          </div>
        }
      />

      {state.isWaitMode && (
        <div className="fixed bottom-0 left-0 w-full h-[95px] z-[110] bg-zinc-950 border-t border-zinc-900 pointer-events-auto shadow-[0_-10px_30px_rgba(0,0,0,0.5)] flex flex-col">
          <div className="w-full py-1 bg-zinc-900 border-b border-zinc-800 flex justify-center items-center gap-2 relative shadow-sm">
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Real-time Wait Mode Monitor</p>
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
          </div>
          <VirtualKeyboard 
            activeNotes={state.activeNotes} 
            className="flex-1 rounded-none border-none bg-transparent" 
          />
        </div>
      )}

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

      {showUpgrade && (
        <UpgradePrompt feature={showUpgrade} onClose={() => setShowUpgrade(null)} />
      )}

      {/* Gamification Celebration Overlay */}
      <GamificationCelebration />

      {/* Mic Calibration Wizard Overlay */}
      <MicCalibrationWizard 
        isOpen={showMicWizard}
        onClose={() => setShowMicWizard(false)}
      />
    </div>
  );
}
