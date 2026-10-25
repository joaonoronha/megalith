import { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { KpiGrid } from './components/KpiGrid';
import { ActivityChart } from './components/ActivityChart';
import { FunnelCard } from './components/FunnelCard';
import { AudienceBreakdown } from './components/AudienceBreakdown';
import { EventStreamTable } from './components/EventStreamTable';
import { PostHogSettingsModal } from './components/PostHogSettingsModal';
import {
  METRICS_DATA,
  INITIAL_EVENTS,
  type AppId,
  type TelemetryEventItem,
} from './data/metricsData';
import { queryPostHogHogQL, type PostHogQueryCredentials } from './services/posthogApi';

export function App() {
  const [currentApp, setCurrentApp] = useState<AppId>('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [events, setEvents] = useState<TelemetryEventItem[]>(INITIAL_EVENTS);

  const activeMetrics = useMemo(() => {
    return METRICS_DATA[currentApp] || METRICS_DATA.all;
  }, [currentApp]);

  const filteredEvents = useMemo(() => {
    if (currentApp === 'all') return events;
    return events.filter((e) => e.app === currentApp);
  }, [events, currentApp]);

  const handleConnectLive = async (creds: PostHogQueryCredentials) => {
    try {
      // Test the live connection with a basic HogQL count query
      await queryPostHogHogQL(
        creds,
        'SELECT properties.app, count() FROM events GROUP BY properties.app'
      );
      setIsLive(true);
      setIsSettingsOpen(false);
      alert('Successfully connected to PostHog EU! Metrics are now live.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Connection failed: ${msg}`);
    }
  };

  const handleResetFeed = () => {
    setIsLive(false);
    setIsSettingsOpen(false);
  };

  const handleRefreshEvents = () => {
    // Append a simulated live event if in demo feed
    const newEvt: TelemetryEventItem = {
      id: String(Date.now()),
      name: currentApp === 'portfolio' ? 'portfolio_project_clicked' : 'wedding_viewed',
      app: currentApp === 'all' ? 'wedding' : currentApp,
      meta: 'locale: pt-PT · simulated realtime',
      timestamp: 'Just now',
    };
    setEvents((prev) => [newEvt, ...prev.slice(0, 15)]);
  };

  return (
    <div className="min-h-screen bg-dashboard-glow text-slate-100 p-4 md:p-8 font-sans selection:bg-blue-500/20 selection:text-blue-200">
      <div className="max-w-7xl mx-auto space-y-6">
        <Header
          currentApp={currentApp}
          onSelectApp={setCurrentApp}
          isLive={isLive}
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
      />
    </div>
  );
}

export default App;
