import posthog from "posthog-js";

export interface AnalyticsConfig {
  app: string;
  apiKey?: string;
  apiHost?: string;
  enabled?: boolean;
  debug?: boolean;
  capturePageView?: boolean;
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

function isTestMode(): boolean {
  try {
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
      return true;
    }
    const meta = import.meta as unknown as { env?: { MODE?: string } };
    if (meta?.env?.MODE === "test") {
      return true;
    }
  } catch {
    // Ignore
  }
  return false;
}

export function initAnalytics(config: AnalyticsConfig): void {
  if (initialized) return;
  activeConfig = config;
  initialized = true;

  if (isTestMode()) {
    return;
  }

  const key = config.apiKey?.trim();
  const host = config.apiHost?.trim() || "https://eu.i.posthog.com";

  if (!key) {
    if (config.debug) {
      console.info("[Analytics] No PostHog API key found; running in silent mode.");
    }
    return;
  }

  if (typeof window !== "undefined") {
    posthog.init(key, {
      api_host: host,
      capture_pageview: config.capturePageView !== false,
      capture_pageleave: true,
      person_profiles: "identified_only",
      autocapture: true,
      loaded: (ph) => {
        ph.register({
          app: config.app,
          app_domain: window.location.hostname,
        });
        if (config.debug) {
          console.info(`[Analytics] Initialized PostHog for '${config.app}'`);
        }
      },
    });
  }
}

export function trackEvent(
  event: AnalyticsEventName,
  properties?: Record<string, unknown>
): void {
  if (typeof window === "undefined" || isTestMode()) return;

  if (activeConfig?.apiKey) {
    posthog.capture(event, properties);
  }

  if (activeConfig?.debug || import.meta.env?.DEV) {
    console.debug(`[Analytics] Track: ${event}`, properties);
  }
}
