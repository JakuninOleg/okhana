'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

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
  /** Push-to-talk: pointer/touch down. */
  pressStart: () => void;
  /** Push-to-talk: pointer/touch up/cancel → stop, upload, transcript. */
  pressEnd: () => void;
  stop: () => void;
};

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') {
    return undefined;
  }
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function subscribeVoiceSupport(): () => void {
  return () => undefined;
}

function getVoiceSupportedClient(): boolean {
  return typeof MediaRecorder !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia);
}

function getVoiceSupportedServer(): boolean {
  return false;
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions): UseVoiceRecorderResult {
  const [phase, setPhase] = useState<VoiceRecorderPhase>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const supported = useSyncExternalStore(
    subscribeVoiceSupport,
    getVoiceSupportedClient,
    getVoiceSupportedServer,
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const warnRef = useRef<number | null>(null);
  const hardStopRef = useRef<number | null>(null);
  const uploadingRef = useRef(false);
  const pressingRef = useRef(false);
  const startingRef = useRef(false);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    return () => {
      uploadControllerRef.current?.abort();
      clearTimers();
      stopTracks();
      mediaRecorderRef.current = null;
      pressingRef.current = false;
      startingRef.current = false;
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
    const controller = new AbortController();
    uploadControllerRef.current = controller;

    try {
      const formData = new FormData();
      formData.append('file', blob, 'recording.webm');
      const language = optionsRef.current.language;
      if (language) {
        formData.append('language', language);
      }

      const response = await fetch('/api/chat/transcribe', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Transcription failed');
      }
      const text = payload?.text?.trim() ?? '';
      if (!text) {
        throw new Error('Transcription returned no text');
      }
      if (!controller.signal.aborted) {
        optionsRef.current.onTranscript(text);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      optionsRef.current.onError(error instanceof Error ? error.message : 'Transcription failed');
    } finally {
      if (uploadControllerRef.current === controller) {
        uploadControllerRef.current = null;
      }
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
    if (
      optionsRef.current.disabled
      || !supported
      || startingRef.current
      || mediaRecorderRef.current
      || uploadingRef.current
    ) {
      return;
    }

    startingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // User may have released before permission resolved, or another start won.
      if (!pressingRef.current || mediaRecorderRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

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
        optionsRef.current.onError('Recording failed');
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
        pressingRef.current = false;
        finalizeRecorder();
      }, VOICE_CAPTURE_MAX_MS);
    } catch {
      stopTracks();
      setPhase('idle');
      optionsRef.current.onError('Microphone permission is required');
    } finally {
      startingRef.current = false;
    }
  }

  function pressStart(): void {
    if (optionsRef.current.disabled || !supported || uploadingRef.current || startingRef.current) {
      return;
    }
    pressingRef.current = true;
    void startRecording();
  }

  function pressEnd(): void {
    if (!pressingRef.current && phase !== 'recording' && phase !== 'warning') {
      return;
    }
    pressingRef.current = false;
    if (phase === 'recording' || phase === 'warning' || mediaRecorderRef.current) {
      finalizeRecorder();
    }
  }

  function stop(): void {
    pressingRef.current = false;
    uploadControllerRef.current?.abort();
    if (phase === 'recording' || phase === 'warning' || mediaRecorderRef.current) {
      finalizeRecorder();
    }
  }

  return { phase, elapsedMs, supported, pressStart, pressEnd, stop };
}
