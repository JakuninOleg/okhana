import { DEFAULT_NUDGE_OFFSET_MINUTES } from '@/features/notifications/advance-nudge-plan';

/** Overnight quiet window in Europe/Moscow (inclusive start, exclusive end across midnight). */
export const QUIET_HOURS_START = 22;
export const QUIET_HOURS_END = 8;

/**
 * True when `now` falls in 22:00–08:00 in the given UTC offset (default Moscow +180).
 */
export function isInQuietHours(
  now: Date = new Date(),
  offsetMinutes: number = DEFAULT_NUDGE_OFFSET_MINUTES,
): boolean {
  const shifted = new Date(now.getTime() + offsetMinutes * 60_000);
  const hour = shifted.getUTCHours();
  return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END;
}

export function localHourInOffset(
  now: Date,
  offsetMinutes: number = DEFAULT_NUDGE_OFFSET_MINUTES,
): number {
  return new Date(now.getTime() + offsetMinutes * 60_000).getUTCHours();
}
