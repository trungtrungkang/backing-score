"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Midi } from "@tonejs/midi";
import { cn } from "@/lib/utils";

interface PianoRollRegionProps {
  base64Midi: string | null;
  positionMs: number;
  durationMs: number;
  offsetMs?: number;
  onOffsetChange?: (offsetMs: number) => void;
  className?: string;
  color?: string;
  progressColor?: string;
  trackIndex?: number; // When set, only render notes from this specific MIDI track
  midiChannel?: number; // When set, filter notes by MIDI channel across all tracks
}

export function PianoRollRegion({
  base64Midi,
  positionMs,
  durationMs,
  offsetMs = 0,
  onOffsetChange,
  className,
  color = "#8B5CF6",
  progressColor = "#7C3AED",
  trackIndex,
  midiChannel,
}: PianoRollRegionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use refs for values that change frequently to avoid useEffect teardown/setup
  const positionMsRef = useRef(positionMs);
  const durationMsRef = useRef(durationMs);
  const offsetMsRef = useRef(offsetMs);
  const colorRef = useRef(color);
  const progressColorRef = useRef(progressColor);

  // Keep refs in sync
  positionMsRef.current = positionMs;
  durationMsRef.current = durationMs;
  offsetMsRef.current = offsetMs;
  colorRef.current = color;
  progressColorRef.current = progressColor;

  // Parse MIDI data
  const midiDataRef = useRef<Midi | null>(null);
  const notesRef = useRef<any[]>([]);
  const noteStatsRef = useRef({ minPitch: 0, maxPitch: 127, pitchRange: 127, minTimeMs: 0 });

  useEffect(() => {
    if (!base64Midi) {
      midiDataRef.current = null;
      notesRef.current = [];
      return;
    }
    
    try {
      const binaryString = window.atob(base64Midi.split(",")[1] || base64Midi);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const midi = new Midi(bytes);
      midiDataRef.current = midi;

      // Pre-compute filtered notes and stats once
      let allNotes: any[];
      if (midiChannel !== undefined) {
        allNotes = midi.tracks.flatMap(t => 
          t.notes.filter(n => n.midi !== undefined && t.channel === midiChannel)
        );
        if (allNotes.length === 0) {
          if (trackIndex !== undefined && midi.tracks[trackIndex]) {
            allNotes = midi.tracks[trackIndex].notes;
          } else {
            allNotes = midi.tracks.flatMap(t => t.notes);
          }
        }
      } else if (trackIndex !== undefined) {
        allNotes = midi.tracks[trackIndex]?.notes || [];
      } else {
        allNotes = midi.tracks.flatMap(t => t.notes);
      }
      notesRef.current = allNotes;

      // Pre-compute pitch range and time offset
      if (allNotes.length > 0) {
        let minPitch = 127, maxPitch = 0, minTimeMs = Infinity;
        allNotes.forEach(n => {
          if (n.midi < minPitch) minPitch = n.midi;
          if (n.midi > maxPitch) maxPitch = n.midi;
          const startMs = n.time * 1000;
          if (startMs < minTimeMs) minTimeMs = startMs;
        });
        if (minTimeMs === Infinity) minTimeMs = 0;
        minPitch = Math.max(0, minPitch - 5);
        maxPitch = Math.min(127, maxPitch + 5);
        noteStatsRef.current = { minPitch, maxPitch, pitchRange: maxPitch - minPitch, minTimeMs };
      }
    } catch (err) {
      console.error("Failed to parse Base64 MIDI for Piano Roll", err);
      midiDataRef.current = null;
      notesRef.current = [];
    }
  }, [base64Midi, trackIndex, midiChannel]);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Dragging Logic
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const startOffsetMs = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!onOffsetChange || !dimensions.width) return;
    setIsDragging(true);
    dragStartX.current = e.clientX;
    startOffsetMs.current = offsetMs;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !onOffsetChange || !dimensions.width || !durationMs) return;
    const deltaX = e.clientX - dragStartX.current;
    const deltaMs = (deltaX / dimensions.width) * durationMs;
    const newOffset = Math.max(0, startOffsetMs.current + deltaMs);
    onOffsetChange(newOffset);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Handle Resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Render Piano Roll — optimized: set up RAF loop once, read refs for per-frame values
  const dimensionsRef = useRef(dimensions);
  dimensionsRef.current = dimensions;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    const scrollContainer = canvas.closest('.overflow-x-auto') as HTMLDivElement;
    if (!scrollContainer) return;

    let rafId: number;
    let needsDraw = true;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const allNotes = notesRef.current;
      const curDurationMs = durationMsRef.current;
      const curPositionMs = positionMsRef.current;
      const curOffsetMs = offsetMsRef.current;
      const curColor = colorRef.current;
      const curProgressColor = progressColorRef.current;
      const { width, height } = dimensionsRef.current;

      if (allNotes.length === 0 || curDurationMs <= 0 || width === 0) return;

      const visibleWidth = scrollContainer.clientWidth - 256;
      const scrollLeft = scrollContainer.scrollLeft;
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== visibleWidth * dpr) {
        canvas.width = visibleWidth * dpr;
        canvas.style.width = `${visibleWidth}px`;
      }
      if (canvas.height !== height * dpr) {
        canvas.height = height * dpr;
        canvas.style.height = `${height}px`;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, visibleWidth, height);
      ctx.translate(-scrollLeft, 0);

      const { minPitch, pitchRange, minTimeMs } = noteStatsRef.current;
      const minDrawX = Math.max(0, scrollLeft - 500);
      const maxDrawX = Math.min(width, scrollLeft + visibleWidth + 500);

      allNotes.forEach((note: any) => {
        const startMs = (note.time * 1000) - minTimeMs;
        const durMs = note.duration * 1000;
        const endMs = startMs + durMs;

        const x = ((startMs + curOffsetMs) / curDurationMs) * width;
        const noteWidth = Math.max(2, (durMs / curDurationMs) * width);
        
        if (x + noteWidth < minDrawX || x > maxDrawX) return;

        const normalizedPitch = (note.midi - minPitch) / pitchRange;
        const y = height - (normalizedPitch * height) - 4;

        ctx.fillStyle = (startMs + curOffsetMs <= curPositionMs && endMs + curOffsetMs >= curPositionMs)
          ? curProgressColor
          : curColor;

        ctx.fillRect(x, y, noteWidth, 4);
      });
    };

    // Animation loop — only draws when needed
    const tick = () => {
      if (needsDraw) {
        draw();
        needsDraw = false;
      }
      rafId = requestAnimationFrame(tick);
    };

    // Mark as needing redraw whenever positionMs changes (via MutationObserver on a data attribute)
    const markDirty = () => { needsDraw = true; };

    scrollContainer.addEventListener("scroll", markDirty, { passive: true });
    rafId = requestAnimationFrame(tick);

    // Use an interval to mark dirty at 30fps instead of re-running the entire useEffect at 60fps
    const dirtyInterval = setInterval(markDirty, 33);

    return () => {
      scrollContainer.removeEventListener("scroll", markDirty);
      cancelAnimationFrame(rafId);
      clearInterval(dirtyInterval);
    };
  }, [dimensions, base64Midi, trackIndex, midiChannel]); // Note: positionMs NOT in deps

  return (
    <div 
      ref={containerRef} 
      className={cn("relative w-full h-full pointer-events-auto", onOffsetChange ? "cursor-pointer active:cursor-grabbing" : "", className)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <canvas 
        ref={canvasRef} 
        className="sticky left-[256px] top-0 pointer-events-none" 
        style={{ height: "100%", imageRendering: "pixelated" }} 
      />
    </div>
  );
}
