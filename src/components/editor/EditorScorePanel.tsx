"use client";

import React, { useState, useCallback } from "react";
import { Wand2, Music } from "lucide-react";
import { MusicXMLVisualizer } from "./MusicXMLVisualizer";
import { MeasureMapEditor } from "./MeasureMapEditor";
import { getFileViewUrl } from "@/lib/appwrite";
import { analyzeMusicXML } from "@/lib/score/musicxml-analyzer";
import { toast } from "sonner";
import { useDialogs } from "@/components/ui/dialog-provider";
import type { DAWPayload } from "@/lib/daw/types";

interface EditorScorePanelProps {
  scoreFileId?: string;
  isOwner: boolean;
  positionMs: number;
  positionMsRef: React.RefObject<number>;
  isPlaying: boolean;
  timemap: { measure: number; timeMs: number }[];
  measureMap?: Record<string, any>;
  isDarkMode: boolean;
  onSeek: (ms: number) => void;
  onMidiExtracted: (base64: string) => void;
  // Upload
  onUploadScore?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadingScore?: boolean;
  // Auto-analyze
  payload: DAWPayload;
  onPayloadChange?: (payload: DAWPayload) => void;
  // Map Editor
  showMapEditor: boolean;
  onCloseMapEditor: () => void;
}

export const EditorScorePanel = React.memo(function EditorScorePanel({
  scoreFileId,
  isOwner,
  positionMs,
  positionMsRef,
  isPlaying,
  timemap,
  measureMap,
  isDarkMode,
  onSeek,
  onMidiExtracted,
  onUploadScore,
  uploadingScore,
  payload,
  onPayloadChange,
  showMapEditor,
  onCloseMapEditor,
}: EditorScorePanelProps) {
  const { confirm } = useDialogs();
  const [analyzing, setAnalyzing] = useState(false);

  const handleAutoAnalyze = useCallback(async () => {
    const fileId = payload.notationData?.fileId;
    if (!fileId) return;

    setAnalyzing(true);
    try {
      const url = getFileViewUrl(fileId);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = await res.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let xmlText: string;

      if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(buffer);
        const xmlFile = Object.keys(zip.files).find(f => f.endsWith('.xml') && !f.startsWith('META-INF'));
        if (!xmlFile) throw new Error('No XML file found in MXL archive');
        xmlText = await zip.files[xmlFile].async('string');
      } else {
        xmlText = new TextDecoder().decode(buffer);
      }

      const analysis = analyzeMusicXML(xmlText);

      const lines = [
        `Tempo: ♩= ${Math.round(analysis.tempo)} BPM`,
        `Time Sig: ${analysis.timeSignature}`,
        `Key: ${analysis.keySignature}`,
        `Measures: ${analysis.totalMeasures} (sheet) → ${analysis.totalPlaybackMeasures} (playback)`,
      ];
      if (analysis.tempoChanges.length > 1) {
        lines.push(`\nTempo changes: ${analysis.tempoChanges.map(([m, t]) => `M${m}:${Math.round(t)}`).join(' → ')}`);
      }
      if (analysis.repeatDescriptions.length > 0) {
        lines.push(`\nRepeats: ${analysis.repeatDescriptions.join(', ')}`);
      }

      const ok = await confirm({
        title: '📋 MusicXML Analysis',
        description: lines.join('\n'),
        confirmText: 'Apply All',
        cancelText: 'Cancel',
      });

      if (ok && onPayloadChange) {
        onPayloadChange({
          ...payload,
          metadata: {
            ...payload.metadata,
            tempo: Math.round(analysis.tempo),
            timeSignature: analysis.timeSignature,
            keySignature: analysis.keySignature,
          },
          notationData: {
            ...payload.notationData!,
            timemap: analysis.timemap,
            measureMap: Object.keys(analysis.measureMap).length > 0 ? analysis.measureMap : undefined,
          },
        });
        toast.success(`Applied: ${analysis.totalPlaybackMeasures} measures, ${analysis.tempoChanges.length} tempo event(s)`);
      }
    } catch (err: any) {
      console.error('Auto-analyze failed:', err);
      toast.error(`Analysis failed: ${err.message || 'Unknown error'}`);
    } finally {
      setAnalyzing(false);
    }
  }, [payload, onPayloadChange, confirm]);

  return (
    <div className="flex-1 flex overflow-hidden relative">
      <div className="flex-1 overflow-hidden relative bg-white dark:bg-[#282c34] shadow-inner ring-1 ring-black/5 transition-colors duration-200">
        {/* Auto-Analyze floating button */}
        {scoreFileId && isOwner && (
          <button
            onClick={handleAutoAnalyze}
            disabled={analyzing}
            className="absolute top-2 right-2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold shadow-lg hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 transition-all"
            title="Auto-analyze MusicXML: extract tempo, time signature, key, repeats"
          >
            <Wand2 className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing ? 'Analyzing...' : 'Auto-Analyze'}
          </button>
        )}
        <MusicXMLVisualizer
          scoreFileId={scoreFileId}
          positionMs={positionMs}
          externalPositionMsRef={positionMsRef}
          isPlaying={isPlaying}
          timemap={timemap}
          measureMap={measureMap}
          onSeek={onSeek}
          onMidiExtracted={onMidiExtracted}
          isDarkMode={isDarkMode}
        />

        {/* Empty-state upload shortcut for owners */}
        {!scoreFileId && isOwner && onUploadScore && (
          <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer group z-10 bg-white/80 dark:bg-[#282c34]/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 px-10 py-10 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 group-hover:border-[#C8A856] group-hover:bg-[#C8A856]/5 transition-all duration-200">
              <Music className="w-16 h-16 text-zinc-300 dark:text-zinc-700 group-hover:text-[#C8A856] transition-colors duration-200" />
              <div className="text-center">
                <p className="text-lg font-bold text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                  {uploadingScore ? "Uploading..." : "Click to Upload Sheet Music"}
                </p>
                <p className="text-sm text-zinc-400 dark:text-zinc-600 mt-1.5">MusicXML · .xml · .mxl</p>
              </div>
              {uploadingScore && (
                <div className="w-5 h-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            <input type="file" className="hidden" accept=".musicxml,.xml,.mxl" onChange={onUploadScore} disabled={uploadingScore} />
          </label>
        )}
      </div>

      {showMapEditor && onPayloadChange && (
        <MeasureMapEditor
          payload={payload}
          positionMs={positionMs}
          onPayloadChange={onPayloadChange}
          onClose={onCloseMapEditor}
          onSeek={onSeek}
        />
      )}
    </div>
  );
});
