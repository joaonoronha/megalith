import type {
  AppId,
  AppMetricsOverview,
  ChartDay,
  ClickHeatMapItem,
  GeoLocationSegment,
  TelemetryEventItem,
} from '../data/metricsData';

export interface PostHogQueryCredentials {
  host: string;
  projectId: string;
  personalApiKey: string;
}

export interface PostHogQueryResult {
  results: unknown[][];
  columns: string[];
}

export interface LiveTelemetryResult {
  events: TelemetryEventItem[];
  metrics?: Record<AppId, AppMetricsOverview>;
}

/**
 * Extracts PostHog credentials automatically from environment variables if present.
 */
export function getEnvironmentCredentials(): PostHogQueryCredentials | null {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
  const projectId = env.VITE_POSTHOG_PROJECT_ID || env.POSTHOG_PROJECT_ID;
  const personalApiKey =
    env.VITE_POSTHOG_PERSONAL_API_KEY ||
    env.POSTHOG_PERSONAL_API_KEY ||
    env.VITE_POSTHOG_KEY ||
    env.POSTHOG_KEY;
  const host =
    env.VITE_POSTHOG_HOST ||
    env.POSTHOG_HOST ||
    'https://eu.i.posthog.com';

  if (projectId && personalApiKey) {
    return {
      host: host.trim(),
      projectId: String(projectId).trim(),
      personalApiKey: String(personalApiKey).trim(),
    };
  }
  return null;
}

/**
 * Queries the PostHog HogQL API for live analytics data.
 */
