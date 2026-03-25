import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Peak-First Polyphonic Pitch Detector v6
 *
 * Previous approaches all failed because they scanned every MIDI note against
 * the spectrum — low MIDI notes share FFT bins and produce masses of false positives.
 *
 * This version:
 * 1. Finds REAL spectral peaks (strict local maximum + prominence)
 * 2. Uses parabolic interpolation for accurate peak frequencies
 * 3. Groups peaks into harmonic series by checking integer ratios
 * 4. The fundamental that explains the most peaks wins
 * 5. MIN_MIDI = 36 (C2, 65Hz) — laptop mics can't capture below this reliably
 *
 * When user plays A1 (55Hz), mic captures harmonics 110,220,330,440...
 * Algorithm finds 110Hz as a fundamental that explains 110,220,330,440 = A2.
 * This is physically correct — the mic literally cannot hear 55Hz.
 */

// ── Constants ─────────────────────────────────────────────────────────

const FFT_SIZE = 8192;
const SMOOTHING = 0.3;
const MIC_GAIN = 5.0;
const SILENCE_RMS = 0.015;

// Peak detection
const PEAK_WIN = 3;        // local max window ±3 bins
const PEAK_PROM_DB = 5;    // must exceed ±6bin local avg by this much
const PEAK_FLOOR_DB = -50; // absolute minimum for any peak
const MAX_PEAKS = 20;      // cap raw peaks before matching

// Fundamental matching
const MIN_CANDIDATE_FREQ = 27.5; // Allow candidates down to A0 for missing fundamental detection
const MIN_PEAK_FREQ = 65;        // But only look for peaks above C2 (mic range)
const MAX_FREQ = 4200;    // C8
const FREQ_TOLERANCE = 0.04; // ±4% tolerance for harmonic matching
const MIN_PEAK_MATCHES = 3;  // fundamental must explain at least 3 peaks (was 2, too loose)
const MAX_HARMONIC = 10;     // check up to 10th harmonic

// Note tracking
const CONFIRM_FRAMES = 2;
const RELEASE_FRAMES = 6;
const MAX_NOTES = 6;

// Debug
const DEBUG = false;
let debugCounter = 0;

// ── Types ─────────────────────────────────────────────────────────────

interface SpectralPeak {
  freq: number;
  amp: number;
  bin: number;
}

interface NoteState {
  midiNote: number;
  confirmCount: number;
  releaseCount: number;
  isConfirmed: boolean;
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useMicInput() {
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [isMicInitialized, setIsMicInitialized] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>(0);
  const noteStatesRef = useRef<Map<number, NoteState>>(new Map());
  const activeNotesRef = useRef<Set<number>>(new Set());

  const disconnectMic = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioCtxRef.current) audioCtxRef.current.close().catch(console.error);
    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    animationFrameRef.current = 0;
    noteStatesRef.current.clear();
    setActiveNotes(new Set());
    setIsMicInitialized(false);
  }, []);

  const initializeMic = useCallback(async (): Promise<boolean> => {
    if (isMicInitialized) return true;

    try {
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
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = SMOOTHING;
      analyserRef.current = analyser;

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = MIC_GAIN;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(gainNode);
      gainNode.connect(analyser);

      setIsMicInitialized(true);

      const binCount = analyser.frequencyBinCount;
      const freqBuf = new Float32Array(binCount);
      const timeBuf = new Float32Array(FFT_SIZE);
      const sampleRate = audioCtx.sampleRate;
      const binHz = sampleRate / FFT_SIZE;

      if (DEBUG) {
        console.log(`[PD v6] Init: sr=${sampleRate}, binHz=${binHz.toFixed(2)}`);
      }

      const processAudio = () => {
        if (!analyserRef.current || !audioCtxRef.current) return;

        analyserRef.current.getFloatTimeDomainData(timeBuf);
        const rms = computeRMS(timeBuf);
        debugCounter++;

        if (rms < SILENCE_RMS) {
          ageOutNotes();
          animationFrameRef.current = requestAnimationFrame(processAudio);
          return;
        }

        analyserRef.current.getFloatFrequencyData(freqBuf);

        // ── Step 1: Find real spectral peaks ─────────────────────
        const peaks = findPeaks(freqBuf, binCount, binHz);

        if (peaks.length === 0) {
          ageOutNotes();
          animationFrameRef.current = requestAnimationFrame(processAudio);
          return;
        }

        // ── Step 2: Find fundamentals that explain peak clusters ──
        const fundamentals = findFundamentals(peaks);

        // Debug
        if (DEBUG && fundamentals.length > 0 && debugCounter % 15 === 0) {
          console.log(`[PD] RMS=${rms.toFixed(3)}, peaks=${peaks.length} [${
            peaks.slice(0, 5).map(p => `${p.freq.toFixed(0)}Hz(${p.amp.toFixed(0)}dB)`).join(',')
          }], notes=[${
            fundamentals.map(f => `${midiToNote(f.midi)}(${f.freq.toFixed(0)}Hz,m=${f.matches})`).join(', ')
          }]`);
        }

        // ── Step 3: Note tracking ────────────────────────────────
        const detectedMidi = new Set(fundamentals.map(f => f.midi));
        let changed = false;

        noteStatesRef.current.forEach((state, midi) => {
          if (detectedMidi.has(midi)) {
            state.confirmCount++;
            state.releaseCount = 0;
            if (!state.isConfirmed && state.confirmCount >= CONFIRM_FRAMES) {
              state.isConfirmed = true;
              changed = true;
            }
          } else {
            state.releaseCount++;
            if (state.releaseCount > RELEASE_FRAMES && state.isConfirmed) {
              noteStatesRef.current.delete(midi);
              changed = true;
            }
          }
        });

        for (const midi of detectedMidi) {
          if (!noteStatesRef.current.has(midi)) {
            noteStatesRef.current.set(midi, {
              midiNote: midi,
              confirmCount: 1,
              releaseCount: 0,
              isConfirmed: false,
            });
          }
        }

        if (changed) emitNotes();
        animationFrameRef.current = requestAnimationFrame(processAudio);
      };

      function ageOutNotes() {
        let changed = false;
        noteStatesRef.current.forEach((state, midi) => {
          state.releaseCount++;
          if (state.releaseCount > RELEASE_FRAMES && state.isConfirmed) {
            noteStatesRef.current.delete(midi);
            changed = true;
          }
        });
        if (changed) emitNotes();
      }

      function emitNotes() {
        const newSet = new Set<number>();
        noteStatesRef.current.forEach(s => { if (s.isConfirmed) newSet.add(s.midiNote); });

        let diff = newSet.size !== activeNotesRef.current.size;
        if (!diff) { for (const n of newSet) if (!activeNotesRef.current.has(n)) { diff = true; break; } }

        if (diff) {
          activeNotesRef.current = newSet;
          setActiveNotes(new Set(newSet));
          if (DEBUG && newSet.size > 0) {
            console.log(`[PD] 🎵 Active: ${Array.from(newSet).map(midiToNote).join(', ')}`);
          }
        }
      }

      processAudio();
      return true;
    } catch (err) {
      console.warn("Microphone access denied or unsupported", err);
      return false;
    }
  }, [isMicInitialized]);

  useEffect(() => disconnectMic, [disconnectMic]);

  return { activeNotes, initializeMic, isMicInitialized, disconnectMic };
}

