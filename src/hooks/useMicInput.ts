import { useState, useRef, useCallback, useEffect } from "react";
// @ts-ignore
import Pitchfinder from "pitchfinder";

export function useMicInput() {
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [isMicInitialized, setIsMicInitialized] = useState(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>(0);
  
  // Acoustic Smoothing Filter: Sustain notes for 250ms gracefully overriding raw frequency dropouts natively.
  const activePitchesRef = useRef<Set<number>>(new Set());
  const pitchTimersRef = useRef<Map<number, number>>(new Map());
  const detectPitchRef = useRef<((float32AudioBuffer: Float32Array) => number | null) | null>(null);

  const disconnectMic = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioCtxRef.current) audioCtxRef.current.close().catch(console.error);

    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    animationFrameRef.current = 0;
    activePitchesRef.current.clear();
    pitchTimersRef.current.clear();
    detectPitchRef.current = null;

    setActiveNotes(new Set());
    setIsMicInitialized(false);
  }, []);

  const initializeMic = useCallback(async (): Promise<boolean> => {
    if (isMicInitialized) return true;

    try {
      // CRITCAL AUDIO FIX: Browsers aggressively apply Speech-oriented Noise Suppression and Echo Cancellation by default.
      // This mathematically destroys Musical Instrument harmonics (treating Piano as "background noise").
      // We must explicitly disable these native WebRTC constraints to capture High-Fidelity Acoustic waves!
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        }
      });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048; // Excellent tradeoff between resolution and latency
      analyserRef.current = analyser;

      // Inject a Gain Node artificially amplifying the raw signal strength (2.5x boost)
      // This guarantees even soft, distant piano strokes cross the Float32 trigger threshold natively.
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 2.5;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(gainNode);
      gainNode.connect(analyser);

      detectPitchRef.current = Pitchfinder.YIN({ sampleRate: audioCtx.sampleRate });
      setIsMicInitialized(true);

      const processAudio = () => {
        if (!analyserRef.current || !detectPitchRef.current) return;
        
        const buffer = new Float32Array(analyserRef.current.fftSize);
        analyserRef.current.getFloatTimeDomainData(buffer);
        
        const pitch = detectPitchRef.current(buffer);
        const now = performance.now();
        
        if (pitch && pitch > 20 && pitch < 5000) { 
          // Prevent hallucinated ultra-low baselines or high pitches natively
          // Math calculation for Hertz to explicit MIDI bounds (+0.5 for rounding thresholds)
          const midiNote = Math.round(69 + 12 * Math.log2(pitch / 440));
          if (midiNote > 0 && midiNote < 128) {
            pitchTimersRef.current.set(midiNote, now);
          }
        }
        
        // Decay evaluation enforcing a 250ms grace period protecting against Microphone FFT silences
        const newPitches = new Set<number>();
        pitchTimersRef.current.forEach((lastSeen, note) => {
            if (now - lastSeen < 250) {
                newPitches.add(note);
            } else {
                pitchTimersRef.current.delete(note);
            }
        });

        // Prevent layout thrashing: Diff the exact Set boundaries manually
        let hasChanged = false;
        if (newPitches.size !== activePitchesRef.current.size) {
           hasChanged = true;
        } else {
           for (const n of newPitches) {
               if (!activePitchesRef.current.has(n)) { hasChanged = true; break; }
           }
        }

        if (hasChanged) {
           activePitchesRef.current = newPitches;
           setActiveNotes(new Set(newPitches));
        }

        animationFrameRef.current = requestAnimationFrame(processAudio);
      };

      processAudio();
      return true;

    } catch (err) {
      console.warn("Microphone access denied or unsupported", err);
      return false;
    }
  }, [isMicInitialized]);

  useEffect(() => {
    return disconnectMic;
  }, [disconnectMic]);

  return { activeNotes, initializeMic, isMicInitialized, disconnectMic };
}
