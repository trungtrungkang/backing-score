"use client";

import { useMemo, useState, useCallback } from "react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Music, MoreVertical, Share2, Bookmark, Sun, Moon, Link2, Check, ChevronUp, ChevronDown } from "lucide-react";
import { MusicXMLVisualizer } from "@/components/editor/MusicXMLVisualizer";
import PdfViewer from "@/components/pdf/PdfViewer";
import type { DAWPayload } from "@/lib/daw/types";
import { cn } from "@/lib/utils";
import { PlayerControls } from "./PlayerControls";
import { MicCalibrationWizard } from "./MicCalibrationWizard";
import { VirtualKeyboard } from "./VirtualKeyboard";
import { PlayModeToggle } from "./PlayModeToggle";
import { useMicProfile } from "@/hooks/useMicProfile";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Bookmark as NavMapBookmark, NavigationSequence } from "@/lib/appwrite/nav-maps";
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

function midiToNoteName(midi: number) {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const note = notes[midi % 12];
  return `${note}${octave}`;
}

// Mobile-only consolidated actions menu for Play page header
function MobileActionsMenu({ projectId, projectName }: { projectId: string; projectName: string }) {
  const { user } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [isFavorited, setIsFavorited] = useState(false);
  const [copied, setCopied] = useState(false);
  const tPlay = useTranslations("PlayShell");

  useEffect(() => {
    if (!user) return;
    checkIsFavorited("project", projectId).then(setIsFavorited).catch(() => { });
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
          {copied ? tPlay("copied") : tPlay("shareLink")}
        </DropdownMenuItem>
        {user && (
          <DropdownMenuItem onClick={handleFavorite} className="flex items-center gap-3 text-sm font-medium cursor-pointer">
            <Bookmark className={`w-4 h-4 ${isFavorited ? "fill-amber-500 text-amber-500" : ""}`} />
            {isFavorited ? tPlay("removeFavorite") : tPlay("addFavorite")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex items-center gap-3 text-sm font-medium cursor-pointer"
        >
          {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {resolvedTheme === "dark" ? tPlay("lightMode") : tPlay("darkMode")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const FREE_DAILY_WAIT_MODE_LIMIT = 10;

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
  /** Active during Classroom Assignments: grant Halo Effect bypass */
  isAssignmentContext?: boolean;
  isOwner?: boolean;
  onSaveNavMap?: (bookmarks: NavMapBookmark[], sequence: NavigationSequence) => Promise<void>;
  onPayloadChange?: (payload: DAWPayload) => void;
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
  isAssignmentContext = false,
  isOwner = false,
  onSaveNavMap,
  onPayloadChange,
}: PlayShellProps) {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark" || resolvedTheme === "system";
  const { serviceTier, user } = useAuth();
  
  // Rule 3: The Halo Effect (Bypass) 
  // Free users instantly get Pro features while working on a Private LMS Assignment!
  const hasProAccess = serviceTier === "pro" || serviceTier === "studio" || isAssignmentContext;

  const tc = useTranslations("Classroom");
  const tPlay = useTranslations("PlayShell");
  const tControls = useTranslations("PlayerControls");
  const [showUpgrade, setShowUpgrade] = useState<"playLimit" | "waitMode" | null>(null);
  const router = useRouter();

  // --- Gamification Tracking ---
  const [sessionMaxSpeed, setSessionMaxSpeed] = useState(1.0);
  const sessionStartTimeRef = useRef<number | null>(null);
  const accumulatedTimeMsRef = useRef<number>(0);
  const userRef = useRef(user);
  const maxSpeedRef = useRef(1.0);
  const gamificationWarningShownRef = useRef(false);
  const scoreStateRef = useRef<any>(null);

  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { maxSpeedRef.current = sessionMaxSpeed; }, [sessionMaxSpeed]);

  const [isNavigatingBack, setIsNavigatingBack] = useState(false);

  // --- Layout Toggles (Synced to LocalStorage) ---
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(true);
  const [isCompactHeader, setIsCompactHeader] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'paged' | 'continuous'>('paged');

  useEffect(() => {
    try {
      const vk = localStorage.getItem("bs_show_virtual_keyboard");
      if (vk !== null) setShowVirtualKeyboard(vk === "true");
      const ch = localStorage.getItem("bs_compact_header");
      if (ch !== null) setIsCompactHeader(ch === "true");
      const lm = localStorage.getItem("bs_layout_mode");
      if (lm === "continuous" || lm === "paged") setLayoutMode(lm);
    } catch { }
  }, []);

  const handleLayoutModeChange = useCallback((mode: 'paged' | 'continuous') => {
    setLayoutMode(mode);
    try { localStorage.setItem("bs_layout_mode", mode); } catch { }
  }, []);

  const handleVirtualKeyboardToggle = useCallback((v: boolean) => {
    setShowVirtualKeyboard(v);
    try { localStorage.setItem("bs_show_virtual_keyboard", String(v)); } catch { }
  }, []);

  const handleCompactHeaderToggle = useCallback((v: boolean) => {
    setIsCompactHeader(v);
    try { localStorage.setItem("bs_compact_header", String(v)); } catch { }
  }, []);

  const submitPracticeSession = useCallback(async (waitModeScore?: number): Promise<boolean> => {
    if (!userRef.current?.$id) return false;

    let finalDuration = accumulatedTimeMsRef.current;
    if (sessionStartTimeRef.current !== null) {
      finalDuration += performance.now() - sessionStartTimeRef.current;
      sessionStartTimeRef.current = performance.now(); // reset timer
    }

    if (finalDuration < 10000) return false; // avoid submitting spam

    // Extract dynamic gamification variables from score engine state
    const currentState = scoreStateRef.current;
    let flowModeScore = 0;
    let inputType = 'midi';

    if (currentState) {
      if (currentState.isMicInitialized) inputType = 'mic';

      if (currentState.isFlowMode && currentState.assessmentResults) {
        let total = 0;
        let hits = 0;
        for (const res of Object.values(currentState.assessmentResults as Record<string, { noteMatched: boolean }>)) {
          total++;
          if (res.noteMatched) hits++;
        }
        flowModeScore = total > 0 ? Math.round((hits / total) * 100) : 0;
      }

      // Enforcement of Acoustic Loopback Penalty
      if (currentState.isGamificationInvalidated) {
        flowModeScore = 0;
        if (waitModeScore !== undefined) waitModeScore = 0;
      }
    }

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
          waitModeScore,
          flowModeScore,
          inputType
        })
      });
      const data = await res.json();
      if (data.addedXP) {
        // Dispatch global event for header to animate
        window.dispatchEvent(new CustomEvent("gamification-xp-earned", { detail: data }));
        return true;
      }
    } catch { }
    return false;
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
        }).catch(() => { });
      }
    };
  }, [projectId]);

  const { state, refs, actions } = useScoreEngine({
    payload,
    autoplayOnLoad,
    onNext,
    onPracticeComplete: (score) => { submitPracticeSession(score); }
  });

  useEffect(() => { scoreStateRef.current = state; }, [state]);
  const recorder = useAudioRecorder();

  const { profile, loading: profileLoading } = useMicProfile();
  const [showMicWizard, setShowMicWizard] = useState(false);

  // Auto-enable Wait Mode when forced by assignment
  useEffect(() => {
    if (forceWaitMode && state.practiceModeType !== 'wait') {
      actions.setPracticeModeType('wait');
    }
  }, [forceWaitMode]);

  // Gamification Anti-Cheat Warning Toast
  useEffect(() => {
    if (state.isMicInitialized && (state.isFlowMode || state.isWaitMode)) {
      if (!gamificationWarningShownRef.current) {
        gamificationWarningShownRef.current = true;

        if (state.isGamificationInvalidated) {
          toast.error(tPlay("gamificationInvalidatedMicWarning"), {
            duration: 8000,
            position: "top-center"
          });
        } else {
          toast.info(tPlay("gamificationMicWarning"), {
            duration: 8000,
            position: "top-center"
          });
        }
      }
    } else {
      gamificationWarningShownRef.current = false;
    }
  }, [state.isMicInitialized, state.isFlowMode, state.isWaitMode, state.isGamificationInvalidated]);

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

  // Global Shortcut for skipping stuck Wait Mode note
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow overriding a stuck Wait Mode note when using ArrowRight
      if (e.key === "ArrowRight" && state.isWaiting) {
        e.preventDefault();
        actions.skipWaitNote();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.isWaiting, actions]);

  useEffect(() => {
    if (state.playbackRate > sessionMaxSpeed) {
      setSessionMaxSpeed(state.playbackRate);
    }
  }, [state.playbackRate, sessionMaxSpeed]);

  const handleRecordToggle = useCallback((shouldRecord: boolean) => {
    if (shouldRecord) {
      if (forceWaitMode && !state.isWaitMode) {
        toast.error(tPlay("waitModeRequiredToRecord"), { position: "top-center", duration: 5000 });
        return;
      }
      recorder.startRecording();
    } else {
      recorder.stopRecording();
    }
  }, [recorder, forceWaitMode, state.isWaitMode, tPlay]);

  const handleBackClick = useCallback(() => {
    if (isNavigatingBack) return;
    setIsNavigatingBack(true);

    if (state.isPlaying) {
      actions.handlePause();
    }

    // Fire and forget to save XP immediately without making the user wait for animations
    submitPracticeSession().catch(() => { });

    // Instant Navigation
    router.back();
  }, [isNavigatingBack, submitPracticeSession, state.isPlaying, actions, router]);

  // Play handler — no limit for free users, just track server play count
  const gatedHandlePlay = useCallback(() => {
    // Prevent confusion when user hits play in Wait Mode but hasn't connected an input source
    if (state.isWaitMode && !state.isMidiInitialized && !state.isMicInitialized) {
      toast.error(tPlay("connectInputForWaitMode"), {
        position: "top-center",
        duration: 4000,
      });
      // Optionally, we still let it "Play" so the UI enters playing state, 
      // but it will be paused on the very first note until input arrives.
      // But showing the error is enough to instruct them.
    }

    actions.handlePlay();
    incrementServerPlayCount(projectId); // fire-and-forget
  }, [actions, projectId, state.isWaitMode, state.isMidiInitialized, state.isMicInitialized, tPlay]);

  // Gated Practice Mode toggle — 10/day for free users, unlimited for premium
  const gatedPracticeModeToggle = useCallback((mode: 'none' | 'wait' | 'flow') => {
    if (forceWaitMode && mode !== 'wait') {
      toast.info(tPlay("listeningModePreview", { fallback: "Wait Mode is required for this assignment." }), { position: "top-center", duration: 5000 });
      return; // prevent leaving wait mode if forced
    }
    if (mode !== 'none' && !hasProAccess) {
      const { count } = getWaitModeCount();
      if (count >= FREE_DAILY_WAIT_MODE_LIMIT) {
        setShowUpgrade("waitMode");
        return;
      }
      incrementWaitModeCount();
    }
    actions.setPracticeModeType(mode);
  }, [forceWaitMode, hasProAccess, actions, tPlay]);

  const scoreFileId = payload.notationData?.fileId;

  // Phase 20: Inject synthetic Score Synth track if MusicXML exists
  const displayTracks = useMemo(() => {
    const tracks = state.isMidiMode ? [] : [...payload.audioTracks];
    const autoUnmuteScoreSynth = tracks.length === 0 && !state.isWaitMode;

    if (scoreFileId && !state.isAudioMode) {
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
  }, [payload.audioTracks, scoreFileId, payload.metadata, state.isWaitMode, state.isMidiMode, state.isAudioMode]);

  return (
    <div className="relative flex flex-col h-full w-full bg-[#fdfdfc] dark:bg-[#1A1A1E] text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans">

      {/* 2. Full Screen Sheet Music Area */}
      <div className="flex-1 min-h-0 w-full h-full overflow-hidden relative transition-all duration-300">

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
          payload.notationData?.type === "pdf" ? (
             <div className="w-full h-full p-2 relative overflow-hidden bg-zinc-100 dark:bg-[#1A1A1E]">
                <PdfViewer
                  sheetMusicId={projectId}
                  pdfUrl={`/api/r2/download/${scoreFileId}?context=project_${projectId}`}
                  pageCount={payload.notationData?.pageCount || 1}
                  title={projectName}
                  initialNavMap={payload.notationData?.navMap}
                  readOnlyMap={!isOwner}
                  onSaveNavMap={onSaveNavMap}
                  onNextSong={onNext}
                  onPrevSong={onPrev}
                  hasNextSong={!!nextProjectId}
                  hasPrevSong={!!prevProjectId}
                />
                {/* Che khuất Header của PdfViewer để nhường sân cho PlayerControls */}
                <div className="absolute top-0 left-0 w-full h-[56px] bg-black pointer-events-none z-[100] opacity-0" />
             </div>
          ) : (
            <MusicXMLVisualizer
              scoreFileId={scoreFileId}
              positionMs={state.positionMs}
              isPlaying={state.isPlaying}
              timemap={state.correctedTimemap || state.activeTimemap || []}
              timemapSource={payload.notationData?.timemapSource}
              payloadTempo={payload.metadata?.tempo || 120}
              measureMap={payload.notationData?.measureMap}
              onSeek={actions.handleSeek}
              onMidiExtracted={actions.handleMidiExtracted}
              isDarkMode={isDarkMode}
              isWaitMode={state.isWaitMode}
              isWaiting={state.isWaiting}
              practiceTrackIds={state.practiceTrackIds}
              layoutMode={layoutMode}
              assessmentResults={state.assessmentMeasureResults}
            />
          )
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

      {/* 3. Top Control Bar (Dock) */}
      <div className="order-first flex-none w-full z-[120] relative">
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
          onCollapseToggle={handleCompactHeaderToggle}
          isCollapsed={isCompactHeader}
          showVirtualKeyboard={showVirtualKeyboard}
          onVirtualKeyboardToggle={handleVirtualKeyboardToggle}
          playlistId={playlistId}
          hasNext={!!nextProjectId}
          hasPrev={!!prevProjectId}
          onNext={onNext}
          onPrev={onPrev}
          isAutoplayEnabled={state.isAutoplayEnabled}
          onAutoplayToggle={actions.setIsAutoplayEnabled}
          practiceModeType={state.practiceModeType}
          onPracticeModeTypeChange={gatedPracticeModeToggle}
          layoutMode={layoutMode}
          onLayoutModeChange={handleLayoutModeChange}
          isPremium={hasProAccess}
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
              <button onClick={handleBackClick} disabled={isNavigatingBack} className={cn("p-2 sm:p-2.5 shrink-0 rounded-full bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all", isNavigatingBack && "opacity-50 cursor-wait")}>
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
              <div className="hidden md:flex ml-4 pl-4 border-l border-zinc-200 dark:border-zinc-800 items-center">
                <PlayModeToggle 
                   payload={payload} 
                   onPayloadChange={onPayloadChange} 
                   stretchedMidiBase64={state.stretchedMidiBase64} 
                   midiBase64={state.midiBase64} 
                />
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
              <div className="w-[1px] h-6 bg-zinc-300 dark:bg-zinc-700 mx-1" />
              <button
                onClick={() => handleCompactHeaderToggle(!isCompactHeader)}
                title={isCompactHeader ? "Expand Header" : "Compact Header"}
                className="p-1 sm:p-2 shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all"
              >
                {isCompactHeader ? <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" /> : <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            </div>
          }
        />
      </div>

      {state.isWaitMode && showVirtualKeyboard && (
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

      {/* Practice Monitor HUD (Hidden by default, enable for debugging) */}
      {false && (state.isFlowMode || state.isWaitMode) && (
        <div className={cn(
          "fixed left-4 z-[120] animate-in fade-in zoom-in-95 duration-300",
          (state.isWaitMode && showVirtualKeyboard) ? "bottom-[110px]" : "bottom-6 sm:bottom-8"
        )}>
          <div className="bg-white/95 dark:bg-[#1e1e24]/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-3 flex flex-col gap-2 min-w-[140px]">
            <div className="flex justify-between items-center pb-1 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Flow Monitor</span>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            </div>

            <div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-0.5">{tControls("targetMeasure")}:</div>
              <div className="flex flex-wrap gap-1">
                {(state as any).targetMeasure !== null ? (
                  <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold tabular-nums">
                    {(state as any).targetMeasure}
                  </span>
                ) : (
                  <span className="text-xs text-zinc-400 italic">--</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-0.5">{tControls("activeMeasure")}:</div>
              <div className="flex flex-wrap gap-1">
                {(state as any).activeMeasure !== null ? (
                  <span className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-semibold tabular-nums">
                    {(state as any).activeMeasure}
                  </span>
                ) : (
                  <span className="text-xs text-zinc-400 italic">--</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-0.5">Pressed Keys:</div>
              <div className="flex flex-wrap gap-1">
                {Array.from(state.activeNotes || []).length > 0 ? (
                  Array.from(state.activeNotes || []).map((n: number) => (
                    <span key={`active-${n}`} className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-xs font-semibold tabular-nums">
                      {midiToNoteName(n)}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-zinc-400 italic">--</span>
                )}
              </div>
            </div>
          </div>
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

      {/* Stuck Note Escape Hatch */}
      {state.isWaiting && (
        <div className={cn(
          "absolute right-4 sm:right-8 z-[120] animate-in fade-in zoom-in-95 duration-500 delay-1000 fill-mode-both",
          (state.isWaitMode && showVirtualKeyboard) ? "bottom-[115px]" : "bottom-6 sm:bottom-8"
        )}>
          <button
            onClick={() => actions.skipWaitNote()}
            className="flex items-center gap-2 bg-zinc-900/80 hover:bg-zinc-800 dark:bg-zinc-100/90 dark:hover:bg-white backdrop-blur-md text-white dark:text-black px-4 py-2.5 sm:px-5 sm:py-3 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 border border-white/10 dark:border-black/10 group"
            title="Press [Right Arrow] to skip"
          >
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">Bỏ qua nốt</span>
            <div className="flex items-center justify-center px-1.5 py-0.5 rounded bg-white/20 dark:bg-black/10 text-[10px] font-black group-hover:bg-white/30 dark:group-hover:bg-black/20 transition-colors">
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </button>
        </div>
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
