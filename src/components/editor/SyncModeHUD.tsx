"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface SyncModeHUDProps {
  isPlaying: boolean;
  recordedTimemap: { measure: number; timeMs: number }[];
  onCancel: () => void;
  onSave: () => void;
}

export const SyncModeHUD = React.memo(function SyncModeHUD({
  isPlaying,
  recordedTimemap,
  onCancel,
  onSave,
}: SyncModeHUDProps) {
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
            No intro? Press <kbd className="bg-black/20 border border-black/30 px-1.5 py-0.5 rounded text-xs font-mono font-bold shadow-sm mx-1">SPACE</kbd> to start & mark Measure 1 at t=0.
            <span className="opacity-60 mx-2">·</span>
            Has intro? Press <kbd className="bg-black/20 border border-black/30 px-1.5 py-0.5 rounded text-xs font-mono font-bold shadow-sm mx-1">Play</kbd> first, then SPACE each measure.
          </span>
          : recordedTimemap.length === 0
            ? <span className="text-red-50">Press <kbd className="bg-black/20 border border-black/30 px-1.5 py-0.5 rounded text-xs font-mono font-bold shadow-sm mx-1">SPACE</kbd> on the downbeat of <strong>Measure 1</strong> to begin.</span>
            : <span className="text-red-50">Press <kbd className="bg-black/20 border border-black/30 px-1.5 py-0.5 rounded text-xs font-mono font-bold shadow-sm mx-1">SPACE</kbd> on the downbeat of each new Measure.</span>
        }
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono bg-black/20 px-3 py-1 rounded border border-black/20">
          Recorded: {recordedTimemap.length} measures
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="hover:bg-white/10 hover:text-white" onClick={onCancel}>Cancel</Button>
          <Button size="sm" variant="secondary" className="bg-white text-red-700 hover:bg-red-50 font-bold" onClick={onSave} disabled={recordedTimemap.length === 0}>Save Map</Button>
        </div>
      </div>
    </div>
  );
});
