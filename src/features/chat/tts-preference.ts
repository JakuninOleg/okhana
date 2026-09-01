import type { Locale } from '@/i18n/routing';

const TTS_PREF_PREFIX = 'okhana.ttsEnabled.v1.';
const CHANGE_EVENT = 'okhana-tts-pref';
/** Legacy unscoped key from the first TTS toggle — only applied to `en`. */
const LEGACY_TTS_PREF_KEY = 'okhana.ttsEnabled.v1';

/** Used when localStorage is unavailable (private mode / quota). */
let memoryFallback: boolean | null = null;

function prefKey(locale: Locale): string {
  return `${TTS_PREF_PREFIX}${locale}`;
}

function readRaw(locale: Locale): boolean {
  if (locale !== 'en') {
    return false;
  }

  try {
    const scoped = window.localStorage.getItem(prefKey('en'));
    if (scoped === 'true' || scoped === 'false') {
      memoryFallback = scoped === 'true';
      return scoped === 'true';
    }

    // One-time migrate the old global flag into the EN-scoped key.
    const legacy = window.localStorage.getItem(LEGACY_TTS_PREF_KEY);
    if (legacy === 'true' || legacy === 'false') {
      window.localStorage.setItem(prefKey('en'), legacy);
      window.localStorage.removeItem(LEGACY_TTS_PREF_KEY);
      memoryFallback = legacy === 'true';
      return legacy === 'true';
    }
  } catch {
    return memoryFallback ?? false;
  }

  return memoryFallback ?? false;
}

/** TTS preference is EN-only. RU always reads as off (no TTS UI / no auto-speak). */
export function getTtsEnabledSnapshot(locale: Locale): boolean {
  if (typeof window === 'undefined' || locale !== 'en') {
    return false;
  }
  return readRaw(locale);
}

export function getServerTtsEnabledSnapshot(): boolean {
  return false;
}

export function subscribeTtsEnabled(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const onStorage = (event: StorageEvent): void => {
    if (
      event.key == null
      || event.key.startsWith(TTS_PREF_PREFIX)
      || event.key === LEGACY_TTS_PREF_KEY
    ) {
      onStoreChange();
    }
  };
  const onLocal = (): void => onStoreChange();

  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, onLocal);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, onLocal);
  };
}

/** Persist only for EN. Calls for other locales are ignored. */
export function setTtsEnabled(enabled: boolean, locale: Locale = 'en'): void {
  if (typeof window === 'undefined' || locale !== 'en') {
    return;
  }
  memoryFallback = enabled;
  try {
    window.localStorage.setItem(prefKey('en'), enabled ? 'true' : 'false');
    window.localStorage.removeItem(LEGACY_TTS_PREF_KEY);
  } catch {
    // Private mode / quota — preference stays in-memory for this session only.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
