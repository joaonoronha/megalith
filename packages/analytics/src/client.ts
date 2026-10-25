import posthog, { type PostHog } from 'posthog-js';
import type { AnalyticsConfig, EventProperties, AnalyticsEventName } from './types';

let initialized = false;
let currentConfig: AnalyticsConfig | null = null;

function isTestEnvironment(): boolean {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return true;
  }
  // Vite / vitest test runner mode
  try {
    const meta = import.meta as unknown as { env?: { MODE?: string } };
    if (meta?.env?.MODE === 'test') {
      return true;
    }
  } catch {
    // Ignore if import.meta is unavailable
  }
  return false;
}

function resolveApiKey(config: AnalyticsConfig): string | undefined {
  if (config.apiKey && config.apiKey.trim().length > 0) {
    return config.apiKey.trim();
  }
  // Attempt to read from Vite standard env
  try {
    const meta = import.meta as unknown as {
      env?: { VITE_POSTHOG_KEY?: string; NEXT_PUBLIC_POSTHOG_KEY?: string };
    };
    if (meta?.env?.VITE_POSTHOG_KEY) {
      return meta.env.VITE_POSTHOG_KEY.trim();
    }
    if (meta?.env?.NEXT_PUBLIC_POSTHOG_KEY) {
      return meta.env.NEXT_PUBLIC_POSTHOG_KEY.trim();
    }
  } catch {
    // Ignore
  }
  return undefined;
}

function resolveApiHost(config: AnalyticsConfig): string {
  if (config.apiHost && config.apiHost.trim().length > 0) {
    return config.apiHost.trim();
  }
  try {
    const meta = import.meta as unknown as {
      env?: { VITE_POSTHOG_HOST?: string };
    };
    if (meta?.env?.VITE_POSTHOG_HOST) {
      return meta.env.VITE_POSTHOG_HOST.trim();
    }
  } catch {
    // Ignore
  }
  return 'https://eu.i.posthog.com';
}

/**
 * Initializes PostHog analytics for a Megalith product.
 * Returns the PostHog instance if successfully activated, or null in no-op mode.
 */
export function initAnalytics(config: AnalyticsConfig): PostHog | null {
  currentConfig = { ...config };

  // Safety checks: SSR or test environment
  if (typeof window === 'undefined' || isTestEnvironment()) {
    initialized = false;
    return null;
  }

  // If explicitly disabled via config
  if (config.enabled === false) {
    initialized = false;
    return null;
  }

  const apiKey = resolveApiKey(config);
  if (!apiKey) {
    if (config.debug) {
      console.info(
        `[Analytics] No PostHog API key found for app '${config.app}'. Running in silent no-op mode.`
      );
    }
    initialized = false;
    return null;
  }

  const apiHost = resolveApiHost(config);

  try {
    posthog.init(apiKey, {
      api_host: apiHost,
      autocapture: true,
      capture_pageview: config.capturePageView ?? true,
      // PostHog best practice to save monthly event quota on anonymous visitors:
      person_profiles: 'identified_only',
      // Privacy-first session recording defaults
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: config.maskAllText !== false ? '*' : undefined,
      },
      loaded: (ph) => {
        // Register global monorepo super properties on every event
        ph.register({
          app: config.app,
          app_domain: typeof window !== 'undefined' ? window.location.hostname : '',
        });

        if (config.debug) {
          console.info(
            `[Analytics] Initialized PostHog for '${config.app}' pointing to ${apiHost}`
          );
        }
      },
    });

    initialized = true;
    return posthog;
  } catch (error) {
    if (config.debug) {
      console.warn(`[Analytics] Failed to initialize PostHog:`, error);
    }
    initialized = false;
    return null;
  }
}

/**
 * Tracks a custom event in PostHog.
 * Automatically enriches the event with the app ID and client metadata.
 * Safe to call at any time; cleanly no-ops if analytics is uninitialized.
 */
export function trackEvent(
  eventName: AnalyticsEventName,
  properties?: EventProperties
): void {
  if (!initialized || typeof window === 'undefined') {
    return;
  }

  try {
    posthog.capture(eventName, {
      app: currentConfig?.app,
      ...properties,
    });
  } catch {
    // Fail silently to avoid breaking caller app flows
  }
}

/**
 * Tracks a pageview event with optional custom properties.
 */
export function trackPageView(properties?: EventProperties): void {
  if (!initialized || typeof window === 'undefined') {
    return;
  }

  try {
    posthog.capture('$pageview', {
      app: currentConfig?.app,
      ...properties,
    });
  } catch {
    // Fail silently
  }
}

/**
 * Returns whether PostHog analytics is currently active and initialized.
 */
export function isAnalyticsActive(): boolean {
  return initialized;
}

/**
 * Direct access to the underlying PostHog client (if initialized).
 */
export function getPostHogClient(): PostHog | null {
  return initialized ? posthog : null;
}
