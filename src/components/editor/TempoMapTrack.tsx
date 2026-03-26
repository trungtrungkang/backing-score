"use client";

import { useRef, useEffect, useCallback } from "react";
import type { TimemapEntry } from "@/lib/daw/types";

interface TempoMapTrackProps {
  timemap: TimemapEntry[];
  durationMs: number;
  positionMs: number;
  color?: string;
  onSeek?: (ms: number) => void;
}

/**
 * Renders a horizontal tempo map visualization showing measure boundaries,
 * beat timestamps, and tempo changes as a lane parallel to audio waveforms.
 */
export function TempoMapTrack({ timemap, durationMs, positionMs, color = "#C8A856", onSeek }: TempoMapTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || durationMs <= 0 || timemap.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#111115";
    ctx.fillRect(0, 0, w, h);

    const msToX = (ms: number) => (ms / durationMs) * w;

    // Draw measure boundaries and beat lines
    for (let i = 0; i < timemap.length; i++) {
      const entry = timemap[i];
      const x = msToX(entry.timeMs);
      const nextMs = timemap[i + 1]?.timeMs ?? durationMs;
      const measureW = msToX(nextMs) - x;

      // Measure boundary line (strong)
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();

      // Measure number label
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "left";
      if (measureW > 20) {
        ctx.fillText(`${entry.measure}`, x + 3, 10);
      }

      // Beat timestamps (if present)
      if (entry.beatTimestamps && entry.beatTimestamps.length > 1) {
        for (let b = 1; b < entry.beatTimestamps.length; b++) {
          const bx = msToX(entry.beatTimestamps[b]);
          ctx.strokeStyle = color;
          ctx.lineWidth = 0.8;
          ctx.globalAlpha = 0.35;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(bx, 4);
          ctx.lineTo(bx, h - 4);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Tempo change indicator
      if (entry.tempo !== undefined) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#F43F5E";
        ctx.font = "bold 8px monospace";
        ctx.fillText(`♩=${entry.tempo}`, x + 3, h - 4);
      }

      // Time signature change indicator
      if (entry.timeSignature) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#A855F7";
        ctx.font = "bold 8px monospace";
        const tsX = entry.tempo !== undefined ? x + 45 : x + 3;
        ctx.fillText(entry.timeSignature, tsX, h - 4);
      }

      // Fill alternating measure background
      ctx.globalAlpha = entry.measure % 2 === 0 ? 0.06 : 0.03;
      ctx.fillStyle = color;
      ctx.fillRect(x, 0, measureW, h);
    }

    // Playhead position
    const playX = msToX(positionMs);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#FACC15";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playX, 0);
    ctx.lineTo(playX, h);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }, [timemap, durationMs, positionMs, color]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || durationMs <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ms = (x / rect.width) * durationMs;
    onSeek(Math.max(0, Math.min(durationMs, ms)));
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-pointer"
      onClick={handleClick}
      title="Tempo Map — click to seek"
    />
  );
}
