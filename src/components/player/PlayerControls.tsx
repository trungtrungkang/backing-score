"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Repeat, SlidersHorizontal, Bell, Zap, ChevronDown, ChevronUp, Square, SkipBack, SkipForward, PlaySquare, Keyboard, TrendingUp, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AudioTrack } from "@/lib/daw/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PlayerControlsProps {
  bpm: number;
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  loadingAudio?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (ms: number) => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  pitchShift: number;
  onPitchShiftChange: (pitch: number) => void;
  isMetronomeEnabled: boolean;
  onMetronomeToggle: (enabled: boolean) => void;
  loopState: { enabled: boolean; startBar: number; endBar: number; tempoRamp: boolean; tempoRampStep: number; tempoRampTarget: number };
  onLoopStateChange: (state: { enabled: boolean; startBar: number; endBar: number; tempoRamp?: boolean; tempoRampStep?: number; tempoRampTarget?: number }) => void;
  tracks: AudioTrack[];
  volumes: Record<string, number>;
  muteByTrackId: Record<string, boolean>;
  soloByTrackId: Record<string, boolean>;
  onMuteToggle: (id: string) => void;
  onSoloToggle: (id: string) => void;
  onVolumeChange: (id: string, vol: number) => void;
  isCollapsed?: boolean;
  onCollapseToggle?: (collapsed: boolean) => void;
  playlistId?: string | null;
  hasNext?: boolean;
  hasPrev?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
  isAutoplayEnabled?: boolean;
  onAutoplayToggle?: (enabled: boolean) => void;
  isWaitMode?: boolean;
  onWaitModeToggle?: (enabled: boolean) => void;
  isWaitModeLenient?: boolean;
  onWaitModeLenientToggle?: (enabled: boolean) => void;
  isSynthMuted?: boolean;
  onSynthMuteToggle?: (muted: boolean) => void;
  midiTracks?: { id: number, name: string }[];
  practiceTrackIds?: number[];
  onPracticeTrackChange?: (ids: number[]) => void;
  showWaitModeMonitor?: boolean;
  onWaitModeMonitorToggle?: (show: boolean) => void;
  isMidiInitialized?: boolean;
  onInitializeMidi?: () => Promise<boolean>;
  onDisconnectMidi?: () => void;
  isMicInitialized?: boolean;
  onInitializeMic?: () => Promise<boolean>;
  onDisconnectMic?: () => void;
  isPremium?: boolean;
  // Recording
  isRecording?: boolean;
  onRecordToggle?: (recording: boolean) => void;
}

