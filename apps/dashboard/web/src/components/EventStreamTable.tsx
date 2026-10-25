import React from 'react';
import { ListFilter, RefreshCw } from 'lucide-react';
import type { TelemetryEventItem } from '../data/metricsData';

interface EventStreamTableProps {
  events: TelemetryEventItem[];
  onRefresh: () => void;
}

export const EventStreamTable: React.FC<EventStreamTableProps> = ({
  events,
  onRefresh,
}) => {
  const getBadgeClass = (app: string) => {
    switch (app) {
      case 'wedding':
        return 'bg-amber-400/15 text-amber-300 border border-amber-400/30';
      case 'portfolio':
        return 'bg-blue-400/15 text-blue-300 border border-blue-400/30';
      case 'demo':
        return 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30';
      default:
        return 'bg-slate-700 text-slate-300 border border-slate-600';
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-sm flex flex-col justify-between backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3.5">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <ListFilter className="w-4 h-4 text-emerald-400" />
            Live Event Activity Stream
          </h2>
          <p className="text-xs text-slate-400">
            Real-time incoming telemetry events stamped with monorepo <code className="text-indigo-300 font-mono text-[11px]">app</code>
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors px-2 py-1 rounded hover:bg-indigo-500/10"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs" data-testid="events-table">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="pb-2.5 font-medium">Event Name</th>
              <th className="pb-2.5 font-medium">App</th>
              <th className="pb-2.5 font-medium">Metadata</th>
              <th className="pb-2.5 font-medium text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {events.map((evt) => (
              <tr key={evt.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-2.5 font-mono text-xs text-slate-100 font-medium">{evt.name}</td>
                <td className="py-2.5">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${getBadgeClass(evt.app)}`}>
                    {evt.app}
                  </span>
                </td>
                <td className="py-2.5 font-mono text-[11px] text-slate-400">{evt.meta}</td>
                <td className="py-2.5 text-right text-[11px] text-slate-400">{evt.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pt-3 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
        <span>PostHog Ingestion Schema: <code className="text-[11px] font-mono text-indigo-300 bg-indigo-950/50 px-1 py-0.5 rounded border border-indigo-800/40">properties.app</code></span>
        <span>Storage: <span className="text-emerald-400 font-medium">EU Frankfurt</span></span>
      </div>
    </div>
  );
};
