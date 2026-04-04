"use client";
import { useState, useRef, useEffect, useMemo } from "react";

import { MusicXMLVisualizer } from "@/components/editor/MusicXMLVisualizer";
import { useScoreEngine } from "@/hooks/useScoreEngine";
import type { DAWPayload, TrackBase } from "@/lib/daw/types";
import { Play, Pause, Square, Mic, Piano, Maximize, Minimize, Settings2, Terminal, Music, Maximize2, Minimize2, Keyboard, SlidersHorizontal, Bell } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useGamification } from "@/components/editor/GamificationProvider";
import confetti from "canvas-confetti";
import { revalidateProgressCache } from "@/app/actions/progress";
import { saveWaitModeScore } from "@/app/actions/v5/lessons";
import { createPost } from "@/lib/appwrite/social";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
export interface SnippetPlayerProps {
  payload: DAWPayload;
  zoom?: number;
  snippetId?: string;
  practiceRequired?: boolean;
}

export function SnippetPlayer({ payload, zoom = 40, snippetId, practiceRequired = true }: SnippetPlayerProps) {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark" || resolvedTheme === "system";

  const gami = useGamification();
  const playerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMidiDialog, setShowMidiDialog] = useState(false);
  const [isInitializingMidi, setIsInitializingMidi] = useState(false);
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      if (playerRef.current) {
        await playerRef.current.requestFullscreen().catch(err => console.error("Error attempting to enable fullscreen:", err));
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    }
  };

  const handleWaitModeComplete = async (score?: number) => {
    // Only execute Learner gamification if inside a valid Student Context (not Creator mode)
    if (!gami || gami.readOnly) return;

    // Fire visual gamification exactly when the Engine hits the final physical chord boundary
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b']
    });

    try {
      const clampedScore = Math.max(0, Math.min(100, score ?? 100));
      const { progressDoc, justUnlocked } = await saveWaitModeScore(
        gami.userId, 
        gami.courseId, 
        gami.lessonId, 
        clampedScore,
        snippetId,
        gami.totalSnippets
      );
      
      // If we just unlocked the WHOLE lesson after satisfying the totalSnippets threshold
      if (justUnlocked) {
        try {
          await createPost({
            content: `🔥 I just shredded through Wait Mode and conquered Lesson ${gami.lessonId}!`,
            attachmentType: "none"
          });
        } catch (e) {
          console.error("Community Feed Gamification Silent Failure:", e);
        }

        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
        });
      }

      await revalidateProgressCache();

      toast.success(
         justUnlocked ? "Module Passed! 🎉 All snippets completed." : "Snippet Tracked! Keep playing the others.", 
         { style: { background: '#10b981', color: '#fff', border: 'none' } }
      );
      if (justUnlocked) {
        if (gami.isLastLesson) {
          toast.success("Course Completed! 🏆 You have finished the entire curriculum.");
        } else {
          toast.success("Node Unlocked: You can now access the next lesson!");
        }
      }
    } catch (err) {
      console.error("Wait Mode submission failed:", err);
      toast.error("Could not sync progression directly to Appwrite Server.");
    }
  };

  const { state, refs, actions } = useScoreEngine({
    payload,
    onPracticeComplete: handleWaitModeComplete
  });

  const scoreFileId = payload.notationData?.fileId;

  const displayTracks = useMemo(() => {
    const tracks = state.isMidiMode ? [] : [...payload.audioTracks];
    const autoUnmuteScoreSynth = tracks.length === 0 && !state.isWaitMode;

    if (scoreFileId && !state.isAudioMode) {
      tracks.push({
        id: "score-midi",
        name: "Score Synth (Piano)",
        type: "midi",
        muted: autoUnmuteScoreSynth ? false : (payload.metadata?.scoreSynthMuted ?? false),
        solo: payload.metadata?.scoreSynthSolo ?? false,
        volume: payload.metadata?.scoreSynthVolume ?? 1.0,
        pan: 0,
        offsetMs: payload.metadata?.scoreSynthOffsetMs ?? 0,
      });
    }
    return tracks;
  }, [payload.audioTracks, scoreFileId, payload.metadata, state.isWaitMode, state.isMidiMode, state.isAudioMode]);

  return (
    <div
      ref={playerRef}
      className={`w-full flex flex-col bg-[#fdfdfc] dark:bg-[#1A1A1E] relative ${isFullscreen ? "w-screen h-screen overflow-hidden border-none rounded-none m-0" : "border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden my-4 shadow-sm"}`}
    >
      <div className={`relative z-0 overflow-hidden bg-white dark:bg-[#121214] transition-all duration-300 ease-in-out ${isFullscreen ? "flex-1 min-h-0" : isExpanded ? "h-[500px] border-b border-blue-500/20" : "h-[250px]"}`}>
        {/* Modality Badge */}
        {!isFullscreen && (
          <div className={`absolute top-4 left-4 z-[10] flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase shadow-sm border backdrop-blur-md ${practiceRequired ? 'bg-blue-50/90 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800' : 'bg-green-50/90 dark:bg-green-900/40 border-green-200 dark:border-green-800'}`}>
            {practiceRequired ? (
               <><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-[pulse_2s_ease-in-out_infinite]"></span><span className="text-blue-600 dark:text-blue-400">PRACTICE REQUIRED</span></>
            ) : (
               <><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span><span className="text-green-600 dark:text-green-400">LISTEN ONLY</span></>
            )}
          </div>
        )}

        {/* Headless MIDI Player Fallback */}
        {state.stretchedMidiBase64 && (
          <div className="hidden">
            <midi-player
              ref={refs.midiPlayerRef}
              src={state.stretchedMidiBase64}
              sound-font="https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus"
            />
          </div>
        )}

        {scoreFileId ? (
          <MusicXMLVisualizer
            scoreFileId={scoreFileId}
            positionMs={state.positionMs}
            isPlaying={state.isPlaying}
            timemap={(state.isWaitMode && state.correctedTimemap) ? state.correctedTimemap : (payload.notationData?.timemap || [])}
            timemapSource={payload.notationData?.timemapSource}
            payloadTempo={payload.metadata?.tempo || 120}
            measureMap={payload.notationData?.measureMap}
            onSeek={actions.handleSeek}
            onMidiExtracted={actions.handleMidiExtracted}
            isDarkMode={isDarkMode}
            isWaitMode={state.isWaitMode}
            isWaiting={state.isWaiting}
            practiceTrackIds={state.practiceTrackIds}
            defaultScale={isFullscreen ? zoom + 20 : zoom}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-400">
            <p>No score available for this snippet.</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 relative z-50">
        <div className="flex items-center gap-3">
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              state.isPlaying ? actions.handlePause() : actions.handlePlay();
            }}
            disabled={state.loadingAudio}
            className={`flex items-center justify-center w-10 h-10 rounded-full shadow-sm transition-colors ${state.loadingAudio
              ? "bg-zinc-300 dark:bg-zinc-700 text-zinc-500 cursor-not-allowed"
              : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
          >
            {state.isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5 ml-1" fill="currentColor" />}
          </button>

          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              actions.handlePause();
              actions.handleSeek(0);
            }}
            disabled={state.loadingAudio}
            className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${state.loadingAudio
              ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
              : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400"
              }`}
            title="Stop & Rewind"
          >
            <Square className="w-4 h-4" fill="currentColor" />
          </button>

          <div className="text-xs text-zinc-500 font-mono tracking-wider">
            {Math.floor(state.positionMs / 1000)}s / {Math.floor(state.totalSongDurationMs / 1000)}s
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Fullscreen Native Toggle */}
          <button
            onClick={toggleFullscreen}
            className="px-2 py-1.5 rounded-md text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all ml-1"
            title={isFullscreen ? "Thoát toàn màn hình (Exit Fullscreen)" : "Toàn màn hình (Fullscreen Native)"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Expand/Collapse Inline Toggle */}
          {!isFullscreen && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-2 py-1.5 rounded-md text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all"
              title={isExpanded ? "Thu nhỏ chiều dọc (Collapse)" : "Mở rộng chiều dọc (Expand)"}
            >
              {isExpanded ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          )}

          {/* Wait Mode Popover / Fullscreen Toggle */}
          {practiceRequired && (
            isFullscreen ? (
              <div className="relative flex items-center">
              <button
                onClick={() => {
                  actions.setPracticeModeType('none');
                  actions.handleStop(true);
                  if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
                  setShowFullscreenWarning(true);
                  warningTimeoutRef.current = setTimeout(() => setShowFullscreenWarning(false), 3000);
                }}
                className={`h-8 px-3 flex shrink-0 whitespace-nowrap items-center gap-2 rounded-md border text-xs font-bold tracking-wider transition-all ${state.practiceModeType !== 'none' ? "bg-blue-500/20 border-blue-500/50 text-blue-500 dark:text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]" : "bg-transparent border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                title={state.practiceModeType !== 'none' ? "Turn off Practice Mode" : "Please exit Fullscreen to configure Practice Mode"}
              >
                <Keyboard className="w-4 h-4" /> Practice
              </button>

              {showFullscreenWarning && state.practiceModeType === 'none' && (
                <div className="absolute right-0 bottom-[calc(100%+8px)] w-max max-w-sm px-3 py-2.5 bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs font-medium rounded-lg shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 z-[9999]">
                  <span className="text-blue-400">ℹ️</span> Please exit Fullscreen to configure Practice Mode
                </div>
              )}
            </div>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={`h-8 px-3 flex shrink-0 whitespace-nowrap items-center gap-2 rounded-md border text-xs font-bold tracking-wider transition-all ${state.practiceModeType !== 'none' ? "bg-blue-500/20 border-blue-500/50 text-blue-500 dark:text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]" : "bg-transparent border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                  title="Practice Mode Settings"
                >
                  <Keyboard className="w-4 h-4" /> Practice
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="z-[200] w-64 bg-white dark:bg-[#1A1A1E] border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 p-4 shadow-xl"
                sideOffset={8}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Practice Mode</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="wait-mode-toggle-popup-snippet"
                        checked={state.practiceModeType !== 'none'}
                        onChange={(e) => {
                          if (e.target.checked && !state.isMidiInitialized && !state.isMicInitialized) {
                            const pref = localStorage.getItem("bs_preferred_instrument");
                            if (pref === "mic") {
                              setIsInitializingMidi(true);
                              actions.initializeMic().then(success => {
                                setIsInitializingMidi(false);
                                if (success) {
                                  actions.setPracticeModeType('wait');
                                }
                              });
                            } else if (pref === "midi") {
                              setIsInitializingMidi(true);
                              actions.initializeMidi().then(success => {
                                setIsInitializingMidi(false);
                                if (success) actions.setPracticeModeType('wait');
                              });
                            } else {
                              setShowMidiDialog(true);
                            }
                          } else {
                            actions.setPracticeModeType(e.target.checked ? 'wait' : 'none');
                          }
                        }}
                        className="cursor-pointer w-4 h-4 accent-blue-500 rounded bg-zinc-200 dark:bg-white/10 border-zinc-300 dark:border-white/20 hover:border-zinc-400 dark:hover:border-white/40 focus:ring-0 transition-colors"
                      />
                      <label htmlFor="wait-mode-toggle-popup-snippet" className="text-xs font-medium cursor-pointer">Enable</label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Lenient (1+ Note)</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="lenient-mode-toggle-popup-snippet"
                        checked={state.isWaitModeLenient}
                        onChange={(e) => actions.setIsWaitModeLenient(e.target.checked)}
                        className="cursor-pointer w-4 h-4 accent-blue-500 rounded bg-zinc-200 dark:bg-white/10 border-zinc-300 dark:border-white/20 hover:border-zinc-400 dark:hover:border-white/40 focus:ring-0 transition-colors"
                      />
                      <label htmlFor="lenient-mode-toggle-popup-snippet" className="text-xs font-medium cursor-pointer">Enable</label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-1 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500/80 dark:text-blue-400/80">Diagnostic Monitor</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="monitor-toggle-popup-snippet"
                        checked={state.showWaitModeMonitor}
                        onChange={(e) => actions.setShowWaitModeMonitor(e.target.checked)}
                        className="cursor-pointer w-4 h-4 accent-blue-500 rounded bg-zinc-200 dark:bg-white/10 border-zinc-300 dark:border-white/20 hover:border-zinc-400 dark:hover:border-white/40 focus:ring-0 transition-colors"
                      />
                      <label htmlFor="monitor-toggle-popup-snippet" className="text-xs font-medium cursor-pointer">Show OSD</label>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mt-1 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500/80 dark:text-purple-400/80">Hardware Input</span>

                    {!state.isMidiInitialized && !state.isMicInitialized && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">None</span>
                        <button onClick={() => setShowMidiDialog(true)} className="text-[10px] px-2 py-0.5 rounded font-bold uppercase transition-colors bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-white">Connect</button>
                      </div>
                    )}

                    {state.isMidiInitialized && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1.5"><Keyboard className="w-3 h-3" /> MIDI</span>
                        <button onClick={() => {
                          localStorage.removeItem("bs_preferred_instrument");
                          actions.disconnectMidi();
                        }} className="text-[10px] px-2 py-0.5 rounded font-bold uppercase transition-colors bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20">Disconnect</button>
                      </div>
                    )}

                    {state.isMicInitialized && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1.5"><Mic className="w-3 h-3" /> Mic</span>
                          <button onClick={() => {
                            localStorage.removeItem("bs_preferred_instrument");
                            actions.disconnectMic();
                          }} className="text-[10px] px-2 py-0.5 rounded font-bold uppercase transition-colors bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20">Disconnect</button>
                        </div>
                        <span className="text-[10px] text-amber-500/80 dark:text-amber-400/70 leading-tight">Best for C3–C6. MIDI keyboard recommended for full range.</span>
                      </div>
                    )}
                  </div>

                  {state.parsedMidi && state.parsedMidi.tracks.length > 0 && (
                    <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Practice Parts</label>
                      <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">

                        {/* Global Reset Option */}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={state.practiceTrackIds.includes(-1)}
                            onChange={(e) => {
                              if (e.target.checked) actions.setPracticeTrackIds([-1]);
                            }}
                            className="cursor-pointer w-3.5 h-3.5 accent-blue-500 rounded bg-zinc-200 dark:bg-white/10"
                          />
                          <span className="text-xs">All Tracks (Chords)</span>
                        </label>

                        {state.parsedMidi.tracks.map((t: any, i: number) => {
                          if (!t.notes || t.notes.length === 0) return null;
                          return (
                            <label key={i} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={state.practiceTrackIds.includes(i)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    actions.setPracticeTrackIds([...state.practiceTrackIds.filter(id => id !== -1), i]);
                                  } else {
                                    const next = state.practiceTrackIds.filter(id => id !== i);
                                    if (next.length === 0) actions.setPracticeTrackIds([-1]);
                                    else actions.setPracticeTrackIds(next);
                                  }
                                }}
                                className="cursor-pointer w-3.5 h-3.5 accent-blue-500 rounded bg-zinc-200 dark:bg-white/10"
                              />
                              <span className="text-xs truncate" title={t.name || `Track ${i + 1}`}>{t.name || `Track ${i + 1}`}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          ))}

          {/* Metronome Toggle */}
          <button
            onClick={() => actions.handleMetronomeToggle(!state.isMetronomeEnabled)}
            className={`p-2 rounded-md transition-all ${state.isMetronomeEnabled ? "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400" : "text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white"}`}
            title={state.isMetronomeEnabled ? "Disable Metronome" : "Enable Metronome"}
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* Mixer Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={`p-2 rounded-md transition-all text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white`}
                title="Mixer"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              autoFocus={false}
              align="end"
              sideOffset={16}
              className="z-[400] w-auto min-w-[200px] p-4 bg-[#1e1e24]/95 backdrop-blur-2xl border-zinc-300 dark:border-zinc-700/50 shadow-2xl rounded-2xl"
            >
              <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-widest mb-4">Volume Mixer</div>
              <div className="flex gap-4 sm:gap-6 overflow-x-auto max-w-[85vw] pb-2 px-2 pr-4">
                {displayTracks.map((track: TrackBase) => {
                  const isMuted = state.muteByTrackId[track.id] ?? track.muted ?? false;
                  const isSolo = state.soloByTrackId[track.id] ?? track.solo ?? false;
                  const vol = state.volumes[track.id] ?? track.volume ?? 1;

                  return (
                    <div key={track.id} className="flex flex-col items-center gap-3">
                      <div className="h-32 w-8 flex justify-center py-2 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <Slider
                          orientation="vertical"
                          value={[vol]}
                          min={0} max={1.5} step={0.01}
                          onValueChange={(v) => actions.handleVolumeChange(track.id, v[0])}
                          className={cn("h-full cursor-pointer", isMuted ? "opacity-50" : "")}
                          tooltipFormatter={(val) => Math.round(val * 100) + '%'}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => actions.handleMuteToggle(track.id, !isMuted)}
                          className={cn("w-7 h-7 rounded border flex items-center justify-center text-xs font-bold transition-all", isMuted ? "bg-red-500/20 border-red-500/50 text-red-500" : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300")}
                        >M</button>
                        <button
                          onClick={() => actions.handleSoloToggle(track.id, !isSolo)}
                          className={cn("w-7 h-7 rounded border flex items-center justify-center text-xs font-bold transition-all", isSolo ? "bg-green-500/20 border-green-500/50 text-green-500" : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300")}
                        >S</button>
                      </div>
                      <div className="text-[10px] uppercase font-semibold text-zinc-400 max-w-[60px] truncate text-center" title={track.name}>
                        {track.name}
                      </div>
                    </div>
                  )
                })}
                {displayTracks.length === 0 && (
                  <div className="text-xs text-zinc-500 italic py-4">No audio or MIDI tracks</div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <div className="relative ml-1">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-md transition-all ${showSettings ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white" : "text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white"
                }`}
              title="Mở rộng cài đặt (Settings)"
            >
              <Settings2 className="w-4 h-4" />
            </button>

            {/* Three-dot Settings Menu */}
            {showSettings && (
              <div className="absolute bottom-[calc(100%+12px)] right-0 w-[240px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-2xl rounded-xl p-2 z-[200] flex flex-col transform-origin-bottom-right animate-in slide-in-from-bottom-2 fade-in">
                <div className="px-2 py-2 border-b border-zinc-100 dark:border-zinc-800 mb-1">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Advanced Tools</p>
                </div>

                {/* Speed Control */}
                <div className="w-full flex flex-col px-3 py-2 mt-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                      <Play className="w-4 h-4 text-emerald-500" />
                      <span>Speed</span>
                    </div>
                  </div>
                  <div className="flex items-center bg-zinc-50 dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 p-1">
                    <select
                      value={state.playbackRate}
                      onChange={(e) => actions.handlePlaybackRateChange(parseFloat(e.target.value))}
                      className="w-full bg-transparent font-mono text-sm focus:outline-none cursor-pointer text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors text-center appearance-none py-1"
                      title="Playback Speed"
                    >
                      <option value="0.25" className="bg-white dark:bg-[#18181b] text-zinc-600 dark:text-zinc-300">0.25x (25%)</option>
                      <option value="0.5" className="bg-white dark:bg-[#18181b] text-zinc-600 dark:text-zinc-300">0.5x (50%)</option>
                      <option value="0.75" className="bg-white dark:bg-[#18181b] text-zinc-600 dark:text-zinc-300">0.75x (75%)</option>
                      <option value="0.9" className="bg-white dark:bg-[#18181b] text-zinc-600 dark:text-zinc-300">0.9x (90%)</option>
                      <option value="1" className="bg-white dark:bg-[#18181b] text-zinc-600 dark:text-zinc-300">1.0x (Normal)</option>
                      <option value="1.1" className="bg-white dark:bg-[#18181b] text-zinc-600 dark:text-zinc-300">1.1x (110%)</option>
                      <option value="1.25" className="bg-white dark:bg-[#18181b] text-zinc-600 dark:text-zinc-300">1.25x (125%)</option>
                      <option value="1.5" className="bg-white dark:bg-[#18181b] text-zinc-600 dark:text-zinc-300">1.5x (150%)</option>
                      <option value="2" className="bg-white dark:bg-[#18181b] text-zinc-600 dark:text-zinc-300">2.0x (200%)</option>
                    </select>
                  </div>
                </div>

                {/* Pitch Shifter */}
                <div className="w-full flex flex-col px-3 py-2 mt-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                      <Music className="w-4 h-4 text-blue-500" />
                      <span>Pitch Shift</span>
                    </div>
                    <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400">
                      {state.pitchShift > 0 ? `+${state.pitchShift}` : state.pitchShift}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-950 p-1 rounded-md border border-zinc-200 dark:border-zinc-800">
                    <button
                      onClick={() => actions.handlePitchShiftChange(state.pitchShift - 1)}
                      className="flex-1 py-1 hover:bg-white dark:hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >-</button>
                    <button
                      onClick={() => actions.handlePitchShiftChange(0)}
                      className="flex-1 py-1 px-2 text-xs font-medium bg-white dark:bg-zinc-800 shadow-sm rounded text-zinc-700 dark:text-zinc-300 hover:text-blue-500 transition-colors"
                    >Reset</button>
                    <button
                      onClick={() => actions.handlePitchShiftChange(state.pitchShift + 1)}
                      className="flex-1 py-1 hover:bg-white dark:hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >+</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Wait Mode Real-time Monitor HUD Overlay */}
      <div
        ref={refs.waitModeMonitorRef}
        className={`absolute top-4 right-4 z-[100] bg-black/80 backdrop-blur-md text-emerald-400 font-mono text-xs p-3 rounded-lg border border-emerald-500/30 shadow-2xl shadow-emerald-500/10 transition-opacity duration-300 pointer-events-none min-w-[220px] ${state.showWaitModeMonitor && state.practiceModeType !== 'none' ? "opacity-100" : "opacity-0"
          }`}
      />

      <AlertDialog open={showMidiDialog} onOpenChange={setShowMidiDialog}>
        <AlertDialogContent className="z-[300] bg-white dark:bg-[#18181b] border-zinc-200 dark:border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <Keyboard className="w-5 h-5 text-blue-500" />
              Connect Instrument
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500 dark:text-zinc-400 font-medium">
              Practice Mode pauses playback and waits for you to play the correct notes on your instrument.
              Do you want to connect a Digital Piano via MIDI, or use your Microphone for acoustic instruments?
              <br /><br />
              <span className="text-amber-500 dark:text-amber-400 italic">⚠️ Mic detection works best for notes C3–C6. For accurate chord detection, a MIDI keyboard is strongly recommended.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-between w-full">
            <AlertDialogCancel disabled={isInitializingMidi} className="border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              Cancel
            </AlertDialogCancel>
            <div className="flex flex-col sm:flex-row gap-2">
              <AlertDialogAction
                disabled={isInitializingMidi}
                onClick={async (e) => {
                  e.preventDefault();
                  setIsInitializingMidi(true);
                  const success = await actions.initializeMic();
                  setIsInitializingMidi(false);
                  if (success) {
                    localStorage.setItem("bs_preferred_instrument", "mic");
                    setShowMidiDialog(false);
                    actions.setPracticeModeType('wait');
                  } else {
                    setShowMidiDialog(false);
                  }
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white"
              >
                {isInitializingMidi ? "Connecting..." : "Use Microphone"}
              </AlertDialogAction>
              <AlertDialogAction
                disabled={isInitializingMidi}
                onClick={async (e) => {
                  e.preventDefault();
                  setIsInitializingMidi(true);
                  const success = await actions.initializeMidi();
                  setIsInitializingMidi(false);
                  if (success) {
                    localStorage.setItem("bs_preferred_instrument", "midi");
                    setShowMidiDialog(false);
                    actions.setPracticeModeType('wait');
                  } else {
                    setShowMidiDialog(false);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                {isInitializingMidi ? "Connecting..." : "Connect MIDI"}
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
