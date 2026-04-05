"use client";

import React, { useRef, useState, useEffect } from "react";
import { useUniversalSync } from "../livekit/UniversalSyncProvider";
import { cn } from "@/lib/utils";

export function PdfDrawingLayer({ pageIndex }: { pageIndex: number }) {
  const { role, drawings, broadcastDrawing, canStudentDraw, activeProjectType, isDrawingMode, drawingColor } = useUniversalSync();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Local state for drawing paths (in-progress)
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{x: number, y: number}[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  const hasPermission = (role === "teacher" || canStudentDraw) && activeProjectType !== "musicxml";

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
         setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Filter drawings that belong to this particular page
  const pageDrawings = drawings.filter(d => d.pageIndex === pageIndex || d.action === "CLEAR");

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

    // Render historical drawings for THIS page
    for (const drawEvent of pageDrawings) {
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

  }, [pageDrawings, currentPath, drawingColor, dimensions]);

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

    const nextPath = [...currentPath, pos];
    setCurrentPath(nextPath);
    
    // Optimize: Broadcast intermediate stroke segments every N points
    if (nextPath.length % 5 === 0) {
       broadcastDrawing("DRAW", nextPath, drawingColor, pageIndex);
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing || !isDrawingMode || !hasPermission) return;
    setIsDrawing(false);
    if (currentPath.length > 0) {
      broadcastDrawing("DRAW", currentPath, drawingColor, pageIndex);
    }
    setCurrentPath([]);
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
