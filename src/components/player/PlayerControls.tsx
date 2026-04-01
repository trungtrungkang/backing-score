"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Play, Pause, Repeat, SlidersHorizontal, Bell, Zap, ChevronDown, ChevronUp, Settings2, Square, SkipBack, SkipForward, PlaySquare, Keyboard, TrendingUp, Mic, Check, Piano, X, Volume2, BookOpen, ScrollText } from "lucide-react";
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
  practiceModeType?: 'none' | 'wait' | 'flow';
  onPracticeModeTypeChange?: (mode: 'none' | 'wait' | 'flow') => void;
  isWaitModeLenient?: boolean;
  onWaitModeLenientToggle?: (enabled: boolean) => void;
  layoutMode?: 'paged' | 'continuous';
  onLayoutModeChange?: (mode: 'paged' | 'continuous') => void;
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
  onMicCalibrate?: () => void;
  isPremium?: boolean;
  // Recording
  isRecording?: boolean;
  onRecordToggle?: (recording: boolean) => void;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  showVirtualKeyboard?: boolean;
  onVirtualKeyboardToggle?: (show: boolean) => void;
}

export function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlayerControls({
  playlistId,
  isPlaying,
  bpm,
  positionMs,
  durationMs,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onNext,
  hasPrev,
  hasNext,
  onPrev,
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
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
  practiceModeType = 'none',
  onPracticeModeTypeChange,
  layoutMode = 'paged',
  onLayoutModeChange,
  onInitializeMidi,
  onInitializeMic,
  onPracticeTrackChange,
  isRecording,
  onRecordToggle,
  leftSlot,
  rightSlot,
  loadingAudio,
  isPremium,
  isWaitModeLenient,
  onWaitModeLenientToggle,
  showWaitModeMonitor,
  onWaitModeMonitorToggle,
  isMidiInitialized,
  isMicInitialized,
  onDisconnectMidi,
  onDisconnectMic,
  onMicCalibrate,
  midiTracks,
  practiceTrackIds,
  muteByTrackId,
  soloByTrackId,
  isAutoplayEnabled,
  onAutoplayToggle,
  isCollapsed,
  onCollapseToggle,
  showVirtualKeyboard,
  onVirtualKeyboardToggle,
}: PlayerControlsProps) {

  const [localPos, setLocalPos] = useState(positionMs);
  const [isDragging, setIsDragging] = useState(false);
  const [showMidiDialog, setShowMidiDialog] = useState(false);
  const [isInitializingMidi, setIsInitializingMidi] = useState(false);
  const t = useTranslations("PlayerControls");

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

  return (
    <>
      <div className={cn("w-full bg-white/95 dark:bg-[#1A1A1E]/95 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col pointer-events-auto transition-all duration-300 overflow-hidden", isCollapsed ? "h-0 opacity-0 pb-0 border-none" : "h-auto opacity-100 pb-1 sm:pb-2")}>

        {/* ROW 1: Header / Top Bar */}
        <div className="flex items-center justify-between px-2 sm:px-4 py-1.5 sm:py-2 w-full h-12 sm:h-14">
          <div className="flex items-center shrink-0 min-w-0 mr-4">
            {leftSlot}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {rightSlot}
          </div>
        </div>

        {/* ROW 2: Google Docs-style Pill Toolbar */}
        <div className="w-full px-2 sm:px-4 pb-2">
          <div className="flex flex-nowrap overflow-x-auto no-scrollbar items-center justify-start px-1.5 py-1 w-full bg-zinc-100/80 dark:bg-zinc-800/50 rounded-lg sm:rounded-full border border-zinc-200/80 dark:border-zinc-700/60 gap-1.5 sm:gap-2">

            {/* MAIN PLAYBACK */}
            <div className="flex items-center justify-center gap-0.5 sm:gap-1 pl-1 shrink-0 w-auto bg-transparent border-none p-0 z-[130]">
            {playlistId && (
              <button
                onClick={onPrev}
                disabled={!hasPrev}
                className="w-8 h-8 rounded flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors disabled:opacity-30 border-none bg-transparent"
                title="Previous Track"
              >
                <SkipBack className="w-4 h-4 fill-current" />
              </button>
            )}
            <button
              onClick={isPlaying ? onPause : onPlay}
              disabled={loadingAudio}
              className={cn(
                "w-8 h-8 rounded flex items-center justify-center transition-colors border border-transparent",
                loadingAudio
                  ? "text-zinc-400 cursor-not-allowed"
                  : isPlaying
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60"
              )}
              title={loadingAudio ? "Loading Audio..." : isPlaying ? "Pause" : "Play"}
            >
              {loadingAudio ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current translate-x-0.5" />
              )}
            </button>
            <button
              onClick={onStop}
              className="w-8 h-8 rounded flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors border-none bg-transparent"
              title="Stop and Return"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
            {onRecordToggle && (
              <button
                onClick={() => onRecordToggle(!isRecording)}
                className={cn(
                  "w-8 h-8 rounded flex items-center justify-center transition-colors border-none",
                  isRecording
                    ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 animate-pulse"
                    : "bg-transparent text-zinc-700 dark:text-zinc-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
                )}
                title={isRecording ? "Stop Recording" : "Start Recording"}
              >
                {isRecording ? <Square className="w-3.5 h-3.5 fill-current" /> : <span className="w-3 h-3 rounded-full bg-current inline-block" />}
              </button>
            )}
            {playlistId && (
              <button
                onClick={onNext}
                disabled={!hasNext}
                className="w-8 h-8 rounded flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors disabled:opacity-30 border-none bg-transparent"
                title="Next Track"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>
            )}
          </div>

          <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 shrink-0 mx-0.5 sm:mx-1" />

          {/* RIGHT SETTINGS */}
          <div className="flex flex-1 items-center justify-start shrink-0 min-w-0 w-auto gap-0.5 sm:gap-1 flex-nowrap pr-2">

            {/* Desktop View Menu items */}
            <div className="hidden sm:flex items-center gap-1">
              {/* Layout Mode Toggle */}
              {onLayoutModeChange && (
                <button
                  onClick={() => onLayoutModeChange(layoutMode === 'paged' ? 'continuous' : 'paged')}
                  className={cn(
                    "w-8 h-8 rounded shrink-0 flex items-center justify-center transition-colors border-none",
                    "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60"
                  )}
                  title={layoutMode === 'paged' ? "Switch to Continuous Scrolling" : "Switch to Paged Layout"}
                >
                  {layoutMode === 'paged' ? <BookOpen className="w-[18px] h-[18px]" strokeWidth={2} /> : <ScrollText className="w-[18px] h-[18px]" strokeWidth={2} />}
                </button>
              )}
  
              {/* Speed Option */}
              <div className="flex items-center gap-1 bg-transparent hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 rounded px-1.5 h-8 transition-colors">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">{t("speed")}</span>
                <select
                  value={playbackRate}
                  onChange={(e) => onPlaybackRateChange(parseFloat(e.target.value))}
                  className="bg-transparent text-xs font-mono font-medium outline-none text-zinc-700 dark:text-zinc-300 cursor-pointer"
                >
                  <option value="0.5">.5x</option>
                  <option value="0.75">.75x</option>
                  <option value="0.9">.9x</option>
                  <option value="1">1x</option>
                  <option value="1.1">1.1x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
              </div>
  
              {/* Pitch Option */}
              <div className="flex items-center gap-1 bg-transparent hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 rounded px-1.5 h-8 transition-colors">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">{t("pitch")}</span>
                <select
                  value={pitchShift}
                  onChange={(e) => onPitchShiftChange(parseInt(e.target.value))}
                  className="bg-transparent text-xs font-mono font-medium outline-none text-zinc-700 dark:text-zinc-300 cursor-pointer"
                >
                  {Array.from({ length: 25 }, (_, i) => i - 12).map(val => (
                    <option key={val} value={val}>{val > 0 ? `+${val}` : val}</option>
                  ))}
                </select>
              </div>
              
              <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 shrink-0 mx-0.5" />
            </div>

            {/* Mobile Settings Drawer */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="sm:hidden h-8 px-2 rounded flex items-center gap-1 text-xs font-semibold bg-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors border-none"
                  title="More Settings"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-xl rounded-xl z-[200]">
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Playback Settings</span>
                  
                  {onLayoutModeChange && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Layout</span>
                      <select
                        value={layoutMode}
                        onChange={(e) => onLayoutModeChange(e.target.value as 'paged' | 'continuous')}
                        className="bg-zinc-100 dark:bg-zinc-800 text-xs font-mono font-medium outline-none text-zinc-900 dark:text-zinc-100 cursor-pointer rounded px-2 py-1"
                      >
                        <option value="paged">Paged</option>
                        <option value="continuous">Continuous</option>
                      </select>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Speed</span>
                    <select
                      value={playbackRate}
                      onChange={(e) => onPlaybackRateChange(parseFloat(e.target.value))}
                      className="bg-zinc-100 dark:bg-zinc-800 text-xs font-mono font-medium outline-none text-zinc-900 dark:text-zinc-100 cursor-pointer rounded px-2 py-1"
                    >
                      <option value="0.5">0.5x</option><option value="0.75">0.75x</option><option value="0.9">0.9x</option>
                      <option value="1">1.0x</option><option value="1.1">1.1x</option><option value="1.25">1.25x</option>
                      <option value="1.5">1.5x</option><option value="2">2.0x</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Pitch Shift</span>
                    <select
                      value={pitchShift}
                      onChange={(e) => onPitchShiftChange(parseInt(e.target.value))}
                      className="bg-zinc-100 dark:bg-zinc-800 text-xs font-mono font-medium outline-none text-zinc-900 dark:text-zinc-100 cursor-pointer rounded px-2 py-1"
                    >
                      {Array.from({ length: 25 }, (_, i) => i - 12).map(val => (
                        <option key={val} value={val}>{val > 0 ? `+${val}` : val}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Metronome */}
            <button
              onClick={() => onMetronomeToggle(!isMetronomeEnabled)}
              className={cn(
                "h-8 px-2 rounded flex items-center gap-1.5 text-xs font-semibold transition-colors border-none",
                isMetronomeEnabled
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                  : "bg-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60"
              )}
              title="Toggle Metronome"
            >
              <Bell className="w-3.5 h-3.5" />
            </button>

            {/* A-B Loop Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "h-8 px-2 rounded flex items-center gap-1.5 text-xs font-semibold transition-colors border-none",
                    loopState.enabled
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                      : "bg-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60"
                  )}
                  title="A-B Loop"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline text-[10px] uppercase">Loop</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-xl rounded-xl z-[200]">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">A-B Loop</span>
                    <button
                      onClick={() => onLoopStateChange({ ...loopState, enabled: !loopState.enabled })}
                      className={cn(
                        "text-[10px] px-2 py-1 rounded font-bold uppercase transition-colors border",
                        loopState.enabled
                          ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                      )}
                    >
                      {loopState.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase">Start Bar</label>
                      <input
                        type="number"
                        min={1}
                        value={loopState.startBar}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 1) onLoopStateChange({ ...loopState, startBar: val });
                        }}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded px-2 py-1.5 text-sm outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase">End Bar</label>
                      <input
                        type="number"
                        min={1}
                        value={loopState.endBar}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 1) onLoopStateChange({ ...loopState, endBar: val });
                        }}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded px-2 py-1.5 text-sm outline-none"
                      />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 shrink-0 mx-0.5 sm:mx-1" />

            {/* Practice Mode */}
            {onPracticeModeTypeChange && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "h-8 px-2 flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded text-xs font-semibold tracking-wide transition-colors border-none",
                      practiceModeType !== 'none'
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" 
                        : "bg-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60"
                    )}
                    title="Practice Mode Settings"
                    type="button"
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline"> {t("practiceMode")}</span>
                    {!isPremium && <span className="text-[10px] ml-0.5">👑</span>}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 bg-white dark:bg-[#1e1e24] border-zinc-200 dark:border-zinc-700 shadow-xl rounded-xl p-0 overflow-hidden z-[200]">
                  <div className="bg-zinc-50 dark:bg-[#25252b] px-4 py-3 border-b border-zinc-200 dark:border-zinc-700/50 flex flex-col gap-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Keyboard className="w-4 h-4 text-blue-500" />
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white">{t("practiceMode", { fallback: "Practice Mode" })}</h4>
                    </div>
                    
                    {/* Practice Mode Type Selector */}
                    <div className="flex p-1 bg-zinc-200/50 dark:bg-black/20 rounded-lg">
                      <button
                        onClick={() => {
                          onPracticeModeTypeChange('none');
                        }}
                        className={cn("flex-1 text-xs font-bold px-2 py-1.5 rounded-md transition-colors", practiceModeType === 'none' ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400")}
                      >
                        Off
                      </button>
                      <button
                        onClick={() => {
                          if (!isMidiInitialized && onInitializeMidi) onInitializeMidi();
                          onPracticeModeTypeChange('wait');
                        }}
                        className={cn("flex-1 text-xs font-bold px-2 py-1.5 rounded-md transition-colors", practiceModeType === 'wait' ? "bg-blue-500 text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400")}
                      >
                        Wait
                      </button>
                      <button
                        onClick={() => {
                          if (!isMidiInitialized && onInitializeMidi) onInitializeMidi();
                          onPracticeModeTypeChange('flow');
                        }}
                        className={cn("flex-1 text-xs font-bold px-2 py-1.5 rounded-md transition-colors", practiceModeType === 'flow' ? "bg-green-500 text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400")}
                      >
                        Flow
                      </button>
                    </div>
                  </div>

                  <div className="px-4 py-3 flex flex-col gap-4">
                    {practiceModeType !== 'none' && !isPremium && (
                      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 border border-amber-500/20 rounded-lg p-2.5">
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                          <span className="font-bold">{t("freeDailyLimitTitle", { fallback: "Free limit reached" })}</span>{t("freeDailyLimitDesc", { fallback: " upgrade required." })}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t("strictSync")}</span>
                        <button
                          onClick={() => onWaitModeLenientToggle?.(!isWaitModeLenient)}
                          className={cn("text-[10px] px-2 py-1 rounded font-bold uppercase transition-colors border", !isWaitModeLenient ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700")}
                          title={!isWaitModeLenient ? t("strictSyncDesc") : t("lenientSyncDesc")}
                        >
                          {!isWaitModeLenient ? t("on") : t("off")}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t("monitor")}</span>
                        <button
                          onClick={() => onWaitModeMonitorToggle?.(!showWaitModeMonitor)}
                          className={cn("text-[10px] px-2 py-1 rounded font-bold uppercase transition-colors border", showWaitModeMonitor ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700")}
                        >
                          {showWaitModeMonitor ? t("on") : t("off")}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Virtual Keyboard</span>
                        <button
                          onClick={() => onVirtualKeyboardToggle?.(!showVirtualKeyboard)}
                          className={cn("text-[10px] px-2 py-1 rounded font-bold uppercase transition-colors border", showVirtualKeyboard ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700")}
                        >
                          {showVirtualKeyboard ? t("on") : t("off")}
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-zinc-200 dark:border-zinc-700/50 pt-3">
                      {!isMidiInitialized && !isMicInitialized && (
                        <div className="flex flex-col gap-2">
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Select Input Source:</div>
                          <div className="flex gap-2">
                            {onInitializeMidi && (
                              <button
                                onClick={onInitializeMidi}
                                className="flex-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors border border-zinc-200 dark:border-zinc-700"
                              >
                                <Piano className="w-4 h-4" /> MIDI
                              </button>
                            )}
                            {onInitializeMic && (
                              <button
                                onClick={onInitializeMic}
                                className="flex-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors border border-zinc-200 dark:border-zinc-700"
                              >
                                <Mic className="w-4 h-4" /> MIC
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {isMidiInitialized && (
                        <div className="flex items-center justify-between bg-zinc-50 dark:bg-black/20 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <Piano className="w-4 h-4 text-green-500 shrink-0" />
                            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                              MIDI Device Connected
                            </span>
                          </div>
                          <button onClick={() => {
                            onDisconnectMidi?.();
                          }} className="p-1 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors" title="Disconnect MIDI">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {isMicInitialized && (
                        <div className="flex items-center justify-between bg-zinc-50 dark:bg-black/20 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <Mic className="w-4 h-4 text-green-500 shrink-0" />
                            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                              Mic Tracking Active
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {onMicCalibrate && (
                              <button onClick={onMicCalibrate} className="p-1 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors" title="Calibrate Mic Profile">
                                <Settings2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => {
                              onDisconnectMic?.();
                            }} className="p-1 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors" title="Disconnect MIC">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {midiTracks && midiTracks.length > 0 && onPracticeTrackChange && practiceTrackIds && (
                      <div className="border-t border-zinc-200 dark:border-zinc-700/50 pt-3 flex flex-col gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Practice Parts</span>
                        <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto no-scrollbar">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative flex items-center justify-center">
                              <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={practiceTrackIds.includes(-1)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    onPracticeTrackChange([-1]);
                                  } else {
                                    onPracticeTrackChange([]);
                                  }
                                }}
                              />
                              <div className="w-4 h-4 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 peer-checked:bg-blue-500 peer-checked:border-blue-500 flex items-center justify-center transition-all">
                                <Check className="w-3 h-3 text-white scale-0 peer-checked:scale-100 transition-transform" strokeWidth={3} />
                              </div>
                            </div>
                            <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">Any Part (Auto)</span>
                          </label>

                          {midiTracks.map((t, i) => (
                            <label key={t.id} className="flex items-center gap-2 cursor-pointer group">
                              <div className="relative flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  className="peer sr-only"
                                  checked={practiceTrackIds.includes(i)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      onPracticeTrackChange([...practiceTrackIds.filter(id => id !== -1), i]);
                                    } else {
                                      const next = practiceTrackIds.filter(id => id !== i);
                                      onPracticeTrackChange(next.length === 0 ? [-1] : next);
                                    }
                                  }}
                                />
                                <div className="w-4 h-4 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 peer-checked:bg-blue-500 peer-checked:border-blue-500 flex items-center justify-center transition-all">
                                  <Check className="w-3 h-3 text-white scale-0 peer-checked:scale-100 transition-transform" strokeWidth={3} />
                                </div>
                              </div>
                              <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium group-hover:text-zinc-900 dark:group-hover:text-white transition-colors truncate">{t.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Mixer */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="h-8 px-2 flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded bg-transparent text-xs font-semibold tracking-wide text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors border-none"
                  title="Audio Mixer"
                  type="button"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t("mixer")}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] sm:w-[380px] bg-white dark:bg-[#1e1e24] border-zinc-200 dark:border-zinc-700 shadow-xl rounded-xl p-0 overflow-hidden z-[200]">
                <div className="bg-zinc-50 dark:bg-[#25252b] px-4 py-3 border-b border-zinc-200 dark:border-zinc-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white">{t("mixer")}</h4>
                  </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto no-scrollbar p-2">
                  <div className="flex flex-col gap-1">
                    {tracks.map(track => {
                      const isMuted = muteByTrackId[track.id] ?? track.muted ?? false;
                      const isSolo = soloByTrackId[track.id] ?? track.solo ?? false;

                      return (
                        <div key={track.id} className="flex flex-col gap-2 p-2 hover:bg-zinc-50 dark:hover:bg-black/10 rounded-lg transition-colors group">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 truncate pr-2" title={track.name}>{track.name}</span>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => onMuteToggle(track.id)}
                                className={cn("w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center transition-colors", isMuted ? "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/50" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-transparent")}
                              >
                                M
                              </button>
                              <button
                                onClick={() => onSoloToggle(track.id)}
                                className={cn("w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center transition-colors", isSolo ? "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/50" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-transparent")}
                              >
                                S
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Volume2 className={cn("w-3.5 h-3.5 shrink-0 transition-colors", isMuted ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400")} />
                            <Slider
                              className={cn("flex-1", isMuted && "opacity-50")}
                              value={[isMuted ? 0 : volumes[track.id] ?? track.volume ?? 1]}
                              min={0}
                              max={1}
                              step={0.01}
                              onValueChange={(val) => {
                                if (isMuted && val[0] > 0) onMuteToggle(track.id);
                                onVolumeChange(track.id, val[0]);
                              }}
                            />
                            <span className="w-8 text-right text-[10px] font-mono text-zinc-500">{Math.round((volumes[track.id] ?? track.volume ?? 1) * 100)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 shrink-0 mx-0.5 sm:mx-1" />

            {/* Auto-Play Next Optional (already added right slot, could add here too if missing) */}
            {playlistId && (
              <button
                onClick={() => onAutoplayToggle?.(!isAutoplayEnabled)}
                className={cn(
                  "hidden lg:flex h-8 px-2 rounded flex items-center gap-1.5 text-xs font-semibold transition-colors border-none",
                  isAutoplayEnabled
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                    : "bg-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60"
                )}
                title="Auto-Play Next Track"
              >
                <PlaySquare className="w-3.5 h-3.5" />
              </button>
            )}

          </div>
        </div>
      </div>

      {/* Timeline Row */}
      <div className="w-full flex items-center px-4 sm:px-6 pb-2 -mt-1 gap-3 text-[10px] sm:text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <span className="w-10 text-right tabular-nums">{formatTime(positionMs)}</span>
          <div className="flex-1 relative group py-2">
            <Slider
              value={[localPos]}
              min={0}
              max={durationMs}
              step={100}
              onValueChange={handleSliderChange}
              onValueCommit={handleSliderCommit}
              className="cursor-pointer"
              tooltipFormatter={(val) => formatTime(val)}
            />
          </div>
          <span className="w-10 text-left tabular-nums">{formatTime(durationMs)}</span>
        </div>
      </div>
      <AlertDialog open={showMidiDialog} onOpenChange={setShowMidiDialog}>
        <AlertDialogContent className="z-[300] bg-white dark:bg-[#18181b] border-zinc-200 dark:border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <Keyboard className="w-5 h-5 text-blue-500" />
              {t("connectInstrument")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500 dark:text-zinc-400 font-medium">
              {t("practiceModeDesc")}
              <br /><br />
              <span className="text-zinc-400 dark:text-zinc-500 italic text-sm">{t("practiceMidiTip")}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-between w-full">
            <AlertDialogCancel disabled={isInitializingMidi} className="border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {t("cancel")}
            </AlertDialogCancel>
            <div className="flex flex-col sm:flex-row gap-2">
              <AlertDialogAction
                disabled={isInitializingMidi}
                onClick={(e) => {
                  e.preventDefault();
                  if (!onInitializeMic) return;
                  
                  const initPromise = (async () => {
                    setIsInitializingMidi(true);
                    const success = await onInitializeMic();
                    setIsInitializingMidi(false);
                    if (!success) throw new Error("Init failed");
                    return success;
                  })();

                  toast.promise(initPromise, {
                    loading: t("loadingAIPitch"),
                    success: t("micAndAIReady"),
                    error: t("micAIError")
                  });

                  initPromise.then(() => {
                    localStorage.setItem("bs_preferred_instrument", "mic");
                    setShowMidiDialog(false);
                    onPracticeModeTypeChange?.('wait');
                  }).catch(() => {
                    setShowMidiDialog(false);
                  });
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white"
              >
                {isInitializingMidi ? t("connecting") : t("useMicrophone")}
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
                    onPracticeModeTypeChange?.('wait');
                  } else {
                    setShowMidiDialog(false);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                {isInitializingMidi ? t("connecting") : t("connectMidi")}
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isCollapsed && (
        <div className="w-full h-14 bg-white/95 dark:bg-[#1A1A1E]/95 backdrop-blur-xl border-b border-zinc-200/50 dark:border-zinc-800 shadow-sm flex items-center justify-between px-2 sm:px-4 pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300 gap-2 sm:gap-4 overflow-hidden relative z-50">
          <div className="flex items-center shrink-0 min-w-0 max-w-[35%] sm:max-w-xs">
            {leftSlot}
          </div>

          <div className="flex-1 hidden sm:flex items-center justify-center gap-4 max-w-3xl mx-auto px-4">
            <button
              onClick={isPlaying ? onPause : onPlay}
              disabled={loadingAudio}
              className={cn(
                "w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-colors shadow-sm",
                isPlaying
                  ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:scale-105"
              )}
            >
              {loadingAudio ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current translate-x-0.5" />
              )}
            </button>
            <div className="flex-1 flex items-center gap-3">
              <span className="text-[10px] font-mono text-zinc-500 font-medium tracking-tighter w-[35px] text-right">
                {formatTime(localPos)}
              </span>
              <Slider
                value={[localPos]}
                min={0}
                max={durationMs}
                step={10}
                onValueChange={handleSliderChange}
                onValueCommit={handleSliderCommit}
                className="flex-1 cursor-pointer"
              />
              <span className="text-[10px] font-mono text-zinc-500 font-medium tracking-tighter w-[35px]">
                {formatTime(durationMs)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Mobile play button */}
            <button
              onClick={isPlaying ? onPause : onPlay}
              className="sm:hidden p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            >
               {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current translate-x-0.5" />}
            </button>

            {rightSlot}
          </div>
        </div>
      )}
    </>
  );
}
