import { useState, useRef, useCallback, useEffect } from "react";

export function useMicInput() {
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [isMicInitialized, setIsMicInitialized] = useState(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>(0);
  
  // Acoustic Smoothing Filter: Sustain notes for 500ms gracefully.
  const activePitchesRef = useRef<Set<number>>(new Set());
  const pitchTimersRef = useRef<Map<number, number>>(new Map());

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

    setActiveNotes(new Set());
    setIsMicInitialized(false);
  }, []);

  const initializeMic = useCallback(async (): Promise<boolean> => {
    if (isMicInitialized) return true;

    try {
      // Force-disable default OS Noise Suppression (iOS is extremely aggressive with this by default)
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
      // Flowkey Magic: Maximize FFT Size (32768) to partition frequencies into ultra-fine bins (1.34 Hz/bin)
      // This allows the Peak-Picking algorithm to accurately detect Polyphonic Chords which YIN natively fails at!
      analyser.fftSize = 32768; 
      analyser.smoothingTimeConstant = 0.5; 
      analyserRef.current = analyser;

      // Physically amplify raw input volume.
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 4.0; 

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(gainNode);
      gainNode.connect(analyser);

      setIsMicInitialized(true);

      const processAudio = () => {
        if (!analyserRef.current || !audioCtxRef.current) return;
        
        const binCount = analyserRef.current.frequencyBinCount; // 16384 bins
        // Utilize the Frequency Domain rather than Time Domain to isolate Polyphonic sequences
        const buffer = new Float32Array(binCount);
        analyserRef.current.getFloatFrequencyData(buffer); // Array of Decibels (dB)
        
        const now = performance.now();
        const sampleRate = audioCtxRef.current.sampleRate;
        const binSize = (sampleRate / 2) / binCount;
        
        // 1. Identify Loudest Peak to establish a dynamic background noise threshold
        let maxAmp = -Infinity;
        for (let i = 0; i < binCount; i++) {
          if (buffer[i] > maxAmp) maxAmp = buffer[i];
        }

        // Absolute Minimum Noise Floor Detection limit.
        const THRESHOLD_DB = -55;

        // Skip the first 5 bins (DC offset interference) and trailing 5 bins
        for (let i = 5; i < binCount - 5; i++) {
          const amp = buffer[i];
          
          // Strict Local Maxima / Peak Picking Algorithm
          // Condition 1: Amplitude strictly exceeds minimum absolute Threshold.
          // Condition 2: Filter out dim peaks (Cannot drop more than 35dB below the loudest MaxAmp).
          if (amp > THRESHOLD_DB && amp > maxAmp - 35) {
            
            // Condition 3: Topographic Local Maxima (Amplitude exceeds immediate neighbor bins).
            if (amp > buffer[i - 1] && amp > buffer[i + 1]) {
              
              // Condition 4: PROMINENCE FILTER (Crucial for rejecting Broadband Noise like Coughs/Clapping).
              // Coughs are Broadband (Blunt/Flat shapes). Piano tones are Tonal (Extremely Sharp Spikes).
              // We evaluate 10 surrounding bins (+/- 5 bins) to explicitly confirm the decibel prominence ratio.
              let localSum = 0;
              for (let j = -5; j <= 5; j++) {
                localSum += buffer[i + j];
              }
              const localAvg = localSum / 11;
              
              // If the peak barely rises 10dB above neighbors -> It's Broadband White Noise (Coughs) -> IGNORE!
              // If the peak pierces 12dB or more above neighbors -> It's a clean Acoustic Piano Tone.
              if (amp - localAvg > 12) { 
                
                // Parabolic Interpolation logic smoothing frequency alignment perfectly between 2 overlapping Bins.
                const valL = buffer[i - 1];
                const valC = buffer[i];
                const valR = buffer[i + 1];
                const p = 0.5 * (valL - valR) / (valL - 2 * valC + valR);
                
                const exactBin = i + p;
                const freq = exactBin * binSize;
                
                // Restrict evaluation bounds explicitly to Physical Piano Octave Frequencies
                if (freq >= 27.5 && freq <= 4186) { 
                  const midiNote = Math.round(69 + 12 * Math.log2(freq / 440));
                  if (midiNote > 0 && midiNote < 128) {
                    // Safe Polyphonic Chord Node Discovered!
                    pitchTimersRef.current.set(midiNote, now);
                  }
                }
              }
            }
          }
        }
        
        // 2. Expand Array Grace Period parameters out to 500ms preventing immediate sustain dropout conditions.
        // During Acoustic attack transients (hammer striking piano string), the Peak Picker can hallucinate blind Nulls for 1-2 frames.
        const newPitches = new Set<number>();
        pitchTimersRef.current.forEach((lastSeen, note) => {
            if (now - lastSeen < 500) {
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
