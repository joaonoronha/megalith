import React from 'react';
import { MousePointerClick, Flame, Sparkles } from 'lucide-react';
import type { ClickHeatMapItem, AppId } from '../data/metricsData';

interface ClickHeatMapProps {
  items: ClickHeatMapItem[];
  app: AppId;
}

export const ClickHeatMap: React.FC<ClickHeatMapProps> = ({ items, app }) => {
  const appTitle = app === 'all' ? 'All Web Apps' : app.charAt(0).toUpperCase() + app.slice(1);
  const totalClicks = items.reduce((acc, curr) => acc + curr.clicks, 0);

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-sm space-y-4 backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <MousePointerClick className="w-4 h-4 text-rose-400" />
            <span>Interaction Heat Map</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 font-mono">
              {appTitle}
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Click density &amp; interaction frequency across UI elements
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 self-start sm:self-auto">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> Hot
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Warm
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400" /> Cool
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1.5">
          <Sparkles className="w-5 h-5 text-slate-600 mb-1" />
          <span>No click interactions recorded for this app yet.</span>
        </div>
      ) : (
        <div className="space-y-3.5">
          {items.map((item) => {
            const isHot = item.intensity === 'hot';
            const isWarm = item.intensity === 'warm';

            return (
              <div
                key={item.id}
                className="group relative p-3 rounded-lg bg-slate-950/40 border border-slate-800/60 hover:border-slate-700/80 transition-all space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`p-1 rounded-md shrink-0 ${
                        isHot
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : isWarm
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                    </span>
                    <div className="truncate">
                      <div className="font-semibold text-slate-200 truncate">{item.label}</div>
                      <code className="text-[10px] text-slate-500 font-mono tracking-tight block truncate">
                        {item.selector}
                      </code>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-3">
                    <div className="font-bold text-slate-100 font-mono">
                      {item.clicks}{' '}
                      <span className="text-[10px] text-slate-500 font-normal">
                        ({item.pct}%)
                      </span>
                    </div>
                    <span
                      className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded ${
                        isHot
                          ? 'text-rose-400 bg-rose-950/60'
                          : isWarm
                          ? 'text-amber-400 bg-amber-950/60'
                          : 'text-blue-400 bg-blue-950/60'
                      }`}
                    >
                      {item.intensity}
                    </span>
                  </div>
                </div>

                {/* Heat Intensity Progress Bar */}
                <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isHot
                        ? 'bg-gradient-to-r from-orange-500 via-rose-500 to-red-500 shadow-sm shadow-rose-500/40'
                        : isWarm
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                        : 'bg-gradient-to-r from-blue-600 to-cyan-400'
                    }`}
                    style={{ width: `${Math.max(item.pct, 4)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalClicks > 0 && (
        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
          <span>Total Captured Interactions:</span>
          <span className="font-mono font-semibold text-slate-200">{totalClicks} clicks</span>
        </div>
      )}
    </div>
  );
};
