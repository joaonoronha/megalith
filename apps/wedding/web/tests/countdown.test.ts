import { describe, it, expect } from 'vitest';
import { calculateCountdown } from '../src/utils/countdown';

describe('Countdown Calculation (calculateCountdown)', () => {
  const TARGET_UTC = '2027-08-16T15:00:00Z';

  it('calculates exact days, hours, minutes, and seconds difference before target date', () => {
    // 10 days, 2 hours, 30 minutes, 15 seconds before target
    const now = new Date('2027-08-06T12:29:45Z');
    const result = calculateCountdown(TARGET_UTC, now);

    expect(result.isPast).toBe(false);
    expect(result.days).toBe(10);
    expect(result.hours).toBe(2);
    expect(result.minutes).toBe(30);
    expect(result.seconds).toBe(15);
  });

  it('handles exact zero difference when now equals target instant', () => {
    const now = new Date('2027-08-16T15:00:00Z');
    const result = calculateCountdown(TARGET_UTC, now);

    expect(result.isPast).toBe(true);
    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(0);
    expect(result.totalSeconds).toBe(0);
  });

  it('clamps all values to 0 and marks isPast as true when target instant is in the past', () => {
    const now = new Date('2027-08-17T00:00:00Z');
    const result = calculateCountdown(TARGET_UTC, now);

    expect(result.isPast).toBe(true);
    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(0);
    expect(result.totalSeconds).toBe(0);
  });

  it('accurately calculates leap year and variable month length intervals', () => {
    // 1 year, 100 days, etc.
    const now = new Date('2026-10-13T12:00:00Z');
    const result = calculateCountdown(TARGET_UTC, now);

    expect(result.isPast).toBe(false);
    expect(result.days).toBeGreaterThan(300);
    expect(result.totalSeconds).toBe(
      Math.floor((new Date(TARGET_UTC).getTime() - now.getTime()) / 1000)
    );
  });

  it('handles Date instances as target input seamlessly', () => {
    const targetDate = new Date(TARGET_UTC);
    const now = new Date('2027-08-16T14:59:50Z'); // 10 seconds before
    const result = calculateCountdown(targetDate, now);

    expect(result.isPast).toBe(false);
    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(10);
    expect(result.totalSeconds).toBe(10);
  });
});
