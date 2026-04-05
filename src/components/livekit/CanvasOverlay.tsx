"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useUniversalSync } from "./UniversalSyncProvider";
import { Pencil, Eraser, Trash2, MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";

// A rudimentary canvas overlay for anchor-based drawing sync
export function CanvasOverlay() {
  const { role, drawings, broadcastDrawing, canStudentDraw, activeProjectType, isDrawingMode, drawingColor } = useUniversalSync();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Local state for drawing paths (in-progress)
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{x: number, y: number}[]>([]);
  
  const hasPermission = (role === "teacher" || canStudentDraw) && activeProjectType !== "musicxml";

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
      ctx.strokeStyle = drawingColor;
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

  }, [drawings, currentPath, drawingColor]);

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
         broadcastDrawing("DRAW", nextPath, drawingColor);
      }
      return nextPath;
    });
  };

  const handlePointerUp = () => {
    if (!isDrawing || !isDrawingMode || !hasPermission) return;
    setIsDrawing(false);
    if (currentPath.length > 0) {
      broadcastDrawing("DRAW", currentPath, drawingColor);
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
    </div>
  );
}
