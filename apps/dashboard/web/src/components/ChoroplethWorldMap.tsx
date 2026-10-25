import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Globe, Compass, RotateCcw } from 'lucide-react';
import type { GeoLocationSegment } from '../data/metricsData';

interface ChoroplethWorldMapProps {
  locations: GeoLocationSegment[];
}

function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Geographic polygon boundaries for major countries
const COUNTRY_POLYGONS: Record<string, [number, number][]> = {
  PT: [
    [42.15, -8.2],
    [41.87, -6.74],
    [41.57, -6.19],
    [39.66, -6.93],
    [38.23, -7.01],
    [37.16, -7.4],
    [36.96, -7.88],
    [37.03, -8.99],
    [38.78, -9.5],
    [40.23, -8.87],
    [41.86, -8.86],
    [42.15, -8.2],
  ],
  ES: [
    [43.79, -7.69],
    [43.4, -1.78],
    [42.45, 3.16],
    [36.0, -5.61],
    [36.74, -2.15],
    [37.16, -7.4],
    [39.66, -6.93],
    [41.57, -6.19],
    [42.15, -8.2],
    [43.79, -7.69],
  ],
  GB: [
    [58.64, -3.07],
    [55.81, -1.97],
    [52.9, 0.45],
    [51.13, 1.34],
    [50.5, -2.4],
    [50.05, -5.71],
    [51.5, -4.5],
    [53.3, -4.5],
    [54.8, -5.1],
    [58.64, -3.07],
  ],
  FR: [
    [51.05, 2.54],
    [48.97, 8.23],
    [45.8, 6.9],
    [43.7, 7.5],
    [42.45, 3.16],
    [43.4, -1.78],
    [46.2, -1.2],
    [48.38, -4.72],
    [49.71, -1.94],
    [51.05, 2.54],
  ],
  US: [
    [49.0, -124.7],
    [49.0, -95.1],
    [47.4, -67.8],
    [44.8, -66.9],
    [25.1, -80.4],
    [26.0, -97.1],
    [31.8, -106.5],
    [32.5, -117.1],
    [48.4, -124.7],
    [49.0, -124.7],
  ],
};

// City coordinates for radar pin markers
const CITY_COORDINATES: Record<string, [number, number]> = {
  Lisbon: [38.7219, -9.1398],
  Porto: [41.1579, -8.6291],
  London: [51.5074, -0.1278],
  Paris: [48.8566, 2.3522],
  'San Francisco': [37.7749, -122.4194],
  'New York': [40.7128, -74.006],
  Madrid: [40.4168, -3.7038],
  default_PT: [38.7219, -9.1398],
  default_GB: [51.5074, -0.1278],
  default_FR: [48.8566, 2.3522],
  default_US: [37.7749, -122.4194],
};

