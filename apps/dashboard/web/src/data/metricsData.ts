export type AppId = 'all' | 'wedding' | 'portfolio' | 'demo';

export interface KpiMetrics {
  visitors: string;
  visitorsTrend: string;
  pageviews: string;
  pageviewsTrend: string;
  actions: string;
  actionLabel: string;
  actionSub: string;
  engRate: string;
  engLabel: string;
  engSub: string;
}

export interface ChartDay {
  day: string;
  visitors: number;
  events: number;
}

export interface FunnelStep {
  name: string;
  count: number;
  pct: number;
  color: string;
}

export interface LanguageSegment {
  code: string;
  name: string;
  pct: number;
  count: number;
  color: string;
}

export interface DeviceSegment {
  name: string;
  pct: number;
}

export interface GeoLocationSegment {
  country: string;
  countryCode: string;
  city: string;
  region?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  accuracyKm?: number;
  count: number;
  pct: number;
}

export interface ClickHeatMapItem {
  id: string;
  element: string;
  label: string;
  selector: string;
  clicks: number;
  pct: number;
  app: 'wedding' | 'portfolio' | 'demo';
  intensity: 'hot' | 'warm' | 'cool';
}

export interface TelemetryEventItem {
  id: string;
  name: string;
  app: 'wedding' | 'portfolio' | 'demo';
  meta: string;
  timestamp: string;
}

export interface AppMetricsOverview {
  kpi: KpiMetrics;
  chart: ChartDay[];
  funnel?: FunnelStep[];
  languages: LanguageSegment[];
  devices: DeviceSegment[];
  locations?: GeoLocationSegment[];
  clickHeatmap?: ClickHeatMapItem[];
}

