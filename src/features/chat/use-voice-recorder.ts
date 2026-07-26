'use client';

import { useEffect, useRef, useState } from 'react';

/** Frontend UX contract from Go-Ai voice docs — not trusted server validation. */
export const VOICE_CAPTURE_MAX_MS = 300_000;
export const VOICE_CAPTURE_WARN_MS = 270_000;

export type VoiceRecorderPhase = 'idle' | 'recording' | 'warning' | 'transcribing';

type UseVoiceRecorderOptions = {
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
  language?: string;
  disabled?: boolean;
};

type UseVoiceRecorderResult = {
  phase: VoiceRecorderPhase;
  elapsedMs: number;
  supported: boolean;
  toggle: () => void;
  stop: () => void;
};

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') {
    return undefined;
  }
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions): UseVoiceRecorderResult {
  const [phase, setPhase] = useState<VoiceRecorderPhase>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [supported, setSupported] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const warnRef = useRef<number | null>(null);
  const hardStopRef = useRef<number | null>(null);
  const uploadingRef = useRef(false);

  useEffect(() => {
    setSupported(
      typeof window !== 'undefined'
      && typeof MediaRecorder !== 'undefined'
      && Boolean(navigator.mediaDevices?.getUserMedia),
    );
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      stopTracks();
      mediaRecorderRef.current = null;
    };
  }, []);

  function clearTimers(): void {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (warnRef.current != null) {
      window.clearTimeout(warnRef.current);
      warnRef.current = null;
    }
    if (hardStopRef.current != null) {
      window.clearTimeout(hardStopRef.current);
      hardStopRef.current = null;
    }
  }

  function stopTracks(): void {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function uploadBlob(blob: Blob): Promise<void> {
    if (uploadingRef.current || blob.size === 0) {
      setPhase('idle');
      setElapsedMs(0);
      return;
    }
    uploadingRef.current = true;
    setPhase('transcribing');

    try {
      const formData = new FormData();
      formData.append('file', blob, 'recording.webm');
      if (options.language) {
        formData.append('language', options.language);
      }

      const response = await fetch('/api/chat/transcribe', {
        method: 'POST',
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Transcription failed');
      }
      const text = payload?.text?.trim() ?? '';
      if (!text) {
        throw new Error('Transcription returned no text');
      }
      options.onTranscript(text);
    } catch (error) {
      options.onError(error instanceof Error ? error.message : 'Transcription failed');
    } finally {
      uploadingRef.current = false;
      setPhase('idle');
      setElapsedMs(0);
    }
  }

  function finalizeRecorder(): void {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      clearTimers();
      stopTracks();
      return;
    }
    recorder.stop();
  }

  async function startRecording(): Promise<void> {
    if (options.disabled || phase !== 'idle' || !supported) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setPhase('recording');

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        clearTimers();
        stopTracks();
        setPhase('idle');
        options.onError('Recording failed');
      };
      recorder.onstop = () => {
        clearTimers();
        stopTracks();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        void uploadBlob(blob);
      };

      recorder.start(1_000);

      tickRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 250);

      warnRef.current = window.setTimeout(() => {
        setPhase((current) => (current === 'recording' ? 'warning' : current));
      }, VOICE_CAPTURE_WARN_MS);

      hardStopRef.current = window.setTimeout(() => {
        finalizeRecorder();
      }, VOICE_CAPTURE_MAX_MS);
    } catch {
      stopTracks();
      setPhase('idle');
      options.onError('Microphone permission is required');
    }
  }

  function stop(): void {
    if (phase === 'recording' || phase === 'warning') {
      finalizeRecorder();
    }
  }

  function toggle(): void {
    if (phase === 'recording' || phase === 'warning') {
      stop();
      return;
    }
    void startRecording();
  }

  return { phase, elapsedMs, supported, toggle, stop };
}
