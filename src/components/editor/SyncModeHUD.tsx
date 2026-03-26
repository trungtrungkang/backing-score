"use client";

import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";

/** Map KeyboardEvent.code to display label */
function keyLabel(code: string): string {
  if (code === "Enter") return "ENTER";
  if (code === "ShiftLeft" || code === "ShiftRight") return "SHIFT";
  if (code === "ArrowLeft") return "←";
  if (code === "ArrowRight") return "→";
  if (code === "ArrowUp") return "↑";
  if (code === "ArrowDown") return "↓";
  if (code === "Space") return "SPACE";
  if (code.startsWith("Key")) return code.slice(3); // "KeyD" → "D"
  if (code.startsWith("Digit")) return code.slice(5);
  return code;
}

interface SyncModeHUDProps {
  isPlaying: boolean;
  recordedTimemap: { measure: number; timeMs: number; beatTimestamps?: number[] }[];
  onCancel: () => void;
  onSave: () => void;
  downbeatKey: string;
  midMeasureKey: string;
  upbeatKey: string;
  syncCurrentMeasureRef: React.RefObject<number>;
  syncCurrentBeatRef: React.RefObject<number>;
}

export const SyncModeHUD = React.memo(function SyncModeHUD({
  isPlaying,
  recordedTimemap,
  onCancel,
  onSave,
  downbeatKey,
  midMeasureKey,
  upbeatKey,
  syncCurrentMeasureRef,
  syncCurrentBeatRef,
}: SyncModeHUDProps) {
  const totalBeats = useMemo(() =>
    recordedTimemap.reduce((sum, m) => sum + (m.beatTimestamps?.length ?? 1), 0),
    [recordedTimemap]
  );

  const downLabel = keyLabel(downbeatKey);
  const midLabel = keyLabel(midMeasureKey);
  const upLabel = keyLabel(upbeatKey);

  return (
    <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between text-sm shrink-0 shadow-inner z-10 font-medium">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-red-900/40 px-3 py-1.5 rounded-full">
          <span className="relative flex h-3 w-3">
            {isPlaying && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-100 opacity-75"></span>}
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
          </span>
          <strong className="tracking-wider uppercase text-xs">Sync Mode</strong>
        </div>
        {!isPlaying
          ? <span className="text-red-50">
            No intro? Press <kbd className="bg-black/20 border border-black/30 px-1.5 py-0.5 rounded text-xs font-mono font-bold shadow-sm mx-1">{downLabel}</kbd> to start &amp; mark Measure 1 at t=0.
            <span className="opacity-60 mx-2">·</span>
            Has intro? Press <kbd className="bg-black/20 border border-black/30 px-1.5 py-0.5 rounded text-xs font-mono font-bold shadow-sm mx-1">Play</kbd> first, then tap along.
          </span>
          : recordedTimemap.length === 0
            ? <span className="text-red-50">Press <kbd className="bg-black/20 border border-black/30 px-1.5 py-0.5 rounded text-xs font-mono font-bold shadow-sm mx-1">{downLabel}</kbd> on beat 1 of <strong>Measure 1</strong>.</span>
            : <span className="text-red-50">
              <kbd className="bg-black/20 border border-black/30 px-1.5 py-0.5 rounded text-xs font-mono font-bold shadow-sm mx-0.5">{downLabel}</kbd>
              <span className="opacity-70">= new measure</span>
              <span className="opacity-40 mx-1">|</span>
              <kbd className="bg-black/20 border border-black/30 px-1.5 py-0.5 rounded text-xs font-mono font-bold shadow-sm mx-0.5">{midLabel}</kbd>
              <span className="opacity-70">= half-bar</span>
              <span className="opacity-40 mx-1">|</span>
              <kbd className="bg-black/20 border border-black/30 px-1.5 py-0.5 rounded text-xs font-mono font-bold shadow-sm mx-0.5">{upLabel}</kbd>
              <span className="opacity-70">= beat</span>
            </span>
        }
      </div>
      <div className="flex items-center gap-4">
        {recordedTimemap.length > 0 && (
          <span className="font-mono bg-black/20 px-2 py-1 rounded border border-black/20 text-xs">
            M{syncCurrentMeasureRef.current}:B{syncCurrentBeatRef.current}
          </span>
        )}
        <span className="font-mono bg-black/20 px-3 py-1 rounded border border-black/20">
          {recordedTimemap.length} measures · {totalBeats} beats
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="hover:bg-white/10 hover:text-white" onClick={onCancel}>Cancel</Button>
          <Button size="sm" variant="secondary" className="bg-white text-red-700 hover:bg-red-50 font-bold" onClick={onSave} disabled={recordedTimemap.length === 0}>Save Map</Button>
        </div>
      </div>
    </div>
  );
});
