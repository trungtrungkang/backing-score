"use client";

import React, { useState } from "react";
import { fetchAndAnalyzeMusicXML } from "@/lib/score/musicxml-analyzer";
import type { DAWPayload } from "@/lib/daw/types";
import { toast } from "sonner";
import { Loader2, Music, Waves } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayModeToggleProps {
  payload: DAWPayload;
  onPayloadChange?: (payload: DAWPayload) => void;
  stretchedMidiBase64?: string | null;
  midiBase64?: string | null;
  className?: string;
}

export function PlayModeToggle({ payload, onPayloadChange, stretchedMidiBase64, midiBase64, className }: PlayModeToggleProps) {
  const [analyzing, setAnalyzing] = useState(false);

  const activePlayMode = payload.notationData?.activePlayMode ?? (payload.audioTracks.length > 0 ? "audio" : "midi");
  const hasAudio = payload.audioTracks.length > 0;
  
  // If no audio tracks exist, forcing Audio mode makes no sense. The toggle can be disabled or hidden.
  if (!hasAudio) {
    return null;
  }

  const handleToggle = async (mode: "audio" | "midi") => {
    if (mode === activePlayMode) return;

    if (mode === "midi") {
      // Check if we need to auto-analyze
      if (!payload.notationData?.autoTimemap || payload.notationData.autoTimemap.length === 0) {
        const fileId = payload.notationData?.fileId;
        if (fileId) {
          setAnalyzing(true);
          try {
            const analysis = await fetchAndAnalyzeMusicXML(fileId, stretchedMidiBase64 || midiBase64);
            if (onPayloadChange) {
              onPayloadChange({
                ...payload,
                metadata: {
                  ...payload.metadata,
                  tempo: Math.round(analysis.tempo),
                  timeSignature: analysis.timeSignature,
                },
                notationData: {
                  ...payload.notationData,
                  type: payload.notationData?.type || "music-xml",
                  autoTimemap: analysis.timemap,
                  measureMap: Object.keys(analysis.measureMap).length > 0 ? analysis.measureMap : undefined,
                  activePlayMode: "midi"
                } as any
              });
            }
            toast.success("Auto-analyzed MIDI timemap generated");
          } catch (e: any) {
            toast.error("Failed to extract MIDI timemap: " + e.message);
            // Revert or keep it on audio? If we couldn't analyze, we can still switch to MIDI but it will be broken,
            // so let's revert
            return;
          } finally {
            setAnalyzing(false);
          }
          return;
        }
      }
    }

    if (onPayloadChange) {
      onPayloadChange({
        ...payload,
        notationData: {
          ...payload.notationData,
          type: payload.notationData?.type || "music-xml",
          activePlayMode: mode
        } as any
      });
    }
  };

  return (
    <div className={cn("flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50 shadow-inner", className)}>
      <button
        disabled={analyzing}
        onClick={() => handleToggle("audio")}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
          activePlayMode === "audio" 
            ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm" 
            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        )}
      >
        <Waves className="w-3.5 h-3.5" />
        Audio
      </button>

      <button
        disabled={analyzing}
        onClick={() => handleToggle("midi")}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
          activePlayMode === "midi" 
            ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm" 
            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        )}
      >
        {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Music className="w-3.5 h-3.5" />}
        MIDI
      </button>
    </div>
  );
}
