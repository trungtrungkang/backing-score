"use client";

import React, { useRef, useState, useEffect } from "react";
import { useOptionalUniversalSync } from "../livekit/UniversalSyncProvider";
import { usePdfOverlay } from "./PdfOverlayContext";
import { cn } from "@/lib/utils";

export function PdfDrawingLayer({ pageIndex }: { pageIndex: number }) {
  // 1. LiveKit Sync (Teacher/Classroom Context) - Optional
  const syncContext = useOptionalUniversalSync();
  const liveDrawings = syncContext?.drawings || [];
  const liveRole = syncContext?.role || "student";
  const liveActiveProjectType = syncContext?.activeProjectType || "pdf";
  const canStudentDraw = syncContext?.canStudentDraw || false;
  const isSyncDrawingMode = syncContext?.isDrawingMode || false;
  const syncDrawingColor = syncContext?.drawingColor || "#ef4444";
  
  // 2. Local Overlay (Personal/Private Context) - Required
  const { 
     localDrawings, 
     addDrawingStroke, 
     isDrawingMode: isLocalDrawingMode, 
     drawingColor: localDrawingColor 
  } = usePdfOverlay();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // States
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{x: number, y: number}[]>([]);
  const [currentStrokeId, setCurrentStrokeId] = useState<string>("");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  // Permissions
  // Master switch for drawing mode (priority: Local UI > Sync UI)
  const isCurrentlyDrawingMode = isLocalDrawingMode || isSyncDrawingMode;
  
  // Which stream are we broadcasting to?
  // Nếu SyncDrawingMode đang bật, và là Teacher -> Phát cho cả lớp.
  const isBroadcastingToClass = isSyncDrawingMode && (liveRole === "teacher" || canStudentDraw) && liveActiveProjectType !== "musicxml";

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

  // Lọc lấy các nét vẽ thuộc về trang này (Từ cả 2 nguồn)
  const pageLiveDrawings = liveDrawings.filter(d => d.pageIndex === pageIndex || d.action === "CLEAR");
  const pageLocalDrawings = localDrawings.filter(d => d.pageIndex === pageIndex);

  // Render combined drawings
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;

    // Helper function to draw strokes
    const drawStroke = (points: {x: number, y: number}[], color: string) => {
        if (!points || points.length === 0) return;
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
          const pt = points[i];
          const absX = pt.x * canvas.width;
          const absY = pt.y * canvas.height;
          if (i === 0) ctx.moveTo(absX, absY);
          else ctx.lineTo(absX, absY);
        }
        ctx.stroke();
    };

    // 1. Render LiveKit global drawings
    for (const drawEvent of pageLiveDrawings) {
      if (drawEvent.action === "DRAW" && drawEvent.points) {
        drawStroke(drawEvent.points, drawEvent.color || "#ef4444");
      }
    }
    
    // 2. Render Local Overlays (nằm đè lên trên LiveKit)
    for (const stroke of pageLocalDrawings) {
       drawStroke(stroke.points, stroke.color || "#ef4444");
    }

    // Render currently active local stroke (đang giữ nguyên phím chuột)
    if (currentPath.length > 0) {
      drawStroke(currentPath, isBroadcastingToClass ? syncDrawingColor : localDrawingColor);
    }

  }, [pageLiveDrawings, pageLocalDrawings, currentPath, localDrawingColor, syncDrawingColor, dimensions, isBroadcastingToClass]);

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
    if (!isCurrentlyDrawingMode) return;
    const pos = getRelativePosition(e);
    if (!pos) return;
    setIsDrawing(true);
    setCurrentPath([pos]);
    setCurrentStrokeId(Math.random().toString(36).substring(2, 9));
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !isCurrentlyDrawingMode) return;
    const pos = getRelativePosition(e);
    if (!pos) return;

    const nextPath = [...currentPath, pos];
    setCurrentPath(nextPath);
    
    // Broadcast live to classroom if applicable
    if (isBroadcastingToClass && syncContext) {
       if (nextPath.length % 5 === 0) {
          syncContext.broadcastDrawing("DRAW", nextPath, syncDrawingColor, pageIndex, currentStrokeId);
       }
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing || !isCurrentlyDrawingMode) return;
    setIsDrawing(false);
    
    if (currentPath.length > 0) {
      if (isBroadcastingToClass && syncContext) {
         syncContext.broadcastDrawing("DRAW", currentPath, syncDrawingColor, pageIndex, currentStrokeId);
      } else {
         // Save to private layer DB
         addDrawingStroke({
            pageIndex,
            points: currentPath,
            color: localDrawingColor
         });
      }
    }
    setCurrentPath([]);
  };

  return (
    <div 
      className={cn(
        "absolute inset-0 z-[200]",
        isCurrentlyDrawingMode ? "pointer-events-auto" : "pointer-events-none"
      )}
      ref={containerRef}
    >
      <canvas 
        ref={canvasRef}
        className={cn(
          "w-full h-full cursor-crosshair",
          isCurrentlyDrawingMode ? "opacity-100" : "opacity-100"
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