export const ChoroplethWorldMap: React.FC<ChoroplethWorldMapProps> = ({ locations }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<GeoLocationSegment | null>(
    locations.length > 0 ? locations[0] : null
  );

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up any existing map instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Initialize Leaflet Map centered over Europe/Atlantic
    const map = L.map(mapContainerRef.current, {
      center: [38.72, -9.14],
      zoom: 3,
      minZoom: 2,
      maxZoom: 10,
      zoomControl: false,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // Add ESRI World Dark Gray Base & Reference (No API key required, zero watermarks)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 16,
        subdomains: ['server', 'services'],
      }
    ).addTo(map);

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 16,
        opacity: 0.85,
      }
    ).addTo(map);

    // Zoom control in top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Render Choropleth Country Polygons
    locations.forEach((loc) => {
      const code = loc.countryCode.toUpperCase();
      const polygonCoords = COUNTRY_POLYGONS[code];

      let fillColor = '#312e81'; // 1-15% (indigo)
      let color = '#6366f1';
      let fillOpacity = 0.55;

      if (loc.pct >= 65) {
        fillColor = '#059669'; // Emerald
        color = '#34d399';
        fillOpacity = 0.75;
      } else if (loc.pct >= 35) {
        fillColor = '#0891b2'; // Cyan
        color = '#22d3ee';
        fillOpacity = 0.65;
      } else if (loc.pct >= 15) {
        fillColor = '#2563eb'; // Blue
        color = '#60a5fa';
        fillOpacity = 0.6;
      }

      if (polygonCoords) {
        const polygon = L.polygon(polygonCoords, {
          color,
          fillColor,
          fillOpacity,
          weight: 2,
        }).addTo(map);

        polygon.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; color: #f8fafc; line-height: 1.4;">
            <div style="font-size: 15px; font-weight: bold; margin-bottom: 2px;">
              ${getCountryFlag(loc.countryCode)} ${loc.country}
            </div>
            <div style="color: ${color}; font-weight: bold; font-size: 13px;">${loc.pct}% Traffic Share</div>
            <div style="color: #94a3b8; font-size: 11px;">${loc.count} recorded visitors · ${loc.city || 'Primary Region'}</div>
          </div>
        `);
      }

      // Add Glowing Pulsing Radar Marker on City Coordinate
      const coords: [number, number] =
        loc.latitude !== undefined && loc.longitude !== undefined
          ? [loc.latitude, loc.longitude]
          : CITY_COORDINATES[loc.city] ||
            CITY_COORDINATES[`default_${code}`] ||
            [38.72, -9.14];

      // Custom pulsing DivIcon
      const pulseIcon = L.divIcon({
        className: 'custom-pulse-pin',
        html: `
          <div style="position: relative; width: 24px; height: 24px;">
            <div style="position: absolute; inset: 0; border-radius: 9999px; background-color: ${color}; opacity: 0.75; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: absolute; inset: 4px; border-radius: 9999px; background-color: ${color}; box-shadow: 0 0 10px ${color}; border: 2px solid #ffffff;"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker(coords, { icon: pulseIcon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; color: #f8fafc; line-height: 1.4;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 2px;">
            ${getCountryFlag(loc.countryCode)} ${loc.city}${loc.region ? `, ${loc.region}` : ''}, ${loc.country}
          </div>
          <div style="color: ${color}; font-weight: bold; font-size: 13px; margin-top: 4px;">${loc.pct}% Live Traffic</div>
          <div style="color: #cbd5e1; font-size: 11px;">${loc.count} sessions connected</div>
          ${loc.region || loc.postalCode ? `<div style="color: #94a3b8; font-size: 10px; margin-top: 3px;">📍 ${[loc.region, loc.postalCode ? `Postal Code ${loc.postalCode}` : ''].filter(Boolean).join(' · ')}</div>` : ''}
        </div>
      `);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [locations]);

  // Handle focus on top location
  const handleFocusTop = () => {
    if (!mapInstanceRef.current || locations.length === 0) return;
    const top = locations[0];
    const coords: [number, number] =
      top.latitude !== undefined && top.longitude !== undefined
        ? [top.latitude, top.longitude]
        : CITY_COORDINATES[top.city] ||
          CITY_COORDINATES[`default_${top.countryCode.toUpperCase()}`] ||
          [38.7219, -9.1398];
    mapInstanceRef.current.flyTo(coords, 6, { duration: 1.2 });
    setSelectedLocation(top);
  };

  const handleResetWorld = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([35.0, -10.0], 3, { duration: 1.2 });
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-sm space-y-4 backdrop-blur-sm">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>Interactive Real World Traffic Map</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono">
              Live Geographic Basemap
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Visitor connection locations with country traffic volume shading
          </p>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleFocusTop}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Focus Traffic Center</span>
          </button>
          <button
            onClick={handleResetWorld}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
            title="Reset to World View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>World</span>
          </button>
        </div>
      </div>

      {/* Real Interactive Leaflet Map Container */}
      <div className="relative w-full h-[400px] rounded-xl overflow-hidden border border-slate-800/90 shadow-2xl bg-slate-950">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Floating Traffic Scale Legend */}
        <div className="absolute bottom-4 right-4 z-[400] bg-slate-900/90 border border-slate-700/80 rounded-lg p-2.5 shadow-2xl text-xs backdrop-blur-md">
          <div className="text-[10px] text-slate-400 font-semibold mb-1.5">Traffic Density</div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="w-3 h-3 rounded bg-indigo-900 border border-indigo-500" title="1-15%" />
            <span className="w-3 h-3 rounded bg-blue-600 border border-blue-400" title="15-35%" />
            <span className="w-3 h-3 rounded bg-cyan-600 border border-cyan-300" title="35-65%" />
            <span
              className="w-3 h-3 rounded bg-emerald-500 border border-emerald-300 shadow-sm shadow-emerald-500/50"
              title="65-100%"
            />
            <span className="text-emerald-400 font-bold ml-1">Highest</span>
          </div>
        </div>
      </div>

      {/* Geographic Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
        {locations.map((loc) => {
          const isTop = loc.pct >= 50;
          return (
            <div
              key={loc.countryCode}
              onClick={() => {
                setSelectedLocation(loc);
                const coords: [number, number] =
                  loc.latitude !== undefined && loc.longitude !== undefined
                    ? [loc.latitude, loc.longitude]
                    : CITY_COORDINATES[loc.city] ||
                      CITY_COORDINATES[`default_${loc.countryCode.toUpperCase()}`] ||
                      [38.7219, -9.1398];
                mapInstanceRef.current?.flyTo(coords, 6, { duration: 1.2 });
              }}
              className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                selectedLocation?.countryCode === loc.countryCode
                  ? 'bg-slate-800/90 border-emerald-500 shadow-md shadow-emerald-500/10'
                  : 'bg-slate-950/40 border-slate-800/70 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5 font-medium text-slate-200">
                  <span>{getCountryFlag(loc.countryCode)}</span>
                  <span className="truncate">{loc.country}</span>
                </span>
                <span className={`font-mono font-bold ${isTop ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {loc.pct}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    isTop ? 'bg-gradient-to-r from-teal-400 to-emerald-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.max(loc.pct, 4)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-300 mt-1 flex justify-between">
                <span className="truncate font-medium">
                  {loc.city ? `${loc.city}, ` : ''}{loc.country}
                </span>
                <span className="font-mono shrink-0 ml-1 text-slate-400">{loc.count} visitors</span>
              </div>
              {(loc.region || loc.postalCode) && (
                <div className="text-[9px] text-slate-400 mt-0.5 truncate flex items-center gap-1">
                  <span className="text-emerald-400">📍</span>
                  <span>{[loc.region, loc.postalCode ? `Postal ${loc.postalCode}` : ''].filter(Boolean).join(' · ')}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
