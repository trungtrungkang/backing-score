/**
 * useAudioRecorder — Browser-based audio recording hook using MediaRecorder API.
 * Used in Play Mode for students to record their practice sessions.
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

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
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
  }, [state.recordingUrl]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

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
