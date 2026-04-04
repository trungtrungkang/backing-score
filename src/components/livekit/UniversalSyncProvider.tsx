"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useRoomContext, useDataChannel } from "@livekit/components-react";

export type SyncPayload = {
  type: "SYNC_PDF" | "SYNC_XML" | "CHANGE_DOC" | "HEARTBEAT" | "DRAWING" | "TOGGLE_STUDENT_DRAW";
  timestamp: number;
  senderId: string;
  projectId?: string;
  projectType?: "pdf" | "musicxml";
  pdfCoords?: any;
  xmlCoords?: { measure?: number; beat?: number; tempo?: number; isPlaying: boolean; positionMs: number };
  action?: string;
  points?: any;
  color?: string;
  canStudentDraw?: boolean;
};

interface SyncState {
  role: string;
  isAutoSyncEnabled: boolean;
  canStudentDraw: boolean;
  activeProjectId: string | null;
  activeProjectType: "pdf" | "musicxml" | null;
  latestPdfCoordinates: { pageIndex: number; scrollY: number } | null;
  latestXmlCoordinates: { measure?: number; beat?: number; tempo?: number; isPlaying: boolean; positionMs: number } | null;
  drawings: any[];
}

interface SyncContextValue extends SyncState {
  setAutoSync: (val: boolean) => void;
  setCanStudentDraw: (val: boolean) => void;
  syncToHost: () => void;
  broadcastPayload: (payload: Partial<SyncPayload>) => void;
  broadcastDrawing: (action: string, points?: any, color?: string) => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function useUniversalSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useUniversalSync must be inside UniversalSyncProvider");
  return ctx;
}

export function UniversalSyncProvider({ children, role }: { children: React.ReactNode, role: "teacher" | "student" }) {
  const room = useRoomContext();
  
  const [isAutoSyncEnabled, setAutoSync] = useState(true);
  const [canStudentDraw, setCanStudentDraw] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProjectType, setActiveProjectType] = useState<"pdf" | "musicxml" | null>(null);
  
  const [latestPdfCoordinates, setPdfCoordinates] = useState<any>(null);
  const [latestXmlCoordinates, setXmlCoordinates] = useState<any>(null);
  const [drawings, setDrawings] = useState<any[]>([]);

  // Bắt gói tin gửi tới từ LiveKit DataChannel
  const onMessage = useCallback((msgMsg: any) => {
    try {
      // Trong LiveKit Components V2, dữ liệu byte được bọc trong msg.payload
      const rawData = msgMsg.payload || msgMsg;
      let decodedStr = "";
      
      if (rawData instanceof Uint8Array) {
        decodedStr = new TextDecoder().decode(rawData);
      } else if (typeof rawData === "string") {
        decodedStr = rawData;
      }
      
      const payload: SyncPayload = JSON.parse(decodedStr);
      
      if (payload.type === "CHANGE_DOC") {
        setActiveProjectId(payload.projectId ?? null);
        setActiveProjectType(payload.projectType ?? null);
        // Reset tranh vẽ
        setDrawings([]);
      }

      // Lắng nghe Phân quyền Vẽ cho Học sinh
      if (payload.type === "TOGGLE_STUDENT_DRAW") {
        setCanStudentDraw(payload.canStudentDraw ?? false);
      }

      // Xử lý gói Data Tọa độ (Chỉ nhận nếu đang AutoSync hoặc gặp Heartbeat force)
      if (payload.type === "HEARTBEAT" || isAutoSyncEnabled) {
        if (payload.type === "SYNC_PDF" || (payload.type === "HEARTBEAT" && payload.pdfCoords)) {
          setPdfCoordinates(payload.pdfCoords || payload);
        }
        if (payload.type === "SYNC_XML" || (payload.type === "HEARTBEAT" && payload.xmlCoords)) {
          setXmlCoordinates(payload.xmlCoords || payload);
        }
      }

      // Xử lý Nét vẽ
      if (payload.type === "DRAWING") {
        if (payload.action === "CLEAR") {
          setDrawings([]);
        } else {
          setDrawings(prev => [...prev, payload]);
        }
      }

    } catch (err) {
      console.error("Failed to decode SyncPayload", err);
    }
  }, [isAutoSyncEnabled]);

  const { send } = useDataChannel("music-sync", onMessage);

  // Cơ chế Host đóng gói broadcast xuống lớp
  const broadcastPayload = useCallback((data: Partial<SyncPayload>) => {
    if (role !== "teacher" || !room) return;
    
    // 1. Cập nhật Local State cho chính Thầy giáo phản ứng
    if (data.type === "CHANGE_DOC") {
        setActiveProjectId(data.projectId ?? null);
        setActiveProjectType(data.projectType ?? null);
        setDrawings([]);
    }
    if (data.type === "TOGGLE_STUDENT_DRAW") {
        setCanStudentDraw(data.canStudentDraw ?? false);
    }

    // 2. Broadcast đi cho Học sinh
    const finalPayload = {
      ...data,
      timestamp: Date.now(),
      senderId: room.localParticipant.identity
    };
    send(new TextEncoder().encode(JSON.stringify(finalPayload)), { reliable: data.type === "CHANGE_DOC" || data.type === "DRAWING" || data.type === "TOGGLE_STUDENT_DRAW" });
  }, [send, role, room]);

  const broadcastDrawing = useCallback((action: string, points?: any, color?: string) => {
    broadcastPayload({
      type: "DRAWING",
      action,
      points,
      color
    });
  }, [broadcastPayload]);

  const syncToHost = useCallback(() => {
    setAutoSync(true);
    // Nếu có Heartbeat xót lại trong Cache thì gọi ngay lập tức ra
  }, []);

  // Teacher ngầm gửi Heartbeat cứ mỗi 3 giây
  useEffect(() => {
    if (role !== "teacher") return;
    const interval = setInterval(() => {
       broadcastPayload({
         type: "HEARTBEAT",
         projectId: activeProjectId ?? undefined,
         projectType: activeProjectType ?? undefined,
         pdfCoords: latestPdfCoordinates,
         xmlCoords: latestXmlCoordinates
       });
    }, 3000);
    return () => clearInterval(interval);
  }, [role, broadcastPayload, activeProjectId, activeProjectType, latestPdfCoordinates, latestXmlCoordinates]);

  return (
    <SyncContext.Provider value={{
      role,
      isAutoSyncEnabled,
      canStudentDraw,
      activeProjectId,
      activeProjectType,
      latestPdfCoordinates,
      latestXmlCoordinates,
      drawings,
      setAutoSync,
      setCanStudentDraw,
      syncToHost,
      broadcastPayload,
      broadcastDrawing
    }}>
      {children}
    </SyncContext.Provider>
  );
}
