import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  getGatePreviewOverride,
  isInvitationGated,
  useInvitationGate,
} from '../src/utils/gate';

describe('gate utilities', () => {
  const targetUtc = '2027-02-16T00:00:00Z';

  describe('getGatePreviewOverride', () => {
    it('returns null when no search string or relevant param is provided', () => {
      expect(getGatePreviewOverride('')).toBeNull();
      expect(getGatePreviewOverride('?foo=bar')).toBeNull();
    });

    it('returns "gated" for preview=gated or preview=locked', () => {
      expect(getGatePreviewOverride('?preview=gated')).toBe('gated');
      expect(getGatePreviewOverride('?preview=locked')).toBe('gated');
      expect(getGatePreviewOverride('?foo=1&preview=GATED&bar=2')).toBe('gated');
    });

    it('returns "unlocked" for preview=unlocked, preview=open, or preview=all', () => {
      expect(getGatePreviewOverride('?preview=unlocked')).toBe('unlocked');
      expect(getGatePreviewOverride('?preview=open')).toBe('unlocked');
      expect(getGatePreviewOverride('?preview=all')).toBe('unlocked');
    });
  });

  describe('isInvitationGated', () => {
    it('returns true when current time is strictly before unlock timestamp', () => {
      const beforeDate = new Date('2027-02-15T23:59:59Z');
      expect(isInvitationGated(targetUtc, beforeDate)).toBe(true);
    });

    it('returns false when current time is at or after unlock timestamp', () => {
      const exactDate = new Date('2027-02-16T00:00:00Z');
      const afterDate = new Date('2027-02-16T00:00:01Z');
      expect(isInvitationGated(targetUtc, exactDate)).toBe(false);
      expect(isInvitationGated(targetUtc, afterDate)).toBe(false);
    });

    it('respects explicit preview overrides regardless of clock time', () => {
      const beforeDate = new Date('2026-01-01T00:00:00Z');
      const afterDate = new Date('2028-01-01T00:00:00Z');

      // Force unlock before time
      expect(isInvitationGated(targetUtc, beforeDate, 'unlocked')).toBe(false);

      // Force gate after time
      expect(isInvitationGated(targetUtc, afterDate, 'gated')).toBe(true);
    });

    it('returns false on invalid date to avoid permanent lockout', () => {
      expect(isInvitationGated('invalid-date', new Date())).toBe(false);
    });
  });

  describe('useInvitationGate hook', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('initializes with gated status when now < unlockUtc', () => {
      vi.setSystemTime(new Date('2027-02-15T23:59:50Z'));
      const { result } = renderHook(() =>
        useInvitationGate({ unlockUtc: targetUtc })
      );

      expect(result.current.isGated).toBe(true);
      expect(result.current.isPreview).toBe(false);
    });

    it('automatically transitions to unlocked when timer crosses targetUtc', () => {
      vi.setSystemTime(new Date('2027-02-15T23:59:58Z'));
      const { result } = renderHook(() =>
        useInvitationGate({ unlockUtc: targetUtc })
      );

      expect(result.current.isGated).toBe(true);

      // Advance by 3 seconds past midnight
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.isGated).toBe(false);
    });

    it('honors search preview override', () => {
      vi.setSystemTime(new Date('2027-02-15T00:00:00Z'));
      const { result } = renderHook(() =>
        useInvitationGate({
          unlockUtc: targetUtc,
          searchOverride: '?preview=unlocked',
        })
      );

      expect(result.current.isGated).toBe(false);
      expect(result.current.isPreview).toBe(true);
      expect(result.current.previewMode).toBe('unlocked');
    });
  });
});
