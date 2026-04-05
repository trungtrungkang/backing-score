"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useUniversalSync } from "./UniversalSyncProvider";
import { Pencil, Eraser, Trash2, MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";

// A rudimentary canvas overlay for anchor-based drawing sync
export function CanvasOverlay() {
  const { role, drawings, broadcastDrawing, canStudentDraw } = useUniversalSync();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Local state for drawing
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#ef4444"); // Red by default
  const [currentPath, setCurrentPath] = useState<{x: number, y: number}[]>([]);
  
  const hasPermission = role === "teacher" || canStudentDraw;

  // Render received drawings
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize canvas to properly match container size (Fix DPI scaling)
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;

    // Render historical drawings
    for (const drawEvent of drawings) {
      if (drawEvent.action === "DRAW" && drawEvent.points) {
        ctx.strokeStyle = drawEvent.color || "#ef4444";
        ctx.beginPath();
        for (let i = 0; i < drawEvent.points.length; i++) {
          const pt = drawEvent.points[i];
          // Anchor-relative mapped to absolute px
          const absX = pt.x * canvas.width;
          const absY = pt.y * canvas.height;
          if (i === 0) ctx.moveTo(absX, absY);
          else ctx.lineTo(absX, absY);
        }
        ctx.stroke();
      }
    }

    // Render currently active local stroke
    if (currentPath.length > 0) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      for (let i = 0; i < currentPath.length; i++) {
        const pt = currentPath[i];
        const absX = pt.x * canvas.width;
        const absY = pt.y * canvas.height;
        if (i === 0) ctx.moveTo(absX, absY);
        else ctx.lineTo(absX, absY);
      }
      ctx.stroke();
    }

  }, [drawings, currentPath, color]);

  // Pointer Handlers
  const getRelativePosition = (e: React.PointerEvent) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    // Translate standard absolute cursor pixels into anchor % based floats (0.0 to 1.0)
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isDrawingMode || !hasPermission) return;
    const pos = getRelativePosition(e);
    if (!pos) return;
    setIsDrawing(true);
    setCurrentPath([pos]);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !isDrawingMode || !hasPermission) return;
    const pos = getRelativePosition(e);
    if (!pos) return;

    setCurrentPath(prev => {
      const nextPath = [...prev, pos];
      // Optimize: Broadcast intermediate stroke segments every N points
      if (nextPath.length % 5 === 0) {
         broadcastDrawing("DRAW", nextPath, color);
      }
      return nextPath;
    });
  };

  const handlePointerUp = () => {
    if (!isDrawing || !isDrawingMode || !hasPermission) return;
    setIsDrawing(false);
    if (currentPath.length > 0) {
      broadcastDrawing("DRAW", currentPath, color);
    }
    setCurrentPath([]);
  };

  const clearCanvas = () => {
    broadcastDrawing("CLEAR");
  };

  return (
    <div 
      className={cn(
        "absolute inset-0 z-[200]",
        isDrawingMode ? "pointer-events-auto" : "pointer-events-none"
      )}
      ref={containerRef}
    >
      <canvas 
        ref={canvasRef}
        className={cn(
          "w-full h-full cursor-crosshair",
          isDrawingMode && hasPermission ? "opacity-100" : "opacity-100"
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* Floating Drawing Tool Palette */}
      {hasPermission && (
        <div className="absolute top-4 right-4 bg-white/90 dark:bg-zinc-900/90 shadow-xl backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 flex gap-2 pointer-events-auto">
          
          <button 
            onClick={() => setIsDrawingMode(false)}
            className={cn("p-2 rounded-lg transition-colors", !isDrawingMode ? "bg-blue-100 text-blue-600 dark:bg-blue-900/50" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}
            title="Pointer (Native Scroll)"
          >
            <MousePointer2 className="w-5 h-5" />
          </button>
          
          <div className="w-[1px] h-9 bg-zinc-200 dark:bg-zinc-800 mx-1" />

          <button 
            onClick={() => setIsDrawingMode(true)}
            className={cn("p-2 rounded-lg transition-colors", isDrawingMode ? "bg-rose-100 text-rose-600 dark:bg-rose-900/50" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}
            title="Pen Tool"
          >
            <Pencil className="w-5 h-5" />
          </button>
          
          {isDrawingMode && (
            <div className="flex items-center gap-2 mx-2">
              {["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7"].map(c => (
                <button 
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn("w-6 h-6 rounded-full border-2 transition-transform", color === c ? "scale-125 border-zinc-900 dark:border-white" : "border-transparent block hover:scale-110")}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}

          <div className="w-[1px] h-9 bg-zinc-200 dark:bg-zinc-800 mx-1" />

          <button 
            onClick={clearCanvas}
            className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            title="Clear Board"
          >
            <Trash2 className="w-5 h-5" />
          </button>

        </div>
      )}
    </div>
  );
}
