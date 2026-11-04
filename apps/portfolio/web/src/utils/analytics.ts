/**
 * Self-contained analytics client for Portfolio Web.
 * Operates gracefully with zero external dependencies to support standalone
 * Cloudflare Pages, edge builds, and local development.
 */

export interface AnalyticsConfig {
  app: string;
  apiKey?: string;
  apiHost?: string;
  enabled?: boolean;
  debug?: boolean;
}

export const AnalyticsEvents = {
  PORTFOLIO_VIEWED: "portfolio_viewed",
  PORTFOLIO_PROJECT_CLICKED: "portfolio_project_clicked",
  PORTFOLIO_CONTACT_CLICKED: "portfolio_contact_clicked",
  PORTFOLIO_CV_DOWNLOADED: "portfolio_cv_downloaded",
} as const;

export type AnalyticsEventName =
  | (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents]
  | (string & {});

let initialized = false;
let activeConfig: AnalyticsConfig | null = null;

export function initAnalytics(config: AnalyticsConfig): void {
  if (initialized) return;
  activeConfig = config;
  initialized = true;

  if (config.debug) {
    console.info(`[Analytics] Initialized for '${config.app}'`);
  }
}

export function trackEvent(
  event: AnalyticsEventName,
  properties?: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;

  if (activeConfig?.debug || import.meta.env?.DEV) {
    console.debug(`[Analytics] Track: ${event}`, properties);
  }
}
