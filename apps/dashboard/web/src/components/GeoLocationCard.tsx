import React from 'react';
import { MapPin, Navigation, Compass } from 'lucide-react';
import type { GeoLocationSegment } from '../data/metricsData';

interface GeoLocationCardProps {
  locations?: GeoLocationSegment[];
}

function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export const GeoLocationCard: React.FC<GeoLocationCardProps> = ({ locations = [] }) => {
  const totalVisitors = locations.reduce((sum, loc) => sum + loc.count, 0);

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-sm space-y-4 backdrop-blur-sm flex flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>Visitor Locations</span>
            </h2>
            <p className="text-xs text-slate-400">City, district and postal area of connections</p>
          </div>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Compass className="w-4 h-4" />
          </div>
        </div>

        {/* Mini Visual Geo Node Graphic */}
        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/60 flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full bg-indigo-950/80 border border-indigo-500/40 flex items-center justify-center shrink-0">
            <Navigation className="w-5 h-5 text-indigo-400 transform -rotate-45" />
            {locations.length > 0 && (
              <>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </>
            )}
          </div>
          <div className="text-xs">
            <div className="font-semibold text-slate-200">
              {locations.length > 0 ? `${locations[0].city ? `${locations[0].city}, ` : ''}${locations[0].country}` : '-'}
            </div>
            <div className="text-[11px] text-slate-400">
              {locations.length > 0
                ? `Primary traffic origin (${locations[0].pct}% of traffic)`
                : 'Awaiting connection stream (-)'}
            </div>
          </div>
        </div>

        {/* Location List */}
        <div className="space-y-2.5">
          {locations.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1">
              <span className="text-lg font-mono text-slate-600">-</span>
              <span>No visitor locations received yet</span>
            </div>
          ) : (
            locations.map((loc) => {
              const flag = getCountryFlag(loc.countryCode);
              return (
                <div key={`${loc.country}-${loc.city || 'all'}-${loc.region || ''}`} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-base" role="img" aria-label={loc.country}>
                        {flag}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-slate-200 font-medium leading-tight">
                          {loc.city ? `${loc.city}, ` : ''}{loc.country}
                        </span>
                        {(loc.region || loc.postalCode) && (
                          <span className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <span className="text-emerald-400">📍</span>
                            <span>{[loc.region, loc.postalCode ? `Postal ${loc.postalCode}` : ''].filter(Boolean).join(' · ')}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-white font-mono">{loc.pct}%</span>{' '}
                      <span className="text-[10px] text-slate-500 font-normal">
                        ({loc.count})
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                      style={{ width: `${Math.max(loc.pct, 5)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 mt-2">
        <span>Total Geo Connections</span>
        <span className="font-bold text-slate-400 font-mono">
          {totalVisitors > 0 ? totalVisitors.toLocaleString() : '-'}
        </span>
      </div>
    </div>
  );
};