export function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlayerControls({
  bpm,
  positionMs,
  durationMs,
  isPlaying,
  loadingAudio = false,
  onPlay,
  onPause,
  onStop,
  onSeek,
  playbackRate,
  onPlaybackRateChange,
  pitchShift,
  onPitchShiftChange,
  isMetronomeEnabled,
  onMetronomeToggle,
  loopState,
  onLoopStateChange,
  tracks,
  volumes,
  muteByTrackId,
  soloByTrackId,
  onMuteToggle,
  onSoloToggle,
  onVolumeChange,
  isCollapsed = false,
  onCollapseToggle,
  playlistId,
  hasNext,
  hasPrev,
  onNext,
  onPrev,
  isAutoplayEnabled = true,
  onAutoplayToggle,
  isWaitMode,
  onWaitModeToggle,
  isWaitModeLenient = false,
  onWaitModeLenientToggle,
  isSynthMuted,
  onSynthMuteToggle,
  midiTracks,
  practiceTrackIds,
  onPracticeTrackChange,
  showWaitModeMonitor = false,
  onWaitModeMonitorToggle,
  isMidiInitialized = false,
  onInitializeMidi,
  onDisconnectMidi,
  isMicInitialized = false,
  onInitializeMic,
  onDisconnectMic,
  isPremium = false,
  isRecording = false,
  onRecordToggle,
}: PlayerControlsProps) {

  const [localPos, setLocalPos] = useState(positionMs);
  const [isDragging, setIsDragging] = useState(false);
  const [showMidiDialog, setShowMidiDialog] = useState(false);
  const [isInitializingMidi, setIsInitializingMidi] = useState(false);

  // Sync local position unless user is actively dragging
  useEffect(() => {
    if (!isDragging) {
      setLocalPos(positionMs);
    }
  }, [positionMs, isDragging]);

  const handleSliderChange = (vals: number[]) => {
    setIsDragging(true);
    setLocalPos(vals[0]);
  };

  const handleSliderCommit = (vals: number[]) => {
    onSeek(vals[0]);
    // Small delay to prevent jitter when state syncs back
    setTimeout(() => setIsDragging(false), 50);
  };

  if (isCollapsed) {
    return (
      <div className="absolute bottom-4 md:bottom-0 left-1/2 -translate-x-1/2 z-[120] pointer-events-none pb-[env(safe-area-inset-bottom)] md:pb-0 flex flex-col items-center gap-2">
        {isRecording && (
          <div className="pointer-events-auto flex items-center gap-2 bg-red-500/90 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white" />
            REC
          </div>
        )}
        <button
          onClick={() => onCollapseToggle?.(false)}
          className="w-24 h-8 bg-white/90 dark:bg-[#18181b]/90 backdrop-blur-xl border border-zinc-300 dark:border-zinc-700/50 border-b-0 rounded-t-xl md:rounded-b-none rounded-xl flex flex-col items-center justify-center gap-0.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shadow-2xl pointer-events-auto group"
          title="Show Player Controls"
        >
          <div className="w-8 h-1 rounded-full bg-zinc-400/50 group-hover:bg-zinc-500 transition-colors" />
          <ChevronUp className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[120] w-full max-w-4xl px-2 sm:px-4 pointer-events-none mt-6 pb-[env(safe-area-inset-bottom)] md:pb-0">
      <div className="bg-white/90 dark:bg-[#18181b]/90 backdrop-blur-xl border border-zinc-300 dark:border-zinc-700/50 shadow-2xl rounded-2xl p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 pointer-events-auto relative">
        <button
          onClick={() => onCollapseToggle?.(true)}
          className="absolute -top-[23px] left-1/2 -translate-x-1/2 w-12 h-6 bg-white/90 dark:bg-[#18181b]/90 backdrop-blur-xl border border-zinc-300 dark:border-zinc-700/50 border-b-0 rounded-t-lg flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors z-[-1]"
          title="Hide Player Controls"
        >
          <ChevronDown className="w-4 h-4" />
        </button>

        <div className="flex flex-col w-full gap-2">
          {/* Timeline Range */}
          <div className="flex items-center gap-3 w-full text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span className="w-10 text-right tabular-nums">{formatTime(positionMs)}</span>
            <div className="flex-1 relative group py-2">
              <Slider
                value={[localPos]}
                min={0}
                max={durationMs}
                step={100} // update granularity
                onValueChange={handleSliderChange}
                onValueCommit={handleSliderCommit}
                className="cursor-pointer"
                tooltipFormatter={(val) => formatTime(val)}
              />
            </div>
            <span className="w-10 text-left tabular-nums">{formatTime(durationMs)}</span>
          </div>

          {/* A-B Loop Timeline (Removed visual ms slider, handled in left popover) */}
        </div>

        {/* Controls Row */}
        <div className="flex flex-col w-full gap-3 mt-1">

          {/* Top Row: Playback */}
          <div className="flex items-center justify-center gap-2 sm:gap-6 w-full">
            {playlistId && (
              <button
                onClick={onPrev}
                disabled={!hasPrev}
                className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:text-blue-500 transition-colors disabled:opacity-30 disabled:hover:text-zinc-600 dark:disabled:hover:text-zinc-300"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>
            )}
            <button
              onClick={isPlaying ? onPause : onPlay}
              disabled={loadingAudio}
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]",
                loadingAudio
                  ? "bg-zinc-300 dark:bg-zinc-700 text-zinc-500 cursor-not-allowed shadow-none"
                  : "bg-blue-600 hover:bg-blue-500 text-white hover:scale-105 active:scale-95"
              )}
              title={loadingAudio ? "Loading Audio..." : isPlaying ? "Pause" : "Play"}
            >
              {loadingAudio ? (
                <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : isPlaying ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current translate-x-0.5" />
              )}
            </button>
            <button
              onClick={onStop}
              className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              title="Stop and Return"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
            {/* Record Button */}
            {onRecordToggle && (
              <button
                onClick={() => onRecordToggle(!isRecording)}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                  isRecording
                    ? "bg-red-500 text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                    : "bg-zinc-200 dark:bg-zinc-800 hover:bg-red-500/20 text-zinc-600 dark:text-zinc-300 hover:text-red-500"
                )}
                title={isRecording ? "Stop Recording" : "Start Recording"}
              >
                {isRecording ? <Square className="w-4 h-4 fill-current" /> : <span className="w-4 h-4 rounded-full bg-red-500 inline-block" />}
              </button>
            )}
            {playlistId && (
              <button
                onClick={onNext}
                disabled={!hasNext}
                className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:text-blue-500 transition-colors disabled:opacity-30 disabled:hover:text-zinc-600 dark:disabled:hover:text-zinc-300"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>
            )}
          </div>

          <div className="flex flex-row items-center justify-between w-full pt-2 sm:pt-3 gap-1.5 sm:gap-4 border-t border-zinc-200 dark:border-zinc-800/50">
            {/* Left */}
            <div className="flex items-center gap-1 sm:gap-3">

              {playlistId && (
                <button
                  onClick={() => onAutoplayToggle?.(!isAutoplayEnabled)}
                  className={cn("h-8 flex shrink-0 whitespace-nowrap items-center gap-1.5 sm:gap-2 px-2 sm:px-3 rounded-md border text-xs font-bold transition-all", isAutoplayEnabled ? "bg-green-500/10 border-green-500/50 text-green-600 dark:text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.15)]" : "bg-transparent border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800")}
                  title="Auto-Play Next Track"
                >
                  <PlaySquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Auto-Next</span>
                </button>
              )}

              {/* Wait Mode Popover */}
              {onWaitModeToggle && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={cn("h-8 px-2 sm:px-3 flex shrink-0 whitespace-nowrap items-center gap-1.5 sm:gap-2 rounded-md border text-xs font-bold tracking-wider transition-all", isWaitMode ? "bg-blue-500/20 border-blue-500/50 text-blue-500 dark:text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]" : "bg-transparent border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800")}
                      title="Practice Mode Settings"
                    >
                      <Keyboard className="w-4 h-4" /><span className="hidden sm:inline"> Practice</span>
                      {!isPremium && <span className="text-[10px] ml-1">👑</span>}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="z-[200] w-64 bg-white dark:bg-[#1A1A1E] border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 p-4 shadow-xl" sideOffset={8}>
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Practice Mode</span>
                        <button
                          onClick={() => {
                            if (!isWaitMode && !isPremium) {
                              onWaitModeToggle?.(true);
                              return;
                            }
                            if (!isWaitMode && !isMidiInitialized && !isMicInitialized && (onInitializeMidi || onInitializeMic)) {
                              const pref = localStorage.getItem("bs_preferred_instrument");
                              if (pref === "mic" && onInitializeMic) {
                                setIsInitializingMidi(true);
                                onInitializeMic().then(success => {
                                  setIsInitializingMidi(false);
                                  if (success) {
                                    onWaitModeLenientToggle?.(true);
                                    onWaitModeToggle(true);
                                  }
                                });
                              } else if (pref === "midi" && onInitializeMidi) {
                                setIsInitializingMidi(true);
                                onInitializeMidi().then(success => {
                                  setIsInitializingMidi(false);
                                  if (success) onWaitModeToggle(true);
                                });
                              } else {
                                setShowMidiDialog(true);
                              }
                            } else {
                              onWaitModeToggle?.(!isWaitMode);
                            }
                          }}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded font-bold uppercase transition-colors border",
                            isWaitMode
                              ? "bg-blue-500/20 text-blue-500 border-blue-500/50"
                              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-white"
                          )}
                        >
                          {isWaitMode ? "On" : "Off"}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Lenient (1+ Note)</span>
                        <button
                          onClick={() => onWaitModeLenientToggle?.(!isWaitModeLenient)}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded font-bold uppercase transition-colors border",
                            isWaitModeLenient
                              ? "bg-blue-500/20 text-blue-500 border-blue-500/50"
                              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-white"
                          )}
                        >
                          {isWaitModeLenient ? "On" : "Off"}
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-1 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500/80 dark:text-blue-400/80">Diagnostic Monitor</span>
                        <button
                          onClick={() => onWaitModeMonitorToggle?.(!showWaitModeMonitor)}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded font-bold uppercase transition-colors border",
                            showWaitModeMonitor
                              ? "bg-blue-500/20 text-blue-500 border-blue-500/50"
                              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-white"
                          )}
                        >
                          {showWaitModeMonitor ? "On" : "Off"}
                        </button>
                      </div>

                      <div className="flex flex-col gap-2 mt-1 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500/80 dark:text-purple-400/80">Hardware Input</span>

                        {!isMidiInitialized && !isMicInitialized && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">None</span>
                            <button onClick={() => setShowMidiDialog(true)} className="text-[10px] px-2 py-0.5 rounded font-bold uppercase transition-colors bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-white">Connect</button>
                          </div>
                        )}

                        {isMidiInitialized && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1.5"><Keyboard className="w-3 h-3" /> MIDI</span>
                            <button onClick={() => {
                              localStorage.removeItem("bs_preferred_instrument");
                              onDisconnectMidi?.();
                            }} className="text-[10px] px-2 py-0.5 rounded font-bold uppercase transition-colors bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20">Disconnect</button>
                          </div>
                        )}

                        {isMicInitialized && (
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1.5">🎙️ Mic</span>
                              <button onClick={() => {
                                localStorage.removeItem("bs_preferred_instrument");
                                onDisconnectMic?.();
                              }} className="text-[10px] px-2 py-0.5 rounded font-bold uppercase transition-colors bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20">Disconnect</button>
                            </div>
                            <span className="text-[10px] text-amber-500/80 dark:text-amber-400/70 leading-tight">Best for C3–C6. MIDI keyboard recommended for full range.</span>
                          </div>
                        )}
                      </div>

                      {midiTracks && midiTracks.length > 0 && onPracticeTrackChange && practiceTrackIds && (
                        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                          <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Practice Parts</label>
                          <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">

                            {/* Global Reset Option */}
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={practiceTrackIds.includes(-1)}
                                onChange={(e) => {
                                  if (e.target.checked) onPracticeTrackChange([-1]);
                                }}
                                className="cursor-pointer w-3.5 h-3.5 accent-blue-500 rounded bg-zinc-200 dark:bg-white/10"
                              />
                              <span className="text-xs">All Tracks (Chords)</span>
                            </label>

                            {midiTracks.map((t, i) => (
                              <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={practiceTrackIds.includes(i)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      onPracticeTrackChange([...practiceTrackIds.filter(id => id !== -1), i]);
                                    } else {
                                      const next = practiceTrackIds.filter(id => id !== i);
                                      if (next.length === 0) onPracticeTrackChange([-1]); // auto fallback
                                      else onPracticeTrackChange(next);
                                    }
                                  }}
                                  className="cursor-pointer w-3.5 h-3.5 accent-blue-500 rounded bg-zinc-200 dark:bg-white/10"
                                />
                                <span className="text-xs">{t.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn("h-8 px-2 sm:px-3 flex shrink-0 whitespace-nowrap items-center gap-1.5 sm:gap-2 rounded-md border text-xs font-bold tracking-wider transition-all", loopState.enabled ? "bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]" : "bg-transparent border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800")}
                    title="Edit Loop Range"
                  >
                    <Repeat className="w-4 h-4" /> A-B
                  </button>
                </PopoverTrigger>
                <PopoverContent className="z-[200] w-52 bg-white dark:bg-[#1A1A1E] border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 p-3 shadow-xl" sideOffset={8}>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Loop Range</span>
                      <button
                        onClick={() => onLoopStateChange({ ...loopState, enabled: !loopState.enabled })}
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded font-bold uppercase transition-colors border",
                          loopState.enabled
                            ? "bg-amber-500/20 text-amber-500 border-amber-500/50"
                            : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-white"
                        )}
                      >
                        {loopState.enabled ? "Active" : "Off"}
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Start Bar</span>
                        <input
                          type="number"
                          min={1}
                          value={loopState.startBar}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val >= 1) onLoopStateChange({ ...loopState, startBar: val });
                          }}
                          className="w-16 bg-zinc-100 dark:bg-zinc-900 border border-zinc-700 focus:border-amber-500/50 rounded px-2 py-1 text-sm text-center font-mono outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">End Bar</span>
                        <input
                          type="number"
                          min={1}
                          value={loopState.endBar}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val >= 1) onLoopStateChange({ ...loopState, endBar: val });
                          }}
                          className="w-16 bg-zinc-100 dark:bg-zinc-900 border border-zinc-700 focus:border-amber-500/50 rounded px-2 py-1 text-sm text-center font-mono outline-none"
                        />
                      </div>
                    </div>

                    {/* Tempo Ramp */}
                    <div className="border-t border-zinc-200 dark:border-zinc-700/50 pt-2 mt-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> Tempo Ramp
                        </span>
                        <button
                          onClick={() => onLoopStateChange({ ...loopState, tempoRamp: !loopState.tempoRamp })}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded font-bold uppercase transition-colors border",
                            loopState.tempoRamp
                              ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/50"
                              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-white"
                          )}
                        >
                          {loopState.tempoRamp ? "On" : "Off"}
                        </button>
                      </div>
                      {loopState.tempoRamp && (
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-1 flex-1">
                            <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Step</span>
                            <select
                              value={loopState.tempoRampStep}
                              onChange={(e) => onLoopStateChange({ ...loopState, tempoRampStep: parseFloat(e.target.value) })}
                              className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-700 focus:border-emerald-500/50 rounded px-1.5 py-1 text-xs font-mono outline-none cursor-pointer appearance-none text-center"
                            >
                              <option value="0.05">+5%</option>
                              <option value="0.1">+10%</option>
                              <option value="0.15">+15%</option>
                              <option value="0.2">+20%</option>
                            </select>
                          </div>
                          <div className="flex flex-col gap-1 flex-1">
                            <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Target</span>
                            <select
                              value={loopState.tempoRampTarget}
                              onChange={(e) => onLoopStateChange({ ...loopState, tempoRampTarget: parseFloat(e.target.value) })}
                              className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-700 focus:border-emerald-500/50 rounded px-1.5 py-1 text-xs font-mono outline-none cursor-pointer appearance-none text-center"
                            >
                              <option value="0.75">75%</option>
                              <option value="0.8">80%</option>
                              <option value="0.9">90%</option>
                              <option value="1">100%</option>
                              <option value="1.1">110%</option>
                              <option value="1.2">120%</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Speed Control */}
              <div className="flex flex-row items-center gap-2 bg-zinc-100 dark:bg-zinc-800/40 rounded-md border border-zinc-300 dark:border-zinc-700/50 px-2 h-8 hidden sm:flex">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">Speed</span>
                <select
                  value={playbackRate}
                  onChange={(e) => onPlaybackRateChange(parseFloat(e.target.value))}
                  className="bg-transparent font-mono text-xs focus:outline-none cursor-pointer text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors text-right w-12 appearance-none"
                  title="Playback Speed"
                >
                  <option value="0.25" className="bg-[#18181b] text-zinc-600 dark:text-zinc-300">.25x</option>
                  <option value="0.5" className="bg-[#18181b] text-zinc-600 dark:text-zinc-300">.5x</option>
                  <option value="0.75" className="bg-[#18181b] text-zinc-600 dark:text-zinc-300">.75x</option>
                  <option value="0.9" className="bg-[#18181b] text-zinc-600 dark:text-zinc-300">.9x</option>
                  <option value="1" className="bg-[#18181b] text-zinc-600 dark:text-zinc-300">1x</option>
                  <option value="1.1" className="bg-[#18181b] text-zinc-600 dark:text-zinc-300">1.1x</option>
                  <option value="1.25" className="bg-[#18181b] text-zinc-600 dark:text-zinc-300">1.25x</option>
                  <option value="1.5" className="bg-[#18181b] text-zinc-600 dark:text-zinc-300">1.5x</option>
                  <option value="2" className="bg-[#18181b] text-zinc-600 dark:text-zinc-300">2x</option>
                </select>
              </div>

              {/* Pitch Control */}
              <div className="flex flex-row items-center gap-2 bg-zinc-100 dark:bg-zinc-800/40 rounded-md border border-zinc-300 dark:border-zinc-700/50 px-2 h-8 hidden sm:flex">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">Pitch</span>
                <div className="flex items-center">
                  <button
                    onClick={() => onPitchShiftChange(pitchShift - 1)}
                    className="w-4 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  >
                    -
                  </button>
                  <span className="text-xs font-mono font-bold w-6 text-center text-zinc-600 dark:text-zinc-300">
                    {pitchShift > 0 ? `+${pitchShift}` : pitchShift}
                  </span>
                  <button
                    onClick={() => onPitchShiftChange(pitchShift + 1)}
                    className="w-4 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  >
                    +
                  </button>
                </div>
              </div>

            </div> {/* Close Left Block */}

            {/* Right */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Metronome */}
              <button
                onClick={() => onMetronomeToggle(!isMetronomeEnabled)}
                className={cn("h-8 flex items-center gap-2 px-3 rounded-md border text-xs font-bold transition-all", isMetronomeEnabled ? "bg-blue-100 dark:bg-blue-500/20 border-blue-400 dark:border-blue-500/50 text-blue-600 dark:text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]" : "bg-transparent border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800")}
              >
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Metronome</span>
              </button>

              {/* Mixer Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="h-8 px-3 rounded-md bg-transparent border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4" />
                    <span className="hidden sm:inline text-xs font-bold tracking-wider uppercase">Mixer</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  autoFocus={false}
                  align="end"
                  sideOffset={16}
                  className="z-[200] w-auto min-w-[200px] p-4 bg-[#1e1e24]/95 backdrop-blur-2xl border-zinc-300 dark:border-zinc-700/50 shadow-2xl rounded-2xl"
                >
                  <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-widest mb-4">Volume Mixer</div>
                  <div className="flex gap-4 sm:gap-6 overflow-x-auto max-w-[85vw] pb-2 px-2 pr-4">
                    {tracks.map(track => {
                      const isMuted = muteByTrackId[track.id] ?? track.muted ?? false;
                      const isSolo = soloByTrackId[track.id] ?? track.solo ?? false;
                      const vol = volumes[track.id] ?? track.volume ?? 1;

                      return (
                        <div key={track.id} className="flex flex-col items-center gap-3">
                          {/* Vertical Slider */}
                          <div className="h-32 w-8 flex justify-center py-2 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                            <Slider
                              orientation="vertical"
                              value={[vol]}
                              min={0} max={1.5} step={0.01}
                              onValueChange={(v) => onVolumeChange(track.id, v[0])}
                              className={cn("h-full cursor-pointer", isMuted ? "opacity-50" : "")}
                              tooltipFormatter={(val) => Math.round(val * 100) + '%'}
                            />
                          </div>
                          {/* M/S Buttons */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onMuteToggle(track.id)}
                              className={cn("w-7 h-7 rounded border flex items-center justify-center text-xs font-bold transition-all", isMuted ? "bg-red-500/20 border-red-500/50 text-red-500" : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300")}
                            >M</button>
                            <button
                              onClick={() => onSoloToggle(track.id)}
                              className={cn("w-7 h-7 rounded border flex items-center justify-center text-xs font-bold transition-all", isSolo ? "bg-green-500/20 border-green-500/50 text-green-500" : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300")}
                            >S</button>
                          </div>
                          <div className="text-[10px] uppercase font-semibold text-zinc-400 max-w-[60px] truncate text-center" title={track.name}>
                            {track.name}
                          </div>
                        </div>
                      )
                    })}
                    {tracks.length === 0 && (
                      <div className="text-xs text-zinc-500 italic py-4">No audio or MIDI tracks</div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {/* Close Bottom Row */}
          </div>

        </div>
      </div>

      <AlertDialog open={showMidiDialog} onOpenChange={setShowMidiDialog}>
        <AlertDialogContent className="z-[300] bg-white dark:bg-[#18181b] border-zinc-200 dark:border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <Keyboard className="w-5 h-5 text-blue-500" />
              Connect Instrument
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500 dark:text-zinc-400 font-medium">
              Practice Mode pauses playback and waits for you to play the correct notes on your instrument.
              Do you want to connect a Digital Piano via MIDI, or use your Microphone for acoustic instruments?
              <br /><br />
              <span className="text-amber-500 dark:text-amber-400 italic">⚠️ Mic detection works best for notes C3–C6. For accurate chord detection, a MIDI keyboard is strongly recommended.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-between w-full">
            <AlertDialogCancel disabled={isInitializingMidi} className="border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              Cancel
            </AlertDialogCancel>
            <div className="flex flex-col sm:flex-row gap-2">
              <AlertDialogAction
                disabled={isInitializingMidi}
                onClick={async (e) => {
                  e.preventDefault();
                  if (!onInitializeMic) return;
                  setIsInitializingMidi(true);
                  const success = await onInitializeMic();
                  setIsInitializingMidi(false);
                  if (success) {
                    localStorage.setItem("bs_preferred_instrument", "mic");
                    setShowMidiDialog(false);
                    onWaitModeLenientToggle?.(true); // Force Lenient for acoustic pitches
                    onWaitModeToggle?.(true);
                  } else {
                    setShowMidiDialog(false);
                  }
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white"
              >
                {isInitializingMidi ? "Connecting..." : "Use Microphone"}
              </AlertDialogAction>
              <AlertDialogAction
                disabled={isInitializingMidi}
                onClick={async (e) => {
                  e.preventDefault();
                  if (!onInitializeMidi) return;
                  setIsInitializingMidi(true);
                  const success = await onInitializeMidi();
                  setIsInitializingMidi(false);
                  if (success) {
                    localStorage.setItem("bs_preferred_instrument", "midi");
                    setShowMidiDialog(false);
                    onWaitModeToggle?.(true);
                  } else {
                    setShowMidiDialog(false);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                {isInitializingMidi ? "Connecting..." : "Connect MIDI"}
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
