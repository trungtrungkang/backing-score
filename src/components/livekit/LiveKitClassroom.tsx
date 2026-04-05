"use client";

import React, { useState, useEffect } from "react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  useTracks,
  useConnectionState,
  ControlBar,
  LayoutContextProvider,
  Chat,
  useLayoutContext,
  useRoomContext,
  useParticipants
} from "@livekit/components-react";
import { Track, ConnectionState } from "livekit-client";
import { Loader2 } from "lucide-react";
import "@livekit/components-styles";
import { LiveKitPlayShellBridge } from "./LiveKitPlayShellBridge";
import { UniversalSyncProvider, useUniversalSync } from "./UniversalSyncProvider";
import { generateLiveKitToken, createLiveSession, stopLiveSession, recordAttendance, endCurrentLiveSession } from "@/app/actions/v5/livekit";
import { useParams } from "next/navigation";
import { listMyProjects, type ProjectDocument } from "@/lib/appwrite";
import { FolderHeart, Search, X, LogOut, Settings2, SlidersHorizontal, Users, MicOff, VideoOff, Mic, Video, MousePointer2, Pencil, Trash2 } from "lucide-react";

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

     const handleUnload = () => {
        if (connectionState === ConnectionState.Connected) {
           navigator.sendBeacon('/api/v5/livekit/beacon', JSON.stringify({
              classroomId,
              role
           }));
        }
     };
     window.addEventListener('beforeunload', handleUnload);

     return () => {
        mounted = false;
        window.removeEventListener('beforeunload', handleUnload);
         // On unmount (tab close or navigate away), try to send leave event
         if (connectionState === ConnectionState.Connected) {
            if (role === "student") {
               fetch('/api/v5/livekit/beacon', {
                 method: 'POST',
                 keepalive: true,
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ classroomId, role: "student" })
               }).catch(() => {});
            }
         }
     };
  }, [connectionState, classroomId, role]);

  return null; // Headless component
}

