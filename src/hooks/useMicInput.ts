import { useState, useRef, useCallback, useEffect } from "react";
import * as tf from "@tensorflow/tfjs";
import { BasicPitch } from "@spotify/basic-pitch";

// URL to Spotify's pre-trained Basic Pitch model hosted publicly via UNPKG
// TFJS will fetch this once and cache it heavily in the browser's IndexedDB.
const BASIC_PITCH_MODEL_URL = "https://unpkg.com/@spotify/basic-pitch@1.0.1/model/model.json";

// Basic Pitch requires exactly 22050Hz and 43844 samples per window (~2 seconds)
const AUDIO_SAMPLE_RATE = 22050;
const AUDIO_WINDOW_LENGTH_SECONDS = 2;
const FFT_HOP = 256;
const AUDIO_N_SAMPLES = AUDIO_SAMPLE_RATE * AUDIO_WINDOW_LENGTH_SECONDS - FFT_HOP; // 43844

const CONFIRM_PROBABILITY_THRESHOLD = 0.38; // Standard threshold (reduced noise)

export interface MicProfile {
  noiseFloor: number;
  lowRangeOffset: number;
  highRangeOffset: number;
}

export interface UseMicInputOptions {
  profile?: MicProfile;
  /**
   * Callback to receive raw probability frames (88 array)
   * used mostly for Calibration UI to listen to ML confidence.
   */
  onFrameAnalyzed?: (aggregatedFrame: Float32Array) => void;
}

