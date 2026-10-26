import React, { useState } from 'react';
import {
  Flame,
  Monitor,
  Smartphone,
  Eye,
  ExternalLink,
  Sliders,
  RefreshCw,
  MousePointer2,
} from 'lucide-react';
import type { ClickHeatMapItem, AppId } from '../data/metricsData';

interface VisualWebsiteHeatmapProps {
  items: ClickHeatMapItem[];
  app: AppId;
}

export const VisualWebsiteHeatmap: React.FC<VisualWebsiteHeatmapProps> = ({ items, app }) => {
  const [selectedSite, setSelectedSite] = useState<'wedding' | 'portfolio'>(
    app === 'portfolio' ? 'portfolio' : 'wedding'
  );
  const [weddingView, setWeddingView] = useState<'overlay' | 'invitation'>('overlay');
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [heatIntensity, setHeatIntensity] = useState<number>(0.85);
  const [showHeatOverlay, setShowHeatOverlay] = useState<boolean>(true);
  const [interactiveMode, setInteractiveMode] = useState<boolean>(false);
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState<number>(0);

  // Sync selected site when parent tab switches
  React.useEffect(() => {
    if (app === 'portfolio') setSelectedSite('portfolio');
    if (app === 'wedding') setSelectedSite('wedding');
  }, [app]);

  // Actual live website URLs
  const siteUrl =
    selectedSite === 'wedding'
      ? weddingView === 'overlay'
        ? 'https://madalenaejoao.pt'
        : 'https://madalenaejoao.pt?intro=false'
      : 'https://joaonoronha.pt';

  const isScrollable = selectedSite === 'wedding' && weddingView === 'invitation';
  const isMobileView = viewport === 'mobile' || (typeof window !== 'undefined' && window.innerWidth < 768);

  // Find click stats for specific targets purely from real telemetry items
  const getStats = (selectorPart: string) => {
    const item = items.find(
      (i) =>
        i.selector.toLowerCase().includes(selectorPart.toLowerCase()) ||
        i.element.toLowerCase().includes(selectorPart.toLowerCase()) ||
        i.label.toLowerCase().includes(selectorPart.toLowerCase())
    );
    return item || null;
  };

  // Wedding real stats from PostHog
  const weddingIntroCta = getStats('intro-pulse') || getStats('SAVE THE DATE') || getStats('Start Video');
  const weddingCalendarStats = getStats('guardar') || getStats('Calendar') || getStats('save-date');
  const weddingVideoStats = getStats('video') || getStats('Completed');
  const weddingLangStats = getStats('lang');

  // Portfolio real stats from PostHog
  const portfolioCvStats = getStats('cv');
  const portfolioProjectStats = getStats('project');
  const portfolioContactStats = getStats('contact');

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-sm space-y-4 backdrop-blur-sm">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <span>Actual Website UI Heatmap</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono">
              Live Production Frame
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Rendering the real deployed website with user click density projected directly on top
          </p>
        </div>

        {/* Viewport and Preview Switches */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Site Switcher */}
          <div className="inline-flex rounded-lg p-1 bg-slate-950/80 border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setSelectedSite('wedding')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                selectedSite === 'wedding'
                  ? 'bg-amber-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Wedding (madalenaejoao.pt)
            </button>
            <button
              onClick={() => setSelectedSite('portfolio')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                selectedSite === 'portfolio'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Portfolio (joaonoronha.pt)
            </button>
          </div>

          {/* Wedding Views Switcher: View 1 (Overlay) vs View 2 (Post-Video Invitation) */}
          {selectedSite === 'wedding' && (
            <div className="inline-flex rounded-lg p-1 bg-slate-950/80 border border-slate-800 text-xs font-medium">
              <button
                onClick={() => setWeddingView('overlay')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  weddingView === 'overlay'
                    ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="View 1: Initial Intro Overlay with 'SAVE THE DATE' button"
              >
                1. Intro Overlay
              </button>
              <button
                onClick={() => setWeddingView('invitation')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  weddingView === 'invitation'
                    ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="View 2: Post-Video Full Invitation (Scrollable)"
              >
                2. Post-Video Invitation
              </button>
            </div>
          )}

          {/* Desktop / Mobile Frame Switch */}
          <div className="inline-flex rounded-lg p-1 bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
            <button
              onClick={() => setViewport('desktop')}
              className={`p-1.5 rounded-md ${
                viewport === 'desktop' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Desktop viewport"
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewport('mobile')}
              className={`p-1.5 rounded-md ${
                viewport === 'mobile' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Mobile viewport"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>

          {/* Heatmap Overlay Toggle */}
          <button
            onClick={() => setShowHeatOverlay(!showHeatOverlay)}
            className={`px-2.5 py-1 text-xs rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
              showHeatOverlay
                ? 'bg-orange-600/20 border-orange-500/40 text-orange-300'
                : 'bg-slate-950/80 border-slate-800 text-slate-400'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Heatmap: {showHeatOverlay ? 'ON' : 'OFF'}</span>
          </button>

          {/* Interactive Mode Toggle */}
          <button
            onClick={() => setInteractiveMode(!interactiveMode)}
            className={`px-2.5 py-1 text-xs rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
              interactiveMode
                ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                : 'bg-slate-950/80 border-slate-800 text-slate-400'
            }`}
            title={interactiveMode ? 'Clicking interacts with the live website' : 'Clicking inspects heatmap points'}
          >
            <MousePointer2 className="w-3.5 h-3.5" />
            <span>{interactiveMode ? 'Interactive (Scroll & Click)' : 'Inspector Mode'}</span>
          </button>

          {/* Heat Intensity Slider */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-400">
            <Sliders className="w-3.5 h-3.5 text-orange-400" />
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={heatIntensity}
              onChange={(e) => setHeatIntensity(parseFloat(e.target.value))}
              className="w-14 accent-orange-500 cursor-pointer"
              title="Heatmap overlay opacity"
            />
          </div>
        </div>
      </div>

      {/* Actual Website Canvas Frame */}
      <div className="w-full overflow-x-auto bg-slate-950/90 rounded-xl border border-slate-800/80 p-4 sm:p-6 flex justify-center items-start">
        <div
          className={`relative transition-all duration-300 shadow-2xl rounded-2xl overflow-hidden border border-slate-700/80 ${
            viewport === 'mobile' ? 'w-[390px] h-[720px]' : 'w-full max-w-5xl h-[650px]'
          }`}
        >
          {/* Browser Chrome Bar */}
          <div className="bg-slate-900 border-b border-slate-800 px-3 py-2 flex items-center justify-between text-xs text-slate-400 select-none">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
            </div>

            <div className="font-mono text-[11px] bg-slate-950 px-3 py-0.5 rounded-md border border-slate-800 text-slate-200 flex items-center gap-2 max-w-md truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="truncate">{siteUrl}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIframeKey((k) => k + 1)}
                className="p-1 hover:text-white rounded hover:bg-slate-800 text-slate-400"
                title="Reload website frame"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <a
                href={siteUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1 hover:text-white rounded hover:bg-slate-800 text-slate-400 flex items-center gap-1"
                title="Open live website in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* THE ACTUAL LIVE WEBSITE EMBED (100% REAL UI)                            */}
          {/* ========================================================================= */}
          <div
            className={`relative w-full h-[calc(100%-37px)] bg-slate-950 ${
              isScrollable
                ? 'overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900'
                : 'overflow-hidden'
            }`}
          >
            <div
              className="relative w-full"
              style={{
                height: isScrollable ? (isMobileView ? '1080px' : '1160px') : '100%',
              }}
            >
            <iframe
              key={iframeKey}
              src={siteUrl}
              className={`w-full h-full border-0 ${
                interactiveMode ? 'pointer-events-auto' : 'pointer-events-none'
              }`}
              title={`Live Preview of ${siteUrl}`}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />

            {/* ========================================================================= */}
            {/* HEATMAP THERMAL GLOW OVERLAY PROJECTED OVER THE REAL WEBSITE            */}
            {/* ========================================================================= */}
            {showHeatOverlay && (
              <div
                className={`absolute inset-0 z-30 transition-opacity duration-300 overflow-hidden ${
                  interactiveMode ? 'pointer-events-none' : 'pointer-events-auto'
                }`}
                style={{ opacity: heatIntensity }}
              >
                {/* ---------------- WEDDING HEATMAP ZONES ---------------- */}
                {selectedSite === 'wedding' && (
                  <>
                    {/* View 1: Intro Overlay -> Single Primary CTA: 'SAVE THE DATE' (Start Experience) */}
                    {weddingView === 'overlay' && (
                      <div
                        onMouseEnter={() =>
                          setActiveElementId(
                            'Primary Landing CTA: SAVE THE DATE (button.intro-pulse-btn)'
                          )
                        }
                        onMouseLeave={() => setActiveElementId(null)}
                        className="absolute top-[64%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer pointer-events-auto"
                      >
                        {/* Thermal Glow Centered Exactly Over the Golden 'SAVE THE DATE' Button */}
                        <div
                          className="w-64 sm:w-72 h-16 rounded-full blur-md"
                          style={{
                            background:
                              weddingIntroCta && weddingIntroCta.clicks > 0
                                ? 'radial-gradient(ellipse, rgba(239, 68, 68, 0.95) 0%, rgba(249, 115, 22, 0.8) 40%, rgba(245, 158, 11, 0.4) 70%, transparent 85%)'
                                : 'radial-gradient(ellipse, rgba(148, 163, 184, 0.3) 0%, transparent 70%)',
                          }}
                        />
                        {weddingIntroCta && weddingIntroCta.clicks > 0 && (
                          <div className="absolute inset-0 rounded-full animate-ping border-2 border-red-500/70" />
                        )}
                        <div
                          className={`absolute -top-3.5 left-1/2 transform -translate-x-1/2 font-mono text-[10px] font-bold px-3 py-1 rounded-full shadow-2xl flex items-center gap-1.5 border whitespace-nowrap ${
                            weddingIntroCta && weddingIntroCta.clicks > 0
                              ? 'bg-red-600 text-white border-red-200 animate-bounce'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          <Flame className="w-3.5 h-3.5 fill-current" />
                          <span>
                            TOP CTA: SAVE THE DATE ({weddingIntroCta ? `${weddingIntroCta.clicks} clicks · ${weddingIntroCta.pct}%` : '-'})
                          </span>
                        </div>
                      </div>
                    )}

                    {/* View 2: Post-Video Main Page (Scrollable Full Invitation) */}
                    {weddingView === 'invitation' && (
                      <>
                        {/* 1. Language Switcher Capsule in Header */}
                        {weddingLangStats && weddingLangStats.clicks > 0 && (
                          <div
                            onMouseEnter={() =>
                              setActiveElementId('Language Switcher (nav.lang-switch)')
                            }
                            onMouseLeave={() => setActiveElementId(null)}
                            className="absolute top-4 right-4 group cursor-pointer pointer-events-auto"
                          >
                            <div
                              className="w-24 h-12 rounded-full blur-sm"
                              style={{
                                background:
                                  'radial-gradient(circle, rgba(56, 189, 248, 0.8) 0%, rgba(59, 130, 246, 0.4) 50%, transparent 80%)',
                              }}
                            />
                            <span className="absolute -top-3 right-0 bg-blue-600 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg border border-blue-400">
                              {weddingLangStats.clicks} clicks ({weddingLangStats.pct}%)
                            </span>
                          </div>
                        )}

                        {/* 2. Video Player in Baroque Gold Frame */}
                        <div
                          onMouseEnter={() =>
                            setActiveElementId('Video Player (video.screenshot-video-element)')
                          }
                          onMouseLeave={() => setActiveElementId(null)}
                          style={{
                            top: isMobileView ? '320px' : '360px',
                          }}
                          className="absolute left-1/2 transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer pointer-events-auto"
                        >
                          <div
                            className="w-72 sm:w-80 h-36 rounded-2xl blur-md"
                            style={{
                              background:
                                weddingVideoStats && weddingVideoStats.clicks > 0
                                  ? 'radial-gradient(ellipse, rgba(245, 158, 11, 0.85) 0%, rgba(234, 88, 12, 0.5) 45%, transparent 75%)'
                                  : 'radial-gradient(ellipse, rgba(148, 163, 184, 0.3) 0%, transparent 70%)',
                            }}
                          />
                          <div
                            className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-xl flex items-center gap-1 border whitespace-nowrap ${
                              weddingVideoStats && weddingVideoStats.clicks > 0
                                ? 'bg-amber-500 text-black border-amber-300'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            <Flame className="w-3 h-3 fill-current" />
                            <span>Video Completions: {weddingVideoStats ? `${weddingVideoStats.clicks} full plays` : '-'}</span>
                          </div>
                        </div>

                        {/* 3. Goal CTA: Guardar a Data (.ics Calendar CTA) */}
                        <div
                          onMouseEnter={() =>
                            setActiveElementId(
                              'Goal CTA: Guardar no Calendário (button.screenshot-guardar-btn)'
                            )
                          }
                          onMouseLeave={() => setActiveElementId(null)}
                          style={{
                            top: isMobileView ? '645px' : '730px',
                          }}
                          className="absolute left-1/2 transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer pointer-events-auto"
                        >
                          <div
                            className="w-64 sm:w-72 h-14 rounded-full blur-md"
                            style={{
                              background:
                                weddingCalendarStats && weddingCalendarStats.clicks > 0
                                  ? 'radial-gradient(ellipse, rgba(239, 68, 68, 0.95) 0%, rgba(249, 115, 22, 0.8) 35%, rgba(245, 158, 11, 0.45) 65%, transparent 85%)'
                                  : 'radial-gradient(ellipse, rgba(148, 163, 184, 0.3) 0%, transparent 70%)',
                            }}
                          />
                          {weddingCalendarStats && weddingCalendarStats.clicks > 0 && (
                            <div className="absolute inset-0 rounded-full animate-ping border-2 border-red-500/70" />
                          )}
                          <div
                            className={`absolute -top-3.5 left-1/2 transform -translate-x-1/2 font-mono text-[10px] font-bold px-3 py-1 rounded-full shadow-2xl flex items-center gap-1.5 border whitespace-nowrap ${
                              weddingCalendarStats && weddingCalendarStats.clicks > 0
                                ? 'bg-red-600 text-white border-red-200 animate-bounce'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            <Flame className="w-3.5 h-3.5 fill-current" />
                            <span>
                              TOP GOAL: Guardar a Data (.ics) ({weddingCalendarStats ? `${weddingCalendarStats.clicks} downloads · ${weddingCalendarStats.pct}%` : '-'})
                            </span>
                          </div>
                        </div>
                      </>
                    )}

                  </>
                )}

                {/* ---------------- PORTFOLIO HEATMAP ZONES ---------------- */}
                {selectedSite === 'portfolio' && (
                  <>
                    {/* Upper Left: PRIMARY CTA 'Download CV (PDF)' -> TOP HOTTEST POINT */}
                    {portfolioCvStats && (
                      <div
                        onMouseEnter={() => setActiveElementId('Primary CTA: Download CV (a#download-cv)')}
                        onMouseLeave={() => setActiveElementId(null)}
                        className="absolute top-[28%] left-[10%] sm:left-[15%] group cursor-pointer pointer-events-auto"
                      >
                        <div
                          className="w-56 h-20 rounded-2xl blur-md"
                          style={{
                            background:
                              'radial-gradient(ellipse, rgba(239, 68, 68, 0.95) 0%, rgba(249, 115, 22, 0.8) 35%, rgba(59, 130, 246, 0.45) 65%, transparent 85%)',
                          }}
                        />
                        <div className="absolute inset-0 rounded-xl animate-ping border-2 border-red-500/60" />
                        <div className="absolute -top-4 left-2 bg-red-600 text-white font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-2xl flex items-center gap-1 border border-red-200 animate-bounce whitespace-nowrap">
                          <Flame className="w-3 h-3 fill-white" />
                          <span>TOP CLICK: Download CV ({portfolioCvStats.clicks} clicks &middot; {portfolioCvStats.pct}%)</span>
                        </div>
                      </div>
                    )}

                    {/* Mid Section: Featured Technical Projects */}
                    {portfolioProjectStats && (
                      <div
                        onMouseEnter={() => setActiveElementId('Project Showcase: Megalith (div.project-card)')}
                        onMouseLeave={() => setActiveElementId(null)}
                        className="absolute top-[52%] left-1/2 transform -translate-x-1/2 group cursor-pointer pointer-events-auto"
                      >
                        <div
                          className="w-80 h-28 rounded-2xl blur-md"
                          style={{
                            background:
                              'radial-gradient(ellipse, rgba(245, 158, 11, 0.75) 0%, rgba(234, 88, 12, 0.4) 45%, transparent 75%)',
                          }}
                        />
                        <div className="absolute top-2 right-2 bg-amber-500 text-black font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-lg flex items-center gap-1 border border-amber-300">
                          <Flame className="w-3 h-3 fill-black" />
                          <span>Project Clicks: {portfolioProjectStats.clicks} clicks ({portfolioProjectStats.pct}%)</span>
                        </div>
                      </div>
                    )}

                    {/* Lower Section: Outreach / Socials */}
                    {portfolioContactStats && (
                      <div
                        onMouseEnter={() => setActiveElementId('Socials & Outreach (a.contact-social)')}
                        onMouseLeave={() => setActiveElementId(null)}
                        className="absolute bottom-8 left-[15%] group cursor-pointer pointer-events-auto"
                      >
                        <div
                          className="w-48 h-12 rounded-xl blur-sm"
                          style={{
                            background:
                              'radial-gradient(circle, rgba(56, 189, 248, 0.7) 0%, rgba(59, 130, 246, 0.3) 50%, transparent 80%)',
                          }}
                        />
                        <span className="absolute -top-3 left-0 bg-blue-600 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md">
                          {portfolioContactStats.clicks} clicks ({portfolioContactStats.pct}%)
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Inspector Details Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 gap-2">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-orange-400 shrink-0" />
          <span>
            {activeElementId ? (
              <span className="text-white font-medium">
                Inspecting: <span className="text-orange-300 font-mono font-bold">{activeElementId}</span>
              </span>
            ) : (
              'Rendering actual deployed website. Toggle "Interactive" to browse the real page or "Inspector Mode" to examine hot spots.'
            )}
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] shrink-0">
          <span className="text-red-400 font-bold">&bull; Primary Goal CTA (Top Heat)</span>
          <span className="text-amber-400 font-bold">&bull; Secondary Engagement</span>
        </div>
      </div>
    </div>
  );
};
