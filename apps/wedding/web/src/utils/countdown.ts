/**
 * Countdown calculation utility for Madalena & João's wedding.
 * Ensures timezone-safe UTC difference computation without local clock distortion.
 */

export interface CountdownResult {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
  readonly isPast: boolean;
  readonly totalSeconds: number;
}

/**
 * Calculates remaining days, hours, minutes, and seconds until target instant.
 *
 * @param targetUtc Target UTC instant as ISO string or Date instance (canonical: 2027-08-16T15:00:00Z)
 * @param now Current timestamp (defaults to system new Date())
 * @returns Breakdown of remaining units and isPast status
 */
export function calculateCountdown(
  targetUtc: string | Date,
  now: Date = new Date()
): CountdownResult {
  const targetMs = typeof targetUtc === 'string' ? new Date(targetUtc).getTime() : targetUtc.getTime();
  const nowMs = now.getTime();
  const diffMs = targetMs - nowMs;

  if (diffMs <= 0 || isNaN(diffMs)) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isPast: true,
      totalSeconds: 0,
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    isPast: false,
    totalSeconds,
  };
}