export async function queryPostHogHogQL(
  creds: PostHogQueryCredentials,
  query: string
): Promise<PostHogQueryResult> {
  const host = creds.host.replace(/\/$/, '');
  const url = `${host}/api/projects/${creds.projectId}/query/`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${creds.personalApiKey}`,
    },
    body: JSON.stringify({
      query: {
        kind: 'HogQLQuery',
        query,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PostHog API request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    results: data.results || [],
    columns: data.columns || [],
  };
}

function formatInteractionElement(event: string, _app: 'wedding' | 'portfolio' | 'demo'): {
  element: string;
  label: string;
  selector: string;
  intensity: 'hot' | 'warm' | 'cool';
} {
  switch (event) {
    case 'wedding_calendar_saved':
      return {
        element: 'Salvar no Calendário (.ics)',
        label: 'Guardar a Data Calendar CTA',
        selector: 'button.screenshot-guardar-btn',
        intensity: 'hot',
      };
    case 'wedding_video_completed':
      return {
        element: 'Video Player',
        label: '100% Video Completed',
        selector: 'video.screenshot-video-element',
        intensity: 'warm',
      };
    case 'wedding_video_started':
    case 'wedding_intro_dismissed':
      return {
        element: 'SAVE THE DATE Button',
        label: 'Enter & Start Video (intro-pulse-btn)',
        selector: 'button.intro-pulse-btn',
        intensity: 'hot',
      };
    case 'wedding_language_changed':
      return {
        element: 'Language Switcher',
        label: 'Locale Switcher (PT/EN/FR)',
        selector: 'nav.lang-switch',
        intensity: 'cool',
      };
    case 'wedding_viewed':
      return {
        element: 'Main Invitation Card',
        label: 'Landing Page Impression',
        selector: 'main#invitation',
        intensity: 'warm',
      };
    case 'portfolio_project_clicked':
      return {
        element: 'Project Showcase Card',
        label: 'Technical Deep-Dive',
        selector: 'div.project-card',
        intensity: 'hot',
      };
    case 'portfolio_cv_downloaded':
      return {
        element: 'Download CV (PDF)',
        label: 'Curriculum Vitae Download',
        selector: 'a#download-cv',
        intensity: 'hot',
      };
    case 'portfolio_viewed':
      return {
        element: 'Hero Profile View',
        label: 'Landing CV Impression',
        selector: 'header#hero',
        intensity: 'warm',
      };
    case 'demo_viewed':
      return {
        element: 'API Health Probe',
        label: 'Container Availability Probe',
        selector: 'probe#health-endpoint',
        intensity: 'cool',
      };
    default:
      return {
        element: event.replace(/_/g, ' '),
        label: `${event} interaction`,
        selector: `element.${event}`,
        intensity: 'warm',
      };
  }
}

/**
 * Builds dynamic AppMetricsOverview datasets from real PostHog query results.
 */
export function buildLiveMetrics(
  aggRows: unknown[][],
  dailyRows: unknown[][],
  eventRows: unknown[][] = []
): Record<AppId, AppMetricsOverview> {
  const statsByApp: Record<'wedding' | 'portfolio' | 'demo', {
    totalEvents: number;
    visitors: number;
    events: Record<string, number>;
  }> = {
    wedding: { totalEvents: 0, visitors: 0, events: {} },
    portfolio: { totalEvents: 0, visitors: 0, events: {} },
    demo: { totalEvents: 0, visitors: 0, events: {} },
  };

  let allEvents = 0;
  let allVisitors = 0;

  for (const row of aggRows) {
    const event = String(row[0] || '');
    const rawApp = String(row[1] || 'wedding');
    const count = Number(row[2]) || 0;
    const visitors = Number(row[3]) || 0;

    const targetApp: 'wedding' | 'portfolio' | 'demo' =
      rawApp === 'portfolio' || rawApp === 'demo' ? rawApp : 'wedding';

    statsByApp[targetApp].totalEvents += count;
    // Count visitors on pageview / primary impression events
    if (event === 'wedding_viewed' || event === '$pageview' || event === 'portfolio_viewed' || event === 'demo_viewed') {
      statsByApp[targetApp].visitors = Math.max(statsByApp[targetApp].visitors, visitors);
    }
    statsByApp[targetApp].events[event] = (statsByApp[targetApp].events[event] || 0) + count;

    if (event === 'wedding_viewed' || event === '$pageview' || event === 'portfolio_viewed' || event === 'demo_viewed') {
      allVisitors = Math.max(allVisitors, visitors);
    }
    allEvents += count;
  }

  // Fallback if visitors wasn't set by an impression event
  for (const app of ['wedding', 'portfolio', 'demo'] as const) {
    if (statsByApp[app].visitors === 0) {
      statsByApp[app].visitors = Math.max(0, ...Object.values(statsByApp[app].events));
    }
  }

  // Parse geo locations from raw event properties
  const geoByApp: Record<'wedding' | 'portfolio' | 'demo', Record<string, GeoLocationSegment>> = {
    wedding: {},
    portfolio: {},
    demo: {},
  };
  const allGeoMap: Record<string, GeoLocationSegment> = {};

  for (const row of eventRows) {
    const rawApp = String(row[3] || 'wedding');
    const targetApp: 'wedding' | 'portfolio' | 'demo' =
      rawApp === 'portfolio' || rawApp === 'demo' ? rawApp : 'wedding';
    const propsStr = row[2];

    if (typeof propsStr === 'string' && propsStr.startsWith('{')) {
      try {
        const p = JSON.parse(propsStr);
        const country = p['$geoip_country_name'] || 'Portugal';
        const countryCode = p['$geoip_country_code'] || 'PT';
        const city = p['$geoip_city_name'] || 'Lisbon';
        const region = p['$geoip_subdivision_1_name'] || undefined;
        const postalCode = p['$geoip_postal_code'] || undefined;
        const latitude = typeof p['$geoip_latitude'] === 'number' ? p['$geoip_latitude'] : undefined;
        const longitude = typeof p['$geoip_longitude'] === 'number' ? p['$geoip_longitude'] : undefined;
        const accuracyKm = typeof p['$geoip_accuracy_radius'] === 'number' ? p['$geoip_accuracy_radius'] : undefined;
        const key = `${country}-${city}`;

        if (!allGeoMap[key]) {
          allGeoMap[key] = { country, countryCode, city, region, postalCode, latitude, longitude, accuracyKm, count: 0, pct: 0 };
        }
        allGeoMap[key].count += 1;

        if (!geoByApp[targetApp][key]) {
          geoByApp[targetApp][key] = { country, countryCode, city, region, postalCode, latitude, longitude, accuracyKm, count: 0, pct: 0 };
        }
        geoByApp[targetApp][key].count += 1;
      } catch {
        // ignore JSON parse error
      }
    }
  }

  const formatLocations = (map: Record<string, GeoLocationSegment>, total: number): GeoLocationSegment[] => {
    const list = Object.values(map);
    if (list.length === 0) {
      return [{ country: 'Portugal', countryCode: 'PT', city: 'Lisbon', count: total || 1, pct: 100 }];
    }
    const sum = list.reduce((acc, curr) => acc + curr.count, 0) || 1;
    return list
      .map((item) => ({ ...item, pct: Math.round((item.count / sum) * 100) }))
      .sort((a, b) => b.count - a.count);
  };

  const buildAppHeatmap = (appKey: 'wedding' | 'portfolio' | 'demo'): ClickHeatMapItem[] => {
    const evMap = statsByApp[appKey].events;
    const ignoredEvents = new Set([
      '$web_vitals',
      '$pageleave',
      '$pageview',
      'wedding_viewed',
      'portfolio_viewed',
      'demo_viewed',
    ]);
    const clickEntries = Object.entries(evMap).filter(([evName]) => !ignoredEvents.has(evName));
    const total = clickEntries.reduce((sum, [, count]) => sum + count, 0) || 1;
    return clickEntries
      .map(([evName, count], idx) => {
        const formatted = formatInteractionElement(evName, appKey);
        return {
          id: `${appKey}-${idx}`,
          ...formatted,
          clicks: count,
          pct: Math.round((count / total) * 100),
          app: appKey,
        };
      })
      .sort((a, b) => b.clicks - a.clicks);
  };

  const weddingHeatmap = buildAppHeatmap('wedding');
  const portfolioHeatmap = buildAppHeatmap('portfolio');
  const demoHeatmap = buildAppHeatmap('demo');
  const allHeatmap = [...weddingHeatmap, ...portfolioHeatmap, ...demoHeatmap].sort(
    (a, b) => b.clicks - a.clicks
  );

  const days: string[] = ['Oct 19', 'Oct 20', 'Oct 21', 'Oct 22', 'Oct 23', 'Oct 24', 'Today'];
  const todayEvents = dailyRows.length > 0 ? Number(dailyRows[dailyRows.length - 1][1]) || allEvents : allEvents;
  const todayVisitors = dailyRows.length > 0 ? Number(dailyRows[dailyRows.length - 1][2]) || allVisitors : allVisitors;

  const buildChart = (eventsCount: number, visitorsCount: number): ChartDay[] => {
    return days.map((day, idx) => {
      if (idx === days.length - 1) {
        return { day, visitors: visitorsCount, events: eventsCount };
      }
      return { day, visitors: 0, events: 0 };
    });
  };

  const weddingSaves = statsByApp.wedding.events['wedding_calendar_saved'] || 0;
  const weddingViews = statsByApp.wedding.events['wedding_viewed'] || statsByApp.wedding.events['$pageview'] || statsByApp.wedding.visitors || 0;
  const weddingVideoStarted = statsByApp.wedding.events['wedding_video_started'] || 0;
  const weddingVideoDone = statsByApp.wedding.events['wedding_video_completed'] || 0;

  const portfolioClicks = statsByApp.portfolio.events['portfolio_project_clicked'] || 0;
  const portfolioViews = statsByApp.portfolio.events['portfolio_viewed'] || statsByApp.portfolio.events['$pageview'] || statsByApp.portfolio.visitors || 0;
  const portfolioCv = statsByApp.portfolio.events['portfolio_cv_downloaded'] || 0;

  const demoViews = statsByApp.demo.events['demo_viewed'] || statsByApp.demo.events['$pageview'] || statsByApp.demo.visitors || 0;

  const totalPageviews = weddingViews + portfolioViews + demoViews;
  const totalVisitors = Math.max(statsByApp.wedding.visitors, statsByApp.portfolio.visitors, statsByApp.demo.visitors);

  return {
    all: {
      kpi: {
        visitors: String(totalVisitors || allVisitors),
        visitorsTrend: 'Live',
        pageviews: String(totalPageviews),
        pageviewsTrend: 'Live',
        actions: String(weddingSaves + portfolioCv + portfolioClicks),
        actionLabel: 'Calendar Saves & Interactions',
        actionSub: `${weddingSaves} ICS saves · ${portfolioCv + portfolioClicks} portfolio clicks`,
        engRate: totalPageviews > 0 ? `${Math.round(((weddingSaves + portfolioCv + portfolioClicks) / totalPageviews) * 100)}%` : '0%',
        engLabel: 'Overall Conversion Rate',
        engSub: 'Actions per page impression',
      },
      chart: buildChart(todayEvents, todayVisitors),
      funnel: [
        { name: '1. Page Impressions', count: weddingViews + portfolioViews, pct: 100, color: 'bg-slate-500' },
        { name: '2. Engagement / Play', count: weddingVideoStarted || weddingViews, pct: (weddingViews + portfolioViews) > 0 ? 100 : 0, color: 'bg-blue-500' },
        { name: '3. Video Completed', count: weddingVideoDone, pct: weddingViews > 0 ? Math.round((weddingVideoDone / weddingViews) * 100) : 0, color: 'bg-indigo-500' },
        { name: '4. Calendar / Action Saved', count: weddingSaves, pct: weddingViews > 0 ? Math.round((weddingSaves / weddingViews) * 100) : 0, color: 'bg-emerald-500' },
      ],
      languages: [
        { code: 'PT', name: 'Português', pct: 100, count: allVisitors, color: 'bg-amber-400' },
      ],
      devices: [
        { name: 'Mobile (iOS Safari)', pct: 100 },
      ],
      locations: formatLocations(allGeoMap, allVisitors),
      clickHeatmap: allHeatmap,
    },
    wedding: {
      kpi: {
        visitors: String(statsByApp.wedding.visitors),
        visitorsTrend: 'Live',
        pageviews: String(weddingViews),
        pageviewsTrend: 'Live',
        actions: String(weddingSaves),
        actionLabel: 'Calendar Event Saves',
        actionSub: `${weddingSaves} downloaded .ics invitations`,
        engRate: weddingViews > 0 ? `${Math.round((weddingSaves / weddingViews) * 100)}%` : '0%',
        engLabel: 'Invitation Conversion',
        engSub: `${weddingSaves} saves / ${weddingViews} views`,
      },
      chart: buildChart(weddingViews, statsByApp.wedding.visitors),
      funnel: [
        { name: '1. Page Impression', count: weddingViews, pct: 100, color: 'bg-slate-500' },
        { name: '2. Video Started / Watched', count: weddingVideoStarted, pct: weddingViews > 0 ? Math.round((weddingVideoStarted / weddingViews) * 100) : 0, color: 'bg-blue-500' },
        { name: '3. Video Completed', count: weddingVideoDone, pct: weddingViews > 0 ? Math.round((weddingVideoDone / weddingViews) * 100) : 0, color: 'bg-indigo-500' },
        { name: '4. Calendar Saved (.ics)', count: weddingSaves, pct: weddingViews > 0 ? Math.round((weddingSaves / weddingViews) * 100) : 0, color: 'bg-emerald-500' },
      ],
      languages: [
        { code: 'PT', name: 'Português', pct: 100, count: statsByApp.wedding.visitors, color: 'bg-amber-400' },
      ],
      devices: [
        { name: 'Mobile Safari', pct: 100 },
      ],
      locations: formatLocations(geoByApp.wedding, statsByApp.wedding.visitors),
      clickHeatmap: weddingHeatmap,
    },
    portfolio: {
      kpi: {
        visitors: String(statsByApp.portfolio.visitors),
        visitorsTrend: 'Live',
        pageviews: String(statsByApp.portfolio.totalEvents),
        pageviewsTrend: 'Live',
        actions: String(portfolioCv + portfolioClicks),
        actionLabel: 'CV & Project Clicks',
        actionSub: `${portfolioCv} CV downloads · ${portfolioClicks} project links`,
        engRate: portfolioViews > 0 ? `${Math.round(((portfolioCv + portfolioClicks) / portfolioViews) * 100)}%` : '0%',
        engLabel: 'Engagement Rate',
        engSub: 'Interactions per visitor',
      },
      chart: buildChart(statsByApp.portfolio.totalEvents, statsByApp.portfolio.visitors),
      funnel: [
        { name: '1. Landing Pageview', count: portfolioViews, pct: 100, color: 'bg-slate-500' },
        { name: '2. Project Inspected', count: portfolioClicks, pct: portfolioViews > 0 ? Math.round((portfolioClicks / portfolioViews) * 100) : 0, color: 'bg-indigo-500' },
        { name: '3. CV Downloaded', count: portfolioCv, pct: portfolioViews > 0 ? Math.round((portfolioCv / portfolioViews) * 100) : 0, color: 'bg-emerald-500' },
      ],
      languages: [
        { code: 'EN', name: 'English', pct: 100, count: statsByApp.portfolio.visitors, color: 'bg-blue-400' },
      ],
      devices: [
        { name: 'Desktop / Mobile', pct: 100 },
      ],
      locations: formatLocations(geoByApp.portfolio, statsByApp.portfolio.visitors),
      clickHeatmap: portfolioHeatmap,
    },
    demo: {
      kpi: {
        visitors: String(statsByApp.demo.visitors),
        visitorsTrend: 'Live',
        pageviews: String(statsByApp.demo.totalEvents),
        pageviewsTrend: 'Live',
        actions: '0',
        actionLabel: 'API Health Probes',
        actionSub: '0 container checks recorded',
        engRate: '0%',
        engLabel: 'API Availability',
        engSub: 'No live traffic recorded',
      },
      chart: buildChart(0, 0),
      languages: [{ code: 'EN', name: 'English', pct: 100, count: 0, color: 'bg-blue-400' }],
      devices: [{ name: 'None recorded', pct: 0 }],
      locations: formatLocations(geoByApp.demo, statsByApp.demo.visitors),
      clickHeatmap: demoHeatmap,
    },
  };
}

/**
 * Fetches recent live telemetry events and metrics using PostHog HogQL API.
 */
export async function fetchLiveTelemetry(
  creds: PostHogQueryCredentials
): Promise<LiveTelemetryResult> {
  const filter =
    "WHERE distinct_id NOT LIKE 'test-%' AND distinct_id != 'install_verification_agent'";
  const eventsQuery =
    `SELECT uuid, event, properties, properties.app, timestamp FROM events ${filter} ORDER BY timestamp DESC LIMIT 50`;
  const aggQuery =
    `SELECT event, properties.app, count(), count(DISTINCT distinct_id) FROM events ${filter} GROUP BY event, properties.app`;
  const dailyQuery =
    `SELECT toDate(timestamp) as dt, count(), count(DISTINCT distinct_id) FROM events ${filter} AND timestamp >= now() - INTERVAL 7 DAY GROUP BY dt ORDER BY dt ASC`;

  const [eventsRes, aggRes, dailyRes] = await Promise.all([
    queryPostHogHogQL(creds, eventsQuery),
    queryPostHogHogQL(creds, aggQuery).catch(() => ({ results: [], columns: [] })),
    queryPostHogHogQL(creds, dailyQuery).catch(() => ({ results: [], columns: [] })),
  ]);

  const events: TelemetryEventItem[] = (eventsRes.results || []).map((row, idx) => {
    const id = String(row[0] || idx);
    const name = String(row[1] || 'event');
    const rawApp = String(row[3] || 'wedding');
    const app: 'wedding' | 'portfolio' | 'demo' =
      rawApp === 'portfolio' || rawApp === 'demo' ? rawApp : 'wedding';
    const rawTs = row[4];
    const timestamp = rawTs
      ? new Date(String(rawTs)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    return { id, name, app, meta: `app: ${app} · live telemetry`, timestamp };
  });

  const metrics =
    aggRes.results && aggRes.results.length > 0
      ? buildLiveMetrics(aggRes.results, dailyRes.results || [], eventsRes.results || [])
      : undefined;

  return { events, metrics };
}

