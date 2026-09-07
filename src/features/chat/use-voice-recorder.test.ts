import { describe, expect, it } from 'vitest';
import { recordingFilenameForMime } from '@/features/chat/use-voice-recorder';

describe('recordingFilenameForMime', () => {
  it('uses webm for Chrome/Android opus recordings', () => {
    expect(recordingFilenameForMime('audio/webm;codecs=opus')).toBe('recording.webm');
    expect(recordingFilenameForMime('audio/webm')).toBe('recording.webm');
  });

  it('uses mp4/m4a for Safari/iOS MediaRecorder output', () => {
    expect(recordingFilenameForMime('audio/mp4')).toBe('recording.mp4');
    expect(recordingFilenameForMime('audio/mp4;codecs=mp4a.40.2')).toBe('recording.mp4');
    expect(recordingFilenameForMime('audio/aac')).toBe('recording.m4a');
    expect(recordingFilenameForMime('audio/x-m4a')).toBe('recording.m4a');
  });

  it('falls back to webm when mime is missing', () => {
    expect(recordingFilenameForMime('')).toBe('recording.webm');
    expect(recordingFilenameForMime(undefined)).toBe('recording.webm');
  });
});