export const METRICS_DATA: Record<AppId, AppMetricsOverview> = {
  all: {
    kpi: {
      visitors: '1,428',
      visitorsTrend: '+24.8%',
      pageviews: '3,892',
      pageviewsTrend: '+31.2%',
      actions: '512',
      actionLabel: 'Calendar Saves & Downloads',
      actionSub: '384 ICS saves · 128 CV taps',
      engRate: '78.4%',
      engLabel: 'Video Completion Rate',
      engSub: '720 completions / 918 starts',
    },
    chart: [
      { day: 'Oct 19', visitors: 95, events: 210 },
      { day: 'Oct 20', visitors: 110, events: 240 },
      { day: 'Oct 21', visitors: 140, events: 320 },
      { day: 'Oct 22', visitors: 175, events: 390 },
      { day: 'Oct 23', visitors: 220, events: 510 },
      { day: 'Oct 24', visitors: 340, events: 790 },
      { day: 'Today', visitors: 348, events: 820 },
    ],
    funnel: [
      { name: '1. Page Impression', count: 1024, pct: 100, color: 'bg-slate-500' },
      { name: '2. Dismiss Intro / Play Video', count: 918, pct: 89.6, color: 'bg-blue-500' },
      { name: '3. Video Completed', count: 720, pct: 70.3, color: 'bg-indigo-500' },
      { name: '4. Calendar Saved (.ics)', count: 384, pct: 37.5, color: 'bg-emerald-500' },
    ],
    languages: [
      { code: 'PT', name: 'Português', pct: 68.2, count: 698, color: 'bg-amber-400' },
      { code: 'EN', name: 'English', pct: 21.4, count: 219, color: 'bg-blue-400' },
      { code: 'FR', name: 'Français', pct: 10.4, count: 107, color: 'bg-indigo-400' },
    ],
    devices: [
      { name: 'Apple iPhone (iOS Safari)', pct: 62 },
      { name: 'Desktop (Chrome / Safari / Edge)', pct: 26 },
      { name: 'Android Mobile', pct: 12 },
    ],
    locations: [
      { country: 'Portugal', countryCode: 'PT', city: 'Lisbon', count: 980, pct: 68.6 },
      { country: 'United Kingdom', countryCode: 'GB', city: 'London', count: 215, pct: 15.1 },
      { country: 'France', countryCode: 'FR', city: 'Paris', count: 142, pct: 9.9 },
      { country: 'United States', countryCode: 'US', city: 'San Francisco', count: 91, pct: 6.4 },
    ],
    clickHeatmap: [
      { id: '1', element: 'Calendar Invitation (.ics)', label: 'Save Date to Calendar', selector: 'button#save-date-ics', clicks: 384, pct: 45, app: 'wedding', intensity: 'hot' },
      { id: '2', element: 'CV Download (PDF)', label: 'Curriculum Vitae Download', selector: 'a#download-cv', clicks: 128, pct: 24, app: 'portfolio', intensity: 'hot' },
      { id: '3', element: 'Project Cards', label: 'Technical Deep-Dives', selector: 'div.project-card', clicks: 114, pct: 18, app: 'portfolio', intensity: 'warm' },
      { id: '4', element: 'Video Player', label: 'Play / Fullscreen Intro', selector: 'video#wedding-video', clicks: 92, pct: 13, app: 'wedding', intensity: 'cool' },
    ],
  },
  wedding: {
    kpi: {
      visitors: '1,024',
      visitorsTrend: '+28.4%',
      pageviews: '2,840',
      pageviewsTrend: '+35.1%',
      actions: '384',
      actionLabel: 'Calendar Event Saves',
      actionSub: '384 downloaded .ics invitations',
      engRate: '78.4%',
      engLabel: 'Video Completion Rate',
      engSub: '720 completions / 918 starts',
    },
    chart: [
      { day: 'Oct 19', visitors: 65, events: 140 },
      { day: 'Oct 20', visitors: 80, events: 180 },
      { day: 'Oct 21', visitors: 105, events: 240 },
      { day: 'Oct 22', visitors: 130, events: 290 },
      { day: 'Oct 23', visitors: 165, events: 380 },
      { day: 'Oct 24', visitors: 245, events: 580 },
      { day: 'Today', visitors: 234, events: 560 },
    ],
    funnel: [
      { name: '1. Page Impression', count: 1024, pct: 100, color: 'bg-slate-500' },
      { name: '2. Dismiss Intro / Play Video', count: 918, pct: 89.6, color: 'bg-blue-500' },
      { name: '3. Video Completed', count: 720, pct: 70.3, color: 'bg-indigo-500' },
      { name: '4. Calendar Saved (.ics)', count: 384, pct: 37.5, color: 'bg-emerald-500' },
    ],
    languages: [
      { code: 'PT', name: 'Português', pct: 72.5, count: 742, color: 'bg-amber-400' },
      { code: 'EN', name: 'English', pct: 18.2, count: 186, color: 'bg-blue-400' },
      { code: 'FR', name: 'Français', pct: 9.3, count: 96, color: 'bg-indigo-400' },
    ],
    devices: [
      { name: 'Apple iPhone (iOS Safari)', pct: 74 },
      { name: 'Desktop Browsers', pct: 16 },
      { name: 'Android Mobile', pct: 10 },
    ],
    locations: [
      { country: 'Portugal', countryCode: 'PT', city: 'Lisbon', count: 742, pct: 72.5 },
      { country: 'United Kingdom', countryCode: 'GB', city: 'London', count: 186, pct: 18.2 },
      { country: 'France', countryCode: 'FR', city: 'Paris', count: 96, pct: 9.3 },
    ],
    clickHeatmap: [
      { id: 'w1', element: 'Save Calendar CTA', label: 'Download .ics Calendar File', selector: 'button#save-date-ics', clicks: 384, pct: 54, app: 'wedding', intensity: 'hot' },
      { id: 'w2', element: 'Video Player', label: 'Start / Replay Video', selector: 'video#intro-video', clicks: 198, pct: 28, app: 'wedding', intensity: 'warm' },
      { id: 'w3', element: 'Language Switcher', label: 'PT / EN / FR Toggle', selector: 'nav.lang-switcher', clicks: 82, pct: 12, app: 'wedding', intensity: 'cool' },
      { id: 'w4', element: 'Map / Venue Link', label: 'Open Google Maps Venue', selector: 'a#venue-map-link', clicks: 42, pct: 6, app: 'wedding', intensity: 'cool' },
    ],
  },
  portfolio: {
    kpi: {
      visitors: '342',
      visitorsTrend: '+18.1%',
      pageviews: '890',
      pageviewsTrend: '+22.4%',
      actions: '128',
      actionLabel: 'CV & Project Clicks',
      actionSub: '74 CV downloads · 54 project links',
      engRate: '4.2 min',
      engLabel: 'Avg Session Duration',
      engSub: 'High technical reader retention',
    },
    chart: [
      { day: 'Oct 19', visitors: 25, events: 60 },
      { day: 'Oct 20', visitors: 25, events: 50 },
      { day: 'Oct 21', visitors: 30, events: 70 },
      { day: 'Oct 22', visitors: 40, events: 90 },
      { day: 'Oct 23', visitors: 45, events: 110 },
      { day: 'Oct 24', visitors: 85, events: 190 },
      { day: 'Today', visitors: 92, events: 220 },
    ],
    funnel: [
      { name: '1. Landing Pageview', count: 342, pct: 100, color: 'bg-slate-500' },
      { name: '2. AI Workflow Deep-Dive', count: 218, pct: 63.7, color: 'bg-blue-500' },
      { name: '3. Technical Projects Inspected', count: 184, pct: 53.8, color: 'bg-indigo-500' },
      { name: '4. CV Downloaded / Contact Clicked', count: 128, pct: 37.4, color: 'bg-emerald-500' },
    ],
    languages: [
      { code: 'EN', name: 'English (Primary)', pct: 88.0, count: 301, color: 'bg-blue-400' },
      { code: 'PT', name: 'Português', pct: 12.0, count: 41, color: 'bg-amber-400' },
    ],
    devices: [
      { name: 'Desktop (macOS / Linux / Windows)', pct: 72 },
      { name: 'Mobile Safari / Chrome', pct: 28 },
    ],
    locations: [
      { country: 'United States', countryCode: 'US', city: 'San Francisco', count: 154, pct: 45.0 },
      { country: 'United Kingdom', countryCode: 'GB', city: 'London', count: 98, pct: 28.7 },
      { country: 'Portugal', countryCode: 'PT', city: 'Lisbon', count: 90, pct: 26.3 },
    ],
    clickHeatmap: [
      { id: 'p1', element: 'Download CV CTA', label: 'Curriculum Vitae (PDF)', selector: 'a#download-cv', clicks: 74, pct: 58, app: 'portfolio', intensity: 'hot' },
      { id: 'p2', element: 'Project Cards', label: 'Megalith Architecture Click', selector: 'div.project-megalith', clicks: 32, pct: 25, app: 'portfolio', intensity: 'warm' },
      { id: 'p3', element: 'Contact Links', label: 'Email / LinkedIn Outreach', selector: 'a.contact-social', clicks: 22, pct: 17, app: 'portfolio', intensity: 'cool' },
    ],
  },
  demo: {
    kpi: {
      visitors: '62',
      visitorsTrend: '+5.1%',
      pageviews: '162',
      pageviewsTrend: '+8.0%',
      actions: '18',
      actionLabel: 'API Health Probes',
      actionSub: '18 automated container probes',
      engRate: '100%',
      engLabel: 'API Availability',
      engSub: '200 OK responses across checks',
    },
    chart: [
      { day: 'Oct 19', visitors: 5, events: 10 },
      { day: 'Oct 20', visitors: 5, events: 10 },
      { day: 'Oct 21', visitors: 5, events: 10 },
      { day: 'Oct 22', visitors: 5, events: 10 },
      { day: 'Oct 23', visitors: 10, events: 20 },
      { day: 'Oct 24', visitors: 10, events: 20 },
      { day: 'Today', visitors: 22, events: 40 },
    ],
    languages: [
      { code: 'EN', name: 'English', pct: 100.0, count: 62, color: 'bg-blue-400' },
    ],
    devices: [
      { name: 'Automated CI / Curl Probes', pct: 65 },
      { name: 'Desktop Chrome', pct: 35 },
    ],
    locations: [
      { country: 'Portugal', countryCode: 'PT', city: 'Lisbon (Localhost)', count: 62, pct: 100.0 },
    ],
    clickHeatmap: [
      { id: 'd1', element: 'API Health Probe', label: 'GET /api/v1/health probe', selector: 'probe.health', clicks: 18, pct: 100, app: 'demo', intensity: 'hot' },
    ],
  },
};

