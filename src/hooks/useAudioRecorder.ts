/**
 * useAudioRecorder — Browser-based audio recording hook using MediaRecorder API.
 * Used in Play Mode for students to record their practice sessions.
 *
 * Fixes the WebM duration bug (MediaRecorder outputs WebM without duration metadata)
 * using fix-webm-duration. Also enforces a max recording time.
 */

import { useState, useRef, useCallback } from "react";
import fixWebmDuration from "fix-webm-duration";

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

      // Use webm/opus if available, fallback to whatever browser supports
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const isWebm = mimeType.includes("webm");

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000, // 128 kbps for better quality
      });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const duration = Date.now() - startTimeRef.current;
        let blob = new Blob(chunksRef.current, { type: mimeType });

        // Fix WebM duration metadata (MediaRecorder doesn't set it)
        if (isWebm) {
          try {
            blob = await fixWebmDuration(blob, duration, { logger: false });
          } catch {
            // If fix fails, use the original blob — playback works, just no seekbar
          }
        }

        const url = URL.createObjectURL(blob);

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
