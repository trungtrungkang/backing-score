"use client";

import { Play, Pause, Square, Repeat, Activity, Clock, RefreshCw, Minus, Plus, Grid, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface LoopState {
  enabled: boolean;
  startBar: number;
  endBar: number;
}

export interface TransportBarProps {
  /** Current tempo (BPM). */
  bpm?: number;
  onBpmChange?: (bpm: number) => void;
  /** Current playback rate */
  playbackRate?: number;
  onPlaybackRateChange?: (rate: number) => void;
  isMetronomeEnabled?: boolean;
  onMetronomeToggle?: (enabled: boolean) => void;
  isPreRollEnabled?: boolean;
  onPreRollToggle?: (enabled: boolean) => void;
  timeSignature?: string;
  onTimeSignatureChange?: (sig: string) => void;
  keySignature?: string;
  onKeySignatureChange?: (key: string) => void;
  /** Current position in ms (for display). */
  positionMs?: number;
  /** Total duration in ms (for display). */
  durationMs?: number;
  /** Playback state for button labels / disabled. */
  isPlaying?: boolean;
  /** Loop: on/off and bar range (1-based display). */
  loop?: LoopState;
  onLoopChange?: (loop: LoopState) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  /** Sync Mode toggle fn */
  onToggleSyncMode?: () => void;
  /** Is Sync Mode currently active? */
  isSyncMode?: boolean;
  isElasticGrid?: boolean;
  onToggleElasticGrid?: () => void;
  /** Optional timemap array mapping measure numbers to absolute time (Ms) for accurate Elastic Grid readout */
  timemap?: { measure: number; timeMs: number; timeSignature?: string }[];
  isMapEditorOpen?: boolean;
  onToggleMapEditor?: () => void;
  /** Disable all transport controls (e.g. while loading audio) */
  disabled?: boolean;
  className?: string;
  title?: string;
}

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatMeasure(ms: number, bpm: number, timeSignature: string, timemap?: { measure: number; timeMs: number; timeSignature?: string }[]): string {
  if (!Number.isFinite(ms) || ms < 0 || bpm <= 0) return "001:1";
  
  if (timemap && timemap.length > 0) {
    // Elastic Grid Mode: Search Timemap
    let currentMeasure = 1;
    let nextMapTime = Infinity;
    let measureStartMs = 0;
    
    for (let i = 0; i < timemap.length; i++) {
       if (ms >= timemap[i].timeMs) {
          currentMeasure = timemap[i].measure;
          measureStartMs = timemap[i].timeMs;
          if (i + 1 < timemap.length) {
             nextMapTime = timemap[i+1].timeMs;
          } else {
             nextMapTime = Infinity;
          }
       } else {
          break; // Since timemap is sorted sequentially
       }
    }
    let activeSignature = timeSignature;
    for (let i = 0; i < timemap.length; i++) {
        if (timemap[i].measure <= currentMeasure && timemap[i].timeSignature) {
            activeSignature = timemap[i].timeSignature!;
        }
        if (timemap[i].measure > currentMeasure) break;
    }
    
    const [numStr, denStr] = activeSignature.split("/");
    const beatsPerMeasure = parseInt(numStr, 10) || 4;
    
    // If we're inside the measure bounds, calculate which sub-beat we are in proportionately
    let beatInMeasure = 1;
    if (nextMapTime !== Infinity) {
        const exactMeasureDurationMs = nextMapTime - measureStartMs;
        const beatMs = exactMeasureDurationMs / beatsPerMeasure;
        const timeIntoMeasure = ms - measureStartMs;
        beatInMeasure = Math.floor(timeIntoMeasure / beatMs) + 1;
    } else {
        // Fallback beat calc past the end of the map
        const noteValue = parseInt(denStr, 10) || 4;
        const quarterNoteMs = (60 * 1000) / bpm;
        const beatMs = quarterNoteMs * (4 / noteValue);
        const timeIntoMeasure = ms - measureStartMs;
        beatInMeasure = Math.floor(timeIntoMeasure / beatMs) + 1;
    }
    
    if (beatInMeasure > beatsPerMeasure) beatInMeasure = beatsPerMeasure;
    return `${currentMeasure.toString().padStart(3, "0")}:${beatInMeasure}`;
  }

  
  // Parse time signature (e.g. "4/4" -> beatsPerMeasure = 4)
  const [numStr, denStr] = timeSignature.split("/");
  const beatsPerMeasure = parseInt(numStr, 10) || 4;
  const noteValue = parseInt(denStr, 10) || 4;
  
  // A beat in BPM is typically a quarter note. 
  // If we're in 6/8, the beat might be an eighth note depending on interpretation, 
  // but standard MIDI/DAW logic often assumes BPM = quarter notes.
  // For simplicity and matching standard DAWs, we assume BPM = quarter notes.
  // To handle the denominator, we adjust the beat length:
  const quarterNoteMs = (60 * 1000) / bpm;
  // Length of one beat based on the time signature denominator
  const beatMs = quarterNoteMs * (4 / noteValue);
  
  // Calculate total continuous beats
  const totalBeats = ms / beatMs;
  
  // Calculate measure and beat index (1-based)
  const measure = Math.floor(totalBeats / beatsPerMeasure) + 1;
  const beatInMeasure = Math.floor(totalBeats % beatsPerMeasure) + 1;
  
  return `${measure.toString().padStart(3, "0")}:${beatInMeasure}`;
}

const DEFAULT_LOOP: LoopState = { enabled: false, startBar: 1, endBar: 4 };

export function TransportBar({
  bpm = 120,
  onBpmChange,
  playbackRate = 1,
  onPlaybackRateChange,
  isMetronomeEnabled = false,
  onMetronomeToggle,
  isPreRollEnabled = false,
  onPreRollToggle,
  timeSignature = "4/4",
  onTimeSignatureChange,
  keySignature = "C Maj",
  onKeySignatureChange,
  positionMs = 0,
  durationMs = 0,
  isPlaying = false,
  loop = DEFAULT_LOOP,
  onLoopChange,
  onPlay,
  onPause,
  onStop,
  isSyncMode = false,
  onToggleSyncMode,
  isElasticGrid = false,
  onToggleElasticGrid,
  timemap,
  isMapEditorOpen = false,
  onToggleMapEditor,
  disabled = false,
  className,
  title = "Untitled",
}: TransportBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center lg:justify-between w-full bg-zinc-50 dark:bg-[#1C1C1E] text-zinc-600 dark:text-zinc-300 px-4 py-2 border-b border-zinc-200 dark:border-black/50 transition-colors shadow-sm gap-3", className)}>

      {/* 1. Left Section: Transports */}
      <div className="flex-auto lg:flex-1 flex items-center justify-center lg:justify-start gap-6 min-w-max order-1 lg:order-none">
        
        {/* Transport Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={isPlaying ? onPause : onPlay}
            disabled={!(isPlaying ? onPause : onPlay) || disabled}
            className="w-10 h-8 flex items-center justify-center rounded-[4px] bg-zinc-200 dark:bg-zinc-800/80 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-[#2f8c3c] dark:text-[#60C96F] hover:text-[#1b6b26] dark:hover:text-[#7CFF8A] disabled:opacity-30 disabled:text-zinc-500 dark:disabled:text-zinc-600 border border-zinc-300 dark:border-zinc-700/50 shadow-inner transition-colors"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-[18px] h-[18px] fill-current" />
            ) : (
              <Play className="w-[18px] h-[18px] fill-current text-current" />
            )}
          </button>
          <button
            onClick={onStop}
            disabled={!onStop || disabled}
            className="w-10 h-8 flex items-center justify-center rounded-[4px] bg-zinc-200 dark:bg-zinc-800/80 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 border border-zinc-300 dark:border-zinc-700/50 shadow-inner transition-colors"
            title="Stop"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
          
          <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>

          <Popover>
            <PopoverTrigger asChild>
              <button
                disabled={disabled}
                className={cn(
                  "px-3 h-8 flex items-center justify-center gap-1.5 rounded-[4px] text-[12px] font-bold border transition-colors shadow-inner",
                  loop.enabled
                    ? "bg-[#C8A856]/20 text-[#C8A856] border-[#C8A856]/30"
                    : "bg-zinc-200 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700/50 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-300 dark:hover:bg-zinc-700"
                )}
                title="Edit Loop Range"
              >
                <Repeat className="w-3.5 h-3.5" />
                Loop
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 bg-white dark:bg-[#1A1A1E] border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 p-3 shadow-xl" sideOffset={8}>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Loop Range</span>
                  <button
                    onClick={() => onLoopChange?.({ ...loop, enabled: !loop.enabled })}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded font-bold uppercase transition-colors border",
                      loop.enabled
                        ? "bg-[#C8A856]/20 text-[#C8A856] border-[#C8A856]/50"
                        : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-white"
                    )}
                  >
                    {loop.enabled ? "Active" : "Off"}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Start Bar</span>
                    <input 
                      type="number" 
                      min={1} 
                      value={loop.startBar} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 1) onLoopChange?.({ ...loop, startBar: val });
                      }} 
                      className="w-16 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-blue-500 rounded px-2 py-1 text-sm text-center font-mono outline-none" 
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">End Bar</span>
                    <input 
                      type="number" 
                      min={loop.startBar} 
                      value={loop.endBar} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= loop.startBar) onLoopChange?.({ ...loop, endBar: val });
                      }} 
                      className="w-16 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-blue-500 rounded px-2 py-1 text-sm text-center font-mono outline-none" 
                    />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* 2. Center LED / Status Readout */}
      <div className="order-last lg:order-none w-full lg:w-auto mt-2 lg:mt-0 flex justify-center shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex items-center justify-center gap-2 sm:gap-3 lg:gap-4 bg-white dark:bg-[#0E0E11] rounded-md border border-zinc-300 dark:border-zinc-800/80 px-2 sm:px-3 lg:px-4 py-1.5 shadow-sm dark:shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] mx-auto w-max">

        {/* Time Display */}
        <div className="flex flex-col items-center justify-center min-w-[70px]">
          <span className="text-[9px] uppercase tracking-widest text-zinc-500 dark:text-[#5e5e6e] font-bold mb-0.5">Measure</span>
          <div className="text-xl font-mono tracking-wider text-blue-400 dark:text-[#00f0ff] font-bold dark:[text-shadow:0_0_8px_rgba(0,240,255,0.6)] leading-none mt-0.5">
            {formatMeasure(positionMs, bpm, timeSignature, isElasticGrid ? timemap : undefined)}
          </div>
        </div>

        <div className="w-px h-8 bg-zinc-300 dark:bg-zinc-800 mx-0.5 sm:mx-1.5 lg:mx-2"></div>

        {/* Time Signature */}
        <div className="flex flex-col justify-center min-w-[35px] items-center">
          <span className="text-[9px] uppercase tracking-widest text-zinc-500 dark:text-[#5e5e6e] font-bold mb-0.5">Time</span>
          <select
            value={timeSignature}
            onChange={(e) => onTimeSignatureChange?.(e.target.value)}
            disabled={!onTimeSignatureChange || disabled}
            className="bg-transparent text-blue-600 hover:text-blue-800 focus:text-blue-800 dark:text-[#00f0ff] dark:hover:text-white transition-colors text-[13px] font-bold tracking-wide focus:outline-none appearance-none cursor-pointer disabled:opacity-50 dark:[text-shadow:0_0_5px_rgba(0,240,255,0.4)] text-center w-full"
          >
            <option value="1/4" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">1/4</option>
            <option value="2/4" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">2/4</option>
            <option value="3/4" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">3/4</option>
            <option value="4/4" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">4/4</option>
            <option value="6/8" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">6/8</option>
            <option value="2/2" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">2/2</option>
          </select>
        </div>

        <div className="w-px h-8 bg-zinc-300 dark:bg-zinc-800 mx-0.5 sm:mx-1.5 lg:mx-2"></div>

        {/* Key Signature */}
        <div className="flex flex-col justify-center min-w-[50px]">
          <span className="text-[9px] uppercase tracking-widest text-zinc-500 dark:text-[#5e5e6e] font-bold mb-0.5">Key</span>
          <select
            value={keySignature}
            onChange={(e) => onKeySignatureChange?.(e.target.value)}
            disabled={!onKeySignatureChange || disabled}
            className="bg-transparent text-blue-600 hover:text-blue-800 focus:text-blue-800 dark:text-[#00f0ff] dark:hover:text-white transition-colors text-[13px] font-bold tracking-wide focus:outline-none appearance-none cursor-pointer disabled:opacity-50 dark:[text-shadow:0_0_5px_rgba(0,240,255,0.4)]"
          >
            <optgroup label="Major Keys" className="bg-zinc-50 dark:bg-[#1a1a1f] text-zinc-600 dark:text-zinc-400 font-bold">
              <option value="C Maj" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">C Maj</option>
              <option value="G Maj" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">G Maj</option>
              <option value="D Maj" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">D Maj</option>
              <option value="A Maj" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">A Maj</option>
              <option value="E Maj" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">E Maj</option>
              <option value="B Maj" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">B Maj</option>
              <option value="F# Maj" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">F# Maj</option>
              <option value="C# Maj" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">C# Maj</option>
              <option value="F Maj" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">F Maj</option>
              <option value="Bb Maj" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">Bb Maj</option>
              <option value="Eb Maj" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">Eb Maj</option>
              <option value="Ab Maj" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">Ab Maj</option>
              <option value="Db Maj" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">Db Maj</option>
              <option value="Gb Maj" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">Gb Maj</option>
              <option value="Cb Maj" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">Cb Maj</option>
            </optgroup>
            <optgroup label="Minor Keys" className="bg-[#1a1a1f] text-zinc-400 font-bold mt-2">
              <option value="A Min" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">A Min</option>
              <option value="E Min" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">E Min</option>
              <option value="B Min" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">B Min</option>
              <option value="F# Min" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">F# Min</option>
              <option value="C# Min" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">C# Min</option>
              <option value="G# Min" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">G# Min</option>
              <option value="D# Min" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">D# Min</option>
              <option value="A# Min" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">A# Min</option>
              <option value="D Min" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">D Min</option>
              <option value="G Min" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">G Min</option>
              <option value="C Min" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">C Min</option>
              <option value="F Min" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">F Min</option>
              <option value="Bb Min" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">Bb Min</option>
              <option value="Eb Min" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">Eb Min</option>
              <option value="Ab Min" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">Ab Min</option>
            </optgroup>
          </select>
        </div>

        <div className="w-px h-8 bg-zinc-300 dark:bg-zinc-800 mx-0.5 sm:mx-1.5 lg:mx-2"></div>

        {/* BPM */}
        <div className="flex flex-col justify-center min-w-[70px] items-center">
          <span className="text-[9px] uppercase tracking-widest text-zinc-500 dark:text-[#5e5e6e] font-bold mb-1">Tempo</span>
          <div className="flex items-center gap-1.5 h-4">
            <button onClick={() => onBpmChange?.(bpm - 1)} disabled={!onBpmChange || disabled || bpm <= 10} className="text-zinc-500 hover:text-white disabled:opacity-50"><Minus className="w-3 h-3" /></button>
            <span className="text-[12px] text-blue-600 dark:text-[#00f0ff] font-mono font-bold w-7 text-center leading-none tracking-wider dark:[text-shadow:0_0_5px_rgba(0,240,255,0.4)]">
              {bpm}
            </span>
            <button onClick={() => onBpmChange?.(bpm + 1)} disabled={!onBpmChange || disabled || bpm >= 300} className="text-zinc-500 hover:text-white disabled:opacity-50"><Plus className="w-3 h-3" /></button>
          </div>
        </div>

        <div className="w-px h-8 bg-zinc-300 dark:bg-zinc-800 mx-0.5 sm:mx-1.5 lg:mx-2"></div>

        {/* Rate Controls */}
        <div className="flex flex-col justify-center min-w-[50px] items-center">
          <span className="text-[9px] uppercase tracking-widest text-zinc-500 dark:text-[#5e5e6e] font-bold mb-1">Rate</span>
          <div className="flex items-center h-4">
            <select
              value={playbackRate}
              onChange={(e) => onPlaybackRateChange?.(parseFloat(e.target.value))}
              disabled={!onPlaybackRateChange || disabled}
              className="bg-transparent text-blue-600 hover:text-blue-800 focus:text-blue-800 dark:text-[#00f0ff] dark:hover:text-white transition-colors text-[12px] font-mono font-bold tracking-wider focus:outline-none appearance-none cursor-pointer disabled:opacity-50 dark:[text-shadow:0_0_5px_rgba(0,240,255,0.4)] text-center leading-none"
            >
              <option value="0.5" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">.5x</option>
              <option value="0.75" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">.75x</option>
              <option value="1" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">1x</option>
              <option value="1.25" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">1.25x</option>
              <option value="1.5" className="bg-white text-zinc-900 dark:bg-[#1a1a1f] dark:text-zinc-300">1.5x</option>
            </select>
          </div>
        </div>
      </div>
      </div>

      {/* 3. Right Section: Restored Practice Tools */}
      <div className="flex-auto lg:flex-1 flex items-center justify-center lg:justify-end gap-1.5 min-w-max order-2 lg:order-none">
        <button
          onClick={() => onMetronomeToggle?.(!isMetronomeEnabled)}
          disabled={!onMetronomeToggle || disabled}
          className={cn(
            "h-9 px-3 flex flex-col items-center justify-center rounded-[4px] border border-transparent transition-colors",
            isMetronomeEnabled
              ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-blue-400 dark:border-blue-500/30"
              : "hover:border-zinc-300 dark:hover:border-zinc-700/50 hover:bg-zinc-200 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          )}
          title="Toggle Metronome"
        >
          <Activity className="w-4 h-4 mb-0.5" />
          <span className="text-[9px] uppercase font-bold tracking-wider">Click</span>
        </button>
        <button
          onClick={() => onPreRollToggle?.(!isPreRollEnabled)}
          disabled={!onPreRollToggle || disabled}
          className={cn(
            "h-9 px-3 flex flex-col items-center justify-center rounded-[4px] border border-transparent transition-colors",
            isPreRollEnabled
              ? "bg-[#C8A856]/20 text-[#C8A856] border-[#C8A856]/30"
              : "hover:border-zinc-300 dark:hover:border-zinc-700/50 hover:bg-zinc-200 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          )}
          title="Toggle Pre-Roll (1 Measure)"
        >
          <Clock className="w-4 h-4 mb-0.5" />
          <span className="text-[9px] uppercase font-bold tracking-wider">Wait</span>
        </button>
        
        <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>

        <button
          onClick={onToggleSyncMode}
          disabled={!onToggleSyncMode || disabled}
          className={cn(
            "h-9 px-3 flex flex-col items-center justify-center rounded-[4px] border border-transparent transition-colors",
            isSyncMode
              ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-500 border-red-400 dark:border-red-500/30 font-bold"
              : "hover:border-zinc-300 dark:hover:border-zinc-700/50 hover:bg-zinc-200 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          )}
          title="Record Sync Map (Tap Tempo)"
        >
          <RefreshCw className="w-4 h-4 mb-0.5" />
          <span className="text-[9px] uppercase font-bold tracking-wider">Map</span>
        </button>
        
        <button
          onClick={onToggleElasticGrid}
          disabled={!onToggleElasticGrid || disabled}
          className={cn(
            "h-9 px-3 flex flex-col items-center justify-center rounded-[4px] border border-transparent transition-colors",
            isElasticGrid
              ? "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 border-purple-400 dark:border-purple-500/30 font-bold"
              : "hover:border-zinc-300 dark:hover:border-zinc-700/50 hover:bg-zinc-200 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          )}
          title="Toggle Elastic Grid (Sync Audio exactly to Sheet Music tempo variations)"
        >
          <Grid className="w-4 h-4 mb-0.5" />
          <span className="text-[9px] uppercase font-bold tracking-wider">Elastic</span>
        </button>

        <button
          onClick={onToggleMapEditor}
          disabled={!onToggleMapEditor || disabled}
          className={cn(
            "h-9 px-3 flex flex-col items-center justify-center rounded-[4px] border border-transparent transition-colors",
            isMapEditorOpen
              ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border-indigo-400 dark:border-indigo-500/30 font-bold"
              : "hover:border-zinc-300 dark:hover:border-zinc-700/50 hover:bg-zinc-200 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          )}
          title="Toggle Measure Map Editor"
        >
          <Edit3 className="w-4 h-4 mb-0.5" />
          <span className="text-[9px] uppercase font-bold tracking-wider">Edit Map</span>
        </button>
      </div>

    </div>
  );
}
