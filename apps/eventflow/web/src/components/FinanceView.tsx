"use client";

import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  Wallet,
  Trophy,
  Clock,
  Check,
  ChevronDown,
  X,
  Trash2,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { countsForFinance, isCancelledEvent } from "@/lib/events";

interface FinanceViewProps {
  events: any[];
  items: any[];
  movements: any[];
  allocations: any[];
  clients: any[];
  quotes: any[];
  onAddMovement: (formData: FormData) => Promise<any>;
  onDeleteMovement: (id: string) => Promise<any>;
  onOpenItemWizard?: () => void;
  onOpenMovementModal?: () => void;
  onNavigateToEvents?: () => void;
}

export default function FinanceView({
  events = [],
  items = [],
  movements = [],
  allocations = [],
  clients = [],
  quotes = [],
  onAddMovement,
  onDeleteMovement,
  onOpenItemWizard,
  onOpenMovementModal,
  onNavigateToEvents,
}: FinanceViewProps) {
  // Period filter: 6months, 3months, thisMonth, year, all
  const [selectedPeriod, setSelectedPeriod] = useState<string>("6months");

  // Hovered month on the SVG chart for tooltips
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  // Modal for breakdown
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [movementToDelete, setMovementToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Format currency in Portuguese style
  const formatEuro = (val: number, includeDecimals = false) => {
    return (
      "€" +
      Number(val || 0).toLocaleString("pt-PT", {
        minimumFractionDigits: includeDecimals ? 2 : 0,
        maximumFractionDigits: includeDecimals ? 2 : 0,
      })
    );
  };

  // Filter valid events and movements
  const activeEvents = useMemo(() => {
    return (events || []).filter((e) => countsForFinance(e) && !isCancelledEvent(e));
  }, [events]);

  const activeMovements = useMemo(() => movements || [], [movements]);

  // Date filtering helper
  const now = useMemo(() => new Date(), []);

  const isWithinPeriod = (dateStr: string | Date | null | undefined): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;

    if (selectedPeriod === "all") return true;

    if (selectedPeriod === "thisMonth") {
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth()
      );
    }

    if (selectedPeriod === "year") {
      return d.getFullYear() === now.getFullYear();
    }

    if (selectedPeriod === "3months") {
      const past3 = new Date(now);
      past3.setMonth(now.getMonth() - 3);
      return d >= past3;
    }

    // Default: 6months
    const past6 = new Date(now);
    past6.setMonth(now.getMonth() - 6);
    return d >= past6;
  };

  // Filter events and movements by selected period
  const filteredEvents = useMemo(() => {
    return activeEvents.filter((e) => isWithinPeriod(e.startDate));
  }, [activeEvents, selectedPeriod]);

  const filteredMovements = useMemo(() => {
    return activeMovements.filter((m) => isWithinPeriod(m.date));
  }, [activeMovements, selectedPeriod]);

  // Totals calculations (Strictly from real data, zero mocks)
  const totals = useMemo(() => {
    const totalEntradas = filteredMovements
      .filter((m) => m.type === "entrada")
      .reduce((sum, m) => sum + Number(m.amount || 0), 0);

    const totalSaidas = filteredMovements
      .filter((m) => m.type === "saida" || m.type === "investimento")
      .reduce((sum, m) => sum + Number(m.amount || 0), 0);

    const totalFaturadoEventos = filteredEvents.reduce(
      (sum, e) => sum + (Number(e.customerPrice) || 0),
      0
    );

    const totalOrcadoEventos = filteredEvents.reduce(
      (sum, e) => sum + (Number(e.totalBudget) || 0),
      0
    );

    // If movements exist, revenue/expenses are actual cash flows; otherwise fallback to contracted events totals
    const revenue = totalEntradas > 0 ? totalEntradas : totalFaturadoEventos;
    const expenses = totalSaidas > 0 ? totalSaidas : totalOrcadoEventos;
    const profit = revenue - expenses;

    // Previous period profit for MoM growth calculation
    let prevPeriodRevenue = 0;
    let prevPeriodExpenses = 0;

    if (selectedPeriod === "6months" || selectedPeriod === "3months" || selectedPeriod === "thisMonth") {
      const monthsSpan = selectedPeriod === "thisMonth" ? 1 : selectedPeriod === "3months" ? 3 : 6;
      const prevEnd = new Date(now);
      prevEnd.setMonth(now.getMonth() - monthsSpan);
      const prevStart = new Date(prevEnd);
      prevStart.setMonth(prevEnd.getMonth() - monthsSpan);

      const prevMovs = activeMovements.filter((m) => {
        if (!m.date) return false;
        const d = new Date(m.date);
        return d >= prevStart && d < prevEnd;
      });

      const prevEntradas = prevMovs
        .filter((m) => m.type === "entrada")
        .reduce((sum, m) => sum + Number(m.amount || 0), 0);

      const prevSaidas = prevMovs
        .filter((m) => m.type === "saida" || m.type === "investimento")
        .reduce((sum, m) => sum + Number(m.amount || 0), 0);

      prevPeriodRevenue = prevEntradas;
      prevPeriodExpenses = prevSaidas;
    }

    const prevProfit = prevPeriodRevenue - prevPeriodExpenses;
    let profitGrowthPct: number | null = null;
    if (prevProfit > 0 && profit !== 0) {
      profitGrowthPct = Math.round(((profit - prevProfit) / prevProfit) * 100);
    }

    // Money to receive: contracted revenue - received entries
    const moneyToReceive = Math.max(0, totalFaturadoEventos - totalEntradas);

    // Overdue vs Upcoming: based on event end date
    let overdue = 0;
    let upcoming = 0;

    filteredEvents.forEach((ev) => {
      const price = Number(ev.customerPrice) || 0;
      const evEntradas = activeMovements
        .filter((m) => m.eventId === ev.id && m.type === "entrada")
        .reduce((sum, m) => sum + Number(m.amount || 0), 0);

      const pending = Math.max(0, price - evEntradas);
      if (pending > 0) {
        const evDate = new Date(ev.endDate || ev.startDate);
        if (evDate < now) {
          overdue += pending;
        } else {
          upcoming += pending;
        }
      }
    });

    const hasData = filteredMovements.length > 0 || filteredEvents.length > 0;

    return {
      hasData,
      profit,
      profitGrowthPct,
      revenue,
      expenses,
      moneyToReceive,
      overdue,
      upcoming,
    };
  }, [filteredMovements, filteredEvents, activeMovements, selectedPeriod, now]);

  // Monthly trajectory chart points calculated dynamically from real data
  const chartData = useMemo(() => {
    // Collect the past 6 months chronologically
    const months: { key: string; label: string; year: number; month: number }[] = [];
    const ptMonths = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, "0")}`;
      months.push({ key, label: ptMonths[month], year, month });
    }

    let totalPointsWithData = 0;

    const data = months.map((m) => {
      const mMovements = activeMovements.filter((mov) => {
        if (!mov.date) return false;
        const d = new Date(mov.date);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      });

      const mEvents = activeEvents.filter((ev) => {
        if (!ev.startDate) return false;
        const d = new Date(ev.startDate);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      });

      const entradas = mMovements
        .filter((mov) => mov.type === "entrada")
        .reduce((sum, mov) => sum + Number(mov.amount || 0), 0);

      const saidas = mMovements
        .filter((mov) => mov.type === "saida" || mov.type === "investimento")
        .reduce((sum, mov) => sum + Number(mov.amount || 0), 0);

      const eventRevenue = mEvents.reduce((sum, e) => sum + (Number(e.customerPrice) || 0), 0);
      const eventExpenses = mEvents.reduce((sum, e) => sum + (Number(e.totalBudget) || 0), 0);

      const revenue = entradas > 0 ? entradas : eventRevenue;
      const expenses = saidas > 0 ? saidas : eventExpenses;

      if (revenue > 0 || expenses > 0) {
        totalPointsWithData++;
      }

      return {
        month: m.label,
        revenue,
        expenses,
      };
    });

    return {
      points: data,
      hasEnoughData: totalPointsWithData >= 2,
    };
  }, [activeMovements, activeEvents, now]);

  // Dynamic maximum scale for SVG chart
  const maxChartVal = useMemo(() => {
    let max = 10000;
    chartData.points.forEach((p) => {
      if (p.revenue > max) max = p.revenue;
      if (p.expenses > max) max = p.expenses;
    });
    return Math.ceil((max * 1.15) / 10000) * 10000;
  }, [chartData]);

  const getY = (val: number) => {
    const topY = 20;
    const bottomY = 180;
    return bottomY - (val / (maxChartVal || 1)) * (bottomY - topY);
  };

  const getX = (idx: number) => {
    const startX = 65;
    const endX = 720;
    const step = (endX - startX) / (chartData.points.length - 1 || 1);
    return startX + idx * step;
  };

  // Build smooth Bézier SVG curve path
  const buildSmoothPath = (values: number[]) => {
    const points = values.map((val, idx) => ({ x: getX(idx), y: getY(val) }));
    if (points.length === 0) return "";
    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  const revenuePath = useMemo(
    () => buildSmoothPath(chartData.points.map((d) => d.revenue)),
    [chartData, maxChartVal]
  );
  const expensesPath = useMemo(
    () => buildSmoothPath(chartData.points.map((d) => d.expenses)),
    [chartData, maxChartVal]
  );

  // Real expense categories breakdown
  const categoryBreakdown = useMemo(() => {
    const groups: Record<string, number> = {};
    filteredMovements
      .filter((m) => m.type === "saida" || m.type === "investimento")
      .forEach((m) => {
        const cat = m.category || "Outros";
        groups[cat] = (groups[cat] || 0) + Number(m.amount || 0);
      });

    const totalExp = Object.values(groups).reduce((a, b) => a + b, 0);

    if (totalExp > 0) {
      return Object.entries(groups)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, amount]) => ({
          name,
          amount,
          pct: Math.round((amount / totalExp) * 100),
        }));
    }

    return [];
  }, [filteredMovements]);

  // Real events performance breakdown
  const eventsPerformance = useMemo(() => {
    if (filteredEvents.length === 0) return [];

    return filteredEvents.slice(0, 6).map((ev) => {
      const price = Number(ev.customerPrice) || 0;
      const budget = Number(ev.totalBudget) || 0;
      const profit = price - budget;
      return {
        id: ev.id,
        name: ev.name,
        profit,
        isProfit: profit >= 0,
      };
    });
  }, [filteredEvents]);

  const profitableEventsCount = eventsPerformance.filter((e) => e.isProfit).length;
  const totalEventsCount = filteredEvents.length;

  const handleDeleteConfirm = async () => {
    if (!movementToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await onDeleteMovement(movementToDelete.id);
      if (res && res.success) {
        setMovementToDelete(null);
      } else {
        setDeleteError(res?.error || "Erro ao remover.");
      }
    } catch (err: any) {
      setDeleteError(err?.message || "Erro inesperado ao remover.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      {/* ========================================================= */}
      {/* 1. HEADER (ICON, TITLE, SUBTITLE & PERIOD SELECTOR ON RIGHT) */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-3.5">
          {/* Blue Rounded Icon with 3 bar chart bars */}
          <div className="w-12 h-12 rounded-[16px] bg-[#e6f0ff] flex items-center justify-center shrink-0">
            <svg
              className="w-6 h-6 text-[#007aff]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="3" y="10" width="4" height="11" rx="2" />
              <rect x="10" y="5" width="4" height="16" rx="2" />
              <rect x="17" y="13" width="4" height="8" rx="2" />
            </svg>
          </div>
          <div>
            <h1 className="text-[26px] sm:text-[28px] font-bold text-[#111111] tracking-[-0.02em] leading-tight">
              Finanças
            </h1>
            <p className="text-xs sm:text-[13px] text-[#8e8e93]">
              O seu negócio num relance
            </p>
          </div>
        </div>

        {/* Date picker on the right (Buttons removed) */}
        <div className="relative self-start sm:self-auto">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="appearance-none bg-white border border-[#ececf0] rounded-[12px] pl-3.5 pr-8 py-2 text-xs font-semibold text-[#111111] shadow-2xs hover:bg-[#fafafc] focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 cursor-pointer"
          >
            <option value="6months">Últimos 6 meses</option>
            <option value="3months">Últimos 3 meses</option>
            <option value="thisMonth">Este mês</option>
            <option value="year">Este ano</option>
            <option value="all">Todo o histórico</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#8e8e93] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. CARD: RESUMO PRINCIPAL DO NEGÓCIO */}
      {/* ========================================================= */}
      <section className="bg-white border border-[#ececf0] rounded-[24px] p-6 sm:p-7 shadow-xs relative overflow-hidden">
        {/* Top row: Status indicator & decorative trend */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-9 h-9 rounded-full text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${
                totals.profit >= 0 ? "bg-[#10b981]" : "bg-[#ef4444]"
              }`}
            >
              {totals.profit >= 0 ? (
                <Check className="w-5 h-5 stroke-[2.75]" />
              ) : (
                <AlertCircle className="w-5 h-5 stroke-[2.75]" />
              )}
            </div>
            <div>
              <h2 className="text-[18px] sm:text-[19px] font-bold text-[#111111] tracking-[-0.01em]">
                {totals.profit >= 0
                  ? "O seu negócio está a correr bem!"
                  : "Atenção ao saldo operacional"}
              </h2>
              <p className="text-xs sm:text-[13px] text-[#8e8e93] mt-0.5">
                {totals.profitGrowthPct !== null
                  ? totals.profitGrowthPct >= 0
                    ? `Está a gerar +${totals.profitGrowthPct}% de lucro em relação ao período anterior.`
                    : `${totals.profitGrowthPct}% de lucro em relação ao período anterior.`
                  : totals.hasData
                  ? "Balanço calculado com base nos eventos e movimentos registados."
                  : "Sem dados suficientes registados para o período selecionado."}
              </p>
            </div>
          </div>

          {/* Decorative Trend Badge */}
          {totals.hasData && totals.profit >= 0 && (
            <div className="hidden sm:flex items-center justify-center w-28 h-12 rounded-full bg-[#e8f7ee] p-2 shrink-0">
              <svg
                className="w-20 h-8 text-[#10b981]"
                viewBox="0 0 80 32"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M 6 24 L 24 18 L 40 22 L 56 12 L 72 4"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M 60 4 L 72 4 L 72 16"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
        </div>

        {/* 3 Metric Columns with Dividers */}
        <div className="mt-7 pt-6 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#ececf0] gap-4 sm:gap-0">
          {/* Column 1: Money made (profit) */}
          <div className="sm:pr-6">
            <div className="text-xs font-medium text-[#6e6e73]">
              Lucro líquido (ganho)
            </div>
            <div
              className={`text-[32px] sm:text-[36px] font-extrabold tracking-tight leading-none mt-1.5 mb-1.5 ${
                totals.profit >= 0 ? "text-[#00875a]" : "text-[#ef4444]"
              }`}
            >
              {totals.profit >= 0
                ? formatEuro(totals.profit)
                : `-${formatEuro(Math.abs(totals.profit))}`}
            </div>
            {totals.profitGrowthPct !== null ? (
              <div
                className={`text-xs font-semibold flex items-center gap-1 ${
                  totals.profitGrowthPct >= 0 ? "text-[#00875a]" : "text-[#ef4444]"
                }`}
              >
                <span>{totals.profitGrowthPct >= 0 ? "↑" : "↓"}</span>
                <span>
                  {Math.abs(totals.profitGrowthPct)}% vs período anterior
                </span>
              </div>
            ) : (
              <div className="text-[11px] text-[#8e8e93]">
                {totals.hasData ? "Período base" : "Sem dados anteriores"}
              </div>
            )}
          </div>

          {/* Column 2: Money earned (revenue) */}
          <div className="pt-4 sm:pt-0 sm:px-6">
            <div className="text-xs font-medium text-[#6e6e73]">
              Receita total (faturado)
            </div>
            <div className="text-[32px] sm:text-[36px] font-extrabold text-[#111111] tracking-tight leading-none mt-1.5">
              {formatEuro(totals.revenue)}
            </div>
          </div>

          {/* Column 3: Money spent (expenses) */}
          <div className="pt-4 sm:pt-0 sm:pl-6">
            <div className="text-xs font-medium text-[#6e6e73]">
              Total de despesas
            </div>
            <div className="text-[32px] sm:text-[36px] font-extrabold text-[#111111] tracking-tight leading-none mt-1.5">
              {formatEuro(totals.expenses)}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3. CARD: "Estamos a melhorar?" (CHART & CALLOUT) */}
      {/* ========================================================= */}
      <section className="bg-white border border-[#ececf0] rounded-[24px] p-6 sm:p-7 shadow-xs space-y-6">
        {/* Header with Title and Legend */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <svg
              className="w-5 h-5 text-[#007aff]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
            <h2 className="text-[18px] sm:text-[19px] font-bold text-[#111111] tracking-[-0.01em]">
              Estamos a melhorar?
            </h2>
          </div>

          {chartData.hasEnoughData && (
            <div className="flex items-center gap-4 text-xs font-medium text-[#4b5563]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#007aff]" />
                <span>Receita</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7]" />
                <span>Despesas</span>
              </div>
            </div>
          )}
        </div>

        {/* Chart SVG or Empty State */}
        {chartData.hasEnoughData ? (
          <div className="w-full relative">
            <svg
              className="w-full h-56 sm:h-64 overflow-visible"
              viewBox="0 0 760 220"
            >
              {/* Horizontal Grid lines */}
              {[maxChartVal, Math.round(maxChartVal * 0.66), Math.round(maxChartVal * 0.33), 0].map(
                (val) => {
                  const y = getY(val);
                  return (
                    <g key={val}>
                      <line
                        x1="45"
                        y1={y}
                        x2="745"
                        y2={y}
                        stroke="#f0f0f4"
                        strokeWidth="1"
                      />
                      <text
                        x="35"
                        y={y + 4}
                        textAnchor="end"
                        className="text-[11px] fill-[#9ca3af] font-sans font-medium"
                      >
                        {val === 0 ? "€0" : `€${Math.round(val / 1000)}k`}
                      </text>
                    </g>
                  );
                }
              )}

              {/* Blue line: Revenue */}
              <path
                d={revenuePath}
                fill="none"
                stroke="#007aff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Purple line: Expenses */}
              <path
                d={expensesPath}
                fill="none"
                stroke="#a855f7"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Revenue Circles */}
              {chartData.points.map((d, idx) => {
                const cx = getX(idx);
                const cy = getY(d.revenue);
                return (
                  <circle
                    key={`rev-${idx}`}
                    cx={cx}
                    cy={cy}
                    r={hoveredPoint === idx ? "6" : "4"}
                    fill="#007aff"
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="transition-all cursor-pointer"
                    onMouseEnter={() => setHoveredPoint(idx)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                );
              })}

              {/* Expenses Circles */}
              {chartData.points.map((d, idx) => {
                const cx = getX(idx);
                const cy = getY(d.expenses);
                return (
                  <circle
                    key={`exp-${idx}`}
                    cx={cx}
                    cy={cy}
                    r={hoveredPoint === idx ? "6" : "4"}
                    fill="#a855f7"
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="transition-all cursor-pointer"
                    onMouseEnter={() => setHoveredPoint(idx)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                );
              })}

              {/* X-axis Month Labels */}
              {chartData.points.map((d, idx) => {
                const cx = getX(idx);
                return (
                  <text
                    key={`month-${idx}`}
                    x={cx}
                    y="208"
                    textAnchor="middle"
                    className="text-[12px] fill-[#6b7280] font-sans font-medium"
                  >
                    {d.month}
                  </text>
                );
              })}
            </svg>

            {/* Interactive hover tooltip */}
            {hoveredPoint !== null && (
              <div
                className="absolute pointer-events-none bg-[#111111] text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-lg transform -translate-x-1/2 -translate-y-full z-10 space-y-0.5"
                style={{
                  left: `${(getX(hoveredPoint) / 760) * 100}%`,
                  top: `${(getY(chartData.points[hoveredPoint].revenue) / 220) * 100}%`,
                  marginTop: "-12px",
                }}
              >
                <div className="font-bold text-white border-b border-white/20 pb-0.5">
                  {chartData.points[hoveredPoint].month}
                </div>
                <div className="text-[#60a5fa]">
                  Receita: {formatEuro(chartData.points[hoveredPoint].revenue)}
                </div>
                <div className="text-[#c084fc]">
                  Despesas: {formatEuro(chartData.points[hoveredPoint].expenses)}
                </div>
                <div className="text-[#4ade80] font-semibold">
                  Lucro:{" "}
                  {chartData.points[hoveredPoint].revenue >=
                  chartData.points[hoveredPoint].expenses
                    ? `+${formatEuro(
                        chartData.points[hoveredPoint].revenue -
                          chartData.points[hoveredPoint].expenses
                      )}`
                    : `-${formatEuro(
                        chartData.points[hoveredPoint].expenses -
                          chartData.points[hoveredPoint].revenue
                      )}`}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 px-4 rounded-[16px] bg-[#f8f8fa] border border-[#ececf0] text-center space-y-1.5">
            <p className="text-sm font-semibold text-[#111111]">
              Não existem dados suficientes para apresentar o gráfico evolutivo.
            </p>
            <p className="text-xs text-[#8e8e93]">
              Registe movimentos de caixa ou conclua eventos em meses consecutivos para acompanhar a evolução.
            </p>
          </div>
        )}

        {/* Good News / Status Callout Banner */}
        {chartData.hasEnoughData ? (
          <div className="bg-[#eaf8ee] border border-[#cbeed4]/70 rounded-[16px] p-3.5 sm:p-4 flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-[#10b981] text-white flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <p className="text-xs sm:text-[13px] font-semibold text-[#166534]">
              {totals.profit >= 0
                ? "Boas notícias! Está a faturar mais enquanto mantém as despesas controladas."
                : "Acompanhe de perto as saídas de caixa para restaurar a margem positiva."}
            </p>
          </div>
        ) : null}
      </section>

      {/* ========================================================= */}
      {/* 4. TWO-COLUMN SECTION */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Card: "Para onde vai o dinheiro?" */}
        <section className="bg-white border border-[#ececf0] rounded-[24px] p-6 sm:p-7 shadow-xs flex flex-col justify-between">
          <div>
            {/* Header with Blue Wallet Icon */}
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-7 h-7 rounded-[10px] bg-[#e6f0ff] text-[#007aff] flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <h3 className="text-[17px] sm:text-[18px] font-bold text-[#111111] tracking-[-0.01em]">
                Para onde vai o dinheiro?
              </h3>
            </div>

            {/* Categories with Horizontal Progress Bars */}
            {categoryBreakdown.length > 0 ? (
              <div className="space-y-4 my-2">
                {categoryBreakdown.map((cat, idx) => (
                  <div
                    key={cat.name}
                    className="flex items-center justify-between gap-3 text-xs sm:text-sm"
                  >
                    <span className="font-medium text-[#374151] w-32 sm:w-36 shrink-0 truncate">
                      {cat.name}
                    </span>

                    {/* Horizontal Bar */}
                    <div className="flex-1 h-2.5 bg-[#f0f0f4] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(5, Math.min(100, cat.pct))}%`,
                          backgroundColor:
                            idx === 0
                              ? "#0d9488"
                              : idx === 1
                              ? "#0f766e"
                              : idx === 2
                              ? "#14b8a6"
                              : "#2dd4bf",
                        }}
                      />
                    </div>

                    <span className="font-medium text-[#111111] shrink-0 text-right min-w-[90px]">
                      {formatEuro(cat.amount)} ({cat.pct}%)
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 px-4 rounded-[16px] bg-[#f8f8fa] text-center text-xs text-[#8e8e93]">
                Não existem despesas categorizadas registadas neste período.
              </div>
            )}
          </div>

          {/* Footer Link: Ver detalhe completo */}
          {filteredMovements.filter(
            (m) => m.type === "saida" || m.type === "investimento"
          ).length > 0 && (
            <div className="pt-4 border-t border-[#ececf0] mt-6">
              <button
                type="button"
                onClick={() => setShowBreakdownModal(true)}
                className="text-xs sm:text-sm font-semibold text-[#007aff] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Ver detalhe completo</span>
                <span className="text-base leading-none">→</span>
              </button>
            </div>
          )}
        </section>

        {/* Right Card: "Desempenho dos seus eventos" */}
        <section className="bg-white border border-[#ececf0] rounded-[24px] p-6 sm:p-7 shadow-xs flex flex-col justify-between">
          <div>
            {/* Header with Golden Trophy Icon */}
            <div className="flex items-start gap-2.5 mb-5">
              <div className="w-7 h-7 rounded-[10px] bg-[#fef3c7] text-[#f59e0b] flex items-center justify-center shrink-0 mt-0.5">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-[17px] sm:text-[18px] font-bold text-[#111111] tracking-[-0.01em]">
                  Desempenho dos seus eventos
                </h3>
                <p className="text-xs text-[#8e8e93] mt-0.5">
                  {totalEventsCount > 0
                    ? `${profitableEventsCount} de ${totalEventsCount} eventos deram lucro`
                    : "Sem eventos realizados neste período"}
                </p>
              </div>
            </div>

            {/* Event Profitability List */}
            {eventsPerformance.length > 0 ? (
              <div className="space-y-3.5 my-2">
                {eventsPerformance.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between text-xs sm:text-sm"
                  >
                    <span className="font-medium text-[#111111] truncate pr-2">
                      {ev.name}
                    </span>
                    <span
                      className={`font-bold shrink-0 ${
                        ev.profit >= 0 ? "text-[#00875a]" : "text-[#ef4444]"
                      }`}
                    >
                      {ev.profit >= 0
                        ? `+${formatEuro(ev.profit)}`
                        : `-${formatEuro(Math.abs(ev.profit))}`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 px-4 rounded-[16px] bg-[#f8f8fa] text-center text-xs text-[#8e8e93]">
                Não existem eventos ativos para apresentar neste período.
              </div>
            )}
          </div>

          {/* Footer Link: Ver todos os eventos */}
          {eventsPerformance.length > 0 && (
            <div className="pt-4 border-t border-[#ececf0] mt-6">
              <button
                type="button"
                onClick={() => {
                  if (onNavigateToEvents) {
                    onNavigateToEvents();
                  }
                }}
                className="text-xs sm:text-sm font-semibold text-[#007aff] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Ver todos os eventos</span>
                <span className="text-base leading-none">→</span>
              </button>
            </div>
          )}
        </section>
      </div>

      {/* ========================================================= */}
      {/* 5. CARD: "Valores a receber" */}
      {/* ========================================================= */}
      <section className="bg-white border border-[#ececf0] rounded-[24px] p-6 sm:p-7 shadow-xs">
        {/* Header with Blue Clock Icon */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-7 h-7 rounded-[10px] bg-[#e6f0ff] text-[#007aff] flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <h3 className="text-[17px] sm:text-[18px] font-bold text-[#111111] tracking-[-0.01em]">
            Valores a receber
          </h3>
        </div>

        {/* 3 Metric Columns with Dividers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#ececf0] gap-4 sm:gap-0 pt-1">
          {/* Column 1: From clients */}
          <div className="sm:pr-6">
            <div className="text-[28px] sm:text-[32px] font-extrabold text-[#111111] tracking-tight leading-none mb-1">
              {formatEuro(totals.moneyToReceive)}
            </div>
            <div className="text-xs font-medium text-[#8e8e93]">De clientes</div>
          </div>

          {/* Column 2: Overdue */}
          <div className="pt-4 sm:pt-0 sm:px-6">
            <div
              className={`text-[28px] sm:text-[32px] font-extrabold tracking-tight leading-none mb-1 ${
                totals.overdue > 0 ? "text-[#ef4444]" : "text-[#111111]"
              }`}
            >
              {formatEuro(totals.overdue)}
            </div>
            <div className="text-xs font-medium text-[#8e8e93]">Em atraso</div>
          </div>

          {/* Column 3: Upcoming */}
          <div className="pt-4 sm:pt-0 sm:pl-6">
            <div className="text-[28px] sm:text-[32px] font-extrabold text-[#111111] tracking-tight leading-none mb-1">
              {formatEuro(totals.upcoming)}
            </div>
            <div className="text-xs font-medium text-[#8e8e93]">
              Previsto / Próximo
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* MODAL: DETALHE COMPLETO DE DESPESAS */}
      {/* ========================================================= */}
      {showBreakdownModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[22px] w-full max-w-lg border border-[#ececf0] shadow-xl overflow-hidden p-6 text-xs space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#ececf0]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[10px] bg-[#e6f0ff] text-[#007aff] flex items-center justify-center font-bold">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#111111]">
                    Detalhe Completo de Despesas
                  </h3>
                  <p className="text-[11px] text-[#8e8e93]">
                    Categorias e movimentos registados
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBreakdownModal(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List of expenses */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredMovements.filter(
                (m) => m.type === "saida" || m.type === "investimento"
              ).length === 0 ? (
                <div className="p-6 text-center text-[#8e8e93] bg-[#f8f8fa] rounded-[16px]">
                  Nenhuma despesa individual registada para o período selecionado.
                </div>
              ) : (
                filteredMovements
                  .filter((m) => m.type === "saida" || m.type === "investimento")
                  .map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-[12px] bg-[#fafafc] border border-[#ececf0] flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-[#111111] text-xs">
                          {m.description}
                        </div>
                        <div className="text-[11px] text-[#8e8e93]">
                          {m.category || "Geral"} ·{" "}
                          {new Date(m.date).toLocaleDateString("pt-PT")}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-[#ef4444]">
                          -{formatEuro(m.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setMovementToDelete(m)}
                          className="text-[#8e8e93] hover:text-[#ef4444] transition p-1 cursor-pointer"
                          title="Remover despesa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="pt-3 border-t border-[#ececf0] flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowBreakdownModal(false)}
                className="px-4 py-2 rounded-[12px] bg-[#f2f2f5] hover:bg-[#e8e8ed] text-[#111111] font-semibold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CONFIRMAR REMOÇÃO */}
      {/* ========================================================= */}
      {movementToDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[22px] w-full max-w-sm border border-[#ececf0] shadow-xl p-6 text-xs space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#111111]">
                  Remover Movimento?
                </h3>
                <p className="text-[11px] text-[#8e8e93]">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {deleteError}
              </div>
            )}

            <div className="p-3.5 rounded-[14px] bg-[#f8f8fa] border border-[#ececf0] space-y-1">
              <div className="font-bold text-sm text-[#111111]">
                {movementToDelete.description}
              </div>
              <div className="text-[11px] text-[#8e8e93]">
                {movementToDelete.category}
              </div>
              <div className="text-base font-bold text-[#ef4444] pt-1">
                -{formatEuro(movementToDelete.amount)}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMovementToDelete(null)}
                className="flex-1 py-2.5 rounded-[12px] bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[#3a3a3c] font-semibold text-xs transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-[12px] bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
              >
                {isDeleting ? "A remover..." : "Sim, Remover"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