// ── Peak Detection ───────────────────────────────────────────────────

function findPeaks(
  spectrum: Float32Array,
  binCount: number,
  binHz: number,
): SpectralPeak[] {
  const minBin = Math.ceil(MIN_PEAK_FREQ / binHz);
  const maxBin = Math.min(binCount - PEAK_WIN - 1, Math.floor(MAX_FREQ / binHz));

  // Find global max for dynamic threshold
  let globalMax = -Infinity;
  for (let i = minBin; i <= maxBin; i++) {
    if (spectrum[i] > globalMax) globalMax = spectrum[i];
  }

  if (globalMax < PEAK_FLOOR_DB) return [];

  // Dynamic floor: within 35dB of loudest
  const dynFloor = Math.max(globalMax - 35, PEAK_FLOOR_DB);

  const peaks: SpectralPeak[] = [];

  for (let i = minBin + PEAK_WIN; i <= maxBin - PEAK_WIN; i++) {
    const amp = spectrum[i];
    if (amp < dynFloor) continue;

    // Strict local maximum: must be > all neighbors in ±PEAK_WIN
    let isMax = true;
    for (let w = 1; w <= PEAK_WIN; w++) {
      if (spectrum[i - w] >= amp || spectrum[i + w] >= amp) {
        isMax = false;
        break;
      }
    }
    if (!isMax) continue;

    // Prominence check: exceed ±6-bin local average
    const promHalf = 6;
    const lo = Math.max(0, i - promHalf);
    const hi = Math.min(binCount - 1, i + promHalf);
    let localSum = 0;
    for (let j = lo; j <= hi; j++) localSum += spectrum[j];
    const localAvg = localSum / (hi - lo + 1);
    if (amp - localAvg < PEAK_PROM_DB) continue;

    // Parabolic interpolation for sub-bin frequency
    const vL = spectrum[i - 1], vC = amp, vR = spectrum[i + 1];
    const denom = vL - 2 * vC + vR;
    const p = denom !== 0 ? 0.5 * (vL - vR) / denom : 0;
    const freq = (i + p) * binHz;

    if (freq >= MIN_PEAK_FREQ && freq <= MAX_FREQ) {
      peaks.push({ freq, amp, bin: i });
    }
  }

  // Sort by amplitude (loudest first), cap at MAX_PEAKS
  peaks.sort((a, b) => b.amp - a.amp);
  return peaks.slice(0, MAX_PEAKS);
}

// ── Fundamental Matching ─────────────────────────────────────────────

interface FoundNote {
  midi: number;
  freq: number;
  matches: number; // how many peaks this fundamental explains
  score: number;
}

