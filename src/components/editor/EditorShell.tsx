"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { TransportBar, type LoopState } from "./TransportBar";
import { TrackList } from "./TrackList";
import { MusicXMLVisualizer } from "./MusicXMLVisualizer";
import { MeasureMapEditor } from "./MeasureMapEditor";
import {
  Play, Pause, Square, Repeat, ChevronDown, ChevronUp, Music, ArrowLeft, MoreVertical, X, Tag, Activity, Map, PlaySquare, Sun, Moon, MoreHorizontal, Check, Image as ImageIcon, Share, Search, Wand2
} from "lucide-react";
import { useTheme } from "next-themes";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getFileViewUrl, createPost } from "@/lib/appwrite";
import { analyzeMusicXML, type MusicXMLAnalysis } from "@/lib/score/musicxml-analyzer";
import { ProjectActionsMenu } from "@/components/ProjectActionsMenu";
import { toast } from "sonner";
import { useDialogs } from "@/components/ui/dialog-provider";
import type { DAWPayload, AudioTrack, TimemapEntry } from "@/lib/daw/types";
import { AudioManager, type TrackParams } from "@/lib/audio/AudioManager";
import { MidiPlayerSingleton } from "@/lib/audio/MidiPlayerSingleton";
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
  /** Wiki entity links (Phase 2.5) */
  wikiGenreId?: string;
  onWikiGenreIdChange?: (id: string | undefined) => void;
  wikiInstrumentIds?: string[];
  onWikiInstrumentIdsChange?: (ids: string[]) => void;
  wikiCompositionId?: string;
  onWikiCompositionIdChange?: (id: string | undefined) => void;
  wikiComposerIds?: string[];
  onWikiComposerIdsChange?: (ids: string[]) => void;
  /** Pre-fetched wiki data for pickers */
  wikiInstruments?: { $id: string; name: string; family?: string }[];
  wikiGenres?: { $id: string; name: string; era?: string }[];
  wikiCompositions?: { $id: string; title: string; period?: string }[];
  wikiComposers?: { $id: string; name: string; roles?: string[] }[];
  uploadingScore?: boolean;
  uploadingAudio?: boolean;
  uploadError?: string | null;
  onUploadCover?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadingCover?: boolean;
  coverUrl?: string;
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
  wikiGenreId,
  onWikiGenreIdChange,
  wikiInstrumentIds = [],
  onWikiInstrumentIdsChange,
  wikiCompositionId,
  onWikiCompositionIdChange,
  wikiComposerIds = [],
  onWikiComposerIdsChange,
  wikiInstruments = [],
  wikiGenres = [],
  wikiCompositions = [],
  wikiComposers = [],
  uploadingScore = false,
  uploadingAudio = false,
  uploadError,
  onUploadCover,
  uploadingCover = false,
  coverUrl,
}: EditorShellProps) {
  const { prompt, confirm } = useDialogs();
  const [shareCopied, setShareCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [muteByTrackId, setMuteByTrackId] = useState<Record<string, boolean>>({});
  const [soloByTrackId, setSoloByTrackId] = useState<Record<string, boolean>>({});

  const audioManagerRef = useRef<AudioManager | null>(null);
  const correctedTimemapRef = useRef<TimemapEntry[] | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const positionMsRef = useRef(0);
  // positionMsRef is updated directly by RAF loop during playback (no re-renders).
  // setPositionMs is only called on stop/pause/seek/end to sync React state.
  /** Sync both ref and React state — use for stop/pause/seek/end */
  const syncPositionMs = useCallback((ms: number) => {
    positionMsRef.current = ms;
    setPositionMs(ms);
  }, []);
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
  const [tagTab, setTagTab] = useState<"inst" | "genre" | "comp" | "artist" | "diff">("inst");
  const [tagSearch, setTagSearch] = useState("");

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

  // Auto-unmute MIDI synth when no audio tracks exist (match PlayShell behavior)
  const isScoreSynthMuted = payload.audioTracks.length === 0
    ? false  // No audio tracks → always unmute score synth
    : (payload.metadata?.scoreSynthMuted ?? false);
  const midiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const midiPlayStartTimeRef = useRef<number>(0);
  const midiPlayStartPosRef = useRef<number>(0);

  // Phase 22: Per-part MIDI track info extracted from MIDI data
  interface ScoreMidiTrackInfo {
    index: number;       // Track index in @tonejs/midi
    name: string;        // Track/instrument name
    channel: number;     // MIDI channel
    noteCount: number;   // Number of notes in this track
    instrument: string;  // GM instrument name
  }
  const [scoreMidiTracks, setScoreMidiTracks] = useState<ScoreMidiTrackInfo[]>([]);
  const [scoreMidiMuted, setScoreMidiMuted] = useState<Record<number, boolean>>({});
  const [scoreMidiInstrumentOverride, setScoreMidiInstrumentOverride] = useState<Record<number, number>>(
    () => payload.metadata?.scoreMidiInstrumentOverrides || {} // Load from saved metadata
  );

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

      // Extract per-part track info
      const trackInfos: ScoreMidiTrackInfo[] = midi.tracks
        .map((t, i) => ({
          index: i,
          name: t.name || `Track ${i + 1}`,
          channel: t.channel ?? i,
          noteCount: t.notes.length,
          instrument: t.instrument?.name || "Piano",
        }))
        .filter(t => t.noteCount > 0); // Only tracks with notes
      setScoreMidiTracks(trackInfos);
      console.log(`[EditorShell] Extracted ${trackInfos.length} MIDI tracks:`, trackInfos.map(t => t.name));
    } catch (err) {
      console.error("Failed to parse initial MIDI offset", err);
      setMidiStartOffsetMs(0);
      setMidiDurationMs(0);
      setScoreMidiTracks([]);
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

  // Tags Editor (Phase 9 → Phase 2.5 wiki migration)
  const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
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

    try {
      const binaryString = window.atob(midiBase64.split(",")[1] || midiBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const midi = new Midi(bytes.buffer);
      const tempoTarget = payload.metadata?.tempo || 120;

      // Read Verovio's original MIDI tempos (before scaling)
      const originalTempos = midi.header.tempos.length > 0
        ? [...midi.header.tempos]
        : [{ ticks: 0, bpm: tempoTarget }];
      const ppq = midi.header.ppq || 480;

      // Preserve Verovio's original MIDI tempo events (which include intra-measure
      // rit./accel.) and just scale by playbackRate. This avoids cumulative drift
      // from simplified per-measure tempo approximations.
      midi.header.tempos = originalTempos.map(t => ({
        ticks: t.ticks,
        bpm: t.bpm * playbackRate,
      }));

      // Recalculate timemap timeMs from Verovio's MIDI tempo events.
      // Priority: 'manual' → skip (user timeMs authoritative), 'auto' → override,
      // undefined (legacy) → fallback to MIDI-only heuristic (no audio tracks).
      const tmSource = payload.notationData?.timemapSource;
      const shouldCorrectTimemap = tmSource === 'auto' || (tmSource === undefined && payload.audioTracks.length === 0);
      const timemap = payload.notationData?.timemap;
      if (shouldCorrectTimemap && timemap && timemap.length > 0) {
        // Convert ticks to wall-clock ms using MIDI tempo events (already scaled by playbackRate)
        const scaledTempos = midi.header.tempos.sort((a, b) => a.ticks - b.ticks);
        
        const ticksToMs = (targetTick: number): number => {
          let ms = 0;
          let lastTick = 0;
          let currentBpm = scaledTempos[0]?.bpm || tempoTarget * playbackRate;
          
          for (const t of scaledTempos) {
            if (t.ticks >= targetTick) break;
            // Accumulate time from lastTick to this tempo change
            const tickDelta = t.ticks - lastTick;
            ms += (tickDelta / ppq) * (60000 / currentBpm);
            lastTick = t.ticks;
            currentBpm = t.bpm;
          }
          // Remaining ticks after the last tempo change
          const remaining = targetTick - lastTick;
          ms += (remaining / ppq) * (60000 / currentBpm);
          return ms;
        };

        let accTicks = 0;
        const correctedTimemap = timemap.map(entry => {
          const correctedTimeMs = ticksToMs(accTicks);
          const durationQuarters = entry.durationInQuarters ?? 
            (() => {
              const ts = entry.timeSignature || payload.metadata?.timeSignature || "4/4";
              const [num, den] = ts.split("/").map(Number);
              return (num || 4) * (4 / (den || 4));
            })();
          accTicks += durationQuarters * ppq;
          return { ...entry, timeMs: correctedTimeMs };
        });

        // Store corrected timemap in ref for playhead sync
        correctedTimemapRef.current = correctedTimemap;
      } else {
        correctedTimemapRef.current = null;
      }


      midi.tracks.forEach((track, trackIndex) => {
        // Apply pitch shift
        if (pitchShift !== 0) {
          track.notes.forEach(note => {
            const newMidi = note.midi + pitchShift;
            if (newMidi >= 0 && newMidi <= 127) {
              note.midi = newMidi;
            }
          });
        }

        // Phase 22: Mute tracks by clearing notes for muted channels
        if (scoreMidiMuted[trackIndex]) {
          track.notes.length = 0;
        }

        // Apply instrument override (change MIDI program/channel instrument)
        if (scoreMidiInstrumentOverride[trackIndex] !== undefined) {
          track.instrument.number = scoreMidiInstrumentOverride[trackIndex] - 1; // @tonejs/midi uses 0-indexed
        }

        // Apply per-track volume via velocity scaling (read from metadata, not reactive)
        const perTrackVols = payload.metadata?.scoreMidiPerTrackVolume;
        const trackVolume = perTrackVols?.[trackIndex];
        if (trackVolume !== undefined && trackVolume < 1.0) {
          track.notes.forEach(note => {
            note.velocity = Math.max(0.01, note.velocity * trackVolume);
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

      // Only update the player's src when NOT playing.
      // html-midi-player can't hot-swap src without audio interruption,
      // so mute/instrument changes take effect on next play.
      if (midiPlayerRef.current && !isPlayingRef.current) {
        midiPlayerRef.current.src = newBase64;
      }

    } catch (e) {
      console.error("[EditorShell] Failed to transform MIDI for pitch/time shift", e);
      setStretchedMidiBase64(midiBase64); // fallback
    }
    // Note: scoreMidiPerTrackVolume intentionally excluded from deps — volume changes
    // save to metadata but don't trigger MIDI regeneration during playback to avoid
    // audio interruption. Volume is applied whenever MIDI regenerates for other reasons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midiBase64, playbackRate, pitchShift, payload.metadata?.tempo, scoreMidiMuted, scoreMidiInstrumentOverride]);

  useEffect(() => {
    // Initialize standard Web Audio Manager
    if (!audioManagerRef.current) {
      audioManagerRef.current = new AudioManager();
      const tempo = payload.metadata?.tempo || 120;
      audioManagerRef.current.getMetronome()?.setTempoParams(tempo, timeSignature, payload.metadata?.timeSignature || "4/4");
      MidiPlayerSingleton.setAudioManager(audioManagerRef.current);
    }

    // Cleanup on unmount
    return () => {
      MidiPlayerSingleton.cleanup();
      if (audioManagerRef.current) {
        audioManagerRef.current.stop();
        audioManagerRef.current = null;
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
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
      // Use smooth internal performance clock since <midi-player> native currentTime updates discretely only on note events
      const elapsedMs = performance.now() - midiPlayStartTimeRef.current;
      currentPos = Math.max(0, midiPlayStartPosRef.current + (elapsedMs * playbackRate));
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
      syncPositionMs(0);
      return;
    }

    // Update ref only — no setPositionMs() to avoid triggering React re-renders
    positionMsRef.current = Math.round(currentPos);

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
        timemapSource: "manual" as const,
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

    if (midiPlayerRef.current && stretchedMidiBase64 && !isScoreSynthMuted) {
      MidiPlayerSingleton.setPlayer(midiPlayerRef.current);
      const offsetMs = payload.metadata?.scoreSynthOffsetMs || 0;
      const targetTimeSecs = (positionMsRef.current - offsetMs + midiStartOffsetMs) / 1000;

      if (targetTimeSecs >= 0) {
        midiPlayerRef.current.currentTime = targetTimeSecs;
        playPromises.push(Promise.resolve(midiPlayerRef.current.start()).catch((e: any) => console.error(e)));
      } else {
        midiPlayerRef.current.currentTime = 0;
        const delayMs = -targetTimeSecs * 1000;
        midiTimeoutRef.current = setTimeout(() => {
          if (isPlayingRef.current && !isScoreSynthMuted) { // We check isPlayingRef instead of state isPlaying because it's a timeout
            Promise.resolve(midiPlayerRef.current.start()).catch(e => console.error(e));
          }
        }, delayMs);
      }
    }
    if (audioManagerRef.current && payload.audioTracks.length > 0) {
      playPromises.push(Promise.resolve(audioManagerRef.current.play()).catch((e: any) => console.error(e)));
    }

    // Capture accurate Start Times for Smooth MIDI Telemetry Interpolation Tracker
    if (payload.audioTracks.length === 0) {
      midiPlayStartTimeRef.current = performance.now();
      midiPlayStartPosRef.current = positionMsRef.current;
    }

    await Promise.allSettled(playPromises);
    setIsPlaying(true);
    isPlayingRef.current = true;
  }, [payload.audioTracks.length, stretchedMidiBase64, isScoreSynthMuted, midiStartOffsetMs, payload.metadata?.scoreSynthOffsetMs]);

  const handlePause = useCallback(() => {
    if (midiTimeoutRef.current) clearTimeout(midiTimeoutRef.current);
    if (midiPlayerRef.current) {
      midiPlayerRef.current.stop(); // html-midi-player doesn't have pause(), stop() pauses it.
    }
    if (audioManagerRef.current && payload.audioTracks.length > 0) {
      audioManagerRef.current.pause();
    }
    setIsPlaying(false);
    isPlayingRef.current = false;

    if (audioManagerRef.current && payload.audioTracks.length > 0) {
      syncPositionMs(audioManagerRef.current.getCurrentPositionMs()); // force update
    } else if (midiPlayerRef.current) {
      syncPositionMs(Math.max(0, midiPlayerRef.current.currentTime * 1000 - midiStartOffsetMs));
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
    syncPositionMs(0);
  }, [payload.audioTracks.length]);

  const handleSeek = useCallback((ms: number) => {
    if (midiTimeoutRef.current) clearTimeout(midiTimeoutRef.current);
    const offsetMs = payload.metadata?.scoreSynthOffsetMs || 0;
    if (midiPlayerRef.current) {
      const targetTimeSecs = (ms - offsetMs + midiStartOffsetMs) / 1000;
      if (targetTimeSecs >= 0) {
        midiPlayerRef.current.currentTime = targetTimeSecs;
        if (isPlayingRef.current && !isScoreSynthMuted) {
          Promise.resolve(midiPlayerRef.current.start()).catch((e: any) => console.error(e));
        }
      } else {
        midiPlayerRef.current.stop();
        midiPlayerRef.current.currentTime = 0;
        if (isPlayingRef.current && !isScoreSynthMuted) {
          const delayMs = -targetTimeSecs * 1000;
          midiTimeoutRef.current = setTimeout(() => {
            if (isPlayingRef.current && !isScoreSynthMuted) {
              Promise.resolve(midiPlayerRef.current.start()).catch(e => console.error(e));
            }
          }, delayMs);
        }
      }
    }
    if (audioManagerRef.current && payload.audioTracks.length > 0) {
      audioManagerRef.current.seek(ms);
    }
    syncPositionMs(ms);

    // Sync continuous MIDI telemetry stopwatch
    if (payload.audioTracks.length === 0) {
      midiPlayStartTimeRef.current = performance.now();
      midiPlayStartPosRef.current = ms;
    }
  }, [payload.audioTracks.length, midiStartOffsetMs, payload.metadata?.scoreSynthOffsetMs, isScoreSynthMuted]);

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

  const handleShareToFeed = useCallback(async () => {
    if (!projectId || !isPublished) {
      toast.error("You must publish the project first to share it on your feed.");
      return;
    }
    const caption = await prompt({
      title: "Share Project to Feed",
      description: "Write a caption for your post:",
      confirmText: "Share",
      cancelText: "Cancel",
    });
    if (caption !== null) {
      try {
        await createPost({
          content: caption,
          attachmentType: "project",
          attachmentId: projectId,
        });
        toast.success("Project shared to your timeline feed!");
      } catch (err) {
        toast.error("Failed to share project to feed.");
      }
    }
  }, [projectId, prompt, isPublished]);

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

  // ── MusicXML Auto-Analyze ──
  const [analyzing, setAnalyzing] = useState(false);

  const handleAutoAnalyze = useCallback(async () => {
    const fileId = payload.notationData?.fileId;
    if (!fileId) return;

    setAnalyzing(true);
    try {
      // Fetch MusicXML from storage
      const url = getFileViewUrl(fileId);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = await res.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let xmlText: string;

      // Detect MXL (ZIP) by magic bytes "PK" (0x50, 0x4B)
      if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(buffer);
        const xmlFile = Object.keys(zip.files).find(f => f.endsWith('.xml') && !f.startsWith('META-INF'));
        if (!xmlFile) throw new Error('No XML file found in MXL archive');
        xmlText = await zip.files[xmlFile].async('string');
      } else {
        xmlText = new TextDecoder().decode(buffer);
      }

      const analysis = analyzeMusicXML(xmlText);

      // Build description for confirm dialog
      const lines = [
        `Tempo: ♩= ${Math.round(analysis.tempo)} BPM`,
        `Time Sig: ${analysis.timeSignature}`,
        `Key: ${analysis.keySignature}`,
        `Measures: ${analysis.totalMeasures} (sheet) → ${analysis.totalPlaybackMeasures} (playback)`,
      ];
      if (analysis.tempoChanges.length > 1) {
        lines.push(`\nTempo changes: ${analysis.tempoChanges.map(([m, t]) => `M${m}:${Math.round(t)}`).join(' → ')}`);
      }
      if (analysis.repeatDescriptions.length > 0) {
        lines.push(`\nRepeats: ${analysis.repeatDescriptions.join(', ')}`);
      }

      const ok = await confirm({
        title: '📋 MusicXML Analysis',
        description: lines.join('\n'),
        confirmText: 'Apply All',
        cancelText: 'Cancel',
      });

      if (ok && onPayloadChange) {
        onPayloadChange({
          ...payload,
          metadata: {
            ...payload.metadata,
            tempo: Math.round(analysis.tempo),
            timeSignature: analysis.timeSignature,
            keySignature: analysis.keySignature,
          },
          notationData: {
            ...payload.notationData!,
            timemap: analysis.timemap,
            measureMap: Object.keys(analysis.measureMap).length > 0 ? analysis.measureMap : undefined,
          },
        });
        toast.success(`Applied: ${analysis.totalPlaybackMeasures} measures, ${analysis.tempoChanges.length} tempo event(s)`);
      }
    } catch (err: any) {
      console.error('Auto-analyze failed:', err);
      toast.error(`Analysis failed: ${err.message || 'Unknown error'}`);
    } finally {
      setAnalyzing(false);
    }
  }, [payload, onPayloadChange, confirm]);

  const scoreFileId = payload.notationData?.fileId;

  // Phase 22: Inject per-part MIDI tracks if multi-track info available, else fall back to single Score Synth
  const displayTracks = useMemo(() => {
    const tracks = [...payload.audioTracks];
    if (scoreFileId) {
      if (scoreMidiTracks.length > 0) {
        // Multi-track mode: one track per MusicXML part
        scoreMidiTracks.forEach((mt) => {
          tracks.push({
            id: `score-midi-${mt.index}`,
            name: mt.name,
            type: "midi",
            muted: scoreMidiMuted[mt.index] ?? false,
            solo: false,
            volume: payload.metadata?.scoreMidiPerTrackVolume?.[mt.index] ?? 1.0,
            pan: 0,
            offsetMs: payload.metadata?.scoreSynthOffsetMs ?? 0,
          });
        });
      } else {
        // Fallback: single Score Synth track
        tracks.push({
          id: "score-midi",
          name: "Score Synth (Piano)",
          type: "midi",
          muted: isScoreSynthMuted,
          solo: payload.metadata?.scoreSynthSolo ?? false,
          volume: payload.metadata?.scoreSynthVolume ?? 1.0,
          pan: 0,
          offsetMs: payload.metadata?.scoreSynthOffsetMs ?? 0,
        });
      }
    }
    return tracks;
  }, [payload.audioTracks, scoreFileId, payload.metadata, scoreMidiTracks, scoreMidiMuted]);

  // Build channel map for PianoRollRegion per-track filtering
  const midiChannelByTrackId = useMemo(() => {
    const map: Record<string, number> = {};
    scoreMidiTracks.forEach(mt => {
      map[`score-midi-${mt.index}`] = mt.channel;
    });
    return map;
  }, [scoreMidiTracks]);

  // Build instrument map for TrackList instrument picker
  const midiInstrumentByTrackId = useMemo(() => {
    const map: Record<string, number> = {};
    scoreMidiTracks.forEach(mt => {
      const override = scoreMidiInstrumentOverride[mt.index];
      if (override !== undefined) {
        map[`score-midi-${mt.index}`] = override;
      }
    });
    return map;
  }, [scoreMidiTracks, scoreMidiInstrumentOverride]);

  const handleInstrumentChange = useCallback((trackId: string, program: number | null) => {
    if (!trackId.startsWith("score-midi-")) return;
    const idx = parseInt(trackId.replace("score-midi-", ""), 10);
    let nextOverrides: Record<number, number> = {};
    setScoreMidiInstrumentOverride(prev => {
      const next = { ...prev };
      if (program === null) {
        delete next[idx];
      } else {
        next[idx] = program;
      }
      nextOverrides = next;
      return next;
    });
    // Persist to metadata outside the updater to avoid setState-during-render
    if (onPayloadChange) {
      setTimeout(() => {
        onPayloadChange({ ...payload, metadata: { ...payload.metadata, scoreMidiInstrumentOverrides: nextOverrides } });
      }, 0);
    }
  }, [onPayloadChange, payload]);

  const handleVirtualMuteChange = useCallback((trackId: string, mute: boolean) => {
    // Per-part MIDI track mute: score-midi-0, score-midi-1, etc.
    if (trackId.startsWith("score-midi-")) {
      const trackIndex = parseInt(trackId.replace("score-midi-", ""), 10);
      setScoreMidiMuted(prev => ({ ...prev, [trackIndex]: mute }));
      setMuteByTrackId(prev => ({ ...prev, [trackId]: mute }));
      return;
    }
    // Legacy single Score Synth track
    if (trackId === "score-midi") {
      setMuteByTrackId(prev => ({ ...prev, [trackId]: mute }));
      if (onPayloadChange) {
        onPayloadChange({ ...payload, metadata: { ...payload.metadata, scoreSynthMuted: mute } });
      }
      return;
    }
    handleMuteChange(trackId, mute);
  }, [handleMuteChange, onPayloadChange, payload]);

  // Dynamic MIDI Mute/Unmute during playback (legacy single-track mode only)
  useEffect(() => {
    if (!midiPlayerRef.current) return;
    // Skip in multi-track mode — muting is handled by scoreMidiMuted → stretchedMidiBase64 regeneration
    if (scoreMidiTracks.length > 0) return;
    if (isPlaying) {
      if (isScoreSynthMuted) {
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
            if (isPlayingRef.current && !isScoreSynthMuted) {
              Promise.resolve(midiPlayerRef.current.start()).catch(e => console.error(e));
            }
          }, -targetTimeSecs * 1000);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScoreSynthMuted]);

  const handleVirtualSoloChange = useCallback((trackId: string, solo: boolean) => {
    // Per-part MIDI track solo: toggle solo on this track and mute others
    if (trackId.startsWith("score-midi-")) {
      const trackIndex = parseInt(trackId.replace("score-midi-", ""), 10);
      setSoloByTrackId(prev => ({ ...prev, [trackId]: solo }));
      if (solo) {
        // Solo this track: mute all other MIDI tracks
        const newMuted: Record<number, boolean> = {};
        scoreMidiTracks.forEach(mt => {
          newMuted[mt.index] = mt.index !== trackIndex;
        });
        setScoreMidiMuted(newMuted);
        setMuteByTrackId(prev => {
          const next = { ...prev };
          scoreMidiTracks.forEach(mt => {
            next[`score-midi-${mt.index}`] = mt.index !== trackIndex;
          });
          return next;
        });
      } else {
        // Un-solo: unmute all MIDI tracks
        const newMuted: Record<number, boolean> = {};
        scoreMidiTracks.forEach(mt => { newMuted[mt.index] = false; });
        setScoreMidiMuted(newMuted);
        setMuteByTrackId(prev => {
          const next = { ...prev };
          scoreMidiTracks.forEach(mt => {
            next[`score-midi-${mt.index}`] = false;
          });
          return next;
        });
      }
      return;
    }
    // Legacy single Score Synth track
    if (trackId === "score-midi") {
      setSoloByTrackId(prev => ({ ...prev, [trackId]: solo }));
      if (onPayloadChange) {
        onPayloadChange({ ...payload, metadata: { ...payload.metadata, scoreSynthSolo: solo } });
      }
      return;
    }
    handleSoloChange(trackId, solo);
  }, [handleSoloChange, onPayloadChange, payload, scoreMidiTracks]);

  const handleVirtualVolumeChange = useCallback((trackId: string, volume: number) => {
    if (trackId.startsWith("score-midi-")) {
      const idx = parseInt(trackId.replace("score-midi-", ""), 10);
      const currentPerTrack = payload.metadata?.scoreMidiPerTrackVolume || {};
      const newPerTrack = { ...currentPerTrack, [idx]: volume };
      if (onPayloadChange) {
        onPayloadChange({ ...payload, metadata: { ...payload.metadata, scoreMidiPerTrackVolume: newPerTrack } });
      }
      return;
    }
    handleVolumeChange(trackId, volume);
  }, [handleVolumeChange, onPayloadChange, payload]);

  const handleVirtualOffsetChange = useCallback((trackId: string, offsetMs: number) => {
    if (trackId.startsWith("score-midi")) {
      if (onPayloadChange) {
        onPayloadChange({ ...payload, metadata: { ...payload.metadata, scoreSynthOffsetMs: offsetMs } });
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
        positionMsRef={positionMsRef}
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
            {coverUrl && (
              <img src={coverUrl} alt="Cover" className="w-6 h-6 rounded-sm object-cover shadow-sm shrink-0 border border-zinc-200 dark:border-zinc-700" />
            )}
            <span className="shrink-0 hidden sm:inline">Title:</span>
            <input
              value={projectName}
              onChange={e => onNameChange(e.target.value)}
              className="bg-transparent dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-200 w-full min-w-[150px] border border-zinc-300 dark:border-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-[#222] focus:border-blue-500 rounded px-2 py-1 outline-none transition-colors shadow-inner"
              placeholder="Project Name"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            {coverUrl && (
              <img src={coverUrl} alt="Cover" className="w-6 h-6 rounded-sm object-cover shadow-sm shrink-0 border border-zinc-200 dark:border-zinc-700" />
            )}
            <span className="truncate max-w-[200px] text-zinc-900 dark:text-zinc-300 font-medium">{projectName || "Untitled"}</span>
          </div>
        )}

        {/* Tags UI (Compact Button) */}
        {tags !== undefined && (
          <div className="shrink-0 mr-auto flex items-center">
            <DropdownMenu onOpenChange={() => { setTagSearch(""); setTagTab("inst"); }}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 rounded-md text-xs font-semibold text-zinc-600 dark:text-zinc-300 shadow-sm transition-colors focus:outline-none">
                  <Tag className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tags</span>
                  {(tags.length + wikiInstrumentIds.length + (wikiGenreId ? 1 : 0) + (wikiCompositionId ? 1 : 0) + wikiComposerIds.length) > 0 && (
                    <span className="bg-[#C8A856] text-black text-[10px] font-bold px-1.5 rounded-full min-w-[20px] text-center flex items-center justify-center -ml-0.5">
                      {tags.length + wikiInstrumentIds.length + (wikiGenreId ? 1 : 0) + (wikiCompositionId ? 1 : 0) + wikiComposerIds.length}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72 bg-white dark:bg-[#1A1A1E] border-zinc-200 dark:border-zinc-800 shadow-xl p-0 z-[150]" align="start">
                {/* Tabs row */}
                <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-1 pt-1">
                  {([
                    { key: "inst" as const, label: "🎹", title: "Instruments", count: wikiInstrumentIds.length },
                    { key: "genre" as const, label: "🎵", title: "Genre", count: wikiGenreId ? 1 : 0 },
                    { key: "comp" as const, label: "📄", title: "Composition", count: wikiCompositionId ? 1 : 0 },
                    { key: "artist" as const, label: "👤", title: "Composer", count: wikiComposerIds.length },
                    { key: "diff" as const, label: "📊", title: "Difficulty", count: tags.filter(t => DIFFICULTY_OPTIONS.includes(t)).length },
                  ]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={(e) => { e.preventDefault(); setTagTab(tab.key); setTagSearch(""); }}
                      title={tab.title}
                      className={cn(
                        "flex-1 py-1.5 text-center text-sm rounded-t-md transition-colors relative",
                        tagTab === tab.key
                          ? "bg-zinc-100 dark:bg-zinc-800 font-bold"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-400"
                      )}
                    >
                      {tab.label}
                      {tab.count > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 bg-[#C8A856] text-black text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Search (for tabs with many items) */}
                {["inst", "comp", "artist"].includes(tagTab) && (
                  <div className="px-2 pt-2 pb-1">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                      <input
                        value={tagSearch}
                        onChange={e => setTagSearch(e.target.value)}
                        placeholder="Search..."
                        className="w-full pl-7 pr-2 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:border-[#C8A856] transition-colors"
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => e.stopPropagation()}
                      />
                    </div>
                  </div>
                )}

                {/* Tab content */}
                <div className="max-h-64 overflow-y-auto px-1 pb-1">
                  {/* Instruments tab */}
                  {tagTab === "inst" && wikiInstruments.length > 0 && (
                    <div>
                      {(isOwner ? wikiInstruments : wikiInstruments.filter(i => wikiInstrumentIds.includes(i.$id)))
                        .filter(i => !tagSearch || i.name.toLowerCase().includes(tagSearch.toLowerCase()))
                        .map(inst => {
                          const isSelected = wikiInstrumentIds.includes(inst.$id);
                          return (
                            <DropdownMenuItem
                              key={inst.$id}
                              onClick={(e) => {
                                if (!isOwner || !onWikiInstrumentIdsChange) { e.preventDefault(); return; }
                                const newIds = isSelected
                                  ? wikiInstrumentIds.filter(id => id !== inst.$id)
                                  : [...wikiInstrumentIds, inst.$id];
                                onWikiInstrumentIdsChange(newIds);
                                e.preventDefault();
                              }}
                              className={cn(
                                "text-xs font-semibold px-2 py-1.5 cursor-pointer rounded transition-colors flex items-center justify-between group",
                                isOwner ? "hover:bg-zinc-100 dark:hover:bg-zinc-800" : "cursor-default",
                                isSelected ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20" : "text-zinc-600 dark:text-zinc-400"
                              )}
                            >
                              <span>{inst.name}{inst.family && <span className="text-zinc-400 ml-1 text-[10px]">({inst.family})</span>}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />}
                            </DropdownMenuItem>
                          );
                        })}
                    </div>
                  )}

                  {/* Genre tab */}
                  {tagTab === "genre" && wikiGenres.length > 0 && (
                    <div>
                      {(isOwner ? wikiGenres : wikiGenres.filter(g => g.$id === wikiGenreId)).map(genre => {
                        const isSelected = wikiGenreId === genre.$id;
                        return (
                          <DropdownMenuItem
                            key={genre.$id}
                            onClick={(e) => {
                              if (!isOwner || !onWikiGenreIdChange) { e.preventDefault(); return; }
                              onWikiGenreIdChange(isSelected ? undefined : genre.$id);
                              e.preventDefault();
                            }}
                            className={cn(
                              "text-xs font-semibold px-2 py-1.5 cursor-pointer rounded transition-colors flex items-center justify-between group",
                              isOwner ? "hover:bg-zinc-100 dark:hover:bg-zinc-800" : "cursor-default",
                              isSelected ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "text-zinc-600 dark:text-zinc-400"
                            )}
                          >
                            <span>{genre.name}{genre.era && <span className="text-zinc-400 ml-1 text-[10px]">({genre.era})</span>}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </div>
                  )}

                  {/* Composition tab */}
                  {tagTab === "comp" && wikiCompositions.length > 0 && (
                    <div>
                      {(isOwner ? wikiCompositions : wikiCompositions.filter(c => c.$id === wikiCompositionId))
                        .filter(c => !tagSearch || c.title.toLowerCase().includes(tagSearch.toLowerCase()))
                        .map(comp => {
                          const isSelected = wikiCompositionId === comp.$id;
                          return (
                            <DropdownMenuItem
                              key={comp.$id}
                              onClick={(e) => {
                                if (!isOwner || !onWikiCompositionIdChange) { e.preventDefault(); return; }
                                onWikiCompositionIdChange(isSelected ? undefined : comp.$id);
                                e.preventDefault();
                              }}
                              className={cn(
                                "text-xs font-semibold px-2 py-1.5 cursor-pointer rounded transition-colors flex items-center justify-between group",
                                isOwner ? "hover:bg-zinc-100 dark:hover:bg-zinc-800" : "cursor-default",
                                isSelected ? "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20" : "text-zinc-600 dark:text-zinc-400"
                              )}
                            >
                              <span>{comp.title}{comp.period && <span className="text-zinc-400 ml-1 text-[10px]">({comp.period})</span>}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />}
                            </DropdownMenuItem>
                          );
                        })}
                    </div>
                  )}

                  {/* Composer tab */}
                  {tagTab === "artist" && wikiComposers.length > 0 && (
                    <div>
                      {(isOwner ? wikiComposers : wikiComposers.filter(a => wikiComposerIds.includes(a.$id)))
                        .filter(a => !tagSearch || a.name.toLowerCase().includes(tagSearch.toLowerCase()))
                        .map(artist => {
                          const isSelected = wikiComposerIds.includes(artist.$id);
                          return (
                            <DropdownMenuItem
                              key={artist.$id}
                              onClick={(e) => {
                                if (!isOwner || !onWikiComposerIdsChange) { e.preventDefault(); return; }
                                const newIds = isSelected
                                  ? wikiComposerIds.filter(id => id !== artist.$id)
                                  : [...wikiComposerIds, artist.$id];
                                onWikiComposerIdsChange(newIds);
                                e.preventDefault();
                              }}
                              className={cn(
                                "text-xs font-semibold px-2 py-1.5 cursor-pointer rounded transition-colors flex items-center justify-between group",
                                isOwner ? "hover:bg-zinc-100 dark:hover:bg-zinc-800" : "cursor-default",
                                isSelected ? "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20" : "text-zinc-600 dark:text-zinc-400"
                              )}
                            >
                              <span>{artist.name}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />}
                            </DropdownMenuItem>
                          );
                        })}
                    </div>
                  )}

                  {/* Difficulty tab */}
                  {tagTab === "diff" && (
                    <div>
                      {DIFFICULTY_OPTIONS.map(tag => {
                        const isSelected = tags.includes(tag);
                        if (!isOwner && !isSelected) return null;
                        return (
                          <DropdownMenuItem
                            key={tag}
                            onClick={(e) => {
                              if (!isOwner) { e.preventDefault(); return; }
                              handleToggleTag(tag);
                              e.preventDefault();
                            }}
                            className={cn(
                              "text-xs font-semibold px-2 py-1.5 cursor-pointer rounded transition-colors flex items-center justify-between group",
                              isOwner ? "hover:bg-zinc-100 dark:hover:bg-zinc-800" : "cursor-default",
                              isSelected ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "text-zinc-600 dark:text-zinc-400"
                            )}
                          >
                            <span>{tag}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <div className="flex-1 flex items-center justify-end gap-3 shrink-0">
          {projectId && <ProjectActionsMenu projectId={projectId} />}

          {/* Unified Tooling Navigation (Desktop & Mobile) */}
          <div className="flex items-center gap-2">
            {isOwner && (
              <>
                <Button size="sm" onClick={onSave} disabled={saving} className="h-7 px-3 bg-zinc-700 hover:bg-zinc-600 text-white text-[11px] uppercase font-bold tracking-wider rounded border border-zinc-600 hidden sm:flex">
                  {saving ? "Saving…" : "Save"}
                </Button>
                {onPublish && !isPublished && (
                  <Button size="sm" onClick={onPublish} disabled={publishing} className="h-7 px-3 bg-[#C8A856] hover:bg-[#D4B86A] text-black text-[11px] uppercase font-bold tracking-wider rounded border border-[#C8A856]/50 hidden sm:flex">
                    {publishing ? "Publishing…" : "Publish"}
                  </Button>
                )}
                {onUnpublish && isPublished && (
                  <Button size="sm" onClick={onUnpublish} disabled={publishing} className="h-7 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] uppercase font-bold tracking-wider rounded border border-zinc-600 hidden sm:flex">
                    {publishing ? "Unpublishing…" : "Unpublish"}
                  </Button>
                )}
              </>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors focus:outline-none">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 bg-white dark:bg-[#1A1A1E] border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300 p-1 z-[150] shadow-xl">
                {projectId && (
                  <DropdownMenuItem asChild className="cursor-pointer font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800 py-2.5 text-xs transition-colors">
                    <Link href={`/play/${projectId}`} className="flex w-full items-center gap-2 text-blue-600 dark:text-blue-400">
                      <PlaySquare className="w-3.5 h-3.5" /> Play Mode
                    </Link>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem onClick={handleShareToFeed} className="cursor-pointer font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-2.5 text-xs transition-colors flex items-center gap-2">
                  <Share className="w-3.5 h-3.5" /> Share to Feed
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-2.5 text-xs transition-colors flex items-center gap-2 mb-1">
                  <Activity className="w-3.5 h-3.5" /> {shareCopied ? "Copied Link!" : "Copy Link"}
                </DropdownMenuItem>

                {isOwner && (
                  <>
                    <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-1 mx-2" />
                    {onUploadCover && (
                      <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()} className="cursor-pointer font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-2.5 text-xs transition-colors">
                        <label className="flex w-full cursor-pointer items-center gap-2">
                          <ImageIcon className="w-3.5 h-3.5" />
                          {uploadingCover ? "Uploading..." : "Upload Cover Art"}
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                            onUploadCover(e);
                            // Let user close menu manually or auto-close if we had access to trigger state.
                          }} disabled={uploadingCover} />
                        </label>
                      </DropdownMenuItem>
                    )}
                    {onUploadScore && (
                      <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()} className="cursor-pointer font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-2.5 text-xs transition-colors">
                        <label className="flex w-full cursor-pointer items-center gap-2">
                          <Music className="w-3.5 h-3.5" />
                          {uploadingScore ? "Uploading..." : "+ MusicXML Score"}
                          <input type="file" className="hidden" accept=".musicxml,.xml,.mxl" onChange={onUploadScore} disabled={uploadingScore} />
                        </label>
                      </DropdownMenuItem>
                    )}

                    {/* Expose Save/Publish internally on Mobile */}
                    <DropdownMenuItem onClick={onSave} disabled={saving} className="sm:hidden cursor-pointer font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800 py-2.5 mt-1 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white transition-colors">
                      {saving ? "Saving..." : "Save Project"}
                    </DropdownMenuItem>
                    {onPublish && !isPublished && (
                      <DropdownMenuItem onClick={onPublish} disabled={publishing} className="sm:hidden cursor-pointer font-semibold hover:bg-[#C8A856]/10 focus:bg-[#C8A856]/10 py-2.5 text-xs text-[#C8A856] transition-colors">
                        {publishing ? "Publishing..." : "Publish Project"}
                      </DropdownMenuItem>
                    )}
                  </>
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
            {/* Auto-Analyze floating button */}
            {scoreFileId && isOwner && (
              <button
                onClick={handleAutoAnalyze}
                disabled={analyzing}
                className="absolute top-2 right-2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold shadow-lg hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 transition-all"
                title="Auto-analyze MusicXML: extract tempo, time signature, key, repeats"
              >
                <Wand2 className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
                {analyzing ? 'Analyzing...' : 'Auto-Analyze'}
              </button>
            )}
            <MusicXMLVisualizer
              scoreFileId={scoreFileId}
              positionMs={positionMs}
              externalPositionMsRef={positionMsRef}
              isPlaying={isPlaying}
              timemap={correctedTimemapRef.current || payload.notationData?.timemap || EMPTY_TIMEMAP}
              measureMap={payload.notationData?.measureMap}
              onSeek={handleSeek}
              onMidiExtracted={handleMidiExtracted}
              isDarkMode={isDarkMode}
            />

            {/* Empty-state upload shortcut for owners */}
            {!scoreFileId && isOwner && onUploadScore && (
              <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer group z-10 bg-white/80 dark:bg-[#282c34]/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4 px-10 py-10 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 group-hover:border-[#C8A856] group-hover:bg-[#C8A856]/5 transition-all duration-200">
                  <Music className="w-16 h-16 text-zinc-300 dark:text-zinc-700 group-hover:text-[#C8A856] transition-colors duration-200" />
                  <div className="text-center">
                    <p className="text-lg font-bold text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                      {uploadingScore ? "Uploading..." : "Click to Upload Sheet Music"}
                    </p>
                    <p className="text-sm text-zinc-400 dark:text-zinc-600 mt-1.5">MusicXML · .xml · .mxl</p>
                  </div>
                  {uploadingScore && (
                    <div className="w-5 h-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                <input type="file" className="hidden" accept=".musicxml,.xml,.mxl" onChange={onUploadScore} disabled={uploadingScore} />
              </label>
            )}
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
              positionMsRef={positionMsRef}
              isPlaying={isPlaying}
              durationMs={totalSongDurationMs}
              bpm={payload.metadata?.tempo || 120}
              timemap={correctedTimemapRef.current || payload.notationData?.timemap || EMPTY_TIMEMAP}
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
              midiChannelByTrackId={midiChannelByTrackId}
              midiInstrumentByTrackId={midiInstrumentByTrackId}
              onInstrumentChange={handleInstrumentChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
