"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { getFileViewUrl } from "@/lib/appwrite";
import Link from "next/link";
import { ArrowLeft, Play, Pause, Repeat, Settings2, SlidersHorizontal, Settings, Music } from "lucide-react";
import { MusicXMLVisualizer } from "@/components/editor/MusicXMLVisualizer";
import type { DAWPayload, AudioTrack } from "@/lib/daw/types";
import { AudioManager, type TrackParams } from "@/lib/audio/AudioManager";
import { Midi } from "@tonejs/midi";
import { cn } from "@/lib/utils";
import { PlayerControls } from "./PlayerControls";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "next-themes";
import { ProjectActionsMenu } from "@/components/ProjectActionsMenu";

export interface PlayShellProps {
  projectId: string;
  projectName: string;
  composer?: string;
  payload: DAWPayload;
  difficulty?: number;
  playlistId?: string | null;
  nextProjectId?: string | null;
  prevProjectId?: string | null;
  onNext?: () => void;
  onPrev?: () => void;
  autoplayOnLoad?: boolean;
}

export function PlayShell({
  projectId,
  projectName,
  composer,
  payload,
  difficulty,
  playlistId,
  nextProjectId,
  prevProjectId,
  onNext,
  onPrev,
  autoplayOnLoad
}: PlayShellProps) {
  const audioManagerRef = useRef<AudioManager | null>(null);
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark" || resolvedTheme === "system";

  // MIDI Fallback State (Phase 19)
  const [midiBase64, setMidiBase64] = useState<string | null>(null);
  const [midiStartOffsetMs, setMidiStartOffsetMs] = useState(0);
  const [midiDurationMs, setMidiDurationMs] = useState(0);
  const midiPlayerRef = useRef<any>(null);
  const midiTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMidiExtracted = useCallback((base64: string) => {
    setMidiBase64(base64);
    try {
      const binaryString = window.atob(base64.split(",")[1] || base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
      const midi = new Midi(bytes);
      let minMs = Infinity;
      let maxMs = 0;
      midi.tracks.forEach(t => t.notes.forEach(n => {
        if (n.time * 1000 < minMs) minMs = n.time * 1000;
        if ((n.time + n.duration) * 1000 > maxMs) maxMs = (n.time + n.duration) * 1000;
      }));
      setMidiStartOffsetMs(minMs === Infinity ? 0 : minMs);
      setMidiDurationMs(maxMs);
    } catch (err) {
      console.error("Failed to parse initial MIDI offset", err);
      setMidiStartOffsetMs(0);
      setMidiDurationMs(0);
    }
  }, []);

  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const requestRef = useRef<number>(0);
  const prevFilesRef = useRef<string | null>(null);
  const autoplayTriggeredRef = useRef(false);

  // Mixer State
  const [muteByTrackId, setMuteByTrackId] = useState<Record<string, boolean>>({});
  const [soloByTrackId, setSoloByTrackId] = useState<Record<string, boolean>>({});
  const [volumes, setVolumes] = useState<Record<string, number>>({});

  // Practice Tools State
  const [playbackRate, setPlaybackRate] = useState(1);
  const [pitchShift, setPitchShift] = useState(0);
  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(false);
  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState(true);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);

  // Hydrate collapsed state from localStorage defensively
  useEffect(() => {
    try {
      if (localStorage.getItem("bs_player_collapsed") === "true") {
        setIsControlsCollapsed(true);
      }
    } catch {}
  }, []);

  const handleCollapseToggle = (collapsed: boolean) => {
    setIsControlsCollapsed(collapsed);
    try {
      localStorage.setItem("bs_player_collapsed", collapsed ? "true" : "false");
    } catch {}
  };

  const [loopState, setLoopState] = useState<{enabled: boolean; startBar: number; endBar: number}>({ 
    enabled: false, 
    startBar: 1, 
    endBar: 4 
  });

  const handleLoopStateChange = useCallback((state: {enabled: boolean; startBar: number; endBar: number}) => {
    setLoopState(state);
    if (audioManagerRef.current) {
      audioManagerRef.current.setLooping(state.enabled);
      
      const bpm = payload.metadata?.tempo || 120;
      const ts = payload.metadata?.timeSignature || "4/4";
      const [numStr, denStr] = ts.split("/");
      const beatsPerMeasure = parseInt(numStr, 10) || 4;
      const noteValue = parseInt(denStr, 10) || 4;
      
      const quarterNoteMs = (60 * 1000) / bpm;
      const beatMs = quarterNoteMs * (4 / noteValue);
      const measureMs = beatsPerMeasure * beatMs;
      
      const startMs = (state.startBar - 1) * measureMs;
      const endMs = state.endBar * measureMs;
      
      audioManagerRef.current.setLoopPoints(startMs, endMs);
    }
  }, [payload.metadata]);

  useEffect(() => {
    if (!audioManagerRef.current) {
      audioManagerRef.current = new AudioManager();
      const tempo = payload.metadata?.tempo || 120;
      audioManagerRef.current.getMetronome()?.setTempoParams(tempo, payload.metadata?.timeSignature || "4/4", payload.metadata?.timeSignature || "4/4");

      // Load initial volumes from payload
      const initialVols: Record<string, number> = {};
      payload.audioTracks.forEach(t => {
        initialVols[t.id] = t.volume ?? 1;
      });
      setVolumes(initialVols);
    }

    return () => {
      if (audioManagerRef.current) {
        audioManagerRef.current.stop();
        audioManagerRef.current = null;
      }
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      prevFilesRef.current = null;
    };
  }, []);

  // Phase 21: Dynamically stretch the MIDI file if pitchShift or playbackRate changes
  const [stretchedMidiBase64, setStretchedMidiBase64] = useState<string | null>(null);

  useEffect(() => {
    if (!midiBase64) {
      setStretchedMidiBase64(null);
      return;
    }

    const currentOffsetMs = payload.metadata?.scoreSynthOffsetMs || 0;

    if (playbackRate === 1.0 && pitchShift === 0 && currentOffsetMs === 0) {
      setStretchedMidiBase64(midiBase64);
      return;
    }

    try {
      const binaryString = window.atob(midiBase64.split(",")[1] || midiBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const midi = new Midi(bytes.buffer);
      
      const tempoTarget = payload.metadata?.tempo || 120;
      
      // Override internal verovio default MIDI tempos for perfect Sync
      midi.header.tempos = [{ ticks: 0, bpm: tempoTarget * playbackRate }];
      
      if (pitchShift !== 0) {
        midi.tracks.forEach(track => {
          track.notes.forEach(note => {
            const newMidi = note.midi + pitchShift;
            if (newMidi >= 0 && newMidi <= 127) {
              note.midi = newMidi;
            }
          });
        });
      }

      const newBytes = midi.toArray();
      let newBinaryString = "";
      for (let i = 0; i < newBytes.length; i++) {
        newBinaryString += String.fromCharCode(newBytes[i]);
      }
      const newBase64 = "data:audio/midi;base64," + window.btoa(newBinaryString);
      setStretchedMidiBase64(newBase64);

      if (midiPlayerRef.current && midiPlayerRef.current.currentTime > 0) {
        midiPlayerRef.current.src = newBase64;
      }

    } catch (e) {
      console.error("[PlayShell] Failed to transform MIDI for pitch/time shift", e);
      setStretchedMidiBase64(midiBase64); // fallback
    }
  }, [midiBase64, playbackRate, pitchShift, payload.metadata?.tempo]);

  // Sync the timemap down to the audio engine metronome
  useEffect(() => {
    if (audioManagerRef.current) {
      const metronome = audioManagerRef.current.getMetronome();
      if (metronome) {
        const timemapArr = payload.notationData?.timemap || [];
        metronome.setTimemap(timemapArr);
        // Force Elastic Grid ON in Play Mode if a timemap exists
        metronome.setSyncToTimemap(timemapArr.length > 0);
      }
    }
  }, [payload.notationData?.timemap, payload.metadata?.syncToTimemap]);

  const scoreFileId = payload.notationData?.fileId;

  // Phase 20: Inject synthetic Score Synth track if MusicXML exists
  const displayTracks = useMemo(() => {
    const tracks = [...payload.audioTracks];
    if (scoreFileId) {
      tracks.push({
        id: "score-midi",
        name: "Score Synth (Piano)",
        type: "midi",
        muted: payload.metadata?.scoreSynthMuted ?? false,
        solo: payload.metadata?.scoreSynthSolo ?? false,
        volume: payload.metadata?.scoreSynthVolume ?? 1.0,
        pan: 0,
        offsetMs: payload.metadata?.scoreSynthOffsetMs ?? 0,
      });
    }
    return tracks;
  }, [payload.audioTracks, scoreFileId, payload.metadata]);

  // Load Audio Tracks
  useEffect(() => {
    if (!audioManagerRef.current) return;
    const validTracks = payload.audioTracks.filter(t => !!t.fileId);
    const currentFiles = validTracks.map(t => `${t.id}:${t.fileId}`).join(',');

    if (currentFiles === prevFilesRef.current) return;
    prevFilesRef.current = currentFiles;

    if (validTracks.length === 0) {
      audioManagerRef.current.stop();
      setDurationMs(audioManagerRef.current.getDurationMs());
      return;
    }

    const tracksToLoad: TrackParams[] = validTracks.map(t => ({
      id: t.id,
      name: t.name,
      url: getFileViewUrl(t.fileId!),
      volume: volumes[t.id] ?? t.volume ?? 1,
      pan: t.pan ?? 0,
      muted: muteByTrackId[t.id] ?? t.muted ?? false,
      solo: soloByTrackId[t.id] ?? t.solo ?? false,
      offsetMs: t.offsetMs ?? 0,
    }));

    setLoadingAudio(true);
    audioManagerRef.current.loadTracks(tracksToLoad, (loading) => {
      if (!audioManagerRef.current) return;
      if (!loading) {
        setLoadingAudio(false);
        setDurationMs(audioManagerRef.current.getDurationMs());
        
        if (autoplayOnLoad && !autoplayTriggeredRef.current) {
           autoplayTriggeredRef.current = true;
           handlePlay();
        }
      }
    });
  }, [payload.audioTracks]);

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Dynamic MIDI Mute/Unmute during playback
  useEffect(() => {
    if (!midiPlayerRef.current) return;
    if (isPlaying) {
      if (payload.metadata?.scoreSynthMuted) {
        midiPlayerRef.current.stop();
      } else if (stretchedMidiBase64) {
        let currentPos = positionMs;
        if (audioManagerRef.current && payload.audioTracks.length > 0) {
          currentPos = audioManagerRef.current.getCurrentPositionMs();
        }
        const offsetMs = payload.metadata?.scoreSynthOffsetMs || 0;
        const targetTimeSecs = (currentPos - offsetMs + midiStartOffsetMs) / 1000;
        
        if (targetTimeSecs >= 0) {
          midiPlayerRef.current.currentTime = targetTimeSecs;
          Promise.resolve(midiPlayerRef.current.start()).catch(e => console.error(e));
        } else {
          midiPlayerRef.current.currentTime = 0;
          if (midiTimeoutRef.current) clearTimeout(midiTimeoutRef.current);
          midiTimeoutRef.current = setTimeout(() => {
             if (isPlayingRef.current && !payload.metadata?.scoreSynthMuted) {
                Promise.resolve(midiPlayerRef.current.start()).catch(e => console.error(e));
             }
          }, -targetTimeSecs * 1000);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload.metadata?.scoreSynthMuted]);

  // Calculate Global Maximum Song Duration
  const totalSongDurationMs = useMemo(() => {
    let maxAudio = durationMs || 0;
    let maxMidi = midiDurationMs || 0;
    
    let maxTimemap = 0;
    const timemap = payload.notationData?.timemap;
    if (timemap && timemap.length > 0) {
       const lastMap = timemap[timemap.length - 1];
       const bpm = payload.metadata?.tempo || 120;
       const ts = payload.metadata?.timeSignature || "4/4";
       const [numStr, denStr] = ts.split("/");
       const beatsPerMeasure = parseInt(numStr, 10) || 4;
       const noteValue = parseInt(denStr, 10) || 4;
       const measureMs = (60 * 1000 / bpm) * (4 / noteValue) * beatsPerMeasure;
       maxTimemap = lastMap.timeMs + measureMs;
    }
    const finalMax = Math.max(maxAudio, maxMidi, maxTimemap);
    return finalMax > 0 ? finalMax : 0;
  }, [durationMs, midiDurationMs, payload.notationData?.timemap, payload.metadata?.tempo, payload.metadata?.timeSignature]);

  const updatePosition = useCallback(() => {
    if (!isPlayingRef.current) return;
    
    let currentPos = 0;
    if (payload.audioTracks.length === 0 && midiPlayerRef.current) {
      currentPos = Math.max(0, midiPlayerRef.current.currentTime * 1000 - midiStartOffsetMs);
    } else if (audioManagerRef.current) {
      currentPos = audioManagerRef.current.getCurrentPositionMs();
    }

    // Auto-Stop Tripwire
    if (totalSongDurationMs > 0 && currentPos > totalSongDurationMs) {
      setIsPlaying(false);
      if (midiPlayerRef.current) {
        midiPlayerRef.current.stop();
        midiPlayerRef.current.currentTime = 0;
      }
      if (audioManagerRef.current) {
        audioManagerRef.current.stop();
      }
      setPositionMs(0);
      
      // Auto-Advance logic
      if (isAutoplayEnabled && onNext) {
         // Break out of strict execution loop to allow React unmount
         setTimeout(() => {
            onNext();
         }, 50);
      }
      return;
    }

    setPositionMs(prev => {
      // Throttle exact updates to ~60fps boundaries by rounding to prevent floating-point React render avalanches
      const roundedPos = Math.round(currentPos);
      if (Math.abs(prev - roundedPos) < 16) return prev;
      return roundedPos;
    });

    requestRef.current = requestAnimationFrame(updatePosition);
  }, [payload.audioTracks.length, midiStartOffsetMs, totalSongDurationMs]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(updatePosition);
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (midiTimeoutRef.current) clearTimeout(midiTimeoutRef.current);
    }
  }, [isPlaying, updatePosition]);


  // Audio Actions
  const handlePlay = useCallback(async () => {
    // FORCE iOS AUDIO CONTEXT RESUME SYNCHRONOUSLY
    try {
      if (audioManagerRef.current) {
        audioManagerRef.current.unlockiOSAudio();
      }
      
      // Also force Web Component Tone.js resume for the MIDI player fallback
      const globalTone = (window as any).Tone;
      if (globalTone && globalTone.context && globalTone.context.state === 'suspended') {
        globalTone.context.resume();
      }
    } catch (e) { 
      console.warn("iOS Resume bypass failed", e); 
    }

    let playPromises: Promise<void>[] = [];
    if (midiTimeoutRef.current) clearTimeout(midiTimeoutRef.current);

    if (midiPlayerRef.current && stretchedMidiBase64 && !payload.metadata?.scoreSynthMuted) {
      const offsetMs = payload.metadata?.scoreSynthOffsetMs || 0;
      const targetTimeSecs = (positionMs - offsetMs + midiStartOffsetMs) / 1000;
      
      if (targetTimeSecs >= 0) {
        midiPlayerRef.current.currentTime = targetTimeSecs;
        playPromises.push(Promise.resolve(midiPlayerRef.current.start()).catch((e:any) => console.error(e)));
      } else {
        midiPlayerRef.current.currentTime = 0; 
        const delayMs = -targetTimeSecs * 1000;
        midiTimeoutRef.current = setTimeout(() => {
          if (isPlayingRef.current && !payload.metadata?.scoreSynthMuted) {
             Promise.resolve(midiPlayerRef.current.start()).catch(e => console.error(e));
          }
        }, delayMs);
      }
    }
    if (audioManagerRef.current && payload.audioTracks.length > 0) {
      playPromises.push(Promise.resolve(audioManagerRef.current.play()).catch((e:any) => console.error(e)));
    }
    await Promise.allSettled(playPromises);
    setIsPlaying(true);
  }, [payload.audioTracks.length, stretchedMidiBase64, payload.metadata?.scoreSynthMuted, positionMs, midiStartOffsetMs, payload.metadata?.scoreSynthOffsetMs]);

  const handlePause = useCallback(() => {
    if (midiTimeoutRef.current) clearTimeout(midiTimeoutRef.current);
    if (midiPlayerRef.current) {
      midiPlayerRef.current.stop(); // html-midi-player doesn't have pause(), stop() pauses it.
    }
    if (audioManagerRef.current && payload.audioTracks.length > 0) {
      audioManagerRef.current.pause();
    }
    setIsPlaying(false);

    if (audioManagerRef.current && payload.audioTracks.length > 0) {
      setPositionMs(audioManagerRef.current.getCurrentPositionMs()); // force update
    } else if (midiPlayerRef.current) {
      const offsetMs = payload.metadata?.scoreSynthOffsetMs || 0;
      setPositionMs(Math.max(0, (midiPlayerRef.current.currentTime * 1000) - midiStartOffsetMs + offsetMs));
    }
  }, [payload.audioTracks.length, midiStartOffsetMs, payload.metadata?.scoreSynthOffsetMs]);
  // Handle iOS/Mobile backgrounding & lock screen exclusively (leave desktop background tabs playing)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isPlayingRef.current) {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
        if (isMobile) {
           handlePause();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [handlePause]);

  const handleSeek = useCallback((ms: number) => {
    if (midiTimeoutRef.current) clearTimeout(midiTimeoutRef.current);
    const offsetMs = payload.metadata?.scoreSynthOffsetMs || 0;
    if (midiPlayerRef.current) {
      const targetTimeSecs = (ms - offsetMs + midiStartOffsetMs) / 1000;
      if (targetTimeSecs >= 0) {
        midiPlayerRef.current.currentTime = targetTimeSecs;
        if (isPlayingRef.current && !payload.metadata?.scoreSynthMuted) {
          Promise.resolve(midiPlayerRef.current.start()).catch((e:any) => console.error(e));
        }
      } else {
        midiPlayerRef.current.stop();
        midiPlayerRef.current.currentTime = 0;
        if (isPlayingRef.current && !payload.metadata?.scoreSynthMuted) {
          const delayMs = -targetTimeSecs * 1000;
          midiTimeoutRef.current = setTimeout(() => {
             if (isPlayingRef.current && !payload.metadata?.scoreSynthMuted) {
                Promise.resolve(midiPlayerRef.current.start()).catch(e => console.error(e));
             }
          }, delayMs);
        }
      }
    }
    if (audioManagerRef.current && payload.audioTracks.length > 0) {
      audioManagerRef.current.seek(ms);
    }
    setPositionMs(ms);
  }, [payload.audioTracks.length, midiStartOffsetMs, payload.metadata?.scoreSynthOffsetMs, payload.metadata?.scoreSynthMuted]);

  const handleStop = useCallback(() => {
    handlePause();
    // Return to beginning of measure or beginning of song
    const bpm = payload.metadata?.tempo || 120;
    const ts = payload.metadata?.timeSignature || "4/4";
    const [numStr, denStr] = ts.split("/");
    const beatsPerMeasure = parseInt(numStr, 10) || 4;
    const noteValue = parseInt(denStr, 10) || 4;
    const quarterNoteMs = (60 * 1000) / bpm;
    const beatMs = quarterNoteMs * (4 / noteValue);
    const measureMs = beatsPerMeasure * beatMs;
    
    // Calculate start of current measure
    const currentMeasureIndex = Math.floor(positionMs / measureMs);
    const startOfMeasureMs = currentMeasureIndex * measureMs;
    
    // Go to 0 if already at measure start
    if (positionMs - startOfMeasureMs < 150) {
      handleSeek(0);
    } else {
      handleSeek(startOfMeasureMs);
    }
  }, [handlePause, handleSeek, payload.metadata?.tempo, payload.metadata?.timeSignature, positionMs]);

  // Spacebar hotkey for Play/Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or contenteditable
      if (
        document.activeElement?.tagName === "INPUT" || 
        document.activeElement?.tagName === "TEXTAREA" || 
        document.activeElement?.hasAttribute("contenteditable")
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (isPlaying) {
          handlePause();
        } else {
          handlePlay();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, handlePlay, handlePause]);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (audioManagerRef.current) {
      audioManagerRef.current.setPlaybackRate(rate);
    }
  }, []);

  const handlePitchShiftChange = useCallback((semitones: number) => {
    setPitchShift(semitones);
    if (audioManagerRef.current) {
      audioManagerRef.current.setPitchShift(semitones);
    }
  }, []);

  const handleMetronomeToggle = useCallback((enabled: boolean) => {
    setIsMetronomeEnabled(enabled);
    if (audioManagerRef.current) {
      audioManagerRef.current.setMetronomeEnabled(enabled);
    }
  }, []);

  const handleMuteToggle = useCallback((trackId: string) => {
    setMuteByTrackId(prev => {
      const next = { ...prev, [trackId]: !prev[trackId] };
      if (trackId !== "score-midi" && audioManagerRef.current) {
        audioManagerRef.current.setMute(trackId, next[trackId]);
      }
      return next;
    });
  }, []);

  const handleSoloToggle = useCallback((trackId: string) => {
    setSoloByTrackId(prev => {
      const next = { ...prev, [trackId]: !prev[trackId] };
      if (trackId !== "score-midi" && audioManagerRef.current) {
        audioManagerRef.current.setSolo(trackId, next[trackId]);
      }
      return next;
    });
  }, []);

  const handleVolumeChange = useCallback((trackId: string, volume: number) => {
    setVolumes(prev => ({ ...prev, [trackId]: volume }));
    if (trackId !== "score-midi" && audioManagerRef.current) {
      audioManagerRef.current.setVolume(trackId, volume);
    }
  }, []);

  // Sync MIDI Player properties with Mixer State
  useEffect(() => {
    if (midiPlayerRef.current) {
       // html-midi-player doesn't expose a direct volume/mute API easily on the element for all browsers
       // but we'll try to set it if supported, or rely on stopping it.
       // For a robust approach, if track is muted, we can just stop it if it's the only track.
       // If there ARE audio tracks, we need to handle its play/pause together with audioManager.
    }
  }, [muteByTrackId, volumes]);

  return (
    <div className="relative flex flex-col h-full w-full bg-[#fdfdfc] dark:bg-[#1A1A1E] text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans">

      {/* 1. Minimal Header */}
      <header className="absolute top-0 left-0 w-full z-20 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-[#151518]/80 to-transparent pointer-events-none transition-opacity duration-300">
        <div className="flex items-center gap-4 pointer-events-auto">
          <Link href="/discover" className="p-2 rounded-full bg-[#1e1e24]/80 text-zinc-300 hover:text-white hover:bg-[#2a2a32] backdrop-blur-md transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-white drop-shadow-md tracking-tight leading-tight">
              {projectName}
            </h1>
            <span className="text-sm font-medium text-zinc-300 drop-shadow-sm">
              {composer}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <ProjectActionsMenu projectId={projectId} />
          <ThemeToggle hideBg className="p-2 w-10 h-10 rounded-full bg-[#1e1e24]/80 text-zinc-300 hover:text-white hover:bg-[#2a2a32] backdrop-blur-md transition-all border-none" />
        </div>
      </header>

      {/* 2. Full Screen Sheet Music Area */}
      <div className={cn("flex-1 min-h-0 w-full h-full pt-16 overflow-hidden relative transition-all duration-300", isControlsCollapsed ? "pb-0" : "pb-[120px]")}>
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#fdfdfc] dark:from-[#1A1A1E] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#fdfdfc] dark:from-[#1A1A1E] to-transparent z-10 pointer-events-none" />
        
        {/* Headless MIDI Player for Fallback SoundFont engine */}
        {stretchedMidiBase64 && (
          <div className="hidden">
            <midi-player
              ref={midiPlayerRef}
              src={stretchedMidiBase64}
              sound-font="https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus"
            />
          </div>
        )}

        {scoreFileId ? (
          <MusicXMLVisualizer
            scoreFileId={scoreFileId}
            positionMs={positionMs} // For measure highlighting
            isPlaying={isPlaying} // Enables Playhead auto-scrolling
            timemap={payload.notationData?.timemap || []} // Provide map
            onSeek={(ms) => handleSeek(ms)}
            onMidiExtracted={handleMidiExtracted}
            isDarkMode={isDarkMode}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400">
            <Music className="w-16 h-16 mb-4 opacity-20" />
            <p>No sheet music available for this project.</p>
          </div>
        )}
      </div>

      {/* 3. Floating Control Bar (Dock) */}
      <PlayerControls
        bpm={payload.metadata?.tempo || 120}
        positionMs={positionMs}
        durationMs={totalSongDurationMs}
        isPlaying={isPlaying}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onSeek={handleSeek}
        playbackRate={playbackRate}
        onPlaybackRateChange={handlePlaybackRateChange}
        pitchShift={pitchShift}
        onPitchShiftChange={handlePitchShiftChange}
        isMetronomeEnabled={isMetronomeEnabled}
        onMetronomeToggle={handleMetronomeToggle}
        loopState={loopState}
        onLoopStateChange={handleLoopStateChange}
        tracks={displayTracks}
        volumes={volumes}
        muteByTrackId={muteByTrackId}
        soloByTrackId={soloByTrackId}
        onMuteToggle={handleMuteToggle}
        onSoloToggle={handleSoloToggle}
        onVolumeChange={handleVolumeChange}
        isCollapsed={isControlsCollapsed}
        onCollapseToggle={handleCollapseToggle}
        playlistId={playlistId}
        hasNext={!!nextProjectId}
        hasPrev={!!prevProjectId}
        onNext={onNext}
        onPrev={onPrev}
        isAutoplayEnabled={isAutoplayEnabled}
        onAutoplayToggle={setIsAutoplayEnabled}
      />
    </div>
  );
}
