"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TransportBar, type LoopState } from "./TransportBar";
import { TrackList } from "./TrackList";
import { MusicXMLVisualizer } from "./MusicXMLVisualizer";
import { MeasureMapEditor } from "./MeasureMapEditor";
import {
  Play, Pause, Square, Repeat, ChevronDown, ChevronUp, Music, ArrowLeft, MoreVertical, X, Tag, Activity, Map, PlaySquare, Sun, Moon, MoreHorizontal, Check
} from "lucide-react";
import { useTheme } from "next-themes";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getFileViewUrl } from "@/lib/appwrite";
import type { DAWPayload, AudioTrack } from "@/lib/daw/types";
import { AudioManager, type TrackParams } from "@/lib/audio/AudioManager";
import { Midi } from "@tonejs/midi";
import { cn } from "@/lib/utils";

const EMPTY_TIMEMAP: { measure: number; timeMs: number }[] = [];

export interface EditorShellProps {
  projectId: string;
  projectName: string;
  payload: DAWPayload;
  isOwner: boolean;
  isPublished: boolean;
  saving?: boolean;
  publishing?: boolean;
  onSave?: () => void;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onPayloadChange?: (payload: DAWPayload) => void;
  onUploadTrackFile?: (trackId: string, file: File) => Promise<void>;
  onNameChange?: (name: string) => void;
  onUploadScore?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddAudioTrack?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteTrack?: (trackId: string) => void;
  tags?: string[];
  onTagsChange?: (tags: string[]) => void;
  uploadingScore?: boolean;
  uploadingAudio?: boolean;
  uploadError?: string | null;
}

