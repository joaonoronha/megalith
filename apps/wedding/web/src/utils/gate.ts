import React from 'react';

export type GatePreviewOverride = 'gated' | 'unlocked' | null;

/**
 * Parses URL search string to detect admin/preview overrides.
 *
 * Supported params:
 * - ?preview=gated -> forces gated state
 * - ?preview=unlocked (or ?preview=all) -> forces unlocked state
 */
export function getGatePreviewOverride(search?: string): GatePreviewOverride {
  if (typeof search === 'undefined') {
    if (typeof window === 'undefined' || !window.location) {
      return null;
    }
    search = window.location.search;
  }

  if (!search) return null;

  try {
    const params = new URLSearchParams(search);
    const preview = params.get('preview')?.toLowerCase().trim();

    if (preview === 'gated' || preview === 'locked') {
      return 'gated';
    }
    if (preview === 'unlocked' || preview === 'open' || preview === 'all') {
      return 'unlocked';
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Determines whether the wedding application is currently gated behind the Save the Date experience.
 *
 * @param unlockUtc ISO UTC timestamp for when the invitation unlocks (e.g. '2027-02-16T00:00:00Z')
 * @param now Current Date (defaults to system new Date())
 * @param override Explicit preview override ('gated', 'unlocked', or null)
 * @returns boolean true if gated, false if unlocked
 */
export function isInvitationGated(
  unlockUtc: string,
  now: Date = new Date(),
  override: GatePreviewOverride = null
): boolean {
  if (override === 'gated') return true;
  if (override === 'unlocked') return false;

  const targetMs = new Date(unlockUtc).getTime();
  const nowMs = now.getTime();

  if (isNaN(targetMs)) {
    // If invalid date string, default to unlocked to prevent permanently locking users out
    return false;
  }

  return targetMs > nowMs;
}

export interface UseInvitationGateOptions {
  readonly unlockUtc: string;
  readonly searchOverride?: string;
}

export interface UseInvitationGateResult {
  readonly isGated: boolean;
  readonly isPreview: boolean;
  readonly previewMode: GatePreviewOverride;
}

/**
 * React hook to manage live gate status. Automatically transitions when the countdown passes unlockUtc.
 */
export function useInvitationGate({
  unlockUtc,
  searchOverride,
}: UseInvitationGateOptions): UseInvitationGateResult {
  const previewMode = React.useMemo(() => {
    return getGatePreviewOverride(searchOverride);
  }, [searchOverride]);

  const [isGated, setIsGated] = React.useState<boolean>(() => {
    return isInvitationGated(unlockUtc, new Date(), previewMode);
  });

  React.useEffect(() => {
    // Check initial status
    const initialGated = isInvitationGated(unlockUtc, new Date(), previewMode);
    setIsGated(initialGated);

    if (previewMode !== null || !initialGated) {
      // If manually overridden or already unlocked in the past, no periodic timer is needed
      return;
    }

    const interval = window.setInterval(() => {
      const currentGated = isInvitationGated(unlockUtc, new Date(), previewMode);
      setIsGated(currentGated);
      if (!currentGated) {
        window.clearInterval(interval);
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [unlockUtc, previewMode]);

  return {
    isGated,
    isPreview: previewMode !== null,
    previewMode,
  };
}
