/**
 * useAudioRecorder — Browser-based audio recording hook using mp3-mediarecorder.
 * Outputs high-quality MP3 using WASM LAME encoder (vs native MediaRecorder's low-quality WebM).
 * MP3 has proper duration metadata → no seekbar bugs.
 */

import { useState, useRef, useCallback } from "react";

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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopRecording = useCallback(() => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      // Clean up previous recording URL
      if (state.recordingUrl) {
        URL.revokeObjectURL(state.recordingUrl);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      streamRef.current = stream;

      // Dynamically import mp3-mediarecorder (WASM-based, loads worker)
      let RecorderClass: typeof MediaRecorder;
      try {
        const { Mp3MediaRecorder } = await import("mp3-mediarecorder");
        const workerUrl = new URL(
          "mp3-mediarecorder/worker",
          import.meta.url
        );
        RecorderClass = class extends Mp3MediaRecorder {
          constructor(s: MediaStream, opts?: MediaRecorderOptions) {
            super(s, { worker: new Worker(workerUrl, { type: "module" }), ...opts });
          }
        } as unknown as typeof MediaRecorder;
      } catch {
        // Fallback to native MediaRecorder if mp3-mediarecorder fails
        RecorderClass = MediaRecorder;
      }

      const recorder = new RecorderClass(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = chunksRef.current[0]?.type || "audio/mpeg";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const duration = Date.now() - startTimeRef.current;

        setState((prev) => ({
          ...prev,
          isRecording: false,
          isPaused: false,
          recordingBlob: blob,
          recordingUrl: url,
          durationMs: duration,
        }));

        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.start(1000); // Collect data every second

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
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied. Please allow mic access to record."
          : "Failed to start recording. Check your microphone.";

      setState((prev) => ({ ...prev, error: message }));
    }
  }, [state.recordingUrl, stopRecording]);

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