export function EditorShell({
  projectId,
  projectName,
  payload,
  isOwner,
  isPublished,
  saving = false,
  publishing = false,
  onSave,
  onPublish,
  onUnpublish,
  onPayloadChange,
  onUploadTrackFile,
  onNameChange,
  onUploadScore,
  onAddAudioTrack,
  onDeleteTrack,
  tags = [],
  onTagsChange,
  uploadingScore = false,
  uploadingAudio = false,
  uploadError,
}: EditorShellProps) {
  const [shareCopied, setShareCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [muteByTrackId, setMuteByTrackId] = useState<Record<string, boolean>>({});
  const [soloByTrackId, setSoloByTrackId] = useState<Record<string, boolean>>({});

  const audioManagerRef = useRef<AudioManager | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const requestRef = useRef<number>(0);
  const prevFilesRef = useRef<string | null>(null);
  const [isTracksExpanded, setIsTracksExpanded] = useState(true);
  const [trackListHeight, setTrackListHeight] = useState(250);
  const isDraggingHeight = useRef(false);

  // Sync Mode State
  const [isSyncMode, setIsSyncMode] = useState(false);
  const [recordedTimemap, setRecordedTimemap] = useState<{ measure: number; timeMs: number }[]>([]);
  const [showMapEditor, setShowMapEditor] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const { resolvedTheme } = useTheme();
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Sync isDarkMode natively once mounted
  useEffect(() => {
    setIsDarkMode(resolvedTheme === "dark" || resolvedTheme === "system" || !resolvedTheme);
  }, [resolvedTheme]);

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

  // Playback Speed State (Phase 6.2)
  const [playbackRate, setPlaybackRate] = useState(1);
  const [pitchShift, setPitchShift] = useState(0);
  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(false);
  const [isPreRollEnabled, setIsPreRollEnabled] = useState(false);
  const [timeSignature, setTimeSignature] = useState(payload.metadata?.timeSignature || "4/4");

  // A-B Looping State (Phase 7.1)
  const [loopState, setLoopState] = useState<LoopState>({ enabled: false, startBar: 1, endBar: 4 });

  // Tags Editor (Phase 9)
  const TAG_GROUPS = {
    Instruments: ["Piano", "Acoustic Guitar", "Electric Guitar", "Bass", "Violin", "Cello", "Trumpet", "Saxophone", "Drums", "Vocals", "Flute", "Clarinet"],
    Genres: ["Pop", "Rock", "Jazz", "Classical", "Blues", "R&B", "Country", "Folk", "Latin", "Electronic", "Hip Hop"],
    Difficulty: ["Beginner", "Intermediate", "Advanced"],
  };
  const [isEditingTags, setIsEditingTags] = useState(false);

  const handleToggleTag = (tag: string) => {
    if (!onTagsChange || !tags) return;
    if (tags.includes(tag)) {
      onTagsChange(tags.filter((t) => t !== tag));
    } else {
      onTagsChange([...tags, tag]);
    }
  };

  const handleRemoveTag = (tag: string) => {
    if (onTagsChange && tags) onTagsChange(tags.filter((t) => t !== tag));
  };

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
      
      midi.tracks.forEach(track => {
        track.notes.forEach(note => {
          note.time = note.time / playbackRate;
          note.duration = note.duration / playbackRate;
          
          // Pitch Shift
          const newMidi = note.midi + pitchShift;
          if (newMidi >= 0 && newMidi <= 127) {
            note.midi = newMidi;
          }
        });

        // Also shift Sustain Pedals
        if (track.controlChanges) {
          Object.keys(track.controlChanges).forEach(cc => {
            track.controlChanges[cc as any].forEach((event: any) => {
              event.time = event.time / playbackRate;
            });
          });
        }

        if (track.pitchBends) {
          track.pitchBends.forEach((event: any) => {
            event.time = event.time / playbackRate;
          });
        }
      });

      const newBytes = midi.toArray();
      let newBinaryString = "";
      for (let i = 0; i < newBytes.length; i++) {
        newBinaryString += String.fromCharCode(newBytes[i]);
      }
      const newBase64 = "data:audio/midi;base64," + window.btoa(newBinaryString);
      setStretchedMidiBase64(newBase64);
      console.log(`[EditorShell] Generated stretched MIDI base64 (rate=${playbackRate}, pitch=${pitchShift})`);

      // We must reload the player if it's currently loaded
      if (midiPlayerRef.current && midiPlayerRef.current.currentTime > 0) {
        // Force the player to accept the new source instantly if the user changes it mid-song
        midiPlayerRef.current.src = newBase64;
      }

    } catch (e) {
      console.error("[EditorShell] Failed to transform MIDI for pitch/time shift", e);
      setStretchedMidiBase64(midiBase64); // fallback
    }
  }, [midiBase64, playbackRate, pitchShift]);

  useEffect(() => {
    // Initialize standard Web Audio Manager
    if (!audioManagerRef.current) {
      audioManagerRef.current = new AudioManager();
      const tempo = payload.metadata?.tempo || 120;
      audioManagerRef.current.getMetronome()?.setTempoParams(tempo, timeSignature, payload.metadata?.timeSignature || "4/4");
    }

    // Cleanup on unmount
    return () => {
      if (audioManagerRef.current) {
        audioManagerRef.current.stop();
        audioManagerRef.current = null;
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      // Reset the file hash so if the component remounts (e.g. React StrictMode),
      // the load effect will correctly detect a change and reload tracks.
      prevFilesRef.current = null;
    };
  }, []);

  // Sync the timemap and elastic grid settings down to the audio engine
  useEffect(() => {
    if (audioManagerRef.current) {
      const metronome = audioManagerRef.current.getMetronome();
      if (metronome) {
        metronome.setTimemap(payload.notationData?.timemap || []);
        metronome.setSyncToTimemap(!!payload.metadata?.syncToTimemap);
      }
    }
  }, [payload.notationData?.timemap, payload.metadata?.syncToTimemap]);

  // TrackList Resizer Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingHeight.current) return;
      // Calculate height from bottom of the screen
      const newHeight = window.innerHeight - e.clientY;
      setTrackListHeight(Math.max(80, Math.min(newHeight, window.innerHeight * 0.8)));
    };

    const handleMouseUp = () => {
      if (isDraggingHeight.current) {
        isDraggingHeight.current = false;
        document.body.style.cursor = 'default';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleResizerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingHeight.current = true;
    document.body.style.cursor = 'row-resize';
  };

  // Sync track loading whenever track counts/files change
  useEffect(() => {
    if (!audioManagerRef.current) return;

    // Filter valid tracks first
    const validTracks = payload.audioTracks.filter(t => !!t.fileId);

    // Check if the underlying files have actually changed
    const currentFiles = validTracks.map(t => `${t.id}:${t.fileId}`).join(',');

    // If the valid file IDs haven't changed, do nothing
    if (currentFiles === prevFilesRef.current) return;
    prevFilesRef.current = currentFiles;

    if (validTracks.length === 0) {
      audioManagerRef.current.stop();
      setDurationMs(audioManagerRef.current.getDurationMs());
      return;
    }

    // Build the TrackParams list
    const tracksToLoad: TrackParams[] = validTracks.map(t => ({
      id: t.id,
      name: t.name,
      url: getFileViewUrl(t.fileId!),
      volume: t.volume ?? 1,
      pan: t.pan ?? 0,
      muted: muteByTrackId[t.id] ?? t.muted ?? false,
      solo: soloByTrackId[t.id] ?? t.solo ?? false,
      offsetMs: t.offsetMs ?? 0,
    }));

    setLoadingAudio(true);
    audioManagerRef.current.loadTracks(tracksToLoad, (loading, loadedCount, total) => {
      // Prevent crash if component unmounts before loading completes
      if (!audioManagerRef.current) return;

      if (!loading) {
        setLoadingAudio(false);
        setDurationMs(audioManagerRef.current.getDurationMs());
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload.audioTracks, muteByTrackId, soloByTrackId]); // intentionally keeping state out to prevent reload when mixing

  // Sync Mode Tapper ref is hoisted for use in updatePosition
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

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

  // Playback Loop for UI
  const updatePosition = useCallback(() => {
    if (!isPlayingRef.current) return;
    
    let currentPos = 0;
    // MIDI Fallback Routing
    if (payload.audioTracks.length === 0 && midiPlayerRef.current) {
      currentPos = midiPlayerRef.current.currentTime * 1000;
    } else if (audioManagerRef.current) {
      // Standard Audio Routing
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
      return;
    }

    setPositionMs(prev => {
      const roundedPos = Math.round(currentPos);
      if (Math.abs(prev - roundedPos) < 16) return prev;
      return roundedPos;
    });

    requestRef.current = requestAnimationFrame(updatePosition);
  }, [payload.audioTracks.length, totalSongDurationMs]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(updatePosition);
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
  }, [isPlaying, updatePosition]);

  // Sync Mode Tapper
  const recordedTimemapRef = useRef(recordedTimemap);
  useEffect(() => { recordedTimemapRef.current = recordedTimemap; }, [recordedTimemap]);

  // (Moved keyboard listener down below handlePause to access it safely)

  const handleToggleSyncMode = () => {
    setIsSyncMode(prev => {
      const next = !prev;
      if (next) {
        setRecordedTimemap([]);
        if (audioManagerRef.current) audioManagerRef.current.seek(0);
      }
      return next;
    });
  };

  const handleToggleElasticGrid = () => {
    if (!onPayloadChange) return;
    const isCurrentlyElastic = !!payload.metadata?.syncToTimemap;
    onPayloadChange({
      ...payload,
      metadata: {
        ...payload.metadata,
        syncToTimemap: !isCurrentlyElastic,
      },
    });
  };

  const handleSaveSyncMap = useCallback(() => {
    if (!onPayloadChange) return;
    const newPayload: DAWPayload = {
      ...payload,
      notationData: {
        ...(payload.notationData || { type: "music-xml" }),
        timemap: recordedTimemap,
      } as any,
    };
    onPayloadChange(newPayload);
    setIsSyncMode(false);
  }, [payload, recordedTimemap, onPayloadChange]);

  const handleCancelSync = useCallback(() => {
    setIsSyncMode(false);
    setRecordedTimemap([]);
  }, []);

  const handleBpmChange = useCallback((newBpm: number) => {
    if (!onPayloadChange) return;
    const oldBpm = payload.metadata?.tempo ?? 120;
    if (newBpm === oldBpm || newBpm <= 0) return;

    // Rescale timemap based on BPM ratio
    const ratio = oldBpm / newBpm;
    const oldTimemap = payload.notationData?.timemap ?? EMPTY_TIMEMAP;
    const newTimemap = oldTimemap.map((t: { measure: number, timeMs: number }) => ({
      measure: t.measure,
      timeMs: t.timeMs * ratio
    }));

    onPayloadChange({
      ...payload,
      metadata: {
        ...payload.metadata,
        tempo: newBpm,
      },
      notationData: {
        ...payload.notationData,
        timemap: newTimemap
      } as any,
    });

    if (audioManagerRef.current) {
      audioManagerRef.current.getMetronome()?.setTempoParams(newBpm, timeSignature, payload.metadata?.timeSignature || "4/4");
    }
  }, [payload, onPayloadChange, timeSignature]);

  const handleTimeSignatureChange = useCallback(
    (newSig: string) => {
      setTimeSignature(newSig);
      if (onPayloadChange) {
        onPayloadChange({
          ...payload,
          metadata: { ...payload.metadata, timeSignature: newSig },
        });
      }
      if (audioManagerRef.current) {
        const currentBpm = payload.metadata?.tempo || 120;
        audioManagerRef.current.getMetronome()?.setTempoParams(currentBpm, newSig, payload.metadata?.timeSignature || "4/4");
      }
    },
    [payload, onPayloadChange]
  );

  const handleMetronomeToggle = useCallback((enabled: boolean) => {
    setIsMetronomeEnabled(enabled);
    if (!audioManagerRef.current) return;

    audioManagerRef.current.setMetronomeEnabled(enabled);
  }, [isPlaying]);

  const handlePreRollToggle = useCallback((enabled: boolean) => {
    setIsPreRollEnabled(enabled);
    if (!audioManagerRef.current) return;

    audioManagerRef.current.setPreRollEnabled(enabled);
  }, []);

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
          if (isPlayingRef.current && !payload.metadata?.scoreSynthMuted) { // We check isPlayingRef instead of state isPlaying because it's a timeout
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
      setPositionMs(Math.max(0, midiPlayerRef.current.currentTime * 1000 - midiStartOffsetMs));
    }
  }, [payload.audioTracks.length, midiStartOffsetMs]);

  // Spacebar Play/Pause & Sync Mode Listener
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (
        document.activeElement?.tagName === "INPUT" || 
        document.activeElement?.tagName === "TEXTAREA" || 
        document.activeElement?.hasAttribute("contenteditable")
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (isSyncMode) {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }

          if (!isPlayingRef.current) {
            if (recordedTimemapRef.current.length === 0 && audioManagerRef.current) {
              if (audioManagerRef.current.getCurrentPositionMs() !== 0) {
                audioManagerRef.current.seek(0);
              }
              await audioManagerRef.current.play();
              setIsPlaying(true);
              setRecordedTimemap([{ measure: 1, timeMs: 0 }]);
            }
          } else {
            const preciseTime = audioManagerRef.current?.getCurrentPositionMs() ?? 0;
            setRecordedTimemap(prev => {
              const lastTap = prev[prev.length - 1];
              if (lastTap && (preciseTime - lastTap.timeMs < 200)) return prev;
              return [...prev, { measure: prev.length + 1, timeMs: Math.round(preciseTime) }];
            });
          }
        } else {
          if (isPlayingRef.current) {
            handlePause();
          } else {
            handlePlay();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSyncMode, handlePlay, handlePause]);



  const handleStop = useCallback(() => {
    if (midiTimeoutRef.current) clearTimeout(midiTimeoutRef.current);
    if (midiPlayerRef.current) {
      midiPlayerRef.current.stop();
      midiPlayerRef.current.currentTime = 0;
    }
    if (audioManagerRef.current && payload.audioTracks.length > 0) {
      audioManagerRef.current.stop();
    }
    setIsPlaying(false);
    setPositionMs(0);
  }, [payload.audioTracks.length]);

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

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = origin ? `${origin}/p/${projectId}` : "";
  const embedUrl = origin ? `${origin}/embed?p=${projectId}` : "";

  const handleCopyLink = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  }, [shareUrl]);

  const handleCopyEmbed = useCallback(() => {
    if (!embedUrl) return;
    const iframeHtml = `<iframe src="${embedUrl}" width="640" height="400" frameborder="0" allow="autoplay" title="Backing & Score"></iframe>`;
    navigator.clipboard.writeText(iframeHtml).then(() => {
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2000);
    });
  }, [embedUrl]);

  const activeLoopPoints = useMemo(() => {
    if (!loopState.enabled) return null;
    const timemap = payload.notationData?.timemap || [];
    const startMeasure = timemap.find(t => t.measure === loopState.startBar);
    const endMeasureBound = timemap.find(t => t.measure === loopState.endBar + 1);

    // Default to 0 if not mapped at all
    const startMs = startMeasure ? startMeasure.timeMs : 0;
    let endMs = 0;

    if (endMeasureBound) {
      // We explicitly have the start time of the next measure
      endMs = endMeasureBound.timeMs;
    } else {
      // We don't have the next measure. Let's find the current end measure to base our math on
      const currentEndMeasure = timemap.find(t => t.measure === loopState.endBar);

      const msPerBeat = payload.metadata?.tempo ? 60000 / payload.metadata.tempo : 500; // default 120bpm
      const defaultMeasureMs = msPerBeat * 4; // assuming 4/4 as fallback

      if (currentEndMeasure) {
        // We have the start of the end measure, just add 1 measure's duration to it
        endMs = currentEndMeasure.timeMs + defaultMeasureMs;
      } else {
        // We have neither the bound nor the end measure itself, extrapolate from the start measure
        endMs = startMs + (defaultMeasureMs * ((loopState.endBar - loopState.startBar) + 1));
      }

      // Cap at actual audio duration if possible
      if (audioManagerRef.current && audioManagerRef.current.getDurationMs() > 0) {
        endMs = Math.min(endMs, audioManagerRef.current.getDurationMs());
      }
    }

    // Subtract 20ms (roughly half a time-stretch WSOLA window) to prevent SoundTouchJS
    // from overlapping the next measure's transient downbeat
    if (endMs > startMs + 20) {
      endMs -= 20;
    }

    return { startMs, endMs };
  }, [loopState, payload.notationData?.timemap, payload.metadata?.tempo]);

  const handleLoopChange = useCallback(
    (loop: LoopState) => {
      setLoopState(loop);
      if (!audioManagerRef.current) return;

      audioManagerRef.current.setLooping(loop.enabled);
      // Actual points set in useEffect to avoid recreation issues
    },
    []
  );

  useEffect(() => {
    if (audioManagerRef.current && loopState.enabled && activeLoopPoints) {
      audioManagerRef.current.setLoopPoints(activeLoopPoints.startMs, activeLoopPoints.endMs);
    }
  }, [activeLoopPoints, loopState.enabled]);

  const handleMuteChange = useCallback((trackId: string, mute: boolean) => {
    setMuteByTrackId((prev) => ({ ...prev, [trackId]: mute }));
    if (audioManagerRef.current) {
      audioManagerRef.current.setMute(trackId, mute);
    }
    if (onPayloadChange) {
      const track = payload.audioTracks.find((t) => t.id === trackId);
      if (track) {
        const updated = payload.audioTracks.map((t) =>
          t.id === trackId ? { ...t, muted: mute } : t
        ) as AudioTrack[];
        onPayloadChange({ ...payload, audioTracks: updated });
      }
    }
  }, [payload, onPayloadChange]);

  const handleSoloChange = useCallback((trackId: string, solo: boolean) => {
    setSoloByTrackId((prev) => ({ ...prev, [trackId]: solo }));
    if (audioManagerRef.current) {
      audioManagerRef.current.setSolo(trackId, solo);
    }
    if (onPayloadChange) {
      const track = payload.audioTracks.find((t) => t.id === trackId);
      if (track) {
        const updated = payload.audioTracks.map((t) =>
          t.id === trackId ? { ...t, solo } : t
        ) as AudioTrack[];
        onPayloadChange({ ...payload, audioTracks: updated });
      }
    }
  }, [payload, onPayloadChange]);

  const handleVolumeChange = useCallback((trackId: string, volume: number) => {
    if (audioManagerRef.current) {
      audioManagerRef.current.setVolume(trackId, volume);
    }
    if (onPayloadChange) {
      const track = payload.audioTracks.find((t) => t.id === trackId);
      if (track) {
        const updated = payload.audioTracks.map((t) =>
          t.id === trackId ? { ...t, volume } : t
        ) as AudioTrack[];
        onPayloadChange({ ...payload, audioTracks: updated });
      }
    }
  }, [payload, onPayloadChange]);

  const handleOffsetChange = useCallback((trackId: string, offsetMs: number) => {
    if (audioManagerRef.current) {
      audioManagerRef.current.setTrackOffset(trackId, offsetMs);
    }
    if (onPayloadChange) {
      const track = payload.audioTracks.find((t) => t.id === trackId);
      if (track) {
        const updated = payload.audioTracks.map((t) =>
          t.id === trackId ? { ...t, offsetMs } : t
        ) as AudioTrack[];
        onPayloadChange({ ...payload, audioTracks: updated });
      }
    }
  }, [payload, onPayloadChange]);

  const handleKeySignatureChange = (key: string) => {
    if (!onPayloadChange) return;
    onPayloadChange({
      ...payload,
      metadata: {
        ...payload.metadata,
        keySignature: key,
      }
    });
  };

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

  const handleVirtualMuteChange = useCallback((trackId: string, mute: boolean) => {
    if (trackId === "score-midi") {
      setMuteByTrackId(prev => ({ ...prev, [trackId]: mute }));
      if (onPayloadChange) {
        onPayloadChange({ ...payload, metadata: { ...payload.metadata, scoreSynthMuted: mute }});
      }
      return;
    }
    handleMuteChange(trackId, mute);
  }, [handleMuteChange, onPayloadChange, payload]);

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

  const handleVirtualSoloChange = useCallback((trackId: string, solo: boolean) => {
    if (trackId === "score-midi") {
      setSoloByTrackId(prev => ({ ...prev, [trackId]: solo }));
      if (onPayloadChange) {
        onPayloadChange({ ...payload, metadata: { ...payload.metadata, scoreSynthSolo: solo }});
      }
      return;
    }
    handleSoloChange(trackId, solo);
  }, [handleSoloChange, onPayloadChange, payload]);

  const handleVirtualVolumeChange = useCallback((trackId: string, volume: number) => {
    if (trackId === "score-midi") {
      if (onPayloadChange) {
        onPayloadChange({ ...payload, metadata: { ...payload.metadata, scoreSynthVolume: volume }});
      }
      return;
    }
    handleVolumeChange(trackId, volume);
  }, [handleVolumeChange, onPayloadChange, payload]);

  const handleVirtualOffsetChange = useCallback((trackId: string, offsetMs: number) => {
    if (trackId === "score-midi") {
      if (onPayloadChange) {
        onPayloadChange({ ...payload, metadata: { ...payload.metadata, scoreSynthOffsetMs: offsetMs }});
      }
      return;
    }
    handleOffsetChange(trackId, offsetMs);
  }, [handleOffsetChange, onPayloadChange, payload]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0E0E11] text-zinc-300">
      
      {/* 1. Global Header (TransportBar) */}
      <TransportBar
              bpm={payload.metadata?.tempo ?? 120}
              onBpmChange={isOwner && onPayloadChange ? handleBpmChange : undefined}
              playbackRate={playbackRate}
              onPlaybackRateChange={handlePlaybackRateChange}
              isMetronomeEnabled={isMetronomeEnabled}
              onMetronomeToggle={handleMetronomeToggle}
              isPreRollEnabled={isPreRollEnabled}
              onPreRollToggle={handlePreRollToggle}
              timeSignature={timeSignature}
              onTimeSignatureChange={onPayloadChange ? handleTimeSignatureChange : undefined}
              keySignature={payload.metadata?.keySignature || "C Maj"}
              onKeySignatureChange={onPayloadChange ? handleKeySignatureChange : undefined}
              positionMs={positionMs}
              durationMs={totalSongDurationMs}
              isPlaying={isPlaying}
              loop={loopState}
              onLoopChange={onPayloadChange ? handleLoopChange : undefined}
              onPlay={handlePlay}
              onPause={handlePause}
              onStop={handleStop}
              isSyncMode={isSyncMode}
              onToggleSyncMode={() => setIsSyncMode(!isSyncMode)}
              isElasticGrid={!!payload.metadata?.syncToTimemap}
              onToggleElasticGrid={handleToggleElasticGrid}
              timemap={payload.notationData?.timemap}
              isMapEditorOpen={showMapEditor}
              onToggleMapEditor={() => setShowMapEditor(!showMapEditor)}
              disabled={loadingAudio}
              title={projectName || "Untitled"}
      />
      {/* Action Sub-Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 bg-white dark:bg-[#1A1A1E] border-b border-black/50 px-3 sm:px-6 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 shrink-0 w-full overflow-hidden">
        <Link href="/dashboard" className="flex items-center gap-1 hover:text-white transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Projects
        </Link>
        <div className="w-px h-3 bg-zinc-700"></div>

        {isOwner && onNameChange ? (
          <div className="flex items-center gap-2 shrink-0 flex-1 min-w-[200px] sm:max-w-md">
            <span className="shrink-0 hidden sm:inline">Title:</span>
            <input
              value={projectName}
              onChange={e => onNameChange(e.target.value)}
              className="bg-transparent dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-200 w-full min-w-[150px] border border-zinc-300 dark:border-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-[#222] focus:border-blue-500 rounded px-2 py-1 outline-none transition-colors shadow-inner"
              placeholder="Project Name"
            />
          </div>
        ) : (
          <span className="truncate max-w-[200px] text-zinc-900 dark:text-zinc-300 font-medium">{projectName || "Untitled"}</span>
        )}

        {/* Tags UI (Compact Button) */}
        {tags !== undefined && (
          <div className="shrink-0 mr-auto flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 rounded-md text-xs font-semibold text-zinc-600 dark:text-zinc-300 shadow-sm transition-colors focus:outline-none">
                  <Tag className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tags</span>
                  {tags.length > 0 && (
                    <span className="bg-[#C8A856] text-black text-[10px] font-bold px-1.5 rounded-full min-w-[20px] text-center flex items-center justify-center -ml-0.5">
                      {tags.length}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-white dark:bg-[#1A1A1E] border-zinc-200 dark:border-zinc-800 shadow-xl p-1 z-[150]" align="start">
                <div className="max-h-72 overflow-y-auto pr-1">
                  {tags.length === 0 && !isOwner && (
                    <div className="text-xs text-zinc-500 p-3 text-center">No tags added</div>
                  )}
                  {Object.entries(TAG_GROUPS).map(([category, catTags]) => {
                    const viewableTags = isOwner ? catTags : catTags.filter(t => tags.includes(t));
                    if (viewableTags.length === 0) return null;

                    return (
                      <div key={category} className="mb-2">
                        <div className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 px-2 py-1 tracking-wider sticky top-0 bg-white/95 dark:bg-[#1A1A1E]/95 backdrop-blur-md z-10">
                          {category}
                        </div>
                        {viewableTags.map(tag => {
                          const isSelected = tags.includes(tag);
                          return (
                            <DropdownMenuItem 
                              key={tag}
                              onClick={(e) => {
                                if (!isOwner) {
                                  e.preventDefault();
                                  return;
                                }
                                handleToggleTag(tag);
                                e.preventDefault(); // Keep menu open to allow multi-select
                              }}
                              className={cn(
                                "text-xs font-semibold px-2 py-1.5 cursor-pointer rounded transition-colors ml-2 flex items-center justify-between group",
                                isOwner ? "hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800" : "cursor-default",
                                isSelected ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "text-zinc-600 dark:text-zinc-400"
                              )}
                            >
                              <span>{tag}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />}
                            </DropdownMenuItem>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <div className="flex-1 flex items-center justify-end gap-3 shrink-0">
          
          {/* Desktop/Tablet Inline Menu */}
          <div className="hidden xl:flex items-center gap-3">
            <button onClick={handleCopyLink} className="whitespace-nowrap hover:text-zinc-900 dark:hover:text-white transition-colors">{shareCopied ? "Copied Link!" : "Share Link"}</button>
            <div className="w-px h-3 bg-zinc-700"></div>
            {projectId && (
               <Link href={`/play/${projectId}`} className="whitespace-nowrap hover:text-blue-600 dark:hover:text-blue-300 transition-colors text-blue-500 dark:text-blue-400 flex items-center gap-1">
                 <PlaySquare className="w-3.5 h-3.5" /> Play Mode
               </Link>
            )}

            {isOwner && (
              <>
                <div className="w-px h-3 bg-zinc-700 mx-1"></div>
                {onUploadScore && (
                  <label className="whitespace-nowrap cursor-pointer hover:text-zinc-900 dark:hover:text-white transition-colors">
                    {uploadingScore ? "Uploading..." : "+ MusicXML"}
                    <input type="file" className="hidden" accept=".musicxml,.xml,.mxl" onChange={onUploadScore} disabled={uploadingScore} />
                  </label>
                )}
                <Button size="sm" onClick={onSave} disabled={saving} className="h-6 px-3 bg-zinc-700 hover:bg-zinc-600 text-white text-[10px] uppercase font-bold tracking-wider rounded border border-zinc-600">
                  {saving ? "Saving…" : "Save"}
                </Button>
                {onPublish && !isPublished && (
                  <Button size="sm" onClick={onPublish} disabled={publishing} className="h-6 px-3 bg-[#C8A856] hover:bg-[#D4B86A] text-black text-[10px] uppercase font-bold tracking-wider rounded border border-[#C8A856]/50">
                    {publishing ? "Publishing…" : "Publish"}
                  </Button>
                )}
                {onUnpublish && isPublished && (
                  <Button size="sm" onClick={onUnpublish} disabled={publishing} className="h-6 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] uppercase font-bold tracking-wider rounded border border-zinc-600">
                    {publishing ? "Unpublishing…" : "Unpublish"}
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Mobile Collapsed Menu */}
          <div className="xl:hidden block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-[#1A1A1E] border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300 p-1 z-[150]">
                <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-2 text-xs transition-colors">
                  {shareCopied ? "Copied Link!" : "Share Link"}
                </DropdownMenuItem>
                {projectId && (
                  <DropdownMenuItem asChild className="cursor-pointer font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800 py-2 text-xs transition-colors">
                     <Link href={`/play/${projectId}`} className="flex w-full items-center gap-2 text-blue-600 dark:text-blue-400">
                       <PlaySquare className="w-3.5 h-3.5" /> Play Mode
                     </Link>
                   </DropdownMenuItem>
                )}
                {isOwner && onUploadScore && (
                  <DropdownMenuItem asChild className="cursor-pointer font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-2 text-xs transition-colors">
                    <label className="flex w-full cursor-pointer items-center">
                      {uploadingScore ? "Uploading..." : "+ MusicXML"}
                      <input type="file" className="hidden" accept=".musicxml,.xml,.mxl" onChange={onUploadScore} disabled={uploadingScore} />
                    </label>
                  </DropdownMenuItem>
                )}
                {isOwner && (
                  <DropdownMenuItem onClick={onSave} disabled={saving} className="cursor-pointer font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800 py-2 mt-1 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white transition-colors">
                    {saving ? "Saving..." : "Save Project"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        </div>
      </div>

      {/* Sync Mode HUD */}
      {isSyncMode && (
        <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between text-sm shrink-0 shadow-inner z-10 font-medium">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-red-900/40 px-3 py-1.5 rounded-full">
              <span className="relative flex h-3 w-3">
                {isPlaying && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-100 opacity-75"></span>}
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              <strong className="tracking-wider uppercase text-xs">Sync Mode</strong>
            </div>
            {!isPlaying
              ? <span className="text-red-50">
                No intro? Press <kbd className="bg-black/20 border border-black/30 px-1.5 py-0.5 rounded text-xs font-mono font-bold shadow-sm mx-1">SPACE</kbd> to start & mark Measure 1 at t=0.
                <span className="opacity-60 mx-2">·</span>
                Has intro? Press <kbd className="bg-black/20 border border-black/30 px-1.5 py-0.5 rounded text-xs font-mono font-bold shadow-sm mx-1">Play</kbd> first, then SPACE each measure.
              </span>
              : recordedTimemap.length === 0
                ? <span className="text-red-50">Press <kbd className="bg-black/20 border border-black/30 px-1.5 py-0.5 rounded text-xs font-mono font-bold shadow-sm mx-1">SPACE</kbd> on the downbeat of <strong>Measure 1</strong> to begin.</span>
                : <span className="text-red-50">Press <kbd className="bg-black/20 border border-black/30 px-1.5 py-0.5 rounded text-xs font-mono font-bold shadow-sm mx-1">SPACE</kbd> on the downbeat of each new Measure.</span>
            }
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono bg-black/20 px-3 py-1 rounded border border-black/20">
              Recorded: {recordedTimemap.length} measures
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="hover:bg-white/10 hover:text-white" onClick={handleCancelSync}>Cancel</Button>
              <Button size="sm" variant="secondary" className="bg-white text-red-700 hover:bg-red-50 font-bold" onClick={handleSaveSyncMap} disabled={recordedTimemap.length === 0}>Save Map</Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative bg-[#f0f2f5] dark:bg-[#181a1f] transition-colors duration-200">

        {/* Top Area: Sheet Music & Map Editor (Takes remaining space) */}
        <div className="flex-1 flex overflow-hidden relative">
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

          <div className="flex-1 overflow-hidden relative bg-white dark:bg-[#282c34] shadow-inner ring-1 ring-black/5 transition-colors duration-200">
            <MusicXMLVisualizer
              scoreFileId={scoreFileId}
              positionMs={positionMs}
              isPlaying={isPlaying}
              timemap={payload.notationData?.timemap || EMPTY_TIMEMAP}
              measureMap={payload.notationData?.measureMap}
              onSeek={handleSeek}
              onMidiExtracted={handleMidiExtracted}
              isDarkMode={isDarkMode}
            />
          </div>

          {showMapEditor && onPayloadChange && (
            <MeasureMapEditor
              payload={payload}
              positionMs={positionMs}
              onPayloadChange={onPayloadChange}
              onClose={() => setShowMapEditor(false)}
            />
          )}
        </div>

        {/* Bottom Area: Horizontal TrackList (Collapsible Height) */}
        <div
          className="shrink-0 z-20 relative border-t border-black flex flex-col"
          style={{ height: isTracksExpanded ? `${trackListHeight}px` : '28px' }}
        >
          {/* Resizer Handle */}
          {isTracksExpanded && (
            <div
              className="absolute top-0 left-0 right-0 h-1.5 -mt-0.5 bg-transparent hover:bg-blue-500/50 cursor-row-resize z-50 transition-colors"
              onMouseDown={handleResizerMouseDown}
            />
          )}

          <div className="flex-1 overflow-hidden relative">
            <TrackList
              tracks={displayTracks}
              muteByTrackId={muteByTrackId}
              soloByTrackId={soloByTrackId}
              onMuteChange={handleVirtualMuteChange}
              onSoloChange={handleVirtualSoloChange}
              onVolumeChange={handleVirtualVolumeChange}
              onOffsetChange={handleVirtualOffsetChange}
              audioManager={audioManagerRef.current}
              positionMs={positionMs}
              durationMs={durationMs}
              bpm={payload.metadata?.tempo || 120}
              timemap={payload.notationData?.timemap || EMPTY_TIMEMAP}
              timeSignature={{
                numerator: parseInt((payload.metadata?.timeSignature || "4/4").split("/")[0], 10) || 4,
                denominator: parseInt((payload.metadata?.timeSignature || "4/4").split("/")[1], 10) || 4
              }}
              isExpanded={isTracksExpanded}
              onToggleExpand={() => setIsTracksExpanded(!isTracksExpanded)}
              loopStartMs={activeLoopPoints?.startMs}
              loopEndMs={activeLoopPoints?.endMs}
              pitchShift={pitchShift}
              onPitchShiftChange={handlePitchShiftChange}
              audioReady={!loadingAudio}
              onSeek={handleSeek}
              onAddAudioTrack={onAddAudioTrack}
              onDeleteTrack={onDeleteTrack}
              syncToTimemap={!!payload.metadata?.syncToTimemap}
              isDarkMode={isDarkMode}
              midiBase64={midiBase64}
              uploadingAudio={uploadingAudio}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
