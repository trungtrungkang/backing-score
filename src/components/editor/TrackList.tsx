"use client";

import { AudioTrack, TimemapEntry } from "@/lib/daw/types";
import { TimelineRuler } from "./TimelineRuler";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Waveform } from "./Waveform";
import { PianoRollRegion } from "./PianoRollRegion";
import { AudioManager } from "@/lib/audio/AudioManager";
import { ChevronDown, ChevronUp, MoveRight, Trash2, Plus, Info, Music } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Midi } from "@tonejs/midi";
import { useDialogs } from "@/components/ui/dialog-provider";
import { GM_INSTRUMENTS, getGMInstrumentName } from "@/lib/score/midi-instruments";

export interface TrackListProps {
  tracks: AudioTrack[];
  muteByTrackId: Record<string, boolean>;
  soloByTrackId: Record<string, boolean>;
  onMuteChange: (trackId: string, mute: boolean) => void;
  onSoloChange: (trackId: string, solo: boolean) => void;
  onVolumeChange: (trackId: string, volume: number) => void;
  onOffsetChange: (trackId: string, offsetMs: number) => void;
  audioManager: AudioManager | null; // Pass reference to fetch Data
  positionMs: number;
  durationMs: number;
  bpm?: number;
  timemap: TimemapEntry[];
  timeSignature: { numerator: number; denominator: number };
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  loopStartMs?: number;
  loopEndMs?: number;
  pitchShift?: number;
  onPitchShiftChange?: (semitones: number) => void;
  className?: string;
  audioReady?: boolean;
  onSeek?: (positionMs: number) => void;
  onAddAudioTrack?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteTrack?: (trackId: string) => void;
  syncToTimemap?: boolean;
  isDarkMode?: boolean;
  midiBase64?: string | null;
  uploadingAudio?: boolean;
  midiChannelByTrackId?: Record<string, number>;
  midiInstrumentByTrackId?: Record<string, number>; // current GM program per track
  onInstrumentChange?: (trackId: string, program: number | null) => void; // null = reset to default
}

