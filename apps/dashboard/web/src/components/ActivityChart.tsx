import React from 'react';
import { BarChart3 } from 'lucide-react';
import type { ChartDay } from '../data/metricsData';

interface ActivityChartProps {
  data: ChartDay[];
}

export const ActivityChart: React.FC<ActivityChartProps> = ({ data }) => {
  const maxEvents = Math.max(...data.map((d) => d.events), 100);
  const maxVisitors = Math.max(...data.map((d) => d.visitors), 50);

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-sm flex flex-col justify-between backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            Activity Timeline
          </h2>
          <p className="text-xs text-slate-400">Daily event &amp; visitor telemetry</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500"></span> Visitors
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500/70"></span> Events
          </span>
        </div>
      </div>

      {/* SVG Dual-Bar Histogram */}
      <div className="w-full h-52 relative pt-2">
        <svg className="w-full h-full overflow-visible" viewBox="0 0 600 180" preserveAspectRatio="none">
          {/* Subtle Grid horizontal lines */}
          <line x1="0" y1="30" x2="600" y2="30" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="0" y1="80" x2="600" y2="80" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="0" y1="130" x2="600" y2="130" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3 3" />

          {data.map((d, i) => {
            const count = data.length;
            const slotWidth = 600 / count;
            const cx = i * slotWidth + slotWidth / 2;
            const barWidth = 24;

            const eHeight = Math.max(8, (d.events / maxEvents) * 140);
            const vHeight = Math.max(6, (d.visitors / maxVisitors) * 115);

            return (
              <g key={d.day} className="cursor-pointer group">
                <title>{`${d.day}: ${d.visitors} visitors, ${d.events} events`}</title>
                {/* Event Bar (Outer/Back) */}
                <rect
                  x={cx - barWidth / 2}
                  y={165 - eHeight}
                  width={barWidth}
                  height={eHeight}
                  rx="4"
                  className="fill-indigo-500/50 group-hover:fill-indigo-500/80 transition-colors"
                />
                {/* Visitor Bar (Inner/Front) */}
                <rect
                  x={cx - barWidth / 2 + 3}
                  y={165 - vHeight}
                  width={barWidth - 6}
                  height={vHeight}
                  rx="3"
                  className="fill-blue-500 group-hover:fill-blue-400 transition-colors"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Date Labels */}
      <div className="flex justify-between text-[11px] text-slate-400 border-t border-slate-800/60 pt-2 mt-2">
        {data.map((d) => (
          <span key={d.day}>{d.day}</span>
        ))}
      </div>
    </div>
  );
};
