import React from 'react';
import { Globe2, Smartphone } from 'lucide-react';
import type { LanguageSegment, DeviceSegment } from '../data/metricsData';

interface AudienceBreakdownProps {
  languages: LanguageSegment[];
  devices: DeviceSegment[];
}

export const AudienceBreakdown: React.FC<AudienceBreakdownProps> = ({
  languages,
  devices,
}) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-sm space-y-5 backdrop-blur-sm">
      <div>
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-indigo-400" />
          Audience Segments
        </h2>
        <p className="text-xs text-slate-400">Language preferences &amp; device categories</p>
      </div>

      {/* Languages */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
          Languages
        </h3>
        <div className="space-y-2">
          {languages.map((lang) => (
            <div key={lang.code} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <span className="font-mono text-[11px] bg-slate-800 px-1.5 py-0.5 rounded text-amber-300 font-bold">
                  {lang.code}
                </span>
                <span className="text-slate-300">{lang.name}</span>
              </span>
              <span className="font-semibold text-white">
                {lang.pct}% <span className="text-[10px] text-slate-500 font-normal">({lang.count})</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Devices */}
      <div className="border-t border-slate-800/60 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5 text-blue-400" />
          Top Devices
        </h3>
        <div className="space-y-2">
          {devices.map((device) => (
            <div key={device.name} className="flex items-center justify-between text-xs">
              <span className="text-slate-300">{device.name}</span>
              <span className="font-semibold text-white">{device.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