export const INITIAL_EVENTS: TelemetryEventItem[] = [
  { id: '1', name: 'wedding_calendar_saved', app: 'wedding', meta: 'format: .ics · iOS Safari', timestamp: 'Just now' },
  { id: '2', name: 'wedding_video_completed', app: 'wedding', meta: 'duration: 48s · 100% watched', timestamp: '1m ago' },
  { id: '3', name: 'portfolio_project_clicked', app: 'portfolio', meta: 'project_id: megalith', timestamp: '3m ago' },
  { id: '4', name: 'wedding_video_started', app: 'wedding', meta: 'fullscreen: true', timestamp: '4m ago' },
  { id: '5', name: 'wedding_intro_dismissed', app: 'wedding', meta: 'suck_in_zoom: ok', timestamp: '4m ago' },
  { id: '6', name: 'wedding_language_changed', app: 'wedding', meta: 'pt-PT -> en', timestamp: '7m ago' },
  { id: '7', name: 'portfolio_cv_downloaded', app: 'portfolio', meta: 'format: pdf', timestamp: '12m ago' },
  { id: '8', name: 'wedding_viewed', app: 'wedding', meta: 'locale: pt-PT', timestamp: '14m ago' },
  { id: '9', name: 'demo_viewed', app: 'demo', meta: 'endpoint: /api/v1/health', timestamp: '22m ago' },
];
