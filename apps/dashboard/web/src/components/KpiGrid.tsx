import React from 'react';
import { Users, Eye, CheckCircle2, TrendingUp } from 'lucide-react';
import type { KpiMetrics } from '../data/metricsData';

interface KpiGridProps {
  kpi: KpiMetrics;
}

export const KpiGrid: React.FC<KpiGridProps> = ({ kpi }) => {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Key Performance Indicators">
      {/* 1. Unique Visitors */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 md:p-5 shadow-sm relative overflow-hidden backdrop-blur-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-1.5">
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            Unique Visitors
          </span>
          <span
            className={`font-semibold text-[11px] px-1.5 py-0.5 rounded ${
              kpi.visitorsTrend === '-' || !kpi.visitorsTrend
                ? 'text-slate-500 bg-slate-800/40'
                : 'text-emerald-400 bg-emerald-500/10'
            }`}
          >
            {kpi.visitorsTrend || '-'}
          </span>
        </div>
        <div className="text-2xl md:text-3xl font-bold tracking-tight text-white font-mono" data-testid="kpi-visitors">
          {kpi.visitors || '-'}
        </div>
        <p className="text-[11px] text-slate-400 mt-1">Unique client fingerprints</p>
      </div>

      {/* 2. Total Impressions */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 md:p-5 shadow-sm relative overflow-hidden backdrop-blur-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-1.5">
          <span className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-indigo-400" />
            Total Impressions
          </span>
          <span
            className={`font-semibold text-[11px] px-1.5 py-0.5 rounded ${
              kpi.pageviewsTrend === '-' || !kpi.pageviewsTrend
                ? 'text-slate-500 bg-slate-800/40'
                : 'text-emerald-400 bg-emerald-500/10'
            }`}
          >
            {kpi.pageviewsTrend || '-'}
          </span>
        </div>
        <div className="text-2xl md:text-3xl font-bold tracking-tight text-white font-mono" data-testid="kpi-pageviews">
          {kpi.pageviews || '-'}
        </div>
        <p className="text-[11px] text-slate-400 mt-1">Total pageviews &amp; reloads</p>
      </div>

      {/* 3. Key Conversion Actions */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 md:p-5 shadow-sm relative overflow-hidden backdrop-blur-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-1.5">
          <span className="flex items-center gap-1.5 truncate">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{kpi.actionLabel}</span>
          </span>
          <span
            className={`font-semibold text-[11px] px-1.5 py-0.5 rounded shrink-0 ${
              kpi.actions === '-'
                ? 'text-slate-500 bg-slate-800/40'
                : 'text-indigo-400 bg-indigo-500/10'
            }`}
          >
            {kpi.actions === '-' ? '-' : 'Goals'}
          </span>
        </div>
        <div className="text-2xl md:text-3xl font-bold tracking-tight text-white font-mono" data-testid="kpi-actions">
          {kpi.actions || '-'}
        </div>
        <p className="text-[11px] text-slate-400 mt-1 truncate">{kpi.actionSub || '-'}</p>
      </div>

      {/* 4. Engagement / Completion */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 md:p-5 shadow-sm relative overflow-hidden backdrop-blur-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-1.5">
          <span className="flex items-center gap-1.5 truncate">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{kpi.engLabel}</span>
          </span>
          <span
            className={`font-semibold text-[11px] px-1.5 py-0.5 rounded shrink-0 ${
              kpi.engRate === '-'
                ? 'text-slate-500 bg-slate-800/40'
                : 'text-emerald-400 bg-emerald-500/10'
            }`}
          >
            {kpi.engRate === '-' ? '-' : 'Rate'}
          </span>
        </div>
        <div className="text-2xl md:text-3xl font-bold tracking-tight text-white font-mono" data-testid="kpi-eng-rate">
          {kpi.engRate || '-'}
        </div>
        <p className="text-[11px] text-slate-400 mt-1 truncate">{kpi.engSub || '-'}</p>
      </div>
    </section>
  );
};
