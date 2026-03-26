"use client";

import { useState } from "react";
import { Plus, Trash2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TimemapEntry } from "@/lib/daw/types";

interface BeatTimelineEditorProps {
  timemap: TimemapEntry[];
  selectedMeasure: number | null;
  onTimemapChange: (newTimemap: TimemapEntry[]) => void;
  onSeek?: (timeMs: number) => void;
}

function formatMs(ms: number): string {
  const s = (ms / 1000).toFixed(2);
  return `${s}s`;
}

export function BeatTimelineEditor({ timemap, selectedMeasure, onTimemapChange, onSeek }: BeatTimelineEditorProps) {
  const [editingBeat, setEditingBeat] = useState<{ measureIdx: number; beatIdx: number } | null>(null);
  const [editValue, setEditValue] = useState("");

  if (selectedMeasure === null) {
    return (
      <div className="p-3 text-xs text-muted-foreground italic">
        Click a measure above to view/edit its beats.
      </div>
    );
  }

  const tmIdx = timemap.findIndex(t => t.measure === selectedMeasure);
  if (tmIdx === -1) return null;

  const entry = timemap[tmIdx];
  const beats = entry.beatTimestamps || [entry.timeMs];
  const nextMeasureMs = timemap[tmIdx + 1]?.timeMs;

  const handleDeleteBeat = (beatIdx: number) => {
    if (beats.length <= 1) return; // Can't delete the only beat (downbeat)
    const updated = [...timemap];
    const newBeats = beats.filter((_, i) => i !== beatIdx);
    // If deleting beat 0 (downbeat), update timeMs to the next beat
    const newTimeMs = beatIdx === 0 ? newBeats[0] : entry.timeMs;
    updated[tmIdx] = { ...entry, timeMs: newTimeMs, beatTimestamps: newBeats };
    onTimemapChange(updated);
  };

  const handleAddBeat = () => {
    // Insert beat at the largest gap
    const updated = [...timemap];
    let maxGap = 0;
    let insertAfter = beats.length - 1;
    const endMs = nextMeasureMs ?? (beats[beats.length - 1] + 500);

    for (let i = 0; i < beats.length; i++) {
      const nextMs = beats[i + 1] ?? endMs;
      const gap = nextMs - beats[i];
      if (gap > maxGap) {
        maxGap = gap;
        insertAfter = i;
      }
    }

    const insertMs = Math.round(beats[insertAfter] + maxGap / 2);
    const newBeats = [...beats];
    newBeats.splice(insertAfter + 1, 0, insertMs);
    updated[tmIdx] = { ...entry, beatTimestamps: newBeats };
    onTimemapChange(updated);
  };

  const handleEditSave = () => {
    if (!editingBeat) return;
    const newMs = parseInt(editValue, 10);
    if (isNaN(newMs) || newMs < 0) return;

    const updated = [...timemap];
    const newBeats = [...beats];
    newBeats[editingBeat.beatIdx] = newMs;
    newBeats.sort((a, b) => a - b); // Keep sorted
    const newTimeMs = newBeats[0]; // Downbeat is always the first
    updated[tmIdx] = { ...entry, timeMs: newTimeMs, beatTimestamps: newBeats };
    onTimemapChange(updated);
    setEditingBeat(null);
  };

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Beats in M{selectedMeasure}
          <span className="ml-1 text-[10px] font-normal opacity-60">({beats.length} beats)</span>
        </h4>
        <Button size="icon" variant="ghost" className="h-6 w-6 text-green-500 hover:text-green-600 hover:bg-green-50" onClick={handleAddBeat} title="Add beat at largest gap">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
      
      <div className="space-y-1">
        {beats.map((beatMs, i) => {
          const isDownbeat = i === 0;
          const isEditing = editingBeat?.measureIdx === tmIdx && editingBeat?.beatIdx === i;

          return (
            <div
              key={`beat-${i}`}
              className={`flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                isDownbeat ? "bg-blue-500/10 border border-blue-500/20" : "bg-muted/30 border border-border"
              }`}
            >
              <span className={`w-6 text-center font-bold ${isDownbeat ? "text-blue-500" : "text-muted-foreground"}`}>
                {isDownbeat ? "◆" : "◇"}
              </span>
              <span className="text-[10px] text-muted-foreground w-4">B{i + 1}</span>

              {isEditing ? (
                <input
                  type="number"
                  className="flex-1 bg-background border border-blue-400 rounded px-1.5 py-0.5 text-xs font-mono w-20"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleEditSave(); if (e.key === "Escape") setEditingBeat(null); }}
                  onBlur={handleEditSave}
                  autoFocus
                />
              ) : (
                <button
                  className="flex-1 text-left font-mono text-xs hover:text-blue-400 transition-colors"
                  onClick={() => { setEditingBeat({ measureIdx: tmIdx, beatIdx: i }); setEditValue(beatMs.toString()); }}
                  title="Click to edit timestamp"
                >
                  {formatMs(beatMs)} <span className="opacity-40">({beatMs}ms)</span>
                </button>
              )}

              {onSeek && (
                <button
                  className="p-0.5 text-green-500 hover:text-green-400 transition-colors"
                  onClick={() => onSeek(beatMs)}
                  title="Play from this beat"
                >
                  <Play className="w-3 h-3 fill-current" />
                </button>
              )}

              {!isDownbeat && (
                <button
                  className="p-0.5 text-red-500 hover:text-red-400 transition-colors"
                  onClick={() => handleDeleteBeat(i)}
                  title="Delete beat"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
