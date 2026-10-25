/**
 * Configuration options for @megalith/analytics
 */
export interface AnalyticsConfig {
  /**
   * Monorepo application identifier (e.g. 'wedding', 'portfolio', 'demo').
   * Automatically stamped into all events, pageviews, and session replays.
   */
  app: string;

  /**
   * PostHog Project API Key (e.g., 'phc_...').
   * If omitted, falls back to VITE_POSTHOG_KEY or NEXT_PUBLIC_POSTHOG_KEY.
   * If empty or undefined, analytics safely operates in silent no-op mode.
   */
  apiKey?: string;

  /**
   * PostHog Ingestion Host.
   * Defaults to EU Cloud ('https://eu.i.posthog.com') for European data privacy.
   */
  apiHost?: string;

  /**
   * Explicitly enable or disable tracking.
   * Defaults to true in production if an apiKey is provided; false in tests.
   */
  enabled?: boolean;

  /**
   * Enable debug console logging. Defaults to false.
   */
  debug?: boolean;

  /**
   * Automatically capture $pageview events on route/load. Defaults to true.
   */
  capturePageView?: boolean;

  /**
   * Whether session recording masks all textual elements on the page for GDPR compliance.
   * Defaults to true.
   */
  maskAllText?: boolean;
}

/**
 * Arbitrary properties sent with custom events.
 */
export type EventProperties = Record<string, unknown>;

/**
 * Canonical event names across Megalith products.
 */
export const AnalyticsEvents = {
  // Wedding app events
  WEDDING_VIEWED: 'wedding_viewed',
  WEDDING_INTRO_DISMISSED: 'wedding_intro_dismissed',
  WEDDING_VIDEO_STARTED: 'wedding_video_started',
  WEDDING_VIDEO_COMPLETED: 'wedding_video_completed',
  WEDDING_CALENDAR_SAVED: 'wedding_calendar_saved',
  WEDDING_LANGUAGE_CHANGED: 'wedding_language_changed',

  // Portfolio app events
  PORTFOLIO_VIEWED: 'portfolio_viewed',
  PORTFOLIO_PROJECT_CLICKED: 'portfolio_project_clicked',
  PORTFOLIO_CONTACT_CLICKED: 'portfolio_contact_clicked',
  PORTFOLIO_CV_DOWNLOADED: 'portfolio_cv_downloaded',

  // Demo app events
  DEMO_VIEWED: 'demo_viewed',
} as const;

export type AnalyticsEventName =
  | (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents]
  | (string & {});
