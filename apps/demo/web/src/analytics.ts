export interface AnalyticsConfig {
  app: string;
  apiKey?: string;
  apiHost?: string;
  debug?: boolean;
  capturePageView?: boolean;
  maskAllText?: boolean;
}

/**
 * Lightweight, self-contained analytics initializer for demo web client.
 * Operates in silent no-op mode in local tests or when VITE_POSTHOG_KEY is not set.
 */
export function initAnalytics(config: AnalyticsConfig): void {
  if (typeof window === 'undefined') return;

  const apiKey = config.apiKey || (import.meta as any).env?.VITE_POSTHOG_KEY;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    if (config.debug) {
      console.info(`[Analytics] No API key configured for '${config.app}'. Running in silent no-op mode.`);
    }
    return;
  }

  const apiHost = config.apiHost || (import.meta as any).env?.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';

  import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(apiKey.trim(), {
        api_host: apiHost,
        autocapture: true,
        capture_pageview: config.capturePageView ?? true,
        person_profiles: 'identified_only',
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: config.maskAllText !== false ? '*' : undefined,
        },
        loaded: (ph: any) => {
          ph.register({
            app: config.app,
            app_domain: window.location.hostname,
          });
        },
      });
    })
    .catch((err) => {
      if (config.debug) {
        console.warn('[Analytics] Failed to initialize PostHog:', err);
      }
    });
}
