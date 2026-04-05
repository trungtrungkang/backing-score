"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useRoomContext, useDataChannel, useConnectionState } from "@livekit/components-react";
import { LocalAudioTrack, Track, ConnectionState } from "livekit-client";
import { toast } from "sonner";

export type SyncPayload = {
  type: "SYNC_PDF" | "SYNC_XML" | "CHANGE_DOC" | "HEARTBEAT" | "DRAWING" | "TOGGLE_STUDENT_DRAW" | "MODERATE" | "END_CLASS";
  timestamp: number;
  senderId: string;
  projectId?: string;
  projectType?: "pdf" | "musicxml";
  pdfCoords?: any;
  xmlCoords?: { measure?: number; beat?: number; tempo?: number; isPlaying: boolean; positionMs: number; anchorMeasureId?: string };
  action?: string;
  points?: any;
  color?: string;
  pageIndex?: number;
  canStudentDraw?: boolean;
  moderateAction?: "MUTE_MIC" | "MUTE_CAM";
  targetIdentity?: string;
};

interface SyncState {
  role: string;
  isAutoSyncEnabled: boolean;
  canStudentDraw: boolean;
  activeProjectId: string | null;
  activeProjectType: "pdf" | "musicxml" | null;
  latestPdfCoordinates: { pageIndex: number; scrollY: number } | null;
  latestXmlCoordinates: { measure?: number; beat?: number; tempo?: number; isPlaying: boolean; positionMs: number; anchorMeasureId?: string } | null;
  drawings: any[];
  isDrawingMode: boolean;
  drawingColor: string;
}

