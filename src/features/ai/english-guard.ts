/**
 * App-owned English language guard for TTS.
 * UI locale is not enough — the model may reply in Russian in an English UI.
 * Returns false for non-English or indeterminate text (do not call TTS).
 */
export function isConfidentlyEnglish(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 12) {
    return false;
  }

  const letters = trimmed.match(/\p{L}/gu) ?? [];
  if (letters.length < 8) {
    return false;
  }

  const latinCount = (trimmed.match(/[A-Za-z]/g) ?? []).length;
  const cyrillicCount = (trimmed.match(/[\u0400-\u04FF]/g) ?? []).length;

  if (cyrillicCount > 0) {
    return false;
  }

  return latinCount / letters.length >= 0.9;
}

/** Orpheus TTS accepts a short input; truncate at a word boundary when possible. */
export function truncateForTts(text: string, maxChars = 200): string {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxChars) {
    return normalized;
  }

  const slice = normalized.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace >= Math.floor(maxChars * 0.6)) {
    return slice.slice(0, lastSpace).trimEnd();
  }
  return slice.trimEnd();
}
