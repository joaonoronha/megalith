"use client";

import React, { useState, useId } from "react";
import Link from "next/link";
import { TrendingUp, Sparkles, CheckCircle2 } from "lucide-react";
import {
  CompletedEventFinancial,
  MonthlyTrajectoryItem,
} from "@/lib/profit-trajectory";

interface CompletedEventsProfitChartProps {
  totalProfit: number;
  totalRevenue: number;
  totalCosts: number;
  avgMargin: string;
  events: CompletedEventFinancial[];
  monthlyTrajectory: MonthlyTrajectoryItem[];
  onSelectEvent?: (eventId: string) => void;
  onNavigateFinance?: (e: React.MouseEvent) => void;
}

export default function CompletedEventsProfitChart({
  totalProfit,
  totalRevenue,
  totalCosts,
  avgMargin,
  events,
  monthlyTrajectory,
  onSelectEvent,
  onNavigateFinance,
}: CompletedEventsProfitChartProps) {
  const [hoveredEvent, setHoveredEvent] =
    useState<CompletedEventFinancial | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null
  );

  const gradientId = useId();

  // Chart dimensions
  const svgWidth = 560;
  const svgHeight = 200;
  const padding = { top: 26, right: 28, bottom: 42, left: 52 };
  const innerWidth = svgWidth - padding.left - padding.right;
  const innerHeight = svgHeight - padding.top - padding.bottom;

  // Calculate scales
  const allProfits = [
    ...monthlyTrajectory.map((m) => m.monthlyProfit),
    ...events.map((e) => e.profit),
  ];
  const maxVal = Math.max(1000, ...allProfits, totalProfit > 0 ? 1000 : 0) * 1.18;
  const minVal = Math.min(0, ...allProfits);
  const valRange = maxVal - minVal || 1;

  const getY = (val: number) => {
    const ratio = (val - minVal) / valRange;
    return padding.top + innerHeight - ratio * innerHeight;
  };

  const M = monthlyTrajectory.length;
  const slotWidth = M > 0 ? innerWidth / M : innerWidth;

  // Points for monthly trajectory line
  const monthlyPoints = monthlyTrajectory.map((m, i) => {
    const x = padding.left + i * slotWidth + slotWidth / 2;
    const y = getY(m.monthlyProfit);
    return { x, y, month: m };
  });

  // SVG path generation
  let linePath = "";
  let areaPath = "";

  if (monthlyPoints.length === 1) {
    const p = monthlyPoints[0];
    const leftX = padding.left + slotWidth * 0.15;
    const rightX = padding.left + slotWidth * 0.85;
    linePath = `M ${leftX} ${p.y} L ${rightX} ${p.y}`;
    areaPath = `M ${leftX} ${p.y} L ${rightX} ${p.y} L ${rightX} ${
      padding.top + innerHeight
    } L ${leftX} ${padding.top + innerHeight} Z`;
  } else if (monthlyPoints.length > 1) {
    // Generate smooth bezier curve across monthly points
    linePath = `M ${monthlyPoints[0].x} ${monthlyPoints[0].y}`;
    for (let i = 0; i < monthlyPoints.length - 1; i++) {
      const p0 = monthlyPoints[i];
      const p1 = monthlyPoints[i + 1];
      const cx = (p0.x + p1.x) / 2;
      linePath += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const first = monthlyPoints[0];
    const last = monthlyPoints[monthlyPoints.length - 1];
    areaPath = `${linePath} L ${last.x} ${padding.top + innerHeight} L ${
      first.x
    } ${padding.top + innerHeight} Z`;
  }

  // Horizontal guide line ticks
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount }).map((_, i) => {
    const val = minVal + (valRange / (tickCount - 1)) * i;
    return {
      val,
      y: getY(val),
      label:
        val >= 1000
          ? `€${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`
          : `€${Math.round(val)}`,
    };
  });

  return (
    <div className="bg-white border border-[#ececf0] rounded-[22px] p-5 sm:p-6 shadow-[0_1px_0_rgba(0,0,0,0.02)] space-y-4 relative">
      {/* Head */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1 border-b border-[#ececf0]/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[18px] font-bold tracking-[-0.35px] text-[#111111]">
              Resumo financeiro
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#eaf8ee] text-[#217a3b] border border-[#217a3b]/20 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Eventos concluídos</span>
            </span>
          </div>
          <div className="text-[12px] text-[#8e8e93] mt-0.5">
            Lucro atual apurado com base em eventos passados finalizados
          </div>
        </div>

        <Link
          href="/financas"
          onClick={onNavigateFinance}
          className="text-[13px] font-semibold text-[#007aff] hover:underline cursor-pointer flex items-center gap-1 self-start sm:self-auto"
        >
          <span>Ver detalhe financeiro</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>

      {/* Main Content Grid: Total Profit Left + Line Chart Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* Left Column: Cumulative Profit Number & Breakdown */}
        <div className="lg:col-span-4 flex flex-col justify-between self-stretch bg-[#f8f8fa] border border-[#ececf0] rounded-[18px] p-4 sm:p-5">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8e8e93]">
              Lucro Total Acumulado
            </div>
            <div className="text-[32px] sm:text-[38px] font-extrabold tracking-[-1px] text-[#111111] leading-tight my-1.5">
              €{totalProfit.toLocaleString("pt-PT")}
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-[#217a3b] font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>
                {events.length} {events.length === 1 ? "evento realizado" : "eventos realizados com sucesso"}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-black/[0.06] space-y-2 text-[12px]">
            <div className="flex items-center justify-between text-[#636366]">
              <span>Faturação total:</span>
              <strong className="text-[#111111] font-semibold">
                €{totalRevenue.toLocaleString("pt-PT")}
              </strong>
            </div>
            <div className="flex items-center justify-between text-[#636366]">
              <span>Custos / orçamentos:</span>
              <strong className="text-[#b04a3f] font-semibold">
                €{totalCosts.toLocaleString("pt-PT")}
              </strong>
            </div>
            <div className="flex items-center justify-between text-[#636366] pt-1 border-t border-black/[0.04]">
              <span>Margem média de lucro:</span>
              <strong className="text-[#217a3b] font-bold">
                {avgMargin}%
              </strong>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Line Chart */}
        <div className="lg:col-span-8 relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-[#111111]">
                Trajetória Mensal de Lucros
              </span>
              <span className="text-[11px] text-[#8e8e93]">
                ({monthlyTrajectory.length} {monthlyTrajectory.length === 1 ? "mês apurado" : "meses apurados"})
              </span>
            </div>

            {/* Legend */}
            <div className="hidden sm:flex items-center gap-3 text-[11px] text-[#8e8e93]">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#10b981] rounded-full inline-block"></span>
                <span>Lucro mensal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full border-2 border-[#10b981] bg-white inline-block"></span>
                <span>Ponto = Evento individual</span>
              </div>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="h-[200px] rounded-[16px] bg-[#f8f8fa] border border-[#ececf0] flex flex-col items-center justify-center p-6 text-center">
              <Sparkles className="w-6 h-6 text-[#8e8e93] mb-2" />
              <div className="text-[13px] font-semibold text-[#111111]">
                Sem eventos concluídos registados
              </div>
              <div className="text-[12px] text-[#8e8e93] max-w-sm mt-1">
                Quando os eventos passarem para o estado "Concluído", a evolução mensal e o lucro individual por evento surgirão aqui.
              </div>
            </div>
          ) : (
            <div
              className="relative w-full rounded-[16px] bg-[#fafafc] border border-[#ececf0]/70 p-2 sm:p-3 overflow-hidden"
              onMouseLeave={() => setHoveredEvent(null)}
            >
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-[180px] sm:h-[200px] overflow-visible select-none"
              >
                <defs>
                  <linearGradient
                    id={gradientId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Guide Lines & Y Labels */}
                {ticks.map((t, idx) => (
                  <g key={idx}>
                    <line
                      x1={padding.left}
                      y1={t.y}
                      x2={svgWidth - padding.right}
                      y2={t.y}
                      stroke="#e5e5ea"
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                    <text
                      x={padding.left - 8}
                      y={t.y + 3.5}
                      textAnchor="end"
                      fontSize="10"
                      fill="#8e8e93"
                      fontWeight="500"
                    >
                      {t.label}
                    </text>
                  </g>
                ))}

                {/* Month Column Dividers & Labels */}
                {monthlyTrajectory.map((m, i) => {
                  const x = padding.left + i * slotWidth;
                  const centerX = x + slotWidth / 2;
                  const isHoveredMonth =
                    hoveredEvent && hoveredEvent.monthKey === m.monthKey;

                  return (
                    <g key={m.monthKey}>
                      {i > 0 && (
                        <line
                          x1={x}
                          y1={padding.top}
                          x2={x}
                          y2={padding.top + innerHeight}
                          stroke="#ececf0"
                          strokeWidth="1"
                        />
                      )}

                      {/* Month Column Highlight on Hover */}
                      {isHoveredMonth && (
                        <rect
                          x={x}
                          y={padding.top}
                          width={slotWidth}
                          height={innerHeight}
                          fill="#10b981"
                          fillOpacity="0.04"
                        />
                      )}

                      {/* Month Label */}
                      <text
                        x={centerX}
                        y={svgHeight - 16}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="600"
                        fill={isHoveredMonth ? "#111111" : "#636366"}
                      >
                        {m.monthLabel}
                      </text>

                      {/* Month Profit Sub-label */}
                      <text
                        x={centerX}
                        y={svgHeight - 4}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="700"
                        fill="#10b981"
                      >
                        €{m.monthlyProfit.toLocaleString("pt-PT")}
                      </text>
                    </g>
                  );
                })}

                {/* Shaded Area Under Monthly Trajectory */}
                {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

                {/* Monthly Trajectory Line */}
                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Event Individual Points */}
                {monthlyTrajectory.flatMap((month, monthIdx) => {
                  const monthLeft = padding.left + monthIdx * slotWidth;
                  const K = month.events.length;

                  return month.events.map((ev, k) => {
                    const eventX =
                      K === 1
                        ? monthLeft + slotWidth / 2
                        : monthLeft + ((k + 1) / (K + 1)) * slotWidth;
                    const eventY = getY(ev.profit);
                    const isHovered = hoveredEvent?.id === ev.id;

                    return (
                      <g
                        key={ev.id}
                        className="cursor-pointer transition-transform"
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget
                            .closest("div")
                            ?.getBoundingClientRect();
                          if (rect) {
                            setTooltipPos({
                              x: (eventX / svgWidth) * rect.width,
                              y: (eventY / svgHeight) * rect.height,
                            });
                          }
                          setHoveredEvent(ev);
                        }}
                        onClick={() => {
                          if (onSelectEvent) {
                            onSelectEvent(ev.id);
                          }
                        }}
                      >
                        {/* Vertical Stem Line from baseline to event point */}
                        <line
                          x1={eventX}
                          y1={eventY}
                          x2={eventX}
                          y2={padding.top + innerHeight}
                          stroke={isHovered ? "#10b981" : "#d1d1d6"}
                          strokeWidth={isHovered ? "1.5" : "1"}
                          strokeDasharray={isHovered ? "none" : "2 2"}
                        />

                        {/* Large Invisible Hover Target for easy touching/mouse hit */}
                        <circle
                          cx={eventX}
                          cy={eventY}
                          r="16"
                          fill="transparent"
                        />

                        {/* Pulsing ring when hovered */}
                        {isHovered && (
                          <circle
                            cx={eventX}
                            cy={eventY}
                            r="11"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2"
                            strokeOpacity="0.4"
                            className="animate-ping"
                          />
                        )}

                        {/* Outer Glow / Ring */}
                        <circle
                          cx={eventX}
                          cy={eventY}
                          r={isHovered ? "7" : "5"}
                          fill={isHovered ? "#10b981" : "#ffffff"}
                          stroke="#10b981"
                          strokeWidth={isHovered ? "2.5" : "2"}
                          filter={
                            isHovered
                              ? "drop-shadow(0 2px 4px rgba(16,185,129,0.4))"
                              : "none"
                          }
                        />

                        {/* Center core */}
                        {isHovered && (
                          <circle
                            cx={eventX}
                            cy={eventY}
                            r="2.5"
                            fill="#ffffff"
                          />
                        )}
                      </g>
                    );
                  });
                })}
              </svg>

              {/* Floating Tooltip */}
              {hoveredEvent && tooltipPos && (
                <div
                  className="absolute pointer-events-none z-30 transition-all duration-150 ease-out"
                  style={{
                    left: `${Math.min(
                      Math.max(tooltipPos.x, 120),
                      520
                    )}px`,
                    top: `${Math.max(tooltipPos.y - 10, 10)}px`,
                    transform: "translate(-50%, -100%)",
                  }}
                >
                  <div className="bg-[#1c1c1e] text-white rounded-[14px] p-3 shadow-2xl border border-white/10 w-64 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
                      <span className="font-bold text-white text-[13px] truncate">
                        {hoveredEvent.name}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between pt-0.5">
                      <span className="text-white/60 text-[11px]">
                        Lucro do evento:
                      </span>
                      <span
                        className={`text-[15px] font-extrabold ${
                          hoveredEvent.profit >= 0
                            ? "text-[#34c759]"
                            : "text-[#ff453a]"
                        }`}
                      >
                        {hoveredEvent.profit >= 0 ? "+" : ""}€
                        {hoveredEvent.profit.toLocaleString("pt-PT")}
                      </span>
                    </div>

                    <div className="text-[11px] text-white/70 space-y-0.5 pt-0.5">
                      <div className="flex justify-between">
                        <span>Faturação:</span>
                        <strong className="text-white font-semibold">
                          €{hoveredEvent.revenue.toLocaleString("pt-PT")}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Custos:</span>
                        <strong className="text-white font-semibold">
                          €{hoveredEvent.costs.toLocaleString("pt-PT")}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Margem:</span>
                        <strong className="text-[#34c759] font-bold">
                          {hoveredEvent.margin.toFixed(1)}%
                        </strong>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] text-white/50">
                      <span>{hoveredEvent.formattedDate}</span>
                      <span className="text-[#0a84ff] font-medium">
                        Clique para abrir ↗
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
