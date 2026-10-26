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

export const createEmptyMetrics = (app: AppId = 'all'): AppMetricsOverview => {
  const actionLabel =
    app === 'wedding'
      ? 'Calendar Event Saves'
      : app === 'portfolio'
      ? 'CV & Project Clicks'
      : app === 'demo'
      ? 'API Health Probes'
      : 'Calendar Saves & Interactions';

  const actionSub = '-';

  const engLabel =
    app === 'wedding'
      ? 'Invitation Conversion'
      : app === 'portfolio'
      ? 'Engagement Rate'
      : app === 'demo'
      ? 'API Availability'
      : 'Overall Conversion Rate';

  return {
    kpi: {
      visitors: '-',
      visitorsTrend: '-',
      pageviews: '-',
      pageviewsTrend: '-',
      actions: '-',
      actionLabel,
      actionSub,
      engRate: '-',
      engLabel,
      engSub: '-',
    },
    chart: [],
    funnel: [],
    languages: [],
    devices: [],
    locations: [],
    clickHeatmap: [],
  };
};

export const EMPTY_METRICS_DATA: Record<AppId, AppMetricsOverview> = {
  all: createEmptyMetrics('all'),
  wedding: createEmptyMetrics('wedding'),
  portfolio: createEmptyMetrics('portfolio'),
  demo: createEmptyMetrics('demo'),
};

// Aliased to empty metrics: no mocked data appears before live PostHog telemetry is received
export const METRICS_DATA: Record<AppId, AppMetricsOverview> = EMPTY_METRICS_DATA;

// Empty initial telemetry event stream before PostHog data arrives
export const INITIAL_EVENTS: TelemetryEventItem[] = [];
