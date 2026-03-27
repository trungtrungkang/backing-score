/**
 * useAudioRecorder — High-quality MP3 recording using Web Audio API + lamejs.
 *
 * Flow:
 * 1. getUserMedia → AudioContext → ScriptProcessorNode captures PCM float samples
 * 2. On stop, lamejs encodes accumulated PCM → MP3 Blob
 * 3. Output: proper MP3 file with correct duration metadata
 *
 * No WASM, no workers, no Next.js bundling issues — pure JavaScript.
 */

import { useState, useRef, useCallback } from "react";
import { encodePcmToMp3 } from "@/lib/mp3encoder";

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  recordingBlob: Blob | null;
  recordingUrl: string | null;
  durationMs: number;
  error: string | null;
}

export const MAX_RECORDING_MS = 5 * 60 * 1000; // 5 minutes

export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    recordingBlob: null,
    recordingUrl: null,
    durationMs: 0,
    error: null,
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcmDataRef = useRef<Float32Array[]>([]);
  const startTimeRef = useRef<number>(0);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRecordingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;

    const sampleRate = audioCtxRef.current?.sampleRate ?? 44100;
    const pcmChunks = [...pcmDataRef.current];
    const duration = Date.now() - startTimeRef.current;

    cleanup();

    // Encode to MP3 (async — lamejs is loaded dynamically)
    try {
      const blob = await encodePcmToMp3(pcmChunks, sampleRate);
      const url = URL.createObjectURL(blob);

      setState((prev) => ({
        ...prev,
        isRecording: false,
        isPaused: false,
        recordingBlob: blob,
        recordingUrl: url,
        durationMs: duration,
      }));
    } catch (err) {
      console.error("MP3 encoding failed:", err);
      setState((prev) => ({
        ...prev,
        isRecording: false,
        error: "Failed to encode recording",
      }));
    }
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    try {
      // Clean up previous recording URL
      if (state.recordingUrl) {
        URL.revokeObjectURL(state.recordingUrl);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,  // OFF for music quality
          noiseSuppression: false,  // OFF for music quality
          autoGainControl: false,   // OFF for natural dynamics
          sampleRate: 44100,
        },
      });
      streamRef.current = stream;

      const audioCtx = new AudioContext({ sampleRate: 44100 });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // ScriptProcessorNode to capture raw PCM
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      pcmDataRef.current = [];
      startTimeRef.current = Date.now();
      isRecordingRef.current = true;

      processor.onaudioprocess = (e) => {
        if (!isRecordingRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        pcmDataRef.current.push(new Float32Array(inputData));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      // Auto-stop after MAX_RECORDING_MS
      autoStopTimerRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_RECORDING_MS);

      setState((prev) => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        recordingBlob: null,
        recordingUrl: null,
        durationMs: 0,
        error: null,
      }));
    } catch (err) {
      cleanup();
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied. Please allow mic access to record."
          : "Failed to start recording. Check your microphone.";

      setState((prev) => ({ ...prev, error: message }));
    }
  }, [state.recordingUrl, stopRecording, cleanup]);

  const discardRecording = useCallback(() => {
    if (state.recordingUrl) {
      URL.revokeObjectURL(state.recordingUrl);
    }
    setState((prev) => ({
      ...prev,
      recordingBlob: null,
      recordingUrl: null,
      durationMs: 0,
    }));
  }, [state.recordingUrl]);

  return {
    ...state,
    startRecording,
    stopRecording,
    discardRecording,
  };
}
