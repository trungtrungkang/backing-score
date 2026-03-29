import { useState, useCallback, useEffect, useRef, useMemo, useId } from "react";
import { getFileViewUrl } from "@/lib/appwrite";
import { Midi } from "@tonejs/midi";
import type { DAWPayload, TimemapEntry } from "@/lib/daw/types";
import { AudioManager, type TrackParams } from "@/lib/audio/AudioManager";
import { MidiPlayerSingleton } from "@/lib/audio/MidiPlayerSingleton";
import { useMidiInput } from "@/hooks/useMidiInput";
import { useMicInput } from "@/hooks/useMicInput";
import { useMicProfile } from "@/hooks/useMicProfile";
import { getPhysicalMeasure, evaluateWaitModeMatch } from "@/lib/score/math";

export interface ScoreEngineParams {
  payload: DAWPayload;
  autoplayOnLoad?: boolean;
  onNext?: () => void;
  onWaitModeComplete?: (score: number) => void;
  /** When provided, enables BPM/time-sig editing (EditorShell). */
  onPayloadChange?: (payload: DAWPayload) => void;
}

export function useScoreEngine({ payload, autoplayOnLoad, onNext, onWaitModeComplete, onPayloadChange }: ScoreEngineParams) {
  const engineId = useId();
  const audioManagerRef = useRef<AudioManager | null>(null);
  const endOfTrackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // MIDI Fallback State (Phase 19)
  const [midiBase64, setMidiBase64] = useState<string | null>(null);
  const [midiStartOffsetMs, setMidiStartOffsetMs] = useState(0);
  const [midiDurationMs, setMidiDurationMs] = useState(0);
  const midiPlayerRef = useRef<any>(null);
  const midiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const midiPlayStartTimeRef = useRef<number>(0);
  const midiPlayStartPosRef = useRef<number>(0);
  const pendingResumeAfterRateChangeRef = useRef(false);

  // --- Wait Mode Hardware Integration ---
  const { activeNotes: midiNotes, hasMidiDevice, initializeMidi, isMidiInitialized, disconnectMidi } = useMidiInput();
  const { profile } = useMicProfile();
  const { activeNotes: micNotes, initializeMic, isMicInitialized: isMicInitializedState, disconnectMic } = useMicInput({ profile: profile || undefined });

  const activeNotes = useMemo(() => {
    const combined = new Set(midiNotes);
    micNotes.forEach((n: number) => combined.add(n));
    return combined;
  }, [midiNotes, micNotes]);

  const [isWaitMode, setIsWaitMode] = useState(false);
  const [practiceTrackIds, setPracticeTrackIds] = useState<number[]>([-1]);
  const [parsedMidi, setParsedMidi] = useState<any>(null);
  const [showWaitModeMonitor, setShowWaitModeMonitor] = useState(false);

  const activeNotesRef = useRef<Set<number>>(new Set());
  const isWaitModeRef = useRef(false);
  const [isWaitModeLenient, setIsWaitModeLenient] = useState(false);
  const isWaitModeLenientRef = useRef(false);
  const practiceTrackIdsRef = useRef<number[]>([-1]);
  const practiceChordsRef = useRef<{ timeMs: number, notes: Set<number>, measure?: number, trackIndex?: number }[]>([]);
  const targetChordIndexRef = useRef(0);
  const isWaitingRef = useRef(false);
  const releasedPitchesRef = useRef<Set<number>>(new Set());
  const waitModeMonitorRef = useRef<HTMLDivElement>(null);
  const parsedMidiRef = useRef<any>(null);

  useEffect(() => { activeNotesRef.current = activeNotes; }, [activeNotes]);
  useEffect(() => { isWaitModeRef.current = isWaitMode; }, [isWaitMode]);
  useEffect(() => { isWaitModeLenientRef.current = isWaitModeLenient; }, [isWaitModeLenient]);
  useEffect(() => { practiceTrackIdsRef.current = practiceTrackIds; }, [practiceTrackIds]);

  // 1. Establish a Timeline Resolver computing Measure boundaries based on physical MIDI extraction
  const timemap = payload.notationData?.timemap || [];
  const getMeasureForTime = useCallback((timeMs: number) => {
    if (!timemap || timemap.length === 0) return 0;
    
    // Scan exactly like the math.ts implementation to guarantee UI sync
    for (let i = 0; i < timemap.length; i++) {
        if (i === timemap.length - 1) return timemap[i].measure;
        if (timeMs >= timemap[i].timeMs && timeMs < timemap[i + 1].timeMs) {
            return timemap[i].measure;
        }
    }
    return 0;
  }, [timemap]);

  const handleMidiExtracted = useCallback((base64Midi: string) => {
    setMidiBase64(base64Midi);
    try {
      const binaryString = window.atob(base64Midi.split(",")[1] || base64Midi);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
      const midi = new Midi(bytes);
      parsedMidiRef.current = midi; 

      let minMs = Infinity;
      let maxMs = 0;
      midi.tracks.forEach(t => t.notes.forEach(n => {
        if (n.time * 1000 < minMs) minMs = n.time * 1000;
        if ((n.time + n.duration) * 1000 > maxMs) maxMs = (n.time + n.duration) * 1000;
      }));
      setMidiStartOffsetMs(minMs === Infinity ? 0 : minMs);
      setMidiDurationMs(maxMs); 
      setParsedMidi(midi); 
    } catch (err) {
      console.error("Failed to parse initial MIDI offset", err);
      setMidiStartOffsetMs(0);
      setMidiDurationMs(0);
      setParsedMidi(null);
      practiceChordsRef.current = [];
    }
  }, [getMeasureForTime]);

  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  useEffect(() => { positionMsRef.current = positionMs; }, [positionMs]);
  const [durationMs, setDurationMs] = useState(0);
  const requestRef = useRef<number>(0);
  const prevFilesRef = useRef<string | null>(null);
  const autoplayTriggeredRef = useRef(false);

  // Mixer State
  const [muteByTrackId, setMuteByTrackId] = useState<Record<string, boolean>>({});
  const [soloByTrackId, setSoloByTrackId] = useState<Record<string, boolean>>({});
  const [volumes, setVolumes] = useState<Record<string, number>>({});

  const autoUnmuteScoreSynth = payload.audioTracks.length === 0 && !isWaitMode;
  let isScoreSynthMuted = muteByTrackId["score-midi"] ?? payload.metadata?.scoreSynthMuted ?? false;
  if (autoUnmuteScoreSynth && muteByTrackId["score-midi"] === undefined) {
    isScoreSynthMuted = false;
  }
  const isScoreSynthMutedRef = useRef(isScoreSynthMuted);
  useEffect(() => {
    isScoreSynthMutedRef.current = isScoreSynthMuted;
  }, [isScoreSynthMuted]);

  // Practice Tools State
  const [playbackRate, setPlaybackRate] = useState(1);
  const [pitchShift, setPitchShift] = useState(0);
  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(false);
  const [isPreRollEnabled, setIsPreRollEnabled] = useState(false);
  const [timeSignature, setTimeSignature] = useState(payload.metadata?.timeSignature || "4/4");
  const positionMsRef = useRef(0);
  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState(true);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [partNames, setPartNames] = useState<string[]>([]);
  const [loopState, setLoopState] = useState<{
    enabled: boolean; startBar: number; endBar: number;
    tempoRamp: boolean; tempoRampStep: number; tempoRampTarget: number;
  }>({
    enabled: false, startBar: 1, endBar: 4,
    tempoRamp: false, tempoRampStep: 0.05, tempoRampTarget: 1.0,
  });
  const loopIterationRef = useRef(0);
  const prevLoopPosRef = useRef(0);

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    try {
      if (localStorage.getItem("bs_player_collapsed") === "true") {
        setIsControlsCollapsed(true);
      }
    } catch {}
  }, []);

  // WAIT MODE V2 Core Progression Logic
  useEffect(() => {
    if (!parsedMidi) return;
    let tracksToParse: any[] = [];
    if (!practiceTrackIds || practiceTrackIds.includes(-1) || practiceTrackIds.length === 0) {
      tracksToParse = parsedMidi.tracks.filter((t: any) => t.notes.length > 0);
    } else {
      practiceTrackIds.forEach(id => {
        if (parsedMidi.tracks[id]) {
          tracksToParse.push(parsedMidi.tracks[id]);
        }
      });
    }

    const chords: { timeMs: number, notes: Set<number>, measure: number, trackIndex?: number }[] = [];
    const measureMap = payload.notationData?.measureMap;

    tracksToParse.forEach((track, trackIndex) => {
      track.notes.forEach((n: any) => {
        const timeMs = n.time * 1000;
        const latentMeasure = getMeasureForTime(timeMs);
        const physicalMeasure = getPhysicalMeasure(latentMeasure, measureMap);
        
        const existing = chords.find(c => {
          const isSameTime = Math.abs(c.timeMs - timeMs) < 20;
          if (isMicInitializedState) return isSameTime;
          return isSameTime && c.trackIndex === trackIndex;
        });

        if (existing) {
          existing.notes.add(n.midi);
        } else {
          chords.push({ timeMs, notes: new Set([n.midi]), measure: physicalMeasure, trackIndex });
        }
      });
    });
    chords.sort((a,b) => a.timeMs - b.timeMs);
    practiceChordsRef.current = chords;
    targetChordIndexRef.current = 0;
  }, [parsedMidi, practiceTrackIds, getMeasureForTime, isMicInitializedState, payload.notationData?.measureMap]); 

  // Synchronize global mute
  useEffect(() => {
    if (audioManagerRef.current) {
      audioManagerRef.current.setGlobalMute(isWaitMode);
    }
    const globalTone = (window as any).Tone;
    if (globalTone && globalTone.Destination) {
      globalTone.Destination.mute = isScoreSynthMuted || isWaitMode;
    }
  }, [isWaitMode, isScoreSynthMuted]);

  const handleCollapseToggle = useCallback((collapsed: boolean) => {
    setIsControlsCollapsed(collapsed);
    try {
      localStorage.setItem("bs_player_collapsed", collapsed ? "true" : "false");
    } catch {}
  }, []);

  const handleLoopStateChange = useCallback((state: {
    enabled: boolean; startBar: number; endBar: number;
    tempoRamp?: boolean; tempoRampStep?: number; tempoRampTarget?: number;
  }) => {
    const merged = {
      ...loopState,
      ...state,
      tempoRamp: state.tempoRamp ?? loopState.tempoRamp,
      tempoRampStep: state.tempoRampStep ?? loopState.tempoRampStep,
      tempoRampTarget: state.tempoRampTarget ?? loopState.tempoRampTarget,
    };
    setLoopState(merged);
    // Reset loop iteration counter when loop changes
    loopIterationRef.current = 0;
    prevLoopPosRef.current = 0;
    if (audioManagerRef.current) {
      audioManagerRef.current.setLooping(merged.enabled);
      const bpm = payload.metadata?.tempo || 120;
      const ts = payload.metadata?.timeSignature || "4/4";
      const [numStr, denStr] = ts.split("/");
      const beatsPerMeasure = parseInt(numStr, 10) || 4;
      const noteValue = parseInt(denStr, 10) || 4;
      const quarterNoteMs = (60 * 1000) / bpm;
      const beatMs = quarterNoteMs * (4 / noteValue);
      const measureMs = beatsPerMeasure * beatMs;
      const startMs = (merged.startBar - 1) * measureMs;
      const endMs = merged.endBar * measureMs;
      audioManagerRef.current.setLoopPoints(startMs, endMs);
    }
  }, [payload.metadata, loopState]);

  useEffect(() => {
    if (!audioManagerRef.current) {
      audioManagerRef.current = new AudioManager();
      const tempo = payload.metadata?.tempo || 120;
      audioManagerRef.current.getMetronome()?.setTempoParams(tempo, payload.metadata?.timeSignature || "4/4", payload.metadata?.timeSignature || "4/4");
      MidiPlayerSingleton.setAudioManager(audioManagerRef.current);

      const initialVols: Record<string, number> = {};
      payload.audioTracks.forEach(t => {
        initialVols[t.id] = t.volume ?? 1;
      });
      setVolumes(initialVols);
    }

    return () => {
      MidiPlayerSingleton.cleanup();
      if (audioManagerRef.current) {
        audioManagerRef.current.stop();
        audioManagerRef.current = null;
      }
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      prevFilesRef.current = null;
    };
  }, [payload.metadata, payload.audioTracks]);

  // Safety net: force-stop all audio on browser back/forward or page unload
  useEffect(() => {
    const stopAll = () => MidiPlayerSingleton.stopAll();
    window.addEventListener('popstate', stopAll);
    window.addEventListener('beforeunload', stopAll);
    return () => {
      stopAll();
      window.removeEventListener('popstate', stopAll);
      window.removeEventListener('beforeunload', stopAll);
    };
  }, []);

  const [stretchedMidiBase64, setStretchedMidiBase64] = useState<string | null>(null);
  const correctedTimemapRef = useRef<TimemapEntry[] | null>(null);

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

      // Preserve Verovio's original MIDI tempo events (including rit/accel/partial measures)
      // and simply scale each by playbackRate. This avoids the tick-position drift
      // caused by the old approach of rebuilding tempos from timemap entries.
      if (midi.header.tempos.length > 0) {
        midi.header.tempos = midi.header.tempos.map(t => ({
          ticks: t.ticks,
          bpm: t.bpm * playbackRate,
        }));
      } else {
        const tempoTarget = payload.metadata?.tempo || 120;
        midi.header.tempos = [{ ticks: 0, bpm: tempoTarget * playbackRate }];
      }

      // Recalculate timemap timeMs from Verovio's MIDI tempo events.
      // Priority: 'manual' → skip (user timeMs authoritative), 'auto' → override,
      // undefined (legacy) → fallback to MIDI-only heuristic (no audio tracks).
      const tmSource = payload.notationData?.timemapSource;
      const shouldCorrectTimemap = tmSource === 'auto' || (tmSource === undefined && payload.audioTracks.length === 0);
      const timemap = payload.notationData?.timemap;
      const ppq = midi.header.ppq || 480;
      if (shouldCorrectTimemap && timemap && timemap.length > 0) {
        const scaledTempos = [...midi.header.tempos].sort((a, b) => a.ticks - b.ticks);
        const tempoFallback = (payload.metadata?.tempo || 120) * playbackRate;

        const ticksToMs = (targetTick: number): number => {
          let ms = 0;
          let lastTick = 0;
          let currentBpm = scaledTempos[0]?.bpm || tempoFallback;
          for (const t of scaledTempos) {
            if (t.ticks >= targetTick) break;
            const tickDelta = t.ticks - lastTick;
            ms += (tickDelta / ppq) * (60000 / currentBpm);
            lastTick = t.ticks;
            currentBpm = t.bpm;
          }
          const remaining = targetTick - lastTick;
          ms += (remaining / ppq) * (60000 / currentBpm);
          return ms;
        };

        let accTicks = 0;
        correctedTimemapRef.current = timemap.map(entry => {
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
      } else {
        correctedTimemapRef.current = null;
      }
      
      // Apply pitch shift
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

      // Apply instrument overrides from EditorShell metadata
      // Programs in metadata are 1-indexed (GM spec), @tonejs/midi uses 0-indexed
      const instrumentOverrides = payload.metadata?.scoreMidiInstrumentOverrides;
      if (instrumentOverrides) {
        Object.entries(instrumentOverrides).forEach(([trackIdxStr, program]) => {
          const trackIdx = parseInt(trackIdxStr, 10);
          if (trackIdx >= 0 && trackIdx < midi.tracks.length && typeof program === 'number') {
            midi.tracks[trackIdx].instrument.number = program - 1; // 1-indexed → 0-indexed
          }
        });
      }

      // Apply per-track volume by scaling note velocity
      const perTrackVolume = payload.metadata?.scoreMidiPerTrackVolume;
      if (perTrackVolume) {
        Object.entries(perTrackVolume).forEach(([trackIdxStr, vol]) => {
          const trackIdx = parseInt(trackIdxStr, 10);
          if (trackIdx >= 0 && trackIdx < midi.tracks.length && typeof vol === 'number' && vol !== 1) {
            midi.tracks[trackIdx].notes.forEach(note => {
              note.velocity = Math.max(0.01, Math.min(1, note.velocity * vol));
            });
          }
        });
      }

      const newBytes = midi.toArray();
      let newBinaryString = "";
      for (let i = 0; i < newBytes.length; i++) {
        newBinaryString += String.fromCharCode(newBytes[i]);
      }
      const newBase64 = "data:audio/midi;base64," + window.btoa(newBinaryString);
      setStretchedMidiBase64(newBase64);

      // Auto-resume after rate change: register 'load' listener BEFORE setting src
      // so we don't miss the event. The <midi-player> fires 'load' once MIDI is parsed.
      if (pendingResumeAfterRateChangeRef.current && midiPlayerRef.current) {
        pendingResumeAfterRateChangeRef.current = false;
        const player = midiPlayerRef.current;
        const onLoaded = () => {
          player.removeEventListener('load', onLoaded);
          handlePlayRef.current();
        };
        player.addEventListener('load', onLoaded);
      }

      if (midiPlayerRef.current && midiPlayerRef.current.src) {
        midiPlayerRef.current.src = newBase64;
      }
    } catch (e) {
      console.error("Failed to transform MIDI", e);
      setStretchedMidiBase64(midiBase64);
    }
  }, [midiBase64, playbackRate, pitchShift, payload.metadata?.tempo, payload.metadata?.scoreMidiInstrumentOverrides, payload.metadata?.scoreMidiPerTrackVolume]);


  useEffect(() => {
    if (audioManagerRef.current) {
      const metronome = audioManagerRef.current.getMetronome();
      if (metronome) {
        // Always use the ORIGINAL timemap for the metronome (in original-time coordinates).
        // The corrected timemap is in wall-clock coordinates which don't match positionMs.
        // The metronome's scheduler natively divides by playbackRate to get wall-clock time.
        const timemapArr = payload.notationData?.timemap || [];
        metronome.setTimemap(timemapArr);
        metronome.setSyncToTimemap(timemapArr.length > 0);
        metronome.setPlaybackRate(playbackRate);

        // Restart metronome if playing — scheduler must flush old beat schedule after rate change
        if (isPlayingRef.current && metronome.getEnabled()) {
          // Calculate current position from MIDI timing refs (avoids stale positionMs state)
          const elapsedMs = performance.now() - midiPlayStartTimeRef.current;
          const currentPos = midiPlayStartPosRef.current + (elapsedMs * playbackRate);
          const ctx = audioManagerRef.current.getContext();
          if (ctx) {
            metronome.stop();
            metronome.start(currentPos, ctx.currentTime + 0.05);
          }
        }
      }
    }
  }, [payload.notationData?.timemap, payload.metadata?.syncToTimemap, playbackRate]);

  const handlePlay = useCallback(async () => {
    try {
      if (audioManagerRef.current) await audioManagerRef.current.unlockiOSAudio();
      const globalTone = (window as any).Tone;
      if (globalTone && globalTone.context && globalTone.context.state === 'suspended') {
         await globalTone.context.resume();
      }
    } catch (e) { }

    // Enforce Singleton audio mesh lock natively:
    window.dispatchEvent(new CustomEvent('score-engine-play', { detail: { engineId } }));

    let playPromises: Promise<void>[] = [];
    if (midiTimeoutRef.current) clearTimeout(midiTimeoutRef.current);

    if (midiPlayerRef.current && stretchedMidiBase64 && !isScoreSynthMutedRef.current) {
      const offsetMs = payload.metadata?.scoreSynthOffsetMs || 0;
      // positionMs is in song-time (original tempo). The stretched MIDI has tempo * playbackRate,
      // so midiPlayer.currentTime expects stretched-time. Divide by playbackRate to convert.
      const targetTimeSecs = (positionMs - offsetMs + midiStartOffsetMs) / 1000 / playbackRate;
      
      if (targetTimeSecs >= 0) {
        midiPlayerRef.current.currentTime = targetTimeSecs;
        playPromises.push(Promise.resolve(midiPlayerRef.current.start()).catch((e:any) => console.log(e)));
      } else {
        midiPlayerRef.current.currentTime = 0; 
        const delayMs = -targetTimeSecs * 1000;
        midiTimeoutRef.current = setTimeout(() => {
          if (isPlayingRef.current && !isScoreSynthMutedRef.current) {
             Promise.resolve(midiPlayerRef.current.start()).catch(e => console.log(e));
          }
        }, delayMs);
      }
    }
    if (audioManagerRef.current) {
      // Sync AudioManager's internal offset with the actual positionMs before playing.
      // For MIDI-only projects, position is tracked via performance.now(), which diverges
      // from AudioManager's AudioContext-based clock. Without this seek, the metronome
      // starts at the wrong position after pause/resume.
      await audioManagerRef.current.seek(positionMs);
      playPromises.push(Promise.resolve(audioManagerRef.current.play()).catch((e:any) => console.log(e)));
    }
    
    if (payload.audioTracks.length === 0) {
      midiPlayStartTimeRef.current = performance.now();
      midiPlayStartPosRef.current = positionMs;
    }

    await Promise.allSettled(playPromises);
    setIsPlaying(true);
    isPlayingRef.current = true;
  }, [payload.audioTracks.length, stretchedMidiBase64, isScoreSynthMuted, positionMs, midiStartOffsetMs, payload.metadata?.scoreSynthOffsetMs]);

  // Keep a ref to the latest handlePlay for external callers.
  const handlePlayRef = useRef(handlePlay);
  handlePlayRef.current = handlePlay;

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
  }, [payload.audioTracks, autoplayOnLoad, handlePlay, muteByTrackId, soloByTrackId, volumes]);

  useEffect(() => {
    if (!midiPlayerRef.current) return;
    MidiPlayerSingleton.setPlayer(midiPlayerRef.current);
    if (isPlaying) {
      if (isScoreSynthMutedRef.current) {
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
          Promise.resolve(midiPlayerRef.current.start()).catch(e => console.log(e));
        } else {
          midiPlayerRef.current.currentTime = 0;
          if (midiTimeoutRef.current) clearTimeout(midiTimeoutRef.current);
          midiTimeoutRef.current = setTimeout(() => {
             if (isPlayingRef.current && !isScoreSynthMutedRef.current) {
                Promise.resolve(midiPlayerRef.current.start()).catch(e => console.log(e));
             }
          }, -targetTimeSecs * 1000);
        }
      }
    }
  }, [isScoreSynthMuted]);

  const totalSongDurationMs = useMemo(() => {
    let maxAudio = durationMs || 0;
    let maxMidi = midiDurationMs || 0;
    let maxTimemap = 0;
    const timemapArr = payload.notationData?.timemap;
    if (timemapArr && timemapArr.length > 0) {
       const lastMap = timemapArr[timemapArr.length - 1];
       const bpm = payload.metadata?.tempo || 120;
       const ts = payload.metadata?.timeSignature || "4/4";
       const [numStr, denStr] = ts.split("/");
       const beatsPerMeasure = parseInt(numStr, 10) || 4;
       const noteValue = parseInt(denStr, 10) || 4;
       const measureMs = (60 * 1000 / bpm) * (4 / noteValue) * beatsPerMeasure;
       maxTimemap = lastMap.timeMs + measureMs;
    }
    const finalMax = Math.max(maxAudio, maxMidi, maxTimemap);
    return finalMax > 0 ? finalMax : 1800000; // 30 min fallback for metronome-only practice
  }, [durationMs, midiDurationMs, payload.notationData?.timemap, payload.metadata?.tempo, payload.metadata?.timeSignature]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    
    if (midiTimeoutRef.current) clearTimeout(midiTimeoutRef.current);
    if (endOfTrackTimeoutRef.current) {
       clearTimeout(endOfTrackTimeoutRef.current);
       endOfTrackTimeoutRef.current = null;
    }

    try {
        if (midiPlayerRef.current) midiPlayerRef.current.stop();
        if (audioManagerRef.current) audioManagerRef.current.pause();
    } catch (e) { console.error(e); }

    if (audioManagerRef.current && payload.audioTracks.length > 0) {
      setPositionMs(audioManagerRef.current.getCurrentPositionMs()); 
    } else if (midiPlayerRef.current) {
      if (isWaitModeRef.current) {
         setPositionMs(positionMs);
      } else {
         const offsetMs = payload.metadata?.scoreSynthOffsetMs || 0;
         // midiPlayer.currentTime is in stretched-time (MIDI tempo is multiplied by playbackRate).
         // To convert to song-time (original tempo), multiply by playbackRate.
         // E.g. at rate=0.5: stretched MIDI runs at half speed, so 10s wall-clock = 5s song-time.
         setPositionMs(Math.max(0, (midiPlayerRef.current.currentTime * playbackRate * 1000) - midiStartOffsetMs + offsetMs));
      }
    }
  }, [payload.audioTracks.length, midiStartOffsetMs, payload.metadata?.scoreSynthOffsetMs, positionMs, playbackRate]);

  // Synchronize Playback state across multiple component instances (e.g. SnippetPlayer)
  useEffect(() => {
    const onGlobalPlay = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.engineId !== engineId) {
        if (isPlayingRef.current) {
          handlePause();
        }
      }
    };
    window.addEventListener('score-engine-play', onGlobalPlay);
    return () => window.removeEventListener('score-engine-play', onGlobalPlay);
  }, [engineId, handlePause]);

  const handleSeek = useCallback((ms: number) => {
    if (midiTimeoutRef.current) clearTimeout(midiTimeoutRef.current);
    const offsetMs = payload.metadata?.scoreSynthOffsetMs || 0;
    if (midiPlayerRef.current) {
      const targetTimeSecs = (ms - offsetMs + midiStartOffsetMs) / 1000;
      if (targetTimeSecs >= 0) {
        midiPlayerRef.current.currentTime = targetTimeSecs;
        if (isPlayingRef.current && !isScoreSynthMutedRef.current) {
          Promise.resolve(midiPlayerRef.current.start()).catch((e:any) => console.log(e));
        }
      } else {
        midiPlayerRef.current.stop();
        midiPlayerRef.current.currentTime = 0;
        if (isPlayingRef.current && !isScoreSynthMutedRef.current) {
          const delayMs = -targetTimeSecs * 1000;
          midiTimeoutRef.current = setTimeout(() => {
             if (isPlayingRef.current && !isScoreSynthMutedRef.current) {
                Promise.resolve(midiPlayerRef.current.start()).catch(e => console.log(e));
             }
          }, delayMs);
        }
      }
    }
    if (audioManagerRef.current) {
      audioManagerRef.current.seek(ms);
    }
    setPositionMs(ms);
  }, [payload.audioTracks.length, midiStartOffsetMs, payload.metadata?.scoreSynthOffsetMs, isScoreSynthMuted]);

  const handleStop = useCallback((isEndOfTrack: boolean = false) => {
    handlePause();
    isWaitingRef.current = false;
    activeNotesRef.current.clear();
    releasedPitchesRef.current.clear();
    targetChordIndexRef.current = 0; 
    handleSeek(0);
  }, [handlePause, handleSeek]);

  const updatePosition = useCallback(() => {
    if (!isPlayingRef.current) return;
    let currentPos = 0;
    
    if (isWaitModeRef.current) {
      if (practiceChordsRef.current.length > 0 && targetChordIndexRef.current >= 0 && targetChordIndexRef.current < practiceChordsRef.current.length) {
        const targetChord = practiceChordsRef.current[targetChordIndexRef.current];
        currentPos = targetChord.timeMs; 
            
        let roundedPos = Math.round(currentPos);
        setPositionMs(prev => {
          if (prev === roundedPos) return prev;
          return roundedPos;
        });
            
        const pressed = activeNotesRef.current;
        
        if (showWaitModeMonitor && waitModeMonitorRef.current) {
          const MIDI_NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
          const toPitch = (midi: number) => `${MIDI_NOTES[midi % 12]}${Math.floor(midi / 12) - 1}`;
          
          const targets = Array.from(targetChord.notes).map(toPitch).join(", ");
          const actives = Array.from(pressed).map(toPitch).join(", ");
          
          const physMeasure = targetChord.measure ? getPhysicalMeasure(targetChord.measure, payload.notationData?.measureMap) : null;
          
          waitModeMonitorRef.current.innerHTML = `
            <div style="font-weight:bold; margin-bottom: 4px; color: #60a5fa;">DIAGNOSTIC MONITOR</div>
            <div style="display:flex; justify-content: space-between; border-bottom: 1px solid #333; padding-bottom: 4px; margin-bottom: 4px;">
              <span>Target Index:</span> <span style="font-family:monospace">${targetChordIndexRef.current} / ${practiceChordsRef.current.length}</span>
            </div>
            <div style="display:flex; justify-content: space-between;">
              <span style="color:#ef4444;">Required:</span> <span style="font-family:monospace; font-weight:bold;">[${targets || 'None'}] ${physMeasure ? `<span style="color:#a1a1aa; font-size: 10px; margin-left: 4px;">(Measure ${physMeasure})</span>` : ''}</span>
            </div>
            <div style="display:flex; justify-content: space-between;">
              <span style="color:#10b981;">Pressed:</span> <span style="font-family:monospace; font-weight:bold;">[${actives || 'None'}]</span>
            </div>
          `;
        }

        const { allMatched, isAllowedEarly } = evaluateWaitModeMatch(
          pressed, targetChord.notes, isWaitModeLenientRef.current,
          targetChordIndexRef.current > 0 ? practiceChordsRef.current[targetChordIndexRef.current - 1].notes : undefined,
          releasedPitchesRef.current
        );

        if (allMatched && isAllowedEarly) {
            targetChordIndexRef.current++;
            releasedPitchesRef.current.clear();
            
            if (targetChordIndexRef.current < practiceChordsRef.current.length) {
                currentPos = practiceChordsRef.current[targetChordIndexRef.current].timeMs;
            } else {
                currentPos = targetChord.timeMs;
            }
            midiPlayStartTimeRef.current = performance.now();
            midiPlayStartPosRef.current = currentPos;
            
            if (isWaitingRef.current) {
                isWaitingRef.current = false;
                if (midiPlayerRef.current && !isScoreSynthMutedRef.current) Promise.resolve(midiPlayerRef.current.start()).catch((e) => {});
                if (audioManagerRef.current) Promise.resolve(audioManagerRef.current.play()).catch(e => {});
            }
        } else {
            if (!isWaitingRef.current) {
                isWaitingRef.current = true;
                midiPlayStartTimeRef.current = performance.now();
                midiPlayStartPosRef.current = targetChord.timeMs;
                if (audioManagerRef.current) audioManagerRef.current.pause();
            }
        }
      } else {
          // Out of bounds for Wait Mode tracking (End of track)
          currentPos = midiDurationMs || durationMs;
          setPositionMs(Math.round(currentPos));

          if (isWaitModeRef.current && !endOfTrackTimeoutRef.current) {
             endOfTrackTimeoutRef.current = setTimeout(() => {
                handleStop(true);
                endOfTrackTimeoutRef.current = null;
                if (onWaitModeComplete) onWaitModeComplete(100);
                if (isAutoplayEnabled && onNext) onNext();
             }, 1500);
          }


          if (payload.audioTracks.length === 0 && midiPlayerRef.current) {
              const elapsedMs = performance.now() - midiPlayStartTimeRef.current;
              currentPos = Math.max(0, midiPlayStartPosRef.current + (elapsedMs * playbackRate));
              if (isWaitingRef.current) {
                  isWaitingRef.current = false;
                  if (!isScoreSynthMutedRef.current) Promise.resolve(midiPlayerRef.current.start()).catch((e) => {});
              }
          } else if (audioManagerRef.current) {
              currentPos = audioManagerRef.current.getCurrentPositionMs();
              if (isWaitingRef.current) {
                  isWaitingRef.current = false;
                  Promise.resolve(audioManagerRef.current.play()).catch(e => {});
              }
          } else {
              currentPos = positionMs;
          }
      }
    } else {
      const now = performance.now();
      if (payload.audioTracks.length === 0 && midiPlayerRef.current) {
          const elapsedMs = now - midiPlayStartTimeRef.current;
          currentPos = Math.max(0, midiPlayStartPosRef.current + (elapsedMs * playbackRate));

          // MIDI-only loop enforcement: AudioManager's loop interval doesn't run without audio tracks
          if (loopState.enabled && !isWaitModeRef.current) {
            const bpm = payload.metadata?.tempo || 120;
            const ts = payload.metadata?.timeSignature || "4/4";
            const [numStr, denStr] = ts.split("/");
            const beatsPerMeasure = parseInt(numStr, 10) || 4;
            const noteValue = parseInt(denStr, 10) || 4;
            const measureMs = ((60 * 1000) / bpm) * (4 / noteValue) * beatsPerMeasure;
            const loopStartMs = (loopState.startBar - 1) * measureMs;
            const loopEndMs = loopState.endBar * measureMs;

            if (currentPos >= loopEndMs && loopEndMs > loopStartMs) {
              // Wrap position back to loop start
              currentPos = loopStartMs;

              // Tempo ramp: increment speed on each loop iteration
              if (loopState.tempoRamp) {
                loopIterationRef.current++;
                const newRate = Math.min(
                  loopState.tempoRampTarget,
                  playbackRate + loopState.tempoRampStep
                );
                if (newRate !== playbackRate) {
                  setPlaybackRate(newRate);
                  if (audioManagerRef.current) audioManagerRef.current.setPlaybackRate(newRate);
                }
              }

              // Seek MIDI player to loop start
              const offsetMs = payload.metadata?.scoreSynthOffsetMs || 0;
              const targetTimeSecs = (loopStartMs - offsetMs + midiStartOffsetMs) / 1000;
              if (midiPlayerRef.current) {
                midiPlayerRef.current.stop();
                midiPlayerRef.current.currentTime = Math.max(0, targetTimeSecs);
                if (!isScoreSynthMutedRef.current) {
                  Promise.resolve(midiPlayerRef.current.start()).catch(() => {});
                }
              }
              // Reset timing refs for position calculation
              midiPlayStartTimeRef.current = performance.now();
              midiPlayStartPosRef.current = loopStartMs;
            }
          }
      } else if (audioManagerRef.current) {
          currentPos = audioManagerRef.current.getCurrentPositionMs();
      }
    }

    setPositionMs(prev => {
      const roundedPos = Math.round(currentPos);
      // Always update the ref for zero-lag RAF consumers (MusicXMLVisualizer, TrackList)
      positionMsRef.current = roundedPos;
      if (Math.abs(prev - roundedPos) < 16) return prev;

      // Detect loop iteration: position wrapped back to near startBar
      if (loopState.enabled && loopState.tempoRamp && !isWaitModeRef.current) {
        const bpm = payload.metadata?.tempo || 120;
        const ts = payload.metadata?.timeSignature || "4/4";
        const [numStr, denStr] = ts.split("/");
        const beatsPerMeasure = parseInt(numStr, 10) || 4;
        const noteValue = parseInt(denStr, 10) || 4;
        const measureMs = ((60 * 1000) / bpm) * (4 / noteValue) * beatsPerMeasure;
        const loopStartMs = (loopState.startBar - 1) * measureMs;
        const loopEndMs = loopState.endBar * measureMs;
        const midPoint = (loopStartMs + loopEndMs) / 2;

        // Detect wrap: previous position was past midpoint, current is near start
        if (prevLoopPosRef.current > midPoint && roundedPos < midPoint && roundedPos >= loopStartMs - 200) {
          loopIterationRef.current++;
          const newRate = Math.min(
            loopState.tempoRampTarget,
            playbackRate + loopState.tempoRampStep
          );
          if (newRate !== playbackRate) {
            setPlaybackRate(newRate);
            if (audioManagerRef.current) audioManagerRef.current.setPlaybackRate(newRate);
          }
        }
        prevLoopPosRef.current = roundedPos;
      }

      return roundedPos;
    });

    if (totalSongDurationMs > 0 && currentPos > totalSongDurationMs) {
      if (isWaitModeRef.current) {
        if (!endOfTrackTimeoutRef.current) {
           endOfTrackTimeoutRef.current = setTimeout(() => {
              handleStop(true);
              endOfTrackTimeoutRef.current = null;
              if (onWaitModeComplete) onWaitModeComplete(100);
              if (isAutoplayEnabled && onNext) onNext();
           }, 1500);
        }
        return;
      }
      handleStop(true);
      if (isAutoplayEnabled && onNext) setTimeout(() => onNext(), 50);
      return;
    }

    requestRef.current = requestAnimationFrame(updatePosition);
  }, [payload.audioTracks.length, midiStartOffsetMs, totalSongDurationMs, showWaitModeMonitor, playbackRate, isAutoplayEnabled, onNext, handleStop, loopState, payload.metadata]);

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

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isPlayingRef.current) {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
        if (isMobile) handlePause();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [handlePause]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" || 
        document.activeElement?.tagName === "TEXTAREA" || 
        document.activeElement?.hasAttribute("contenteditable")
      ) return;
      if (e.code === "Space") {
        e.preventDefault();
        isPlaying ? handlePause() : handlePlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, handlePlay, handlePause]);

  const handlePlaybackRateChange = useCallback(async (rate: number) => {
    const wasPlaying = isPlayingRef.current;

    // 1. Capture current song-time position BEFORE stopping
    let capturedSongTimeMs = positionMs;
    if (wasPlaying && payload.audioTracks.length === 0 && midiPlayerRef.current) {
      const offsetMs = payload.metadata?.scoreSynthOffsetMs || 0;
      capturedSongTimeMs = Math.max(0, (midiPlayerRef.current.currentTime * playbackRate * 1000) - midiStartOffsetMs + offsetMs);
    } else if (wasPlaying && audioManagerRef.current) {
      capturedSongTimeMs = audioManagerRef.current.getCurrentPositionMs();
    }

    // 2. Pause
    if (wasPlaying) {
      handlePause();
    }

    // 3. Set captured position so handlePlay uses it
    setPositionMs(capturedSongTimeMs);

    // 4. Signal auto-resume (will be picked up by the MIDI stretch effect)
    if (wasPlaying) {
      pendingResumeAfterRateChangeRef.current = true;
    }

    // 5. Update rate (triggers MIDI stretch effect which will auto-resume)
    setPlaybackRate(rate);
    if (audioManagerRef.current) {
      if (payload.audioTracks.length === 0) {
        audioManagerRef.current.setPlaybackRateInternal(rate);
      } else {
        audioManagerRef.current.setPlaybackRate(rate);
      }
    }
  }, [payload.audioTracks.length, handlePause, playbackRate, midiStartOffsetMs, positionMs, payload.metadata?.scoreSynthOffsetMs]);

  const handlePitchShiftChange = useCallback((semitones: number) => {
    const wasPlaying = isPlayingRef.current;

    // Capture position before stopping
    let capturedSongTimeMs = positionMs;
    if (wasPlaying && payload.audioTracks.length === 0 && midiPlayerRef.current) {
      const offsetMs = payload.metadata?.scoreSynthOffsetMs || 0;
      capturedSongTimeMs = Math.max(0, (midiPlayerRef.current.currentTime * playbackRate * 1000) - midiStartOffsetMs + offsetMs);
    } else if (wasPlaying && audioManagerRef.current) {
      capturedSongTimeMs = audioManagerRef.current.getCurrentPositionMs();
    }

    if (wasPlaying) {
      handlePause();
    }

    setPositionMs(capturedSongTimeMs);

    if (wasPlaying) {
      pendingResumeAfterRateChangeRef.current = true;
    }

    setPitchShift(semitones);
    if (audioManagerRef.current) audioManagerRef.current.setPitchShift(semitones);
  }, [payload.audioTracks.length, handlePause, playbackRate, midiStartOffsetMs, positionMs, payload.metadata?.scoreSynthOffsetMs]);

  const handleMetronomeToggle = useCallback((enabled: boolean) => {
    setIsMetronomeEnabled(enabled);
    if (audioManagerRef.current) audioManagerRef.current.setMetronomeEnabled(enabled);
  }, []);

  const handleMuteToggle = useCallback((trackId: string) => {
    setMuteByTrackId(prev => {
      const next = { ...prev, [trackId]: !prev[trackId] };
      if (trackId !== "score-midi" && audioManagerRef.current) audioManagerRef.current.setMute(trackId, next[trackId]);
      return next;
    });
  }, []);

  const handleSoloToggle = useCallback((trackId: string) => {
    setSoloByTrackId(prev => {
      const next = { ...prev, [trackId]: !prev[trackId] };
      if (trackId !== "score-midi" && audioManagerRef.current) audioManagerRef.current.setSolo(trackId, next[trackId]);
      return next;
    });
  }, []);

  const handleVolumeChange = useCallback((trackId: string, volume: number) => {
    setVolumes(prev => ({ ...prev, [trackId]: volume }));
    if (trackId !== "score-midi" && audioManagerRef.current) audioManagerRef.current.setVolume(trackId, volume);
  }, []);

  // --- Pre-roll toggle ---
  const handlePreRollToggle = useCallback((enabled: boolean) => {
    setIsPreRollEnabled(enabled);
    if (audioManagerRef.current) audioManagerRef.current.setPreRollEnabled(enabled);
  }, []);

  // --- BPM change (rescales timemap) ---
  const handleBpmChange = useCallback((newBpm: number) => {
    if (!onPayloadChange) return;
    const oldBpm = payload.metadata?.tempo ?? 120;
    if (newBpm === oldBpm || newBpm <= 0) return;
    const ratio = oldBpm / newBpm;
    const oldTimemap = payload.notationData?.timemap ?? [];
    const newTimemap = oldTimemap.map((t: any) => ({ ...t, timeMs: t.timeMs * ratio }));
    onPayloadChange({
      ...payload,
      metadata: { ...payload.metadata, tempo: newBpm },
      notationData: { ...payload.notationData, timemap: newTimemap } as any,
    });
    if (audioManagerRef.current) {
      audioManagerRef.current.getMetronome()?.setTempoParams(newBpm, timeSignature, payload.metadata?.timeSignature || "4/4");
    }
  }, [payload, onPayloadChange, timeSignature]);

  // --- Time signature change ---
  const handleTimeSignatureChange = useCallback((newSig: string) => {
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
  }, [payload, onPayloadChange]);

  return {
    state: {
      positionMs, durationMs, totalSongDurationMs, isPlaying, loadingAudio,
      midiBase64, stretchedMidiBase64, parsedMidi,
      playbackRate, pitchShift, isMetronomeEnabled, isPreRollEnabled,
      muteByTrackId, soloByTrackId, volumes,
      isWaitMode, isWaitModeLenient, practiceTrackIds, showWaitModeMonitor,
      isControlsCollapsed, isAutoplayEnabled,
      isWaiting: isWaitingRef.current,
      activeNotes,
      isMidiInitialized, isMicInitialized: isMicInitializedState,
      midiNotes, micNotes,
      loopState, partNames, timeSignature,
      correctedTimemap: correctedTimemapRef.current,
      isScoreSynthMuted, midiStartOffsetMs,
    },
    refs: {
      midiPlayerRef, waitModeMonitorRef, positionMsRef, audioManagerRef, isPlayingRef, midiTimeoutRef
    },
    actions: {
      handlePlay, handlePause, handleStop, handleSeek,
      handlePlaybackRateChange, handlePitchShiftChange,
      handleMetronomeToggle, handlePreRollToggle,
      handleBpmChange, handleTimeSignatureChange,
      handleMuteToggle, handleSoloToggle, handleVolumeChange,
      handleCollapseToggle, handleLoopStateChange, handleMidiExtracted,
      handlePartNamesExtracted: setPartNames,
      setIsWaitMode, setIsWaitModeLenient, setPracticeTrackIds, setShowWaitModeMonitor, setIsAutoplayEnabled,
      setMuteByTrackId, setSoloByTrackId, setLoopState,
      initializeMidi, disconnectMidi, initializeMic, disconnectMic
    }
  };
}