function GlobalAvatarInjector() {
  useEffect(() => {
    const interval = setInterval(() => {
      document.querySelectorAll('.lk-participant-tile').forEach(tile => {
         // Attempt to get name from UI element first, then fallback to attributes.
         let rawName = tile.querySelector('.lk-participant-name')?.textContent?.trim();
         if (!rawName) {
            rawName = tile.getAttribute('data-lk-participant-name') || tile.getAttribute('data-lk-participant-identity') || '?';
         }
         // Remove " (You)" suffix if present
         if (rawName.endsWith(' (You)')) {
            rawName = rawName.replace(' (You)', '');
         }
         const name = rawName;

         const placeholder = tile.querySelector('.lk-participant-placeholder');
         if (placeholder) {
             const existingAvatar = placeholder.querySelector('.custom-avatar-text');
             
             // Wait for name to resolve before injecting
             if (!existingAvatar && name && name !== '?') {
                 placeholder.setAttribute('data-avatar-injected', 'true');
                 const svg = placeholder.querySelector('svg');
                 if (svg) svg.style.display = 'none';
                 
                 const initial = name.slice(0, 2).toUpperCase();
                 let hash = 0;
                 for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
                 const color = `hsl(${Math.abs(hash % 360)}, 65%, 45%)`; // beautiful vibrant colors
                 
                 const div = document.createElement('div');
                 div.className = 'absolute inset-0 flex items-center justify-center bg-slate-900/90 backdrop-blur-md pointer-events-none transition-all';
                 div.style.zIndex = '1';
                 div.innerHTML = `<div class="custom-avatar-text w-20 h-20 sm:w-28 sm:h-28 rounded-full flex items-center justify-center text-3xl sm:text-4xl font-bold shadow-2xl tracking-widest border-4 border-white/10" style="background-color: ${color}; color: #ffffff;" data-resolved-name="${name}">${initial}</div>`;
                 placeholder.appendChild(div);
             } else if (existingAvatar && name && name !== '?') {
                 // If name dynamically updates later
                 const resolvedName = existingAvatar.getAttribute('data-resolved-name');
                 if (resolvedName !== name) {
                     const initial = name.slice(0, 2).toUpperCase();
                     let hash = 0;
                     for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
                     const color = `hsl(${Math.abs(hash % 360)}, 65%, 45%)`;
                     existingAvatar.setAttribute('data-resolved-name', name);
                     existingAvatar.textContent = initial;
                     (existingAvatar as HTMLElement).style.backgroundColor = color;
                 }
             }
         }
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);
  return null;
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
      onDisconnected={() => {
         window.location.href = window.location.pathname.replace('/live', '');
      }}
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", backgroundColor: "#020617" }}
    >
      <LiveKitAttendanceTracker classroomId={classroomId} role={role} />
      <GlobalAvatarInjector />

      <UniversalSyncProvider role={role}>
        {role === "teacher" && (
          <style>{`
            /* Ẩn nút Leave mặc định của LiveKit để tránh nhầm lẫn với End Class */
            .lk-disconnect-button {
               display: none !important;
            }
          `}</style>
        )}
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

  return (
    <LayoutContextProvider>
      <div className="flex flex-col w-full h-full bg-slate-900 transition-all duration-500 ease-in-out">
        
        {/* HEADER DOCK */}
        <div className="flex-none h-14 md:h-16 w-full border-b border-white/5 bg-slate-950 flex items-center justify-between px-3 md:px-6 z-[400] shadow-sm">
           <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm md:text-base flex items-center gap-2">
                 <div className="w-2.5 h-2.5 z-10 rounded-full bg-red-500 animate-pulse border border-red-400"></div> LIVE CLASSROOM
              </span>
           </div>
           
           <div className="flex items-center gap-1.5 md:gap-2">
              <TeacherTestingControls />
           </div>
        </div>

        {/* BODY (Video & Canvas) */}
        <div className="flex-1 min-h-0 flex flex-row relative">
          {!activeProjectId ? (
            <div className="flex-1 p-4 bg-slate-900">
              <GridLayout tracks={tracks} style={{ height: "100%" }}>
                <ParticipantTile />
              </GridLayout>
            </div>
          ) : (
            <>
              {/* Cột trái (Video) */}
              <div className="w-[30%] lg:w-[25%] h-full p-2 flex flex-col gap-2 overflow-y-auto border-r border-slate-800/50 bg-black/40">
                <GridLayout tracks={tracks} style={{ height: "100%" }}>
                  <ParticipantTile />
                </GridLayout>
              </div>

              {/* Vùng phải (Bảng vẽ / Bản nhạc) */}
              <div className="flex-1 h-full relative bg-white dark:bg-slate-950 overflow-hidden shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
                <LiveKitPlayShellBridge projectId={activeProjectId} />
              </div>

              <StudentSyncSettings />
            </>
          )}
          
          <ChatOverlay />
        </div>

        {/* FOOTER DOCK (LiveKit Controls) */}
        <div className="flex-none h-[72px] w-full border-t border-white/5 bg-slate-950 flex items-center justify-center z-[400] shadow-2xl relative">
           <ControlBar controls={{ chat: true, settings: false }} />
        </div>

      </div>
    </LayoutContextProvider>
  );
}

// Bảng Chat Nổi (Ẩn/Hiện theo công tắc trên ControlBar)
function ChatOverlay() {
  const layoutContext = useLayoutContext();
  if (!layoutContext?.widget?.state?.showChat) return null;
  return (
    <div className="absolute top-4 right-4 bottom-24 w-[350px] z-[400] shadow-2xl rounded-2xl overflow-hidden animate-in slide-in-from-right-8 duration-300">
      <Chat />
    </div>
  );
}

// Bảng Menu Máy Chủ Host
function TeacherTestingControls() {
  const { broadcastPayload, role, canStudentDraw, setCanStudentDraw, activeProjectId, activeProjectType, isDrawingMode, setIsDrawingMode, drawingColor, setDrawingColor, clearDrawings } = useUniversalSync();
  const [showDrive, setShowDrive] = useState(false);
  const [localSpeakerMuted, setLocalSpeakerMuted] = useState(() => !!(window as any).__localSpeakerMuted);
  const params = useParams();

  if (role !== "teacher") return null;

  const toggleStudentDraw = () => {
    const val = !canStudentDraw;
    setCanStudentDraw(val);
    broadcastPayload({ 
       type: "TOGGLE_STUDENT_DRAW", 
       canStudentDraw: val 
    });
  };

  const room = useRoomContext();
  const participants = useParticipants();
  const [showStudents, setShowStudents] = useState(false);

  const students = participants.filter(p => p.identity !== room?.localParticipant?.identity);

  const handleMuteStudent = (identity: string, type: "MUTE_MIC" | "MUTE_CAM") => {
     broadcastPayload({ type: "MODERATE", moderateAction: type, targetIdentity: identity });
  };

  const closeRoomAndStop = async () => {
    broadcastPayload({ type: "END_CLASS" });
    const roomId = params.id as string;
    
    // Đợi một khoảng để gói tin END_CLASS kịp bay sang các máy học sinh trước khi rút dây mạng
    if (roomId) {
       await new Promise(r => setTimeout(r, 600));
       await endCurrentLiveSession(roomId);
       if (room) {
          room.disconnect();
       }
       window.location.href = window.location.pathname.replace('/live', '');
    }
  };

  return (
    <>
      <div className="flex gap-1.5 items-center transition-all bg-slate-800/50 p-1.5 rounded-xl border border-white/5">
        <button 
          onClick={() => setShowDrive(true)}
          className="px-4 py-2 hover:bg-slate-800 rounded-full text-zinc-300 hover:text-white font-medium text-sm flex items-center gap-2 transition-colors"
        >
          <FolderHeart className="w-4 h-4 text-indigo-400" />
          <span className="hidden md:inline">Sheet Music</span>
        </button>

        <div className="w-[1px] h-6 bg-white/20 mx-1" />
        <button 
          onClick={() => setShowStudents(!showStudents)}
          className="px-4 py-2 hover:bg-slate-800 rounded-full text-zinc-300 hover:text-white font-medium text-sm flex items-center gap-2 transition-colors relative"
        >
          <Users className="w-4 h-4 text-emerald-400" />
          <span className="hidden md:inline">Thành viên ({students.length})</span>
        </button>

        {showStudents && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-[400]">
             <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 mb-2">
                <h3 className="font-bold text-sm text-white">Quản lý lớp học</h3>
                <button onClick={() => setShowStudents(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
             </div>
             <div className="max-h-64 overflow-auto space-y-1">
                {students.length === 0 ? (
                   <p className="text-zinc-500 text-xs text-center py-4">Chưa có học sinh nào.</p>
                ) : students.map(student => (
                   <div key={student.identity} className="flex items-center justify-between p-2 hover:bg-slate-800 rounded-xl transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                         <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[10px] font-bold">
                            {student.name?.slice(0,2).toUpperCase() || "?"}
                         </div>
                         <span className="text-xs text-zinc-300 font-medium truncate max-w-[100px]">{student.name}</span>
                      </div>
                      <div className="flex gap-1">
                         <button onClick={() => handleMuteStudent(student.identity, "MUTE_MIC")} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors" title="Tắt Mic học sinh này">
                           <MicOff className="w-3.5 h-3.5" />
                         </button>
                         <button onClick={() => handleMuteStudent(student.identity, "MUTE_CAM")} className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 rounded-lg transition-colors" title="Tắt Camera học sinh này">
                           <VideoOff className="w-3.5 h-3.5" />
                         </button>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        )}

        {activeProjectId && (
          <>
            <div className="w-[1px] h-6 bg-white/20 mx-1" />
            <button 
              onClick={() => broadcastPayload({ type: "CHANGE_DOC", projectId: undefined, projectType: undefined })}
              className="px-4 py-2 hover:bg-slate-800 rounded-full text-zinc-300 hover:text-white font-medium text-sm flex items-center gap-2 transition-colors"
              title="Ngừng chia sẻ tài liệu (Trở về chế độ Video)"
            >
              <X className="w-4 h-4 text-orange-400" />
              <span className="hidden md:inline">Stop Share</span>
            </button>

            <div className="w-[1px] h-6 bg-white/20 mx-1" />
            <button 
              onClick={() => {
                const newVal = !localSpeakerMuted;
                (window as any).__localSpeakerMuted = newVal;
                setLocalSpeakerMuted(newVal);
                window.dispatchEvent(new CustomEvent('mute-local-speaker', { detail: newVal }));
              }}
              className={`px-4 py-2 rounded-full font-medium text-sm flex items-center gap-2 transition-colors ${
                localSpeakerMuted ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "hover:bg-slate-800 text-zinc-300 hover:text-white"
              }`}
              title="Tắt tiếng xuất ra Loa máy tính giáo viên (Không ảnh hưởng học sinh)"
            >
              {localSpeakerMuted ? (
                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"/> Speaker: OFF</span>
              ) : (
                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-400"/> Speaker: ON</span>
              )}
            </button>
          </>
        )}

        {activeProjectType !== "musicxml" && (
          <>
            <div className="w-[1px] h-6 bg-white/20 mx-1 md:mx-2" />

            <div className="hidden lg:flex items-center gap-1 bg-white/10 rounded-full p-1 mr-1">
              <button 
                onClick={() => setIsDrawingMode(false)}
                className={`p-1.5 rounded-full transition-colors ${!isDrawingMode ? "bg-blue-500 text-white" : "text-zinc-400 hover:text-white hover:bg-slate-800"}`}
                title="Con trỏ Chuột bản địa"
              >
                <MousePointer2 className="w-4 h-4" />
              </button>
              
              <button 
                onClick={() => setIsDrawingMode(true)}
                className={`p-1.5 rounded-full transition-colors ${isDrawingMode ? "bg-rose-500 text-white" : "text-zinc-400 hover:text-white hover:bg-slate-800"}`}
                title="Bút vẽ"
              >
                <Pencil className="w-4 h-4" />
              </button>

              {isDrawingMode && (
                <div className="flex items-center gap-1 px-1">
                  {["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7"].map(c => (
                    <button 
                      key={c}
                      onClick={() => setDrawingColor(c)}
                      className={`w-4 h-4 rounded-full border-2 transition-transform ${drawingColor === c ? "scale-125 border-white" : "border-transparent hover:scale-110"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              )}

              <div className="w-[1px] h-4 bg-white/20 mx-1" />

              <button 
                onClick={clearDrawings}
                className="p-1.5 rounded-full text-zinc-400 hover:text-red-400 hover:bg-red-500/20 transition-colors"
                title="Xoá toàn bộ bảng vẽ"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>


          </>
        )}

        <div className="w-[1px] h-6 bg-white/20 mx-1" />

        <button 
          onClick={closeRoomAndStop}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-full text-white font-medium text-sm flex items-center gap-2 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)]"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">End Class</span>
        </button>
      </div>

      <div className={showDrive ? "block" : "hidden"}>
        <MyDriveModal 
          onClose={() => setShowDrive(false)} 
          onSelect={(id, type) => {
             broadcastPayload({ type: "CHANGE_DOC", projectId: id, projectType: type });
             setShowDrive(false);
          }} 
        />
      </div>
    </>
  );
}

// Bảng Menu Cài đặt Audio-Visual Delay cho Học Sinh
function StudentSyncSettings() {
  const { role, visualSyncDelay, setVisualSyncDelay, activeProjectId } = useUniversalSync();
  const [isOpen, setIsOpen] = useState(false);

  if (role !== "student" || !activeProjectId) return null;

  return (
    <div className="absolute bottom-4 left-4 z-[300] flex flex-col gap-2">
      {isOpen && (
        <div className="bg-slate-900/90 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl origin-bottom-left animate-in fade-in zoom-in w-64">
           <h4 className="text-white text-sm font-semibold flex items-center gap-2 mb-3">
             <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
             A/V Sync Settings
           </h4>
           <div className="space-y-4">
              <div>
                 <div className="flex justify-between text-xs text-slate-400 font-medium mb-1.5">
                    <span>Visual Delay</span>
                    <span className={visualSyncDelay > 0 ? "text-emerald-400 font-bold" : ""}>{visualSyncDelay}ms</span>
                 </div>
                 <input 
                    type="range" 
                    min="0" 
                    max="1000" 
                    step="50"
                    value={visualSyncDelay}
                    onChange={(e) => setVisualSyncDelay(Number(e.target.value))}
                    className="w-full cursor-pointer accent-emerald-500 bg-slate-800 rounded-full h-1.5 appearance-none"
                 />
                 <p className="text-[10px] text-slate-500 mt-2 leading-tight">
                    Adjust this if the highlighted notes jump too quickly before you hear the teacher's piano playing.
                 </p>
              </div>
           </div>
        </div>
      )}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-2 rounded-full font-medium text-sm flex items-center gap-2 shadow-lg transition-colors w-max
          ${isOpen ? 'bg-emerald-600 text-white' : 'bg-slate-800/80 text-zinc-300 hover:bg-slate-700 hover:text-white border border-white/5 backdrop-blur-md'}
        `}
      >
        <Settings2 className="w-4 h-4" />
        <span className="hidden sm:inline">Sync Offset</span>
      </button>
    </div>
  );
}

function MyDriveModal({ onClose, onSelect }: { onClose: () => void, onSelect: (id: string, type: "pdf" | "musicxml") => void }) {
  const [projects, setProjects] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listMyProjects().then(res => {
       setProjects(res || []);
       setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = projects.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
       <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/50">
             <h2 className="text-xl font-bold flex items-center gap-2"><FolderHeart className="text-indigo-400 w-6 h-6" /> MyDrive</h2>
             <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
          </div>
          <div className="p-4 border-b border-slate-800 bg-slate-900">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search your sheet music..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
             </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 bg-slate-950/50 scrollbar-hide">
             {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
             ) : projects.length === 0 ? (
                <div className="text-center py-20 text-slate-500">Your Drive is empty. Upload MusicXML from dashboard first.</div>
             ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-slate-500">No results found for "{search}"</div>
             ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {filtered.map(p => {
                      let type: "musicxml" | "pdf" = "musicxml";
                      try {
                         const payload = typeof p.payload === 'string' ? JSON.parse(p.payload) : p.payload || {};
                         // Also check standard properties
                         if (payload.notationData?.type === "pdf" || (p as any).projectType === "sheet_music") {
                            type = "pdf";
                         }
                      } catch(e) {}

                      return (
                         <button 
                           key={p.$id} 
                           onClick={() => onSelect(p.$id, type)}
                           className="flex flex-col text-left p-4 rounded-xl border border-slate-800 bg-slate-900 shadow-sm hover:border-indigo-500 hover:shadow-indigo-500/20 hover:-translate-y-0.5 transition-all group"
                         >
                            <h3 className="font-semibold text-white truncate max-w-full group-hover:text-indigo-400 transition-colors">{p.name || "Untitled Score"}</h3>
                            <span className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                               <span className={type === "pdf" ? "w-2 h-2 rounded-full bg-rose-500/50" : "w-2 h-2 rounded-full bg-indigo-500/50"}></span>
                               {type === "pdf" ? "PDF Document" : "MusicXML Score"}
                            </span>
                         </button>
                      );
                   })}
                </div>
             )}
          </div>
       </div>
    </div>
  );
}
