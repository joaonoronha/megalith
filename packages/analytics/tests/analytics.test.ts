import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initAnalytics,
  trackEvent,
  trackPageView,
  isAnalyticsActive,
  getPostHogClient,
  AnalyticsEvents,
} from '../src/index';

describe('@megalith/analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('safely no-ops in test environment without throwing', () => {
    const client = initAnalytics({
      app: 'wedding',
      apiKey: 'phc_test_key_123',
    });

    expect(client).toBeNull();
    expect(isAnalyticsActive()).toBe(false);
    expect(getPostHogClient()).toBeNull();

    // Calling tracking functions should never throw
    expect(() => {
      trackEvent(AnalyticsEvents.WEDDING_VIEWED, { test: true });
      trackPageView({ page: '/home' });
    }).not.toThrow();
  });

  it('safely handles missing or empty API keys', () => {
    const client = initAnalytics({
      app: 'portfolio',
      apiKey: '',
    });

    expect(client).toBeNull();
    expect(isAnalyticsActive()).toBe(false);
  });

  it('exposes standard event constants across monorepo products', () => {
    expect(AnalyticsEvents.WEDDING_CALENDAR_SAVED).toBe('wedding_calendar_saved');
    expect(AnalyticsEvents.WEDDING_VIDEO_STARTED).toBe('wedding_video_started');
    expect(AnalyticsEvents.WEDDING_VIDEO_COMPLETED).toBe('wedding_video_completed');
    expect(AnalyticsEvents.PORTFOLIO_PROJECT_CLICKED).toBe('portfolio_project_clicked');
    expect(AnalyticsEvents.PORTFOLIO_CV_DOWNLOADED).toBe('portfolio_cv_downloaded');
  });
});
