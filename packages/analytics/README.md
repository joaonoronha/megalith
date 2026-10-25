# @megalith/analytics

Centralized, privacy-first PostHog analytics package for the Megalith monorepo.

Designed to power both individual product tracking and unified cross-product analytics dashboards.

---

## Features

- **Monorepo Stamped**: Automatically stamps the parent application ID (`app: 'wedding'`, `app: 'portfolio'`, `app: 'demo'`) and domain into all events, pageviews, and session replays.
- **Privacy-First EU Cloud**: Defaults to EU cloud ingestion (`https://eu.i.posthog.com`) for strict GDPR compliance.
- **Quota Optimized**: Uses `person_profiles: 'identified_only'` so anonymous web traffic does not consume your monthly identified user limit.
- **Session Replay Masking**: Text and input masking enabled by default.
- **Silent Fallback**: Completely safe in tests, SSR, and local development—silently no-ops without errors or network traffic when `VITE_POSTHOG_KEY` is not configured.

---

## Quick Start

### 1. Configuration (`.env`)

Add your PostHog Project API key to your app's `.env.local` or `.env`:

```ini
VITE_POSTHOG_KEY=phc_your_posthog_project_api_key_here
VITE_POSTHOG_HOST=https://eu.i.posthog.com
```

### 2. Initialization in `main.tsx`

```tsx
import { initAnalytics } from '@megalith/analytics';

initAnalytics({
  app: 'wedding', // or 'portfolio', 'demo'
});
```

### 3. Tracking Custom Events

```tsx
import { trackEvent, AnalyticsEvents } from '@megalith/analytics';

trackEvent(AnalyticsEvents.WEDDING_CALENDAR_SAVED, {
  method: 'ics_download',
});
```

---

## Centralized Dashboard Querying (HogQL)

Because all events are stamped with `app`, you can query metrics across all your apps from a single PostHog project using HogQL SQL:

```sql
SELECT
  properties.app AS application,
  count() AS total_events,
  count(DISTINCT distinct_id) AS unique_visitors
FROM events
WHERE timestamp >= now() - INTERVAL 30 DAY
GROUP BY application
ORDER BY total_events DESC
```
