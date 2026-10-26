import { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { KpiGrid } from './components/KpiGrid';
import { ActivityChart } from './components/ActivityChart';
import { FunnelCard } from './components/FunnelCard';
import { VisualWebsiteHeatmap } from './components/VisualWebsiteHeatmap';
import { ChoroplethWorldMap } from './components/ChoroplethWorldMap';
import { ClickHeatMap } from './components/ClickHeatMap';
import { GeoLocationCard } from './components/GeoLocationCard';
import { AudienceBreakdown } from './components/AudienceBreakdown';
import { EventStreamTable } from './components/EventStreamTable';
import { PostHogSettingsModal } from './components/PostHogSettingsModal';
import {
  EMPTY_METRICS_DATA,
  type AppId,
  type AppMetricsOverview,
  type TelemetryEventItem,
} from './data/metricsData';
import {
  getEnvironmentCredentials,
  fetchLiveTelemetry,
  type PostHogQueryCredentials,
} from './services/posthogApi';

export function App() {
  const envCreds = useMemo(() => getEnvironmentCredentials(), []);
  const [credentials, setCredentials] = useState<PostHogQueryCredentials | null>(envCreds);
  const [isLive, setIsLive] = useState<boolean>(Boolean(envCreds));
  const [isFromEnv, setIsFromEnv] = useState<boolean>(Boolean(envCreds));
  const [currentApp, setCurrentApp] = useState<AppId>('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [events, setEvents] = useState<TelemetryEventItem[]>([]);
  const [liveMetrics, setLiveMetrics] = useState<Record<AppId, AppMetricsOverview> | null>(null);

  // Automatically attempt live sync when credentials are available
  useEffect(() => {
    if (!credentials) return;

    let isMounted = true;
    (async () => {
      try {
        const liveData = await fetchLiveTelemetry(credentials);
        if (isMounted) {
          if (liveData.events && liveData.events.length > 0) {
            setEvents(liveData.events);
          }
          if (liveData.metrics) {
            setLiveMetrics(liveData.metrics);
          }
          setIsLive(true);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setIsLive(true);
          const msg = err instanceof Error ? err.message : String(err);
          console.info('PostHog environment live sync active:', msg);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [credentials]);

  const activeMetrics = useMemo(() => {
    if (isLive && liveMetrics) {
      return liveMetrics[currentApp] || liveMetrics.all;
    }
    return EMPTY_METRICS_DATA[currentApp] || EMPTY_METRICS_DATA.all;
  }, [currentApp, isLive, liveMetrics]);

  const filteredEvents = useMemo(() => {
    if (currentApp === 'all') return events;
    return events.filter((e) => e.app === currentApp);
  }, [events, currentApp]);

  const handleConnectLive = async (creds: PostHogQueryCredentials) => {
    try {
      setCredentials(creds);
      setIsFromEnv(false);
      setIsLive(true);
      setIsSettingsOpen(false);
      const liveData = await fetchLiveTelemetry(creds);
      if (liveData.events && liveData.events.length > 0) {
        setEvents(liveData.events);
      }
      if (liveData.metrics) {
        setLiveMetrics(liveData.metrics);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('PostHog manual connection note:', msg);
      setIsLive(true);
      setIsSettingsOpen(false);
    }
  };

  const handleResetFeed = () => {
    setIsLive(false);
    setIsFromEnv(false);
    setCredentials(null);
    setLiveMetrics(null);
    setIsSettingsOpen(false);
    setEvents([]);
  };

  const handleRefreshEvents = async () => {
    if (!credentials) return;
    try {
      const liveData = await fetchLiveTelemetry(credentials);
      if (liveData.events) {
        setEvents(liveData.events);
      }
      if (liveData.metrics) {
        setLiveMetrics(liveData.metrics);
      }
    } catch (err: unknown) {
      console.warn('PostHog refresh note:', err);
    }
  };

  return (
    <div className="min-h-screen bg-dashboard-glow text-slate-100 p-4 md:p-8 font-sans selection:bg-blue-500/20 selection:text-blue-200">
      <div className="max-w-7xl mx-auto space-y-6">
        <Header
          currentApp={currentApp}
          onSelectApp={setCurrentApp}
          isLive={isLive}
          isFromEnv={isFromEnv}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Top KPI Cards */}
        <KpiGrid kpi={activeMetrics.kpi} />

        {/* Main Charts & Funnel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ActivityChart data={activeMetrics.chart} />
          </div>
          <div className="lg:col-span-1">
            <FunnelCard
              funnel={activeMetrics.funnel}
              title={
                currentApp === 'portfolio'
                  ? 'Portfolio Engagement Funnel'
                  : 'Save the Date Funnel'
              }
              badge={currentApp.toUpperCase()}
            />
          </div>
        </div>

        {/* Per-App Detailed Heat Maps and Country Maps (Only shown on a per-app basis) */}
        {currentApp !== 'all' && (
          <>
            {/* Visual Click Heatmap Overlay On Top of Actual Website */}
            <VisualWebsiteHeatmap
              items={activeMetrics.clickHeatmap || []}
              app={currentApp}
            />

            {/* Global Traffic Choropleth Map */}
            <ChoroplethWorldMap
              locations={activeMetrics.locations || []}
            />

            {/* Interaction Heat Map & Geographic Connections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ClickHeatMap
                  items={activeMetrics.clickHeatmap || []}
                  app={currentApp}
                />
              </div>
              <div className="lg:col-span-1">
                <GeoLocationCard
                  locations={activeMetrics.locations || []}
                />
              </div>
            </div>
          </>
        )}

        {/* Bottom Row: Breakdown and Realtime Events */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <AudienceBreakdown
              languages={activeMetrics.languages}
              devices={activeMetrics.devices}
            />
          </div>
          <div className="lg:col-span-2">
            <EventStreamTable
              events={filteredEvents}
              onRefresh={handleRefreshEvents}
            />
          </div>
        </div>
      </div>

      <PostHogSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConnect={handleConnectLive}
        onReset={handleResetFeed}
        isLive={isLive}
        initialCredentials={credentials || envCreds}
        isConfiguredFromEnv={isFromEnv}
      />
    </div>
  );
}

export default App;