export function useMicInput(options: UseMicInputOptions = {}) {
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [isMicInitialized, setIsMicInitialized] = useState(false);
  const [mlLoadingProgress, setMlLoadingProgress] = useState<number>(0);
  const [modelReady, setModelReady] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const basicPitchRef = useRef<BasicPitch | null>(null);

  // Buffer state
  const ringBufferRef = useRef<Float32Array>(new Float32Array(AUDIO_N_SAMPLES));
  const writeIdxRef = useRef<number>(0);
  const isEvaluatingRef = useRef<boolean>(false);
  const activeNotesRef = useRef<Set<number>>(new Set());

  const disconnectMic = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
    }
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (audioCtxRef.current) audioCtxRef.current.close().catch(console.error);

    audioCtxRef.current = null;
    processorRef.current = null;
    streamRef.current = null;
    isEvaluatingRef.current = false;
    writeIdxRef.current = 0;

    setActiveNotes(new Set());
    setIsMicInitialized(false);
  }, []);

  const initializeMic = useCallback(async (): Promise<boolean> => {
    if (isMicInitialized) return true;

    try {
      // 1. Initialize TensorFlow Backend and Model if not already done
      if (!basicPitchRef.current) {
        setMlLoadingProgress(0.1);
        // Safely set backend avoiding NextJS HMR duplicate registration warnings
        if (!tf.getBackend()) {
          try {
            await tf.setBackend('webgl');
          } catch {
            try { await tf.setBackend('wasm'); } catch { await tf.setBackend('cpu'); }
          }
        }
        await tf.ready();

        // Start downloading/loading cached model weights
        const model = new BasicPitch(BASIC_PITCH_MODEL_URL);
        await model.model; // Ensure Promise<tf.GraphModel> resolves
        basicPitchRef.current = model;
        setModelReady(true);
        setMlLoadingProgress(1.0);
      }

      // 2. Setup Audio constraints and Context
      // Native resampling: Asking the browser to transcode the mic to exactly 22050Hz!
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        },
      });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass({ sampleRate: AUDIO_SAMPLE_RATE });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);

      // Using legacy ScriptProcessor for universal broad compatibility since AudioWorklet
      // requires compiling external non-module blobs in Next.js.
      const bufferSize = 4096;
      const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioCtx.destination);

      setIsMicInitialized(true);

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const inputData = e.inputBuffer.getChannelData(0);

        // Push incoming samples into the sliding window ring buffer
        for (let i = 0; i < inputData.length; i++) {
          ringBufferRef.current[writeIdxRef.current] = inputData[i];
          writeIdxRef.current = (writeIdxRef.current + 1) % AUDIO_N_SAMPLES;
        }

        // Trigger Evaluation if the engine is ready and not currently evaluating
        if (basicPitchRef.current && !isEvaluatingRef.current) {
          evaluateAudioChunk();
        }
      };

      return true;
    } catch (err) {
      console.warn("Microphone access denied or model failed to load", err);
      return false;
    }
  }, [isMicInitialized]);

  const evaluateAudioChunk = async () => {
    isEvaluatingRef.current = true;
    const bp = basicPitchRef.current;
    if (!bp) {
      isEvaluatingRef.current = false;
      return;
    }

    // Unroll the ring buffer so the most recent sample is at the end
    const unrolledBuffer = new Float32Array(AUDIO_N_SAMPLES);
    const split = writeIdxRef.current;

    // Copy the oldest part from split to end
    unrolledBuffer.set(ringBufferRef.current.subarray(split, AUDIO_N_SAMPLES), 0);
    // Copy the newest part from 0 to split
    unrolledBuffer.set(ringBufferRef.current.subarray(0, split), AUDIO_N_SAMPLES - split);

    try {
      // BasicPitch evaluation (Inference)
      await bp.evaluateModel(
        unrolledBuffer,
        (frames, onsets, contours) => {
          // frames represents chronological slices.
          if (frames.length > 0) {
            // Lookback at the last ~4 frames (45ms) to catch transients without making the UI "sticky" or noisy.
            const numContextFrames = Math.min(4, frames.length);
            const aggregatedFrame = new Float32Array(88);

            for (let i = frames.length - numContextFrames; i < frames.length; i++) {
              if (i < 0) continue;
              const frame = frames[i];
              for (let pIdx = 0; pIdx < 88; pIdx++) {
                // Pure max-pooling without artificial onsets boost to prevent noise splatter
                aggregatedFrame[pIdx] = Math.max(aggregatedFrame[pIdx], frame[pIdx]);
              }
            }

            const newActiveNotes = new Set<number>();

            // Emit raw frame if user needs to read it
            if (options.onFrameAnalyzed) {
              options.onFrameAnalyzed(aggregatedFrame);
            }

            // Apply personal user Mic Profile calibration logic
            const p = options.profile;
            // Baseline limit set by room noise floor + 0.15 headroom (clamped inside sensible boundaries)
            const baseline = p ? Math.max(0.2, Math.min(0.6, p.noiseFloor + 0.15)) : CONFIRM_PROBABILITY_THRESHOLD;

            const activePitches: { pitch: number, prob: number }[] = [];
            aggregatedFrame.forEach((prob, pitchIdx) => {
              // Base threshold
              let dynamicThreshold = baseline;
              // Adjust based on pitch index (bass vs treble ranges)
              if (p) {
                if (pitchIdx < 36) dynamicThreshold += p.lowRangeOffset;
                else if (pitchIdx > 72) dynamicThreshold += p.highRangeOffset;
              } else {
                // Fallback default scaling
                dynamicThreshold = pitchIdx > 72 ? 0.25 : CONFIRM_PROBABILITY_THRESHOLD;
              }

              // Ensure threshold never drops below 0.1 to prevent constant false-positives
              dynamicThreshold = Math.max(0.1, dynamicThreshold);

              if (prob > dynamicThreshold) {
                activePitches.push({ pitch: pitchIdx + 21, prob });
              }
            });

            // Sort by confidence descending, take maximum 6 simultaneous pitches (prevents acoustic splatter)
            const topPitches = activePitches
              .sort((a, b) => b.prob - a.prob)
              .slice(0, 6)
              .map(p => p.pitch);

            topPitches.forEach(p => newActiveNotes.add(p));

            // Simple shallow comparison to prevent unnecessary renders
            let diff = newActiveNotes.size !== activeNotesRef.current.size;
            if (!diff) {
              for (const n of newActiveNotes) {
                if (!activeNotesRef.current.has(n)) { diff = true; break; }
              }
            }

            if (diff) {
              activeNotesRef.current = newActiveNotes;
              setActiveNotes(new Set(newActiveNotes));
            }
          }
        },
        (percent) => { /* Optional loading progress for large static audio buffers */ }
      );
    } catch (err) {
      console.error("TFJS Inference Error:", err);
    } finally {
      isEvaluatingRef.current = false; // Release Mutex lock for the next inference frame
    }
  };

  useEffect(() => disconnectMic, [disconnectMic]);

  return { activeNotes, initializeMic, isMicInitialized, disconnectMic, modelReady, mlLoadingProgress };
}