export function TrackList({
  tracks,
  muteByTrackId,
  soloByTrackId,
  onMuteChange,
  onSoloChange,
  onVolumeChange,
  onOffsetChange,
  audioManager,
  positionMs,
  durationMs,
  bpm = 120,
  timemap,
  timeSignature,
  isExpanded = true,
  onToggleExpand,
  loopStartMs,
  loopEndMs,
  pitchShift = 0,
  onPitchShiftChange,
  className,
  audioReady = true,
  onSeek,
  onAddAudioTrack,
  onDeleteTrack,
  syncToTimemap = false,
  isDarkMode = false,
  midiBase64,
  uploadingAudio = false,
  midiChannelByTrackId = {},
  midiInstrumentByTrackId = {},
  onInstrumentChange,
}: TrackListProps) {
  const { confirm } = useDialogs();
  const [zoomLevel, setZoomLevel] = useState(4);
  const [openInstTrackId, setOpenInstTrackId] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);

  const handlePlayheadPointerDown = (e: React.PointerEvent) => {
    setIsDraggingPlayhead(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePlayheadPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingPlayhead || durationMs <= 0) return;
    const container = scrollContainerRef.current?.firstElementChild as HTMLDivElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const timelineWidth = rect.width - 256;
    const x = e.clientX - rect.left - 256;

    const progress = Math.max(0, Math.min(x / timelineWidth, 1));
    const newPosMs = progress * durationMs;

    if (audioManager) audioManager.seek(newPosMs);
    if (onSeek) onSeek(newPosMs);
  };

  const handlePlayheadPointerUp = (e: React.PointerEvent) => {
    setIsDraggingPlayhead(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Auto-scroll logic (Page Scroll technique)
  useEffect(() => {
    if (!isAutoScrollEnabled || durationMs === 0 || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const trackControlsWidth = 256;
    const totalCanvasWidth = container.scrollWidth - trackControlsWidth;

    if (totalCanvasWidth <= 0) return;

    // Calculate exact pixel position of playhead
    const playheadCanvasX = (positionMs / durationMs) * totalCanvasWidth;
    const playheadAbsoluteX = trackControlsWidth + playheadCanvasX;

    // Calculate viewable area boundaries
    const visibleLeft = container.scrollLeft + trackControlsWidth;
    const visibleRight = container.scrollLeft + container.clientWidth;

    // Trigger page flip if playhead leaves the boundaries
    if (playheadAbsoluteX > visibleRight - 40) {
      container.scrollLeft = playheadAbsoluteX - trackControlsWidth - 40;
    } else if (playheadAbsoluteX < visibleLeft) {
      container.scrollLeft = Math.max(0, playheadAbsoluteX - trackControlsWidth - 40);
    }
  }, [positionMs, durationMs, isAutoScrollEnabled]);

  return (
    <div className={cn("dark flex flex-col h-full bg-[#1e1e24] text-zinc-300 font-sans border-t border-zinc-800 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] z-20 overflow-hidden transition-colors", className)}>
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-zinc-300 dark:border-zinc-800/80 bg-zinc-300/50 dark:bg-[#16161b] shrink-0 transition-colors">
        <h2 className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 dark:text-zinc-400">Audio Tracks</h2>
        <div className="flex items-center gap-3 text-[10px] text-zinc-500 dark:text-zinc-600 font-medium">
          <span>{tracks.length} Stems</span>

          {onPitchShiftChange && (
            <>
              <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-800"></div>
              <div className="flex items-center gap-2 group">
                <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-300 transition-colors">Pitch</span>
                <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/50 rounded overflow-hidden border border-zinc-300 dark:border-zinc-700/50 transition-colors">
                  <button
                    onClick={() => onPitchShiftChange(pitchShift - 1)}
                    className="w-5 h-5 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 active:bg-zinc-300 dark:active:bg-zinc-600 transition-colors font-mono text-zinc-600 dark:text-zinc-300"
                  >
                    -
                  </button>
                  <div className="w-6 text-center text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">
                    {pitchShift > 0 ? `+${pitchShift}` : pitchShift}
                  </div>
                  <button
                    onClick={() => onPitchShiftChange(pitchShift + 1)}
                    className="w-5 h-5 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 active:bg-zinc-300 dark:active:bg-zinc-600 transition-colors font-mono text-zinc-600 dark:text-zinc-300"
                  >
                    +
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Auto Scroll Toggle */}
          <button
            onClick={() => setIsAutoScrollEnabled(!isAutoScrollEnabled)}
            className={cn(
              "flex items-center justify-center h-5 px-2 rounded-sm transition-colors border text-[10px] font-bold tracking-wider",
              isAutoScrollEnabled
                ? "bg-blue-100 text-blue-600 border-blue-200 hover:bg-blue-200 dark:bg-blue-600/30 dark:text-blue-400 dark:border-blue-500/50 dark:hover:bg-blue-600/40"
                : "bg-zinc-100 text-zinc-500 border-zinc-200 hover:text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700 dark:hover:text-zinc-300 dark:hover:bg-zinc-700"
            )}
            title="Auto Scroll Timeline"
          >
            <MoveRight className="w-3 h-3 mr-1" />
            AUTO SCROLL
          </button>

          {/* Zoom Controls */}
          {isExpanded && (
            <div className="flex items-center gap-2 border border-zinc-200 dark:border-zinc-700/50 rounded-md px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-900/50 transition-colors">
              <button onClick={() => setZoomLevel(Math.max(1, zoomLevel - 0.5))} className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors w-4 h-4 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-sm" title="Zoom Out">-</button>
              <span className="w-6 text-center text-zinc-700 dark:text-zinc-400">{zoomLevel}x</span>
              <button onClick={() => setZoomLevel(Math.min(20, zoomLevel + 0.5))} className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors w-4 h-4 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-sm" title="Zoom In">+</button>
            </div>
          )}

          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
              title={isExpanded ? "Collapse Tracks" : "Expand Tracks"}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-auto overscroll-x-none relative">
        <div className="flex flex-col min-h-full h-fit relative" style={{ width: `max(100%, ${(durationMs / 1000) * 10 * zoomLevel + 256}px)` }}>

          {/* Global HTML Playhead */}
          <div
            className="absolute top-0 bottom-0 w-[16px] -ml-[8px] flex justify-center cursor-ew-resize z-50 group outline-none"
            style={{
              left: durationMs > 0 ? `calc(256px + (100% - 256px) * ${positionMs / durationMs})` : "256px",
            }}
            onPointerDown={handlePlayheadPointerDown}
            onPointerMove={handlePlayheadPointerMove}
            onPointerUp={handlePlayheadPointerUp}
            onPointerCancel={handlePlayheadPointerUp}
          >
            {/* The visible line */}
            <div className={cn(
              "w-[2px] h-full shadow-md transition-colors relative flex flex-col items-center",
              isDraggingPlayhead ? "bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.8)]" : "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)] group-hover:bg-yellow-300 group-hover:shadow-[0_0_10px_rgba(253,224,71,0.7)] group-hover:w-[3px]"
            )}>
              {/* Playhead Triangle at the top */}
              <div className={cn(
                "sticky top-0 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-transparent transition-colors z-[60]",
                isDraggingPlayhead ? "border-t-yellow-400" : "border-t-yellow-400 group-hover:border-t-yellow-300"
              )}></div>
            </div>
          </div>

          {/* Timeline Ruler Row */}
          {isExpanded && (
            <div className="flex items-center h-[24px] bg-zinc-800 dark:bg-[#1e1e24] border-b border-zinc-900 dark:border-zinc-800 shrink-0 sticky top-0 z-30 transition-colors">
              {/* Left Controls Spacer */}
              <div className="w-64 h-full border-r border-zinc-900 dark:border-zinc-800/50 bg-zinc-900 dark:bg-[#1e1e24] shrink-0 sticky left-0 z-40 transition-colors"></div>
              {/* Ruler Canvas */}
              <div className="flex-1 h-full relative">
                <TimelineRuler
                  timemap={timemap}
                  timeSignature={timeSignature}
                  durationMs={durationMs}
                  positionMs={positionMs}
                  bpm={bpm}
                  loopStartMs={loopStartMs}
                  loopEndMs={loopEndMs}
                  zoomLevel={zoomLevel}
                  syncToTimemap={syncToTimemap}
                  isDarkMode={true} // Hardcoded to true so the canvas draws dark mode colors properly
                />
              </div>
            </div>
          )}

          {tracks.length === 0 && (
            <div className="text-sm text-zinc-500 dark:text-zinc-400 font-medium flex-1 flex items-center justify-center p-4 sticky left-0 w-full min-h-[100px] border-b border-zinc-200 dark:border-zinc-800/50 transition-colors">
              No audio tracks loaded. You can use the Metronome to practice with the timeline grid.
            </div>
          )}

          <div className="flex flex-col">
            {tracks.map((track, index) => {
              const isMute = muteByTrackId[track.id] ?? !!track.muted;
              const isSolo = soloByTrackId[track.id] ?? !!track.solo;
              // Fetch buffer if available
              const buffer = audioManager?.getBuffer(track.id);

              // Cycle through 4 DAW-inspired colors
              const colorSchemes = [
                { color: "#3B82F6", progress: "#2563EB" }, // Blue
                { color: "#10B981", progress: "#059669" }, // Green
                { color: "#8B5CF6", progress: "#7C3AED" }, // Purple
                { color: "#F43F5E", progress: "#E11D48" }, // Red
              ];
              const scheme = colorSchemes[index % colorSchemes.length];

              return (
                <div
                  key={track.id}
                  className="group flex items-center h-[72px] bg-zinc-800 dark:bg-[#22222a] hover:bg-zinc-700/80 dark:hover:bg-[#282832] transition-colors border-b border-zinc-900/80 dark:border-zinc-800/50"
                >
                  {(() => {
                    let trackBpm = bpm;
                    let trackTimeSig = `${timeSignature.numerator}/${timeSignature.denominator}`;
                    if (track.type === "midi" && midiBase64) {
                      try {
                        const binaryString = window.atob(midiBase64.split(",")[1] || midiBase64);
                        const len = binaryString.length;
                        const bytes = new Uint8Array(len);
                        for (let i = 0; i < len; i++) {
                          bytes[i] = binaryString.charCodeAt(i);
                        }
                        const parsedMidi = new Midi(bytes);
                        if (parsedMidi.header.tempos.length > 0) {
                          trackBpm = Math.round(parsedMidi.header.tempos[0].bpm);
                        }
                        if (parsedMidi.header.timeSignatures.length > 0) {
                          const ts = parsedMidi.header.timeSignatures[0].timeSignature;
                          trackTimeSig = `${ts[0]}/${ts[1]}`;
                        }
                      } catch (e) {
                         // Fallback to global if parsing fails
                      }
                    }

                    return (
                      <>
                        {/* Left Controls Header */}
                    <div className="w-64 h-full flex items-center justify-between px-3 gap-2 border-r border-zinc-900 dark:border-zinc-800/50 bg-[#161619] shrink-0 sticky left-0 z-20 transition-colors">

                      {/* Left: Number, Name, & M/S/R Buttons */}
                      <div className="flex flex-col h-full py-1.5 justify-between flex-1 min-w-0">
                        <div className="flex items-center justify-between group/name">
                          <span className="text-[11px] font-bold text-zinc-100 uppercase tracking-widest truncate" title={track.name}>
                            {track.name}
                          </span>
                        </div>

                        {/* Button Cluster */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onMuteChange(track.id, !isMute)}
                              className={cn(
                                "w-5 h-4 rounded-[2px] text-[8px] font-black transition-colors flex items-center justify-center",
                                isMute ? "bg-[#FF3366] text-white" : "bg-[#25252A] text-zinc-500 hover:bg-[#2D2D33] hover:text-zinc-300 border border-[#33333A]"
                              )}
                            >
                              M
                            </button>
                            <button
                              onClick={() => onSoloChange(track.id, !isSolo)}
                              className={cn(
                                "w-5 h-4 rounded-[2px] text-[8px] font-black transition-colors flex items-center justify-center",
                                isSolo ? "bg-[#FFCC00] text-black" : "bg-[#25252A] text-zinc-500 hover:bg-[#2D2D33] hover:text-zinc-300 border border-[#33333A]"
                              )}
                            >
                              S
                            </button>
                          </div>
                          
                          <div className="flex items-center gap-2 pr-1">
                            {track.type === "midi" && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="text-zinc-500 hover:text-blue-400 transition-colors shrink-0 outline-none" title="Track Properties">
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent side="right" className="w-48 bg-zinc-900 border-zinc-800 p-3 text-xs shadow-xl outline-none">
                                  <div className="space-y-2">
                                    <h4 className="font-semibold text-zinc-300 border-b border-zinc-800 pb-1 mb-2">Track Properties</h4>
                                    <div className="flex justify-between">
                                      <span className="text-zinc-500">Source:</span>
                                      <span className="text-zinc-300 font-medium truncate ml-2 text-right">MusicXML / MIDI</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-zinc-500">Tempo:</span>
                                      <span className="text-zinc-300 font-medium truncate ml-2 text-right">{trackBpm} BPM</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-zinc-500">Time Sig:</span>
                                      <span className="text-zinc-300 font-medium truncate ml-2 text-right">{trackTimeSig}</span>
                                    </div>
                                    {midiBase64 && (
                                      <div className="flex justify-between">
                                        <span className="text-zinc-500">MIDI Data:</span>
                                        <span className="text-green-500 font-medium truncate ml-2 text-right">Loaded</span>
                                      </div>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                            {track.type === "midi" && onInstrumentChange ? (
                              <Popover open={openInstTrackId === track.id} onOpenChange={(open) => {
                                setOpenInstTrackId(open ? track.id : null);
                                if (!open) setExpandedCategory(null);
                              }}>
                                <PopoverTrigger asChild>
                                  <button
                                    className="text-zinc-500 hover:text-amber-400 transition-colors p-0.5 outline-none"
                                    title={`Change instrument${midiInstrumentByTrackId[track.id] ? ` (${getGMInstrumentName(midiInstrumentByTrackId[track.id])})` : ''}`}
                                  >
                                    <Music className="w-3.5 h-3.5" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent side="right" align="start" className="w-56 bg-zinc-900 border-zinc-700 p-0 shadow-xl outline-none max-h-[320px] overflow-y-auto">
                                  {/* Default option */}
                                  <button
                                    onClick={() => { onInstrumentChange(track.id, null); setOpenInstTrackId(null); }}
                                    className={cn(
                                      "w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 transition-colors border-b border-zinc-800 flex items-center gap-2",
                                      !midiInstrumentByTrackId[track.id] ? "text-amber-400 font-semibold" : "text-zinc-300"
                                    )}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" style={{ opacity: !midiInstrumentByTrackId[track.id] ? 1 : 0 }} />
                                    ↺ Default (auto-detect)
                                  </button>
                                  {/* Categories */}
                                  {GM_INSTRUMENTS.map(cat => (
                                    <div key={cat.category}>
                                      <button
                                        onClick={() => setExpandedCategory(expandedCategory === cat.category ? null : cat.category)}
                                        className="w-full text-left px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors flex items-center justify-between"
                                      >
                                        {cat.category}
                                        <ChevronDown className={cn("w-3 h-3 transition-transform", expandedCategory === cat.category && "rotate-180")} />
                                      </button>
                                      {expandedCategory === cat.category && cat.instruments.map(inst => {
                                        const isActive = midiInstrumentByTrackId[track.id] === inst.program;
                                        return (
                                          <button
                                            key={inst.program}
                                            onClick={() => { onInstrumentChange(track.id, inst.program); setOpenInstTrackId(null); }}
                                            className={cn(
                                              "w-full text-left px-4 py-1.5 text-xs hover:bg-zinc-800 transition-colors flex items-center gap-2",
                                              isActive ? "text-amber-400 font-medium bg-zinc-800/60" : "text-zinc-400"
                                            )}
                                          >
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" style={{ opacity: isActive ? 1 : 0 }} />
                                            {inst.name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ))}
                                </PopoverContent>
                              </Popover>
                            ) : onDeleteTrack && track.type !== "midi" ? (
                              <button
                                onClick={async () => {
                                  if (await confirm({ title: "Delete Track", description: `Are you sure you want to delete the track "${track.name}"?`, confirmText: "Delete", cancelText: "Cancel" })) {
                                    onDeleteTrack(track.id);
                                  }
                                }}
                                className="text-zinc-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-0.5"
                                title="Delete Track"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Right: Volume Control */}
                      <div className="flex flex-col items-center justify-center h-full w-[4.5rem] shrink-0 border-l border-[#222] px-2 gap-1.5">
                        <span className="text-[9px] font-mono text-[#00f0ff] font-bold tracking-wider">
                          {(track.volume === 0 ? -60 : ((track.volume ?? 1) * 20 - 20)).toFixed(1)} dB
                        </span>
                        
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={track.volume ?? 1}
                          onChange={(e) => onVolumeChange(track.id, parseFloat(e.target.value))}
                          className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer outline-none transition-colors [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-zinc-400 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-white"
                          title="Adjust Volume"
                        />
                      </div>
                    </div>
                  <div className="flex-1 h-full bg-zinc-900 dark:bg-[#111115] relative flex items-center opacity-80 group-hover:opacity-100 transition-all">
                    {track.type === "midi" ? (() => {
                      // Extract track index for per-part MIDI tracks (score-midi-0, score-midi-1...)
                      const midiTrackIndex = track.id.startsWith("score-midi-")
                        ? parseInt(track.id.replace("score-midi-", ""), 10)
                        : undefined;
                      const midiChannel = midiChannelByTrackId[track.id];
                      return (
                        <PianoRollRegion
                          base64Midi={midiBase64 || null}
                          positionMs={positionMs}
                          durationMs={durationMs}
                          offsetMs={track.offsetMs}
                          onOffsetChange={(offset) => onOffsetChange(track.id, offset)}
                          color={isMute ? "#52525b" : scheme.color}
                          progressColor={isMute ? "#3f3f46" : scheme.progress}
                          trackIndex={midiTrackIndex}
                          midiChannel={midiChannel}
                        />
                      );
                    })() : (
                      <Waveform
                        buffer={buffer}
                        positionMs={positionMs}
                        durationMs={durationMs}
                        offsetMs={track.offsetMs}
                        onOffsetChange={(offset) => onOffsetChange(track.id, offset)}
                        loopStartMs={loopStartMs}
                        loopEndMs={loopEndMs}
                        color={isMute ? "#52525b" : scheme.color}
                        progressColor={isMute ? "#3f3f46" : scheme.progress}
                      />
                    )}
                  </div>
                      </>
                    );
                  })()}
                </div>
              );
            })}

            {/* Add Audio Track Button */}
            {onAddAudioTrack && (
              <div className="group flex items-center h-[48px] bg-zinc-800 dark:bg-[#22222a] border-b border-zinc-900 dark:border-zinc-800/50 transition-colors">
                <div className="w-64 h-full flex items-center px-4 gap-4 border-r border-zinc-900 dark:border-zinc-800/50 bg-zinc-900 dark:bg-[#1e1e24] shrink-0 sticky left-0 z-20 transition-colors">
                  <label className="group/btn flex items-center justify-center h-8 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-700/50 dark:border-zinc-700/50 cursor-pointer transition-colors rounded px-3 w-full">
                    <span className="text-[10px] font-bold text-zinc-300 group-hover/btn:text-white dark:text-zinc-400 dark:group-hover/btn:text-zinc-200 flex items-center gap-1 uppercase tracking-wider transition-colors">
                      {!uploadingAudio && <Plus className="w-3.5 h-3.5" />}
                      {uploadingAudio ? "Uploading..." : "Add Track"}
                    </span>
                    <input type="file" className="hidden" accept="audio/*,.mp3,.wav,.m4a,.flac" onChange={onAddAudioTrack} disabled={uploadingAudio} />
                  </label>
                </div>
                <div className="flex-1 h-full bg-zinc-900 dark:bg-[#111115] transition-colors"></div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
