import React from 'react';
import { Filter } from 'lucide-react';
import type { FunnelStep } from '../data/metricsData';

interface FunnelCardProps {
  funnel?: FunnelStep[];
  title?: string;
  badge?: string;
}

export const FunnelCard: React.FC<FunnelCardProps> = ({
  funnel,
  title = 'Save the Date Funnel',
  badge = 'Wedding',
}) => {
  if (!funnel || funnel.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-sm flex flex-col justify-between backdrop-blur-sm h-full">
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Filter className="w-4 h-4 text-amber-400" />
              {title}
            </h2>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-800/40 px-2 py-0.5 rounded-full border border-slate-700/40 font-mono">
              {badge}
            </span>
          </div>
          <p className="text-xs text-slate-400">Step-by-step guest conversion flow</p>
        </div>

        <div className="my-auto py-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1">
          <span className="text-2xl font-mono text-slate-600">-</span>
          <span>No conversion flow data received yet</span>
        </div>

        <div className="text-[11px] text-slate-400 pt-3 border-t border-slate-800/60 flex items-center justify-between">
          <span>Overall Funnel Efficiency</span>
          <span className="font-semibold text-slate-500 font-mono">-</span>
        </div>
      </div>
    );
  }

  const endToEndPct = funnel[funnel.length - 1].pct;

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-sm flex flex-col justify-between backdrop-blur-sm">
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-400" />
            {title}
          </h2>
          <span className="text-[11px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
            {badge}
          </span>
        </div>
        <p className="text-xs text-slate-400">Step-by-step guest conversion flow</p>
      </div>

      <div className="space-y-3.5 my-auto py-2">
        {funnel.map((step) => (
          <div key={step.name}>
            <div className="flex justify-between text-xs mb-1 font-medium">
              <span className="text-slate-200">{step.name}</span>
              <span className="text-slate-400">
                {step.count.toLocaleString()} ({step.pct}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${step.color}`}
                style={{ width: `${step.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="text-[11px] text-slate-400 pt-3 border-t border-slate-800/60 flex items-center justify-between">
        <span>Overall Funnel Efficiency</span>
        <span className="font-semibold text-emerald-400">{endToEndPct}% conversion</span>
      </div>
    </div>
  );
};
