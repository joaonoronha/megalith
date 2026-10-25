import React from 'react';
import { Activity, Radio, Sliders } from 'lucide-react';
import type { AppId } from '../data/metricsData';

interface HeaderProps {
  currentApp: AppId;
  onSelectApp: (app: AppId) => void;
  isLive: boolean;
  isFromEnv?: boolean;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentApp,
  onSelectApp,
  isLive,
  isFromEnv,
  onOpenSettings,
}) => {
  const tabs: { id: AppId; label: string }[] = [
    { id: 'all', label: 'All Apps' },
    { id: 'wedding', label: 'Wedding' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'demo', label: 'Demo' },
  ];

  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-blue-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Megalith Telemetry Hub
          </h1>
          <p className="text-xs text-slate-400">
            Unified cross-product telemetry &amp; analytics powered by PostHog
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* App Switcher Tabs */}
        <div className="inline-flex rounded-lg p-1 bg-slate-900/90 border border-slate-800 text-xs font-medium" role="tablist">
          {tabs.map((tab) => {
            const isActive = currentApp === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                data-testid={`tab-${tab.id}`}
                onClick={() => onSelectApp(tab.id)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Live / Demo Mode Button */}
        <button
          onClick={onOpenSettings}
          data-testid="posthog-settings-btn"
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-800 bg-slate-900/90 hover:bg-slate-800/80 text-slate-200 flex items-center gap-2 transition-all shadow-sm"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isLive ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-slate-400" />
            {isLive ? (isFromEnv ? 'PostHog Live (Env)' : 'PostHog Live') : 'Demo Feed'}
          </span>
          <Sliders className="w-3.5 h-3.5 text-slate-500 ml-1" />
        </button>
      </div>
    </header>
  );
};
