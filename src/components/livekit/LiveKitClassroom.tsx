"use client";

import React, { useState, useEffect } from "react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  useTracks,
  useLocalParticipant,
  useConnectionState
} from "@livekit/components-react";
import { Track, ConnectionState } from "livekit-client";
import { Loader2 } from "lucide-react";
import "@livekit/components-styles";
import { LiveKitPlayShellBridge } from "./LiveKitPlayShellBridge";
import { UniversalSyncProvider, useUniversalSync } from "./UniversalSyncProvider";
import { generateLiveKitToken, createLiveSession, stopLiveSession, recordAttendance, endCurrentLiveSession } from "@/app/actions/v5/livekit";
import { useParams } from "next/navigation";

function LiveKitAttendanceTracker({ classroomId, role }: { classroomId: string, role: "teacher" | "student" }) {
  const connectionState = useConnectionState();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
     let mounted = true;

     const handleConnection = async () => {
        if (connectionState === ConnectionState.Connected) {
           if (role === "teacher") {
              const sid = await createLiveSession(classroomId);
              if (mounted) setActiveSessionId(sid);
           } else {
              await recordAttendance(classroomId, "join");
           }
        } 
        else if (connectionState === ConnectionState.Disconnected) {
           if (role === "student") {
              await recordAttendance(classroomId, "leave");
           }
        }
     };

     handleConnection();

     return () => {
        mounted = false;
        // On unmount (tab close), try to send leave event
        if (connectionState === ConnectionState.Connected) {
           if (role === "student") {
              recordAttendance(classroomId, "leave").catch(() => {});
           }
        }
     };
  }, [connectionState, classroomId, role]);

  return null; // Headless component
}

export function LiveKitClassroomContainer({ classroomId }: { classroomId: string }) {
  const [token, setToken] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [role, setRole] = useState<"teacher" | "student">("student");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const resp = await generateLiveKitToken(classroomId);
        setToken(resp.token);
        setServerUrl(resp.serverUrl || "");
        setRole(resp.role as "teacher" | "student");
      } catch (err: any) {
        setError(err.message || "Failed to generate token");
      }
    })();
  }, [classroomId]);

  if (error) {
    return <div className="p-10 text-red-500 bg-red-100 rounded-lg">{error}</div>;
  }

  if (token === "") {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
        <p>Đang mượn chìa khóa phòng LiveKit...</p>
      </div>
    );
  }

  // Kết nối và kích hoạt Cấu hình phần cứng Audio/Video Tối thượng
  return (
    <LiveKitRoom
      video={true}
      audio={{
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2,
        sampleRate: 48000,
      }}
      connect={true}
      token={token}
      serverUrl={serverUrl}
      data-lk-theme="default"
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", backgroundColor: "#020617" }}
    >
      {/* Bộ máy ghi chép Session / Attendance */}
      <LiveKitAttendanceTracker classroomId={classroomId} role={role} />

      <UniversalSyncProvider role={role}>
        <ClassroomTopology />
      </UniversalSyncProvider>
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

// Thiết kế giao diện "Cánh Bướm"
function ClassroomTopology() {
  const { activeProjectId, activeProjectType } = useUniversalSync();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  // Nếu không có bài tập nào đang bật -> Toàn màn hình Video (Full Video Mode)
  if (!activeProjectId) {
    return (
      <div className="flex-1 w-full h-full bg-slate-900 relative">
        <VideoConference />
        <TeacherTestingControls />
      </div>
    );
  }

  // Khi có bài tập -> Kiến trúc "Cánh Bướm"
  return (
    <div className="flex w-full h-full bg-slate-950 transition-all duration-500 ease-in-out relative">
      <TeacherTestingControls />
      
      {/* Cột trái (30%): Rải dải Camera từ từ xuống (Picture in picture xếp chồng) */}
      <div className="w-[30%] lg:w-[25%] h-full p-2 flex flex-col gap-2 overflow-y-auto border-r border-slate-800">
        <GridLayout tracks={tracks} style={{ height: "100%" }}>
          <ParticipantTile />
        </GridLayout>
      </div>

      {/* Vùng phình phải (70%): Bảng vẽ / Bản nhạc */}
      <div className="flex-1 h-full relative bg-white dark:bg-slate-900 overflow-hidden shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
        <LiveKitPlayShellBridge projectId={activeProjectId} />
      </div>

    </div>
  );
}

// Bảng Menu Máy Chủ Host
function TeacherTestingControls() {
  const { broadcastPayload, role, canStudentDraw, setCanStudentDraw } = useUniversalSync();
  const [testProjectId, setTestProjectId] = useState<string>("");

  if (role !== "teacher") return null;

  const toggleStudentDraw = () => {
    const val = !canStudentDraw;
    setCanStudentDraw(val);
    broadcastPayload({ 
       type: "TOGGLE_STUDENT_DRAW", 
       canStudentDraw: val 
    });
  };

  const params = useParams();

  const closeRoomAndStop = async () => {
    // 1. Clear Document (Mở trang Null)
    broadcastPayload({ type: "CHANGE_DOC", projectId: undefined, projectType: undefined });
    
    // 2. Chém Session tận gốc rễ Drizzle
    const roomId = params.id as string;
    if (roomId) {
       await endCurrentLiveSession(roomId);
       alert("Đã đánh dấu Kết thúc Lớp học thành công!");
    }
  };

  return (
    <div className="absolute top-4 left-4 z-[250] flex gap-2 items-center bg-white/10 dark:bg-black/20 p-2 rounded-xl backdrop-blur-md border border-white/20">
      <input 
        value={testProjectId} 
        onChange={e => setTestProjectId(e.target.value)} 
        placeholder="Nhập ID Bài hát từ DB..." 
        className="px-3 py-2 rounded-lg bg-zinc-900/80 text-white placeholder:text-zinc-500 border border-zinc-700 outline-none focus:border-blue-500 w-48 text-sm"
      />
      <button 
        onClick={() => {
          if (!testProjectId) {
             alert("Vui lòng dán Project ID thực tế vào ô bên cạnh (có thể lụm từ URL lúc bâm vào bài ở Dashboard)!");
             return;
          }
          broadcastPayload({ type: "CHANGE_DOC", projectId: testProjectId, projectType: "musicxml" })
        }}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium shadow-lg text-sm"
      >
        Mở nhạc XML
      </button>
      <button 
        onClick={closeRoomAndStop}
        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium shadow-lg text-sm"
      >
        Đóng Bài Tập
      </button>

      <div className="w-[1px] h-10 bg-slate-700 mx-2" />

      <button
        onClick={toggleStudentDraw}
        className={`px-4 py-2 rounded-lg text-white font-medium shadow-lg transition-colors ${canStudentDraw ? "bg-green-600 hover:bg-green-500" : "bg-zinc-800 hover:bg-zinc-700"}`}
      >
        {canStudentDraw ? "Học sinh được Vẽ: ON" : "Học sinh được Vẽ: OFF"}
      </button>
    </div>
  );
}
