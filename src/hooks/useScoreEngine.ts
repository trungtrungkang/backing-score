import { useState, useCallback, useEffect, useRef, useMemo, useId } from "react";
import { getFileViewUrl } from "@/lib/appwrite";
import { Midi } from "@tonejs/midi";
import type { DAWPayload } from "@/lib/daw/types";
import { AudioManager, type TrackParams } from "@/lib/audio/AudioManager";
import { useMidiInput } from "@/hooks/useMidiInput";
import { useMicInput } from "@/hooks/useMicInput";
import { getPhysicalMeasure, evaluateWaitModeMatch } from "@/lib/score/math";

export interface ScoreEngineParams {
  payload: DAWPayload;
  autoplayOnLoad?: boolean;
  onNext?: () => void;
  onWaitModeComplete?: (score: number) => void;
}

export function useScoreEngine({ payload, autoplayOnLoad, onNext, onWaitModeComplete }: ScoreEngineParams) {
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

  // --- Wait Mode Hardware Integration ---
  const { activeNotes: midiNotes, hasMidiDevice, initializeMidi, isMidiInitialized, disconnectMidi } = useMidiInput();
  const { activeNotes: micNotes, initializeMic, isMicInitialized: isMicInitializedState, disconnectMic } = useMicInput();

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
  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState(true);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [loopState, setLoopState] = useState<{enabled: boolean; startBar: number; endBar: number}>({ 
    enabled: false, startBar: 1, endBar: 4 
  });

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
      prevFilesRef.current = null;
    };
  }, [payload.metadata, payload.audioTracks]);

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
      console.error("Failed to transform MIDI", e);
      setStretchedMidiBase64(midiBase64);
    }
  }, [midiBase64, playbackRate, pitchShift, payload.metadata?.tempo]);

  useEffect(() => {
    if (audioManagerRef.current) {
      const metronome = audioManagerRef.current.getMetronome();
      if (metronome) {
        const timemapArr = payload.notationData?.timemap || [];
        metronome.setTimemap(timemapArr);
        metronome.setSyncToTimemap(timemapArr.length > 0);
      }
    }
  }, [payload.notationData?.timemap, payload.metadata?.syncToTimemap]);

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
      const targetTimeSecs = (positionMs - offsetMs + midiStartOffsetMs) / 1000;
      
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
    if (audioManagerRef.current && payload.audioTracks.length > 0) {
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
        if (audioManagerRef.current && payload.audioTracks.length > 0) audioManagerRef.current.pause();
    } catch (e) { console.error(e); }

    if (audioManagerRef.current && payload.audioTracks.length > 0) {
      setPositionMs(audioManagerRef.current.getCurrentPositionMs()); 
    } else if (midiPlayerRef.current) {
      if (isWaitModeRef.current) {
         setPositionMs(positionMs);
      } else {
         const offsetMs = payload.metadata?.scoreSynthOffsetMs || 0;
         setPositionMs(Math.max(0, (midiPlayerRef.current.currentTime * 1000) - midiStartOffsetMs + offsetMs));
      }
    }
  }, [payload.audioTracks.length, midiStartOffsetMs, payload.metadata?.scoreSynthOffsetMs, positionMs]);

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
    if (audioManagerRef.current && payload.audioTracks.length > 0) {
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
                if (audioManagerRef.current && payload.audioTracks.length > 0) Promise.resolve(audioManagerRef.current.play()).catch(e => {});
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
      } else if (audioManagerRef.current) {
          currentPos = audioManagerRef.current.getCurrentPositionMs();
      }
    }

    setPositionMs(prev => {
      const roundedPos = Math.round(currentPos);
      if (Math.abs(prev - roundedPos) < 16) return prev;
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
  }, [payload.audioTracks.length, midiStartOffsetMs, totalSongDurationMs, showWaitModeMonitor, playbackRate, isAutoplayEnabled, onNext, handleStop]);

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

  const handlePlaybackRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (audioManagerRef.current) audioManagerRef.current.setPlaybackRate(rate);
  }, []);

  const handlePitchShiftChange = useCallback((semitones: number) => {
    setPitchShift(semitones);
    if (audioManagerRef.current) audioManagerRef.current.setPitchShift(semitones);
  }, []);

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

  return {
    state: {
      positionMs, durationMs, totalSongDurationMs, isPlaying, loadingAudio,
      midiBase64, stretchedMidiBase64, parsedMidi,
      playbackRate, pitchShift, isMetronomeEnabled,
      muteByTrackId, soloByTrackId, volumes,
      isWaitMode, isWaitModeLenient, practiceTrackIds, showWaitModeMonitor,
      isControlsCollapsed, isAutoplayEnabled,
      isWaiting: isWaitingRef.current,
      activeNotes,
      isMidiInitialized, isMicInitialized: isMicInitializedState,
      midiNotes, micNotes,
      loopState
    },
    refs: {
      midiPlayerRef, waitModeMonitorRef
    },
    actions: {
      handlePlay, handlePause, handleStop, handleSeek,
      handlePlaybackRateChange, handlePitchShiftChange,
      handleMetronomeToggle, handleMuteToggle, handleSoloToggle, handleVolumeChange,
      handleCollapseToggle, handleLoopStateChange, handleMidiExtracted,
      setIsWaitMode, setIsWaitModeLenient, setPracticeTrackIds, setShowWaitModeMonitor, setIsAutoplayEnabled,
      initializeMidi, disconnectMidi, initializeMic, disconnectMic
    }
  };
}