interface SyncContextValue extends SyncState {
  setAutoSync: (val: boolean) => void;
  setCanStudentDraw: (val: boolean) => void;
  syncToHost: () => void;
  broadcastPayload: (payload: Partial<SyncPayload>) => void;
  broadcastDrawing: (action: string, points?: any, color?: string, pageIndex?: number) => void;
  visualSyncDelay: number;
  setVisualSyncDelay: (val: number) => void;
  setIsDrawingMode: (val: boolean) => void;
  setDrawingColor: (color: string) => void;
  clearDrawings: () => void;
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
  
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingColor, setDrawingColor] = useState("#ef4444");

  const clearDrawings = useCallback(() => {
    const p = { type: "DRAWING", action: "CLEAR", senderId: room?.localParticipant?.identity || "unknown", timestamp: Date.now() } as const;
    if (room?.localParticipant) {
      const dataStr = JSON.stringify(p);
      room.localParticipant.publishData(new TextEncoder().encode(dataStr), { reliable: true });
    }
    setDrawings([]);
  }, [room]);
  
  // Trạng thái bù trừ trễ hình ảnh (Jitter Compensation) - Mặc định 350ms 
  const [visualSyncDelay, setVisualSyncDelay] = useState(350);

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

      // Xử lý Kiểm duyệt (Mute Mic/Cam từ Teacher)
      if (payload.type === "MODERATE" && payload.targetIdentity === room?.localParticipant?.identity) {
         if (payload.moderateAction === "MUTE_MIC") {
            room.localParticipant.setMicrophoneEnabled(false);
            toast("Giáo viên đã tắt Microphone của bạn.", { id: "teacher-mute-mic" });
         } else if (payload.moderateAction === "MUTE_CAM") {
            room.localParticipant.setCameraEnabled(false);
            toast("Giáo viên đã tắt Camera của bạn.", { id: "teacher-mute-cam" });
         }
      }

      // Xử lý Lớp học kết thúc
      if (payload.type === "END_CLASS") {
         toast.info("Giáo viên đã kết thúc buổi học.", { id: "end-class-student" });
         if (room) room.disconnect();
         setTimeout(() => {
            window.location.href = window.location.pathname.replace('/live', '');
         }, 1500);
      }

        // Xử lý gói Data Tọa độ (Chỉ nhận nếu đang AutoSync hoặc gặp Heartbeat force)
      if (payload.type === "HEARTBEAT" || isAutoSyncEnabled) {
        if (payload.type === "SYNC_PDF" || (payload.type === "HEARTBEAT" && payload.pdfCoords)) {
          setPdfCoordinates(payload.pdfCoords || payload);
        }
        if (payload.type === "SYNC_XML" || (payload.type === "HEARTBEAT" && payload.xmlCoords)) {
          // Bù trừ Jitter Buffer của LiveKit Audio (Tính theo biến cấu hình)
          // Data Channel đi quá nhanh (UDP), trong khi Audio đi chậm hơn. Nếu không delay, UI sẽ nhảy trước khi có tiếng.
          if (role === "student" && visualSyncDelay > 0) {
             setTimeout(() => {
                setXmlCoordinates(payload.xmlCoords || payload);
             }, visualSyncDelay);
          } else {
             setXmlCoordinates(payload.xmlCoords || payload);
          }
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
  }, [isAutoSyncEnabled, role, visualSyncDelay]);

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
    if (data.type === "SYNC_XML") {
        setXmlCoordinates(data.xmlCoords || data);
    }
    if (data.type === "DRAWING") {
        if (data.action === "CLEAR") {
           setDrawings([]);
        } else {
           setDrawings(prev => [...prev, data as SyncPayload]);
        }
    }

    // 2. Broadcast đi cho Học sinh
    const finalPayload = {
      ...data,
      timestamp: Date.now(),
      senderId: room.localParticipant.identity
    };
    send(new TextEncoder().encode(JSON.stringify(finalPayload)), { reliable: data.type === "CHANGE_DOC" || data.type === "DRAWING" || data.type === "TOGGLE_STUDENT_DRAW" });
  }, [send, role, room]);

  const broadcastDrawing = useCallback((action: string, points?: any, color?: string, pageIndex?: number) => {
    broadcastPayload({
      type: "DRAWING",
      action,
      points,
      color,
      pageIndex
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

  // Bộ thu bắt Web Audio Track bắn lên từ máy của Giáo viên để LiveStream nhạc sạch
  const publishedSysAudioRef = useRef<any>(null);
  const connectionState = useConnectionState();
  
  useEffect(() => {
    if (role !== "teacher" || !room || connectionState !== ConnectionState.Connected) return;
    
    const handleSysAudio = async (msTrack: MediaStreamTrack) => {
       if (msTrack && room.localParticipant) {
          try {
             // Nếu đã từng publish, gỡ nó ra trước
             if (publishedSysAudioRef.current && room.state === ConnectionState.Connected) {
                await room.localParticipant.unpublishTrack(publishedSysAudioRef.current).catch(() => {});
             }
             if (room.state !== ConnectionState.Connected) return;

             const pub = await room.localParticipant.publishTrack(msTrack, { name: "system-audio", source: Track.Source.ScreenShareAudio });
             publishedSysAudioRef.current = pub;
             console.log("X-SYS-AUDIO: Web Audio Stream successfully hooked into LiveKit!", msTrack);
             toast.success("High-Fidelity Audio Sync Active!", { id: "sys-audio-hook", description: "Bài hát sẽ truyền qua đường âm thanh chất lượng cao." });
          } catch (err) {
             console.error("X-SYS-AUDIO Hook failed:", err);
             toast.error("Audio Hook Failed", { id: "sys-audio-hook-err", description: "Không thể nhúng luồng âm thanh vào LiveKit." });
          }
       }
    };

    // Quét tìm xem Audio Track đã được sinh ra trước khi hook này kịp chạy hay không (Race Condition)
    if ((window as any).__livekitSystemAudioTrack) {
       handleSysAudio((window as any).__livekitSystemAudioTrack);
    }

    const onEventFired = (e: any) => handleSysAudio(e.detail);
    window.addEventListener('livekit-system-audio-ready', onEventFired);
    return () => {
       window.removeEventListener('livekit-system-audio-ready', onEventFired);
    };
  }, [role, room, connectionState]);

  return (
    <SyncContext.Provider value={{
      role,
      isAutoSyncEnabled,
      setAutoSync,
      canStudentDraw,
      setCanStudentDraw,
      activeProjectId,
      activeProjectType,
      latestPdfCoordinates,
      latestXmlCoordinates,
      drawings,
      syncToHost,
      broadcastPayload,
      broadcastDrawing,
      visualSyncDelay,
      setVisualSyncDelay,
      isDrawingMode,
      setIsDrawingMode,
      drawingColor,
      setDrawingColor,
      clearDrawings
    }}>
      {children}
    </SyncContext.Provider>
  );
}
