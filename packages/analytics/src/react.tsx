import * as React from 'react';
import { trackEvent, trackPageView, isAnalyticsActive } from './client';
import type { AnalyticsEventName, EventProperties } from './types';

export interface UseAnalyticsResult {
  trackEvent: (eventName: AnalyticsEventName, properties?: EventProperties) => void;
  trackPageView: (properties?: EventProperties) => void;
  isActive: boolean;
}

/**
 * Convenient React hook to access event tracking and status.
 */
export function useAnalytics(): UseAnalyticsResult {
  const [isActive, setIsActive] = React.useState<boolean>(isAnalyticsActive);

  React.useEffect(() => {
    setIsActive(isAnalyticsActive());
  }, []);

  return {
    trackEvent,
    trackPageView,
    isActive,
  };
}