function findFundamentals(peaks: SpectralPeak[]): FoundNote[] {
  if (peaks.length === 0) return [];

  // For each peak, try it as a potential fundamental or
  // try dividing it by 2,3,4,5 to find sub-fundamentals
  const candidateF0s = new Map<number, { freq: number; matchCount: number; totalAmp: number; f0IsPeak: boolean }>();

  for (const peak of peaks) {
    // Try this peak as H1, H2, H3 of some fundamental (max div=3)
    // div=3 still allows missing fundamental detection (e.g. 165/3=55=A1)
    // but prevents deep sub-harmonics (262/4=65=C2 false positive)
    for (let div = 1; div <= 3; div++) {
      const f0 = peak.freq / div;
      if (f0 < MIN_CANDIDATE_FREQ || f0 > MAX_FREQ) continue;

      const midi = freqToMidi(f0);
      if (midi < 0) continue;

      const key = midi;
      if (!candidateF0s.has(key)) {
        candidateF0s.set(key, { freq: f0, matchCount: 0, totalAmp: 0, f0IsPeak: false });
      }
    }
  }

  // Check if each candidate's f0 is directly a spectral peak
  candidateF0s.forEach((cand) => {
    for (const peak of peaks) {
      const ratio = peak.freq / cand.freq;
      if (Math.abs(ratio - 1) < FREQ_TOLERANCE) {
        cand.f0IsPeak = true;
        break;
      }
    }
  });

  // Score each candidate: count how many peaks it explains
  candidateF0s.forEach((cand, midi) => {
    let matches = 0;
    let totalAmp = 0;

    for (let h = 1; h <= MAX_HARMONIC; h++) {
      const expectedFreq = cand.freq * h;
      if (expectedFreq > MAX_FREQ * 2) break;

      // Find the peak closest to this expected harmonic
      for (const peak of peaks) {
        const ratio = peak.freq / expectedFreq;
        if (Math.abs(ratio - 1) < FREQ_TOLERANCE) {
          matches++;
          totalAmp += peak.amp;
          break; // count each harmonic only once
        }
      }
    }

    cand.matchCount = matches;
    cand.totalAmp = totalAmp;
  });

  // Filter with adaptive threshold based on f0 presence and frequency:
  // - f0 IS a peak + freq > 400Hz → 1 match (high notes: harmonics above mic range)
  // - f0 IS a peak + freq ≤ 400Hz → 2 matches
  // - f0 NOT a peak → 4 matches (sub-audible: need strong harmonic evidence)
  const valid: FoundNote[] = [];
  candidateF0s.forEach((cand, midi) => {
    let minRequired: number;
    if (cand.f0IsPeak && cand.freq > 400) {
      minRequired = 1; // High notes: fundamental alone is sufficient
    } else if (cand.f0IsPeak) {
      minRequired = 2;
    } else {
      minRequired = 4;
    }
    if (cand.matchCount >= minRequired) {
      // Large bonus when f0 is a peak — prevents octave-below from winning
      const f0Bonus = cand.f0IsPeak ? 50 : 0;
      valid.push({
        midi,
        freq: cand.freq,
        matches: cand.matchCount,
        score: cand.matchCount * 10 + cand.totalAmp + f0Bonus,
      });
    }
  });

  // Sort by SCORE (not match count) — f0Bonus makes audible fundamentals rank first
  valid.sort((a, b) => b.score - a.score);

  // Two-pass greedy selection:
  // Pass 1: candidates with ≥2 matches (strong evidence)
  // Pass 2: 1-match candidates only for peaks not yet claimed
  const selected: FoundNote[] = [];
  const usedPeaks = new Set<number>();

  // Helper to check and select a candidate
  const trySelect = (note: FoundNote): boolean => {
    if (selected.length >= MAX_NOTES) return false;

    let peaksUsed = 0;
    let peaksTotal = 0;
    for (let h = 1; h <= MAX_HARMONIC; h++) {
      const expectedFreq = note.freq * h;
      for (const peak of peaks) {
        const ratio = peak.freq / expectedFreq;
        if (Math.abs(ratio - 1) < FREQ_TOLERANCE) {
          peaksTotal++;
          if (usedPeaks.has(peak.bin)) peaksUsed++;
          break;
        }
      }
    }

    if (peaksTotal > 0 && peaksUsed / peaksTotal > 0.5) return false;

    selected.push(note);
    for (let h = 1; h <= MAX_HARMONIC; h++) {
      const expectedFreq = note.freq * h;
      for (const peak of peaks) {
        const ratio = peak.freq / expectedFreq;
        if (Math.abs(ratio - 1) < FREQ_TOLERANCE) {
          usedPeaks.add(peak.bin);
          break;
        }
      }
    }
    return true;
  };

  // Pass 1: multi-match candidates first (≥2 matches = real evidence)
  for (const note of valid) {
    if (note.matches >= 2) trySelect(note);
  }

  // Pass 2: 1-match candidates only for unclaimed high-frequency peaks
  for (const note of valid) {
    if (note.matches === 1) trySelect(note);
  }

  return selected;
}

// ── Utilities ────────────────────────────────────────────────────────

function computeRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}

function freqToMidi(freq: number): number {
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  return (midi >= 21 && midi <= 108) ? midi : -1;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiToNote(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}
