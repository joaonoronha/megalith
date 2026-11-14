"use client";

import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  Wallet,
  Trophy,
  Clock,
  Check,
  CheckCircle2,
  ChevronDown,
  Plus,
  Coins,
  Trash2,
  X,
  Calendar,
  ExternalLink,
  ArrowUpRight,
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
  // Time period filter
  const [selectedPeriod, setSelectedPeriod] = useState<string>("6months");

  // Hovered month on the SVG chart for tooltips
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  // Modals
  const [showAddIncomeModal, setShowAddIncomeModal] = useState(false);
  const [incomeEventId, setIncomeEventId] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDesc, setIncomeDesc] = useState("");
  const [incomeDate, setIncomeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [incomeNotes, setIncomeNotes] = useState("");
  const [isSubmittingIncome, setIsSubmittingIncome] = useState(false);
  const [incomeError, setIncomeError] = useState<string | null>(null);

  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Espaço / Local");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseEventId, setExpenseEventId] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

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

  // Base mock data matching the exact mockup figures
  const mockTotals = {
    profit: 16450,
    profitGrowthPct: 21,
    revenue: 48250,
    expenses: 31800,
    moneyToReceive: 7500,
    overdue: 2000,
    upcoming: 5500,
  };

  // Calculate actual dynamic totals from database if movements and events exist
  const activeMovements = useMemo(() => movements || [], [movements]);
  const activeEvents = useMemo(() => {
    return (events || []).filter((e) => countsForFinance(e) && !isCancelledEvent(e));
  }, [events]);

  const dynamicTotals = useMemo(() => {
    const totalEntradas = activeMovements
      .filter((m) => m.type === "entrada")
      .reduce((sum, m) => sum + Number(m.amount || 0), 0);

    const totalSaidas = activeMovements
      .filter((m) => m.type === "saida" || m.type === "investimento")
      .reduce((sum, m) => sum + Number(m.amount || 0), 0);

    // If there is no real cash flow recorded yet, use the faithful mock values
    if (totalEntradas === 0 && totalSaidas === 0 && activeEvents.length === 0) {
      return mockTotals;
    }

    const eventRevenue = activeEvents.reduce(
      (sum, e) => sum + (Number(e.customerPrice) || 0),
      0
    );
    const eventExpenses = activeEvents.reduce(
      (sum, e) => sum + (Number(e.totalBudget) || 0),
      0
    );

    const revenue = totalEntradas > 0 ? totalEntradas : eventRevenue || mockTotals.revenue;
    const expenses = totalSaidas > 0 ? totalSaidas : eventExpenses || mockTotals.expenses;
    const profit = revenue - expenses;
    const moneyToReceive = Math.max(0, eventRevenue - totalEntradas) || mockTotals.moneyToReceive;

    return {
      profit,
      profitGrowthPct: mockTotals.profitGrowthPct,
      revenue,
      expenses,
      moneyToReceive,
      overdue: mockTotals.overdue,
      upcoming: Math.max(0, moneyToReceive - mockTotals.overdue) || mockTotals.upcoming,
    };
  }, [activeMovements, activeEvents]);

  // Chart data points (6 months: Jun to Nov) matching the visual mock curve
  const chartData = [
    { month: "Jun", revenue: 36500, expenses: 30000 },
    { month: "Jul", revenue: 45000, expenses: 37500 },
    { month: "Ago", revenue: 49000, expenses: 40000 },
    { month: "Set", revenue: 42000, expenses: 34000 },
    { month: "Out", revenue: 50500, expenses: 41000 },
    { month: "Nov", revenue: 54200, expenses: 44000 },
  ];

  // SVG Chart coordinate mapping
  // Chart dimensions: viewBox 0 0 760 220
  // Y-axis: 0 to 60k
  // y=20 (60k), y=73 (40k), y=126 (20k), y=180 (0k)
  const getY = (val: number) => {
    const maxVal = 60000;
    const topY = 20;
    const bottomY = 180;
    return bottomY - (val / maxVal) * (bottomY - topY);
  };

  const getX = (idx: number) => {
    const startX = 65;
    const endX = 720;
    const step = (endX - startX) / (chartData.length - 1);
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
    () => buildSmoothPath(chartData.map((d) => d.revenue)),
    []
  );
  const expensesPath = useMemo(
    () => buildSmoothPath(chartData.map((d) => d.expenses)),
    []
  );

  // Expense categories breakdown
  const categoryBreakdown = useMemo(() => {
    // If user has recorded movement categories, group them
    const groups: Record<string, number> = {};
    activeMovements
      .filter((m) => m.type === "saida" || m.type === "investimento")
      .forEach((m) => {
        const cat = m.category || "Outros";
        groups[cat] = (groups[cat] || 0) + Number(m.amount || 0);
      });

    const totalExp = Object.values(groups).reduce((a, b) => a + b, 0);

    if (totalExp > 0) {
      return Object.entries(groups)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([name, amount]) => ({
          name,
          amount,
          pct: Math.round((amount / totalExp) * 100),
        }));
    }

    // Default categories matching mockup
    return [
      { name: "Espaço / Local", amount: 9500, pct: 30 },
      { name: "Catering / Alimentação", amount: 8000, pct: 25 },
      { name: "Produção / Equipamento", amount: 5500, pct: 17 },
    ];
  }, [activeMovements]);

  // Events performance breakdown
  const eventsPerformance = useMemo(() => {
    if (activeEvents.length > 0) {
      return activeEvents.slice(0, 5).map((ev) => {
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
    }

    // Mock events from the design
    return [
      { id: "mock-1", name: "Festival de Verão", profit: 4500, isProfit: true },
      { id: "mock-2", name: "Jantar Privado", profit: 2500, isProfit: true },
      { id: "mock-3", name: "Cimeira Empresarial", profit: 1600, isProfit: true },
      { id: "mock-4", name: "Noite Musical", profit: -800, isProfit: false },
    ];
  }, [activeEvents]);

  const profitableEventsCount = eventsPerformance.filter((e) => e.isProfit).length;
  const totalEventsCount = eventsPerformance.length > 4 ? eventsPerformance.length : 8;

  // Handlers for Add Movement
  const handleAddIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingIncome(true);
    setIncomeError(null);

    try {
      const formData = new FormData();
      formData.set("type", "entrada");
      formData.set("description", incomeDesc.trim());
      formData.set("amount", incomeAmount.trim());
      formData.set("category", "Recebimento Cliente");
      formData.set("date", new Date(incomeDate).toISOString());
      if (incomeEventId) formData.set("eventId", incomeEventId);
      if (incomeNotes) formData.set("notes", incomeNotes.trim());

      const res = await onAddMovement(formData);
      if (res && res.success) {
        setShowAddIncomeModal(false);
        setIncomeDesc("");
        setIncomeAmount("");
        setIncomeNotes("");
      } else {
        setIncomeError(res?.error || "Erro ao registar recebimento.");
      }
    } catch (err: any) {
      setIncomeError(err?.message || "Erro inesperado ao registar recebimento.");
    } finally {
      setIsSubmittingIncome(false);
    }
  };

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingExpense(true);
    setExpenseError(null);

    try {
      const formData = new FormData();
      formData.set("type", "saida");
      formData.set("description", expenseDesc.trim());
      formData.set("amount", expenseAmount.trim());
      formData.set("category", expenseCategory);
      formData.set("date", new Date(expenseDate).toISOString());
      if (expenseEventId) formData.set("eventId", expenseEventId);
      if (expenseNotes) formData.set("notes", expenseNotes.trim());

      const res = await onAddMovement(formData);
      if (res && res.success) {
        setShowAddExpenseModal(false);
        setExpenseDesc("");
        setExpenseAmount("");
        setExpenseNotes("");
      } else {
        setExpenseError(res?.error || "Erro ao adicionar despesa.");
      }
    } catch (err: any) {
      setExpenseError(err?.message || "Erro inesperado ao registar despesa.");
    } finally {
      setIsSubmittingExpense(false);
    }
  };

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
      {/* 1. HEADER (ICON, TITLE, SUBTITLE & PERIOD SELECTOR) */}
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

        {/* Right actions: Period dropdown + Quick action buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Quick Add Buttons */}
          <button
            type="button"
            onClick={() => {
              setIncomeEventId("");
              setIncomeAmount("");
              setIncomeDesc("");
              setShowAddIncomeModal(true);
            }}
            className="px-3 py-1.5 rounded-[12px] bg-[#eaf8ee] hover:bg-[#d8f2df] text-[#217a3b] border border-[#cbeed4] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            title="Registar recebimento de cliente"
          >
            <Coins className="w-3.5 h-3.5" />
            <span>+ Recebimento</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setExpenseEventId("");
              setExpenseAmount("");
              setExpenseDesc("");
              setShowAddExpenseModal(true);
            }}
            className="px-3 py-1.5 rounded-[12px] bg-white hover:bg-[#f8f8fa] text-[#111111] border border-[#ececf0] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            title="Lançar nova despesa"
          >
            <Plus className="w-3.5 h-3.5 text-[#8e8e93]" />
            <span>+ Despesa</span>
          </button>

          {/* Period Selector Dropdown */}
          <div className="relative">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="appearance-none bg-white border border-[#ececf0] rounded-[12px] pl-3.5 pr-8 py-1.5 text-xs font-semibold text-[#111111] shadow-2xs hover:bg-[#fafafc] focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 cursor-pointer"
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
      </div>

      {/* ========================================================= */}
      {/* 2. CARD: "O seu negócio está a correr bem!" */}
      {/* ========================================================= */}
      <section className="bg-white border border-[#ececf0] rounded-[24px] p-6 sm:p-7 shadow-xs relative overflow-hidden">
        {/* Top row: Check icon, title, subtitle & decorative mint green trend badge */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-full bg-[#10b981] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              <Check className="w-5 h-5 stroke-[2.75]" />
            </div>
            <div>
              <h2 className="text-[18px] sm:text-[19px] font-bold text-[#111111] tracking-[-0.01em]">
                O seu negócio está a correr bem!
              </h2>
              <p className="text-xs sm:text-[13px] text-[#8e8e93] mt-0.5">
                Está a gerar mais lucro do que no período anterior.
              </p>
            </div>
          </div>

          {/* Decorative Mint Green Graphic Illustration with upward zigzag arrow */}
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
        </div>

        {/* 3 Metric Columns with Dividers */}
        <div className="mt-7 pt-6 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#ececf0] gap-4 sm:gap-0">
          {/* Column 1: Money made (profit) */}
          <div className="sm:pr-6">
            <div className="text-xs font-medium text-[#6e6e73]">
              Lucro líquido (ganho)
            </div>
            <div className="text-[32px] sm:text-[36px] font-extrabold text-[#00875a] tracking-tight leading-none mt-1.5 mb-1.5">
              {formatEuro(dynamicTotals.profit)}
            </div>
            <div className="text-xs font-semibold text-[#00875a] flex items-center gap-1">
              <span>↑</span>
              <span>{dynamicTotals.profitGrowthPct}% vs período anterior</span>
            </div>
          </div>

          {/* Column 2: Money earned (revenue) */}
          <div className="pt-4 sm:pt-0 sm:px-6">
            <div className="text-xs font-medium text-[#6e6e73]">
              Receita total (faturado)
            </div>
            <div className="text-[32px] sm:text-[36px] font-extrabold text-[#111111] tracking-tight leading-none mt-1.5">
              {formatEuro(dynamicTotals.revenue)}
            </div>
          </div>

          {/* Column 3: Money spent (expenses) */}
          <div className="pt-4 sm:pt-0 sm:pl-6">
            <div className="text-xs font-medium text-[#6e6e73]">
              Total de despesas
            </div>
            <div className="text-[32px] sm:text-[36px] font-extrabold text-[#111111] tracking-tight leading-none mt-1.5">
              {formatEuro(dynamicTotals.expenses)}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3. CARD: "Estamos a melhorar?" (CHART & GOOD NEWS CALLOUT) */}
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

          {/* Legend */}
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
        </div>

        {/* Chart SVG */}
        <div className="w-full relative">
          <svg
            className="w-full h-56 sm:h-64 overflow-visible"
            viewBox="0 0 760 220"
          >
            {/* Horizontal Grid lines */}
            {[60000, 40000, 20000, 0].map((val) => {
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
                    {val === 0 ? "€0" : `€${val / 1000}k`}
                  </text>
                </g>
              );
            })}

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
            {chartData.map((d, idx) => {
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
            {chartData.map((d, idx) => {
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
            {chartData.map((d, idx) => {
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
                top: `${(getY(chartData[hoveredPoint].revenue) / 220) * 100}%`,
                marginTop: "-12px",
              }}
            >
              <div className="font-bold text-white border-b border-white/20 pb-0.5">
                {chartData[hoveredPoint].month}
              </div>
              <div className="text-[#60a5fa]">
                Receita: {formatEuro(chartData[hoveredPoint].revenue)}
              </div>
              <div className="text-[#c084fc]">
                Despesas: {formatEuro(chartData[hoveredPoint].expenses)}
              </div>
              <div className="text-[#4ade80] font-semibold">
                Lucro: +{formatEuro(chartData[hoveredPoint].revenue - chartData[hoveredPoint].expenses)}
              </div>
            </div>
          )}
        </div>

        {/* Good News Callout Banner */}
        <div className="bg-[#eaf8ee] border border-[#cbeed4]/70 rounded-[16px] p-3.5 sm:p-4 flex items-center gap-3">
          <div className="w-5 h-5 rounded-full bg-[#10b981] text-white flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
          <p className="text-xs sm:text-[13px] font-semibold text-[#166534]">
            Boas notícias! Está a faturar mais enquanto mantém as despesas controladas.
          </p>
        </div>
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
                          idx === 0 ? "#0d9488" : idx === 1 ? "#0f766e" : "#14b8a6",
                      }}
                    />
                  </div>

                  <span className="font-medium text-[#111111] shrink-0 text-right min-w-[90px]">
                    {formatEuro(cat.amount)} ({cat.pct}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Link: Ver detalhe completo */}
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
                  {profitableEventsCount} de {totalEventsCount} eventos deram lucro
                </p>
              </div>
            </div>

            {/* Event Profitability List */}
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
                    {ev.profit >= 0 ? `+${formatEuro(ev.profit)}` : `-${formatEuro(Math.abs(ev.profit))}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Link: Ver todos os eventos */}
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
              {formatEuro(dynamicTotals.moneyToReceive)}
            </div>
            <div className="text-xs font-medium text-[#8e8e93]">De clientes</div>
          </div>

          {/* Column 2: Overdue */}
          <div className="pt-4 sm:pt-0 sm:px-6">
            <div className="text-[28px] sm:text-[32px] font-extrabold text-[#ef4444] tracking-tight leading-none mb-1">
              {formatEuro(dynamicTotals.overdue)}
            </div>
            <div className="text-xs font-medium text-[#8e8e93]">Em atraso</div>
          </div>

          {/* Column 3: Upcoming */}
          <div className="pt-4 sm:pt-0 sm:pl-6">
            <div className="text-[28px] sm:text-[32px] font-extrabold text-[#111111] tracking-tight leading-none mb-1">
              {formatEuro(dynamicTotals.upcoming)}
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
              {activeMovements.filter(
                (m) => m.type === "saida" || m.type === "investimento"
              ).length === 0 ? (
                <div className="p-6 text-center text-[#8e8e93] bg-[#f8f8fa] rounded-[16px]">
                  Nenhuma despesa individual registada ainda no sistema.
                </div>
              ) : (
                activeMovements
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
                          {m.category || "Geral"} · {new Date(m.date).toLocaleDateString("pt-PT")}
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

            <div className="pt-3 border-t border-[#ececf0] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowBreakdownModal(false);
                  setShowAddExpenseModal(true);
                }}
                className="px-3.5 py-2 rounded-[12px] bg-[#111111] hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Nova Despesa</span>
              </button>
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
      {/* MODAL: REGISTAR RECEBIMENTO */}
      {/* ========================================================= */}
      {showAddIncomeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[22px] w-full max-w-md border border-[#ececf0] shadow-xl overflow-hidden p-6 text-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#eaf8ee] text-[#217a3b] flex items-center justify-center font-bold">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#111111]">
                    Registar Recebimento
                  </h3>
                  <p className="text-[11px] text-[#8e8e93]">
                    Entrada de caixa associada a um evento
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddIncomeModal(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {incomeError && (
              <div className="p-3 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {incomeError}
              </div>
            )}

            <form onSubmit={handleAddIncomeSubmit} className="space-y-3.5">
              <div>
                <label className="block font-bold text-[#111111] mb-1">
                  Evento Associado *
                </label>
                <select
                  required
                  value={incomeEventId}
                  onChange={(e) => {
                    setIncomeEventId(e.target.value);
                    const ev = events.find((x) => x.id === e.target.value);
                    if (ev) {
                      setIncomeDesc(`Recebimento Cliente · ${ev.name}`);
                      setIncomeAmount(String(ev.customerPrice || ""));
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                >
                  <option value="">Selecione o evento...</option>
                  {events
                    .filter((ev) => countsForFinance(ev))
                    .map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name} · {formatEuro(ev.customerPrice || 0)}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#111111] mb-1">
                    Valor Recebido (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={incomeAmount}
                    onChange={(e) => setIncomeAmount(e.target.value)}
                    placeholder="Ex: 3850"
                    className="w-full px-3 py-2 text-sm font-bold bg-white border border-[#ececf0] rounded-[12px] text-[#217a3b] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#111111] mb-1">
                    Data *
                  </label>
                  <input
                    type="date"
                    required
                    value={incomeDate}
                    onChange={(e) => setIncomeDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#111111] mb-1">
                  Descrição *
                </label>
                <input
                  type="text"
                  required
                  value={incomeDesc}
                  onChange={(e) => setIncomeDesc(e.target.value)}
                  placeholder="Ex: Pagamento final Gala Mastercard"
                  className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#111111] mb-1">
                  Observações / Comprovativo
                </label>
                <textarea
                  value={incomeNotes}
                  onChange={(e) => setIncomeNotes(e.target.value)}
                  rows={2}
                  placeholder="Transferência bancária, ref. fatura..."
                  className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingIncome || !incomeAmount.trim()}
                className="w-full py-2.5 rounded-[12px] bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold transition shadow-xs mt-2 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Coins className="w-4 h-4" />
                <span>
                  {isSubmittingIncome ? "A registar..." : "Confirmar Recebimento"}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADICIONAR DESPESA */}
      {/* ========================================================= */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[22px] w-full max-w-md border border-[#ececf0] shadow-xl overflow-hidden p-6 text-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#fee2e2] text-[#ef4444] flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#111111]">
                    Adicionar Despesa
                  </h3>
                  <p className="text-[11px] text-[#8e8e93]">
                    Registo de saída de caixa ou custo de evento
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddExpenseModal(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {expenseError && (
              <div className="p-3 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {expenseError}
              </div>
            )}

            <form onSubmit={handleAddExpenseSubmit} className="space-y-3.5">
              <div>
                <label className="block font-bold text-[#111111] mb-1">
                  Descrição da Despesa *
                </label>
                <input
                  type="text"
                  required
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="Ex: Renda do armazém, Catering, Luz..."
                  className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#111111] mb-1">
                    Valor (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="Ex: 850"
                    className="w-full px-3 py-2 text-sm font-bold bg-white border border-[#ececf0] rounded-[12px] text-[#ef4444] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#111111] mb-1">
                    Categoria *
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  >
                    <option value="Espaço / Local">Espaço / Local</option>
                    <option value="Catering / Alimentação">Catering / Alimentação</option>
                    <option value="Produção / Equipamento">Produção / Equipamento</option>
                    <option value="Rendas & Instalações">Rendas & Instalações</option>
                    <option value="Equipa & Subcontratados">Equipa & Subcontratados</option>
                    <option value="Logística & Transportes">Logística & Transportes</option>
                    <option value="Marketing & Vendas">Marketing & Vendas</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#111111] mb-1">
                    Data *
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#111111] mb-1">
                    Evento (Opcional)
                  </label>
                  <select
                    value={expenseEventId}
                    onChange={(e) => setExpenseEventId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  >
                    <option value="">Nenhum (Despesa Geral)</option>
                    {events
                      .filter((ev) => countsForFinance(ev))
                      .map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#111111] mb-1">
                  Notas / Referência
                </label>
                <textarea
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  rows={2}
                  placeholder="Fatura nº, fornecedor..."
                  className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingExpense || !expenseAmount.trim()}
                className="w-full py-2.5 rounded-[12px] bg-[#111111] hover:bg-black text-white text-xs font-bold transition shadow-xs mt-2 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {isSubmittingExpense ? "A registar..." : "Registar Despesa"}
                </span>
              </button>
            </form>
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
