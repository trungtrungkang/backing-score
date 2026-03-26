"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { TransportBar, type LoopState } from "./TransportBar";
import { TrackList } from "./TrackList";
import { useTheme } from "next-themes";
import { getFileViewUrl } from "@/lib/appwrite";
import type { DAWPayload, AudioTrack } from "@/lib/daw/types";
import { type TrackParams } from "@/lib/audio/AudioManager";
import { useScoreEngine } from "@/hooks/useScoreEngine";
import { EditorActionBar } from "./EditorActionBar";
import { EditorTagsPicker } from "./EditorTagsPicker";
import { SyncModeHUD } from "./SyncModeHUD";
import { EditorScorePanel } from "./EditorScorePanel";

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


  // ======================= SHARED PLAYBACK ENGINE =======================
  const { state: engineState, refs: engineRefs, actions: engineActions } = useScoreEngine({
    payload,
    onPayloadChange,
  });
  const {
    positionMs, isPlaying, loadingAudio, playbackRate, pitchShift,
    isMetronomeEnabled, isPreRollEnabled, stretchedMidiBase64, midiBase64,
    muteByTrackId, soloByTrackId, totalSongDurationMs, parsedMidi,
    isScoreSynthMuted, loopState, timeSignature, durationMs, midiStartOffsetMs,
  } = engineState;
  const { midiPlayerRef, positionMsRef, audioManagerRef, isPlayingRef, midiTimeoutRef } = engineRefs;
  const {
    handlePlay, handlePause, handleStop, handleSeek,
    handlePlaybackRateChange, handlePitchShiftChange,
    handleMetronomeToggle, handlePreRollToggle,
    handleBpmChange, handleTimeSignatureChange,
    handleMuteToggle, handleSoloToggle, handleVolumeChange,
    handleLoopStateChange, handleMidiExtracted,
    setMuteByTrackId, setSoloByTrackId, setLoopState,
  } = engineActions;

  // ======================= EDITOR-SPECIFIC STATE =======================
  const prevFilesRef = useRef<string | null>(null);
  const [isTracksExpanded, setIsTracksExpanded] = useState(true);
  const [trackListHeight, setTrackListHeight] = useState(250);
  const isDraggingHeight = useRef(false);

  // Sync Mode State
  const [isSyncMode, setIsSyncMode] = useState(false);
  const [recordedTimemap, setRecordedTimemap] = useState<{ measure: number; timeMs: number; beatTimestamps?: number[] }[]>([]);
  const [showMapEditor, setShowMapEditor] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { resolvedTheme } = useTheme();
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Sync isDarkMode natively once mounted
  useEffect(() => {
    setIsDarkMode(resolvedTheme === "dark" || resolvedTheme === "system" || !resolvedTheme);
  }, [resolvedTheme]);

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

  // Extract MIDI track info when parsedMidi changes (editor-specific)
  useEffect(() => {
    if (!parsedMidi) { setScoreMidiTracks([]); return; }
    const trackInfos: ScoreMidiTrackInfo[] = parsedMidi.tracks
      .map((t: any, i: number) => ({
        index: i, name: t.name || `Track ${i + 1}`, channel: t.channel ?? i,
        noteCount: t.notes.length, instrument: t.instrument?.name || "Piano",
      }))
      .filter((t: ScoreMidiTrackInfo) => t.noteCount > 0);
    setScoreMidiTracks(trackInfos);
  }, [parsedMidi]);

  // TrackList Resizer Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingHeight.current) return;
      setTrackListHeight(Math.max(80, Math.min(window.innerHeight - e.clientY, window.innerHeight * 0.8)));
    };
    const handleMouseUp = () => { if (isDraggingHeight.current) { isDraggingHeight.current = false; document.body.style.cursor = 'default'; } };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, []);
  const handleResizerMouseDown = (e: React.MouseEvent) => { e.preventDefault(); isDraggingHeight.current = true; document.body.style.cursor = 'row-resize'; };

  // Sync track loading whenever track counts/files change (editor-specific: loads from fileIds)
  useEffect(() => {
    if (!audioManagerRef.current) return;
    const validTracks = payload.audioTracks.filter(t => !!t.fileId);
    const currentFiles = validTracks.map(t => `${t.id}:${t.fileId}`).join(',');
    if (currentFiles === prevFilesRef.current) return;
    prevFilesRef.current = currentFiles;
    if (validTracks.length === 0) return;
    const tracksToLoad: TrackParams[] = validTracks.map(t => ({
      id: t.id, name: t.name, url: getFileViewUrl(t.fileId!),
      volume: t.volume ?? 1, pan: t.pan ?? 0,
      muted: muteByTrackId[t.id] ?? t.muted ?? false,
      solo: soloByTrackId[t.id] ?? t.solo ?? false,
      offsetMs: t.offsetMs ?? 0,
    }));
    audioManagerRef.current.loadTracks(tracksToLoad, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload.audioTracks, muteByTrackId, soloByTrackId]);

  // Sync Mode
  const recordedTimemapRef = useRef(recordedTimemap);
  useEffect(() => { recordedTimemapRef.current = recordedTimemap; }, [recordedTimemap]);

  const handleToggleSyncMode = () => {
    setIsSyncMode(prev => {
      const next = !prev;
      if (next) { setRecordedTimemap([]); if (audioManagerRef.current) audioManagerRef.current.seek(0); }
      return next;
    });
  };

  const handleToggleElasticGrid = () => {
    if (!onPayloadChange) return;
    onPayloadChange({ ...payload, metadata: { ...payload.metadata, syncToTimemap: !payload.metadata?.syncToTimemap } });
  };

  const handleSaveSyncMap = useCallback(() => {
    if (!onPayloadChange) return;
    onPayloadChange({
      ...payload,
      notationData: { ...(payload.notationData || { type: "music-xml" }), timemap: recordedTimemap, timemapSource: "manual" as const } as any,
    });
    setIsSyncMode(false);
  }, [payload, recordedTimemap, onPayloadChange]);

  const handleCancelSync = useCallback(() => { setIsSyncMode(false); setRecordedTimemap([]); }, []);


  // Sync Mode: total beat count across all measures for HUD display
  const syncTotalBeatCountRef = useRef(0);
  const syncCurrentBeatRef = useRef(0);
  const syncCurrentMeasureRef = useRef(0);

  // Configurable sync keys (read from project metadata, default Enter + Shift + ArrowLeft)
  const syncDownbeatKey = payload.metadata?.syncDownbeatKey || "Enter";
  const syncMidMeasureKey = payload.metadata?.syncMidMeasureKey || "ShiftLeft";
  const syncUpbeatKey = payload.metadata?.syncUpbeatKey || "ArrowLeft";

  // Spacebar Play/Pause & Sync Mode Listener (2-key beat-level tapping)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.hasAttribute("contenteditable")) return;

      const isDownbeat = e.code === syncDownbeatKey;
      const isMidMeasure = e.code === syncMidMeasureKey || e.key === "Shift";
      const isUpbeat = e.code === syncUpbeatKey;

      if (isDownbeat || (isSyncMode && (isMidMeasure || isUpbeat))) {
        e.preventDefault();
        e.stopPropagation();
        // Blur focused buttons to prevent native click on keyup
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

        if (isSyncMode) {
          if (!isPlayingRef.current) {
            // Not playing yet — first downbeat starts playback + records measure 1 at t=0
            if (isDownbeat && recordedTimemapRef.current.length === 0 && audioManagerRef.current) {
              if (audioManagerRef.current.getCurrentPositionMs() !== 0) audioManagerRef.current.seek(0);
              await audioManagerRef.current.play();
              setRecordedTimemap([{ measure: 1, timeMs: 0, beatTimestamps: [0] }]);
              syncTotalBeatCountRef.current = 1;
              syncCurrentBeatRef.current = 1;
              syncCurrentMeasureRef.current = 1;
            }
          } else {
            const preciseTime = audioManagerRef.current?.getCurrentPositionMs() ?? 0;

            if (isDownbeat) {
              // DOWNBEAT: start a new measure
              setRecordedTimemap(prev => {
                const lastTap = prev[prev.length - 1];
                if (lastTap && (preciseTime - lastTap.timeMs < 200)) return prev;
                const roundedTime = Math.round(preciseTime);
                syncCurrentMeasureRef.current = prev.length + 1;
                syncCurrentBeatRef.current = 1;
                syncTotalBeatCountRef.current++;
                return [...prev, { measure: prev.length + 1, timeMs: roundedTime, beatTimestamps: [roundedTime] }];
              });
            } else if (isMidMeasure) {
              // MID-MEASURE: insert beat at half-bar position
              // In 4/4 this is beat 3, in 6/4 or 6/8 this is beat 4
              setRecordedTimemap(prev => {
                if (prev.length === 0) return prev;
                const roundedTime = Math.round(preciseTime);
                const last = prev[prev.length - 1];
                const lastBeat = last.beatTimestamps?.[last.beatTimestamps.length - 1] ?? last.timeMs;
                if (roundedTime - lastBeat < 100) return prev; // debounce
                const updated = [...prev];
                // Calculate how many beats to fill up to mid-bar
                const timeSig = payload.metadata?.timeSignature || "4/4";
                const beatsPerBar = parseInt(timeSig.split("/")[0], 10) || 4;
                const midBeat = Math.floor(beatsPerBar / 2); // 4/4→2, 6/4→3, 3/4→1
                const currentBeats = [...(last.beatTimestamps || [last.timeMs])];
                // Fill any missing beats between current position and mid-beat with even spacing
                if (currentBeats.length < midBeat) {
                  const startMs = currentBeats[currentBeats.length - 1];
                  const gap = roundedTime - startMs;
                  const missing = midBeat - currentBeats.length;
                  for (let i = 1; i <= missing; i++) {
                    currentBeats.push(Math.round(startMs + (gap * i / (missing + 1))));
                  }
                }
                currentBeats.push(roundedTime);
                updated[updated.length - 1] = { ...last, beatTimestamps: currentBeats };
                syncCurrentBeatRef.current = currentBeats.length;
                syncTotalBeatCountRef.current += (currentBeats.length - (last.beatTimestamps?.length ?? 1));
                return updated;
              });
            } else if (isUpbeat) {
              // UPBEAT: add beat to current measure's beatTimestamps
              setRecordedTimemap(prev => {
                if (prev.length === 0) return prev;
                const roundedTime = Math.round(preciseTime);
                const last = prev[prev.length - 1];
                const lastBeat = last.beatTimestamps?.[last.beatTimestamps.length - 1] ?? last.timeMs;
                if (roundedTime - lastBeat < 100) return prev; // debounce
                const updated = [...prev];
                const currentBeats = [...(last.beatTimestamps || [last.timeMs]), roundedTime];
                updated[updated.length - 1] = { ...last, beatTimestamps: currentBeats };
                syncCurrentBeatRef.current = currentBeats.length;
                syncTotalBeatCountRef.current++;
                return updated;
              });
            }
          }
        } else {
          // Normal mode: Space = play/pause toggle
          if (isDownbeat) {
            isPlayingRef.current ? handlePause() : handlePlay();
          }
        }
      }
    };
    // Prevent keyup from triggering native button click (for both keys)
    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.code === syncDownbeatKey || e.code === syncMidMeasureKey || e.key === "Shift" || e.code === syncUpbeatKey) && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    return () => { window.removeEventListener("keydown", handleKeyDown, true); window.removeEventListener("keyup", handleKeyUp, true); };
  }, [isSyncMode, handlePlay, handlePause, audioManagerRef, isPlayingRef, syncDownbeatKey, syncUpbeatKey]);


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
      setLoopState(prev => ({ ...prev, ...loop }));
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
    if (audioManagerRef.current) audioManagerRef.current.setMute(trackId, mute);
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
    if (audioManagerRef.current) audioManagerRef.current.setSolo(trackId, solo);
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

  const handleEditorVolumeChange = useCallback((trackId: string, volume: number) => {
    handleVolumeChange(trackId, volume);
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
    handleEditorVolumeChange(trackId, volume);
  }, [handleEditorVolumeChange, onPayloadChange, payload]);

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
        syncDownbeatKey={syncDownbeatKey}
        syncMidMeasureKey={syncMidMeasureKey}
        syncUpbeatKey={syncUpbeatKey}
        onSyncKeyChange={onPayloadChange ? (d, m, u) => {
          onPayloadChange({ ...payload, metadata: { ...payload.metadata, syncDownbeatKey: d, syncMidMeasureKey: m, syncUpbeatKey: u } });
        } : undefined}
      />
      {/* Action Sub-Bar */}
      <EditorActionBar
        projectId={projectId}
        projectName={projectName}
        isOwner={isOwner}
        isPublished={isPublished}
        coverUrl={coverUrl}
        saving={saving}
        publishing={publishing}
        onNameChange={onNameChange}
        onSave={onSave!}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
        onUploadCover={onUploadCover}
        uploadingCover={uploadingCover}
        onUploadScore={onUploadScore}
        uploadingScore={uploadingScore}
        tagsSlot={
          tags !== undefined ? (
            <EditorTagsPicker
              tags={tags}
              isOwner={isOwner}
              onTagsChange={onTagsChange}
              wikiInstruments={wikiInstruments}
              wikiInstrumentIds={wikiInstrumentIds}
              onWikiInstrumentIdsChange={onWikiInstrumentIdsChange}
              wikiGenres={wikiGenres}
              wikiGenreId={wikiGenreId}
              onWikiGenreIdChange={onWikiGenreIdChange}
              wikiCompositions={wikiCompositions}
              wikiCompositionId={wikiCompositionId}
              onWikiCompositionIdChange={onWikiCompositionIdChange}
              wikiComposers={wikiComposers}
              wikiComposerIds={wikiComposerIds}
              onWikiComposerIdsChange={onWikiComposerIdsChange}
            />
          ) : undefined
        }
      />

      {/* Sync Mode HUD */}
      {isSyncMode && (
        <SyncModeHUD
          isPlaying={isPlaying}
          recordedTimemap={recordedTimemap}
          onCancel={handleCancelSync}
          onSave={handleSaveSyncMap}
          downbeatKey={syncDownbeatKey}
          midMeasureKey={syncMidMeasureKey}
          upbeatKey={syncUpbeatKey}
          syncCurrentMeasureRef={syncCurrentMeasureRef}
          syncCurrentBeatRef={syncCurrentBeatRef}
        />
      )}


      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative bg-[#f0f2f5] dark:bg-[#181a1f] transition-colors duration-200">

        {/* Top Area: Sheet Music & Map Editor */}
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

        <EditorScorePanel
          scoreFileId={scoreFileId}
          isOwner={isOwner}
          positionMs={positionMs}
          positionMsRef={positionMsRef}
          isPlaying={isPlaying}
          timemap={payload.notationData?.timemap || EMPTY_TIMEMAP}
          measureMap={payload.notationData?.measureMap}
          isDarkMode={isDarkMode}
          onSeek={handleSeek}
          onMidiExtracted={handleMidiExtracted}
          onUploadScore={onUploadScore}
          uploadingScore={uploadingScore}
          payload={payload}
          onPayloadChange={onPayloadChange}
          showMapEditor={showMapEditor}
          onCloseMapEditor={() => setShowMapEditor(false)}
        />

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
