"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Plus,
  Trash2,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
  PieChart,
  Receipt,
  X,
  ExternalLink,
  Search,
  Building2,
  Briefcase,
  UserCheck,
  Wallet,
  Banknote,
  Coins,
  Eye,
  Check,
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
}

export default function FinanceView({
  events,
  items,
  movements,
  allocations,
  clients,
  quotes,
  onAddMovement,
  onDeleteMovement,
  onOpenItemWizard,
  onOpenMovementModal,
}: FinanceViewProps) {
  // Navigation sub-tabs within Finance View
  const [subTab, setSubTab] = useState<"overview" | "events-profitability" | "expenses" | "inventory">("overview");

  // Display mode for metrics: comparative (both), realized (caixa), projected (eventos)
  const [financialMode, setFinancialMode] = useState<"comparative" | "realized" | "projected">("comparative");

  // Selected Month filter ("all" or "YYYY-MM")
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // Event profitability tab filters & search
  const [eventSearch, setEventSearch] = useState("");
  const [eventStatusFilter, setEventStatusFilter] = useState("todos");
  const [eventSortBy, setEventSortBy] = useState<"date" | "profit_desc" | "price_desc" | "pending_desc">("date");

  // State for Add Income / Payment Modal (Registar Recebimento de Evento)
  const [showAddIncomeModal, setShowAddIncomeModal] = useState(false);
  const [incomeEventId, setIncomeEventId] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDesc, setIncomeDesc] = useState("");
  const [incomeDate, setIncomeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [incomeNotes, setIncomeNotes] = useState("");
  const [isSubmittingIncome, setIsSubmittingIncome] = useState(false);
  const [incomeError, setIncomeError] = useState<string | null>(null);

  // State for Add Expense Modal
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Rendas & Instalações");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseEventId, setExpenseEventId] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // State for Delete Confirmation Modal
  const [movementToDelete, setMovementToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Helper to format currency
  const formatEuro = (val: number) => {
    return "€" + Number(val || 0).toLocaleString("pt-PT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Helper to get Year-Month key from Date
  const getMonthKey = (d: Date | string | number): string => {
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };

  const getMonthLabel = (key: string): string => {
    if (!key || key === "all") return "Todos os Meses";
    const [y, m] = key.split("-");
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const monthIndex = parseInt(m, 10) - 1;
    return `${monthNames[monthIndex] || m} ${y}`;
  };

  // Set of cancelled / ineligible event IDs
  const cancelledEventIds = useMemo(() => {
    return new Set(
      events.filter((e) => isCancelledEvent(e) || !countsForFinance(e)).map((e) => e.id)
    );
  }, [events]);

  // Movements strictly excluding any movement associated with cancelled events
  const activeMovements = useMemo(() => {
    return movements.filter((m) => !m.eventId || !cancelledEventIds.has(m.eventId));
  }, [movements, cancelledEventIds]);

  // 1. Group movements and events by month (both Realized Cash Flow and Projected Pipeline)
  const monthlyData = useMemo(() => {
    const monthsMap: Record<
      string,
      {
        monthKey: string;
        label: string;
        // Realized Cash Flow
        entradas: number;
        saidas: number;
        investimentos: number;
        totalGastos: number;
        lucro: number;
        marginPct: number;
        // Projected Pipeline
        faturacaoProjetada: number;
        custosProjetados: number;
        lucroProjetado: number;
        margemProjetadaPct: number;
        aReceber: number;
        eventsCount: number;
        events: any[];
        movements: any[];
      }
    > = {};

    // Collect all unique months from active movements (ignoring cancelled events)
    activeMovements.forEach((m) => {
      const key = getMonthKey(m.date);
      if (!key) return;
      if (!monthsMap[key]) {
        monthsMap[key] = {
          monthKey: key,
          label: getMonthLabel(key),
          entradas: 0,
          saidas: 0,
          investimentos: 0,
          totalGastos: 0,
          lucro: 0,
          marginPct: 0,
          faturacaoProjetada: 0,
          custosProjetados: 0,
          lucroProjetado: 0,
          margemProjetadaPct: 0,
          aReceber: 0,
          eventsCount: 0,
          events: [],
          movements: [],
        };
      }
      monthsMap[key].movements.push(m);
      if (m.type === "entrada") {
        monthsMap[key].entradas += m.amount;
      } else if (m.type === "saida") {
        monthsMap[key].saidas += m.amount;
      } else if (m.type === "investimento") {
        monthsMap[key].investimentos += m.amount;
      }
    });

    // Collect all unique months and projected financials from active events (excluding cancelled)
    events.forEach((e) => {
      if (!countsForFinance(e)) return;
      const key = getMonthKey(e.startDate);
      if (!key) return;
      if (!monthsMap[key]) {
        monthsMap[key] = {
          monthKey: key,
          label: getMonthLabel(key),
          entradas: 0,
          saidas: 0,
          investimentos: 0,
          totalGastos: 0,
          lucro: 0,
          marginPct: 0,
          faturacaoProjetada: 0,
          custosProjetados: 0,
          lucroProjetado: 0,
          margemProjetadaPct: 0,
          aReceber: 0,
          eventsCount: 0,
          events: [],
          movements: [],
        };
      }
      monthsMap[key].events.push(e);
      monthsMap[key].eventsCount += 1;

      const price = Number(e.customerPrice) || 0;
      const budget = Number(e.totalBudget) || 0;
      monthsMap[key].faturacaoProjetada += price;
      monthsMap[key].custosProjetados += budget;
    });

    // Compute totals and sort chronologically (oldest to newest)
    const sortedKeys = Object.keys(monthsMap).sort();
    const result = sortedKeys.map((key, idx) => {
      const data = monthsMap[key];
      data.totalGastos = data.saidas + data.investimentos;
      data.lucro = data.entradas - data.totalGastos;
      data.marginPct = data.entradas > 0 ? (data.lucro / data.entradas) * 100 : 0;

      data.lucroProjetado = data.faturacaoProjetada - data.custosProjetados;
      data.margemProjetadaPct = data.faturacaoProjetada > 0 ? (data.lucroProjetado / data.faturacaoProjetada) * 100 : 0;
      data.aReceber = Math.max(0, data.faturacaoProjetada - data.entradas);

      // Calculate Month-over-Month deltas compared to previous month
      let prev = idx > 0 ? monthsMap[sortedKeys[idx - 1]] : null;
      let profitDelta = prev ? data.lucro - prev.lucro : 0;
      let profitGrowthPct =
        prev && prev.lucro !== 0
          ? ((data.lucro - prev.lucro) / Math.abs(prev.lucro)) * 100
          : 0;

      let spendingDelta = prev ? data.totalGastos - prev.totalGastos : 0;
      let spendingGrowthPct =
        prev && prev.totalGastos !== 0
          ? ((data.totalGastos - prev.totalGastos) / prev.totalGastos) * 100
          : 0;

      let eventsDelta = prev ? data.eventsCount - prev.eventsCount : 0;
      let eventsGrowthPct =
        prev && prev.eventsCount !== 0
          ? ((data.eventsCount - prev.eventsCount) / prev.eventsCount) * 100
          : 0;

      return {
        ...data,
        profitDelta,
        profitGrowthPct,
        spendingDelta,
        spendingGrowthPct,
        eventsDelta,
        eventsGrowthPct,
      };
    });

    return result;
  }, [movements, events]);

  // Available month keys for dropdown (newest first for UI selection)
  const availableMonths = useMemo(() => {
    return [...monthlyData].reverse();
  }, [monthlyData]);

  // Pending Stock Purchases (Items with purchaseStatus === "not_bought")
  // Only bought items can be accounted for finance, not bought yet can be deducted from the projected value.
  const pendingStockPurchases = useMemo(() => {
    return items
      .filter((item) => item.purchaseStatus === "not_bought")
      .reduce((sum, item) => {
        const cost = Number(item.purchaseCost) > 0
          ? Number(item.purchaseCost)
          : (Number(item.replacementCost) || 0) * (Number(item.totalQuantity) || 1);
        return sum + cost;
      }, 0);
  }, [items]);

  const pendingStockCount = useMemo(() => {
    return items.filter((item) => item.purchaseStatus === "not_bought").length;
  }, [items]);

  // Overall totals / Active filtered data (Realized Cash + Projected Pipeline)
  const activeMetrics = useMemo(() => {
    if (selectedMonth === "all") {
      const totalEntradas = activeMovements
        .filter((m) => m.type === "entrada")
        .reduce((sum, m) => sum + m.amount, 0);
      const totalSaidas = activeMovements
        .filter((m) => m.type === "saida")
        .reduce((sum, m) => sum + m.amount, 0);
      const totalInvestimentos = activeMovements
        .filter((m) => m.type === "investimento")
        .reduce((sum, m) => sum + m.amount, 0);
      const totalGastos = totalSaidas + totalInvestimentos;
      const lucroTotal = totalEntradas - totalGastos;
      const margemGeral = totalEntradas > 0 ? (lucroTotal / totalEntradas) * 100 : 0;
      const activeEvents = events.filter((e) => countsForFinance(e));
      const totalEventos = activeEvents.length;

      const faturacaoProjetadaTotal = activeEvents.reduce((sum, e) => sum + (Number(e.customerPrice) || 0), 0);
      const orcamentoCustosTotal = activeEvents.reduce((sum, e) => sum + (Number(e.totalBudget) || 0), 0);
      const custosProjetadosTotal = orcamentoCustosTotal + pendingStockPurchases;
      const lucroProjetadoTotal = faturacaoProjetadaTotal - custosProjetadosTotal;
      const margemProjetadaGeral = faturacaoProjetadaTotal > 0 ? (lucroProjetadoTotal / faturacaoProjetadaTotal) * 100 : 0;
      const totalAReceber = Math.max(0, faturacaoProjetadaTotal - totalEntradas);

      // Latest month vs previous month MoM
      const latestMonth = monthlyData[monthlyData.length - 1];
      const momProfitGrowth = latestMonth ? latestMonth.profitGrowthPct : 0;
      const momSpendingGrowth = latestMonth ? latestMonth.spendingGrowthPct : 0;
      const momEventsGrowth = latestMonth ? latestMonth.eventsGrowthPct : 0;

      return {
        isFiltered: false,
        label: "Todos os Meses (Visão Acumulada)",
        entradas: totalEntradas,
        saidas: totalSaidas,
        investimentos: totalInvestimentos,
        totalGastos,
        lucro: lucroTotal,
        margemPct: margemGeral,
        eventsCount: totalEventos,
        faturacaoProjetada: faturacaoProjetadaTotal,
        orcamentoCustos: orcamentoCustosTotal,
        pendingStockPurchases,
        pendingStockCount,
        custosProjetados: custosProjetadosTotal,
        lucroProjetado: lucroProjetadoTotal,
        margemProjetadaPct: margemProjetadaGeral,
        aReceber: totalAReceber,
        momProfitGrowth,
        momSpendingGrowth,
        momEventsGrowth,
        latestMonthLabel: latestMonth ? latestMonth.label : "",
      };
    } else {
      const match = monthlyData.find((m) => m.monthKey === selectedMonth);
      if (!match) {
        return {
          isFiltered: true,
          label: getMonthLabel(selectedMonth),
          entradas: 0,
          saidas: 0,
          investimentos: 0,
          totalGastos: 0,
          lucro: 0,
          margemPct: 0,
          eventsCount: 0,
          faturacaoProjetada: 0,
          orcamentoCustos: 0,
          pendingStockPurchases: 0,
          pendingStockCount: 0,
          custosProjetados: 0,
          lucroProjetado: 0,
          margemProjetadaPct: 0,
          aReceber: 0,
          momProfitGrowth: 0,
          momSpendingGrowth: 0,
          momEventsGrowth: 0,
          latestMonthLabel: "",
        };
      }
      return {
        isFiltered: true,
        label: match.label,
        entradas: match.entradas,
        saidas: match.saidas,
        investimentos: match.investimentos,
        totalGastos: match.totalGastos,
        lucro: match.lucro,
        margemPct: match.marginPct,
        eventsCount: match.eventsCount,
        faturacaoProjetada: match.faturacaoProjetada,
        orcamentoCustos: match.custosProjetados,
        pendingStockPurchases: 0,
        pendingStockCount: 0,
        custosProjetados: match.custosProjetados,
        lucroProjetado: match.lucroProjetado,
        margemProjetadaPct: match.margemProjetadaPct,
        aReceber: match.aReceber,
        momProfitGrowth: match.profitGrowthPct,
        momSpendingGrowth: match.spendingGrowthPct,
        momEventsGrowth: match.eventsGrowthPct,
        latestMonthLabel: match.label,
      };
    }
  }, [selectedMonth, monthlyData, activeMovements, events, pendingStockPurchases, pendingStockCount]);

  // 2. Event-by-Event Profitability & Projections (excluding cancelled events)
  const eventProfitabilityList = useMemo(() => {
    const list = events
      .filter((ev) => countsForFinance(ev))
      .map((ev) => {
      const client = clients.find((c) => c.id === ev.clientId);
      const evMovements = activeMovements.filter((m) => m.eventId === ev.id);

      const entradasReais = evMovements
        .filter((m) => m.type === "entrada")
        .reduce((sum, m) => sum + m.amount, 0);

      const despesasReais = evMovements
        .filter((m) => m.type === "saida" || m.type === "investimento")
        .reduce((sum, m) => sum + m.amount, 0);

      const precoClienteProjetado = Number(ev.customerPrice) || 0;
      const custoOrcadoProjetado = Number(ev.totalBudget) || 0;
      const lucroProjetado = precoClienteProjetado - custoOrcadoProjetado;
      const margemProjetadaPct = precoClienteProjetado > 0 ? (lucroProjetado / precoClienteProjetado) * 100 : 0;

      const lucroRealizado = entradasReais - despesasReais;
      const margemRealizadaPct = entradasReais > 0 ? (lucroRealizado / entradasReais) * 100 : 0;

      const saldoAReceber = Math.max(0, precoClienteProjetado - entradasReais);
      const desvioOrcamental = custoOrcadoProjetado - despesasReais; // positivo = abaixo do orçamento
      const paymentProgressPct = precoClienteProjetado > 0
        ? Math.min(100, Math.round((entradasReais / precoClienteProjetado) * 100))
        : (entradasReais > 0 ? 100 : 0);

      const monthKey = getMonthKey(ev.startDate);

      return {
        event: ev,
        client,
        monthKey,
        entradasReais,
        despesasReais,
        precoClienteProjetado,
        custoOrcadoProjetado,
        lucroProjetado,
        margemProjetadaPct,
        lucroRealizado,
        margemRealizadaPct,
        saldoAReceber,
        desvioOrcamental,
        paymentProgressPct,
        movementsCount: evMovements.length,
      };
    });

    // Filter by selectedMonth if active
    return list.filter((item) => {
      if (selectedMonth !== "all" && item.monthKey !== selectedMonth) {
        return false;
      }
      if (eventStatusFilter !== "todos" && item.event.status !== eventStatusFilter) {
        return false;
      }
      if (eventSearch.trim()) {
        const q = eventSearch.toLowerCase();
        const matchesName = item.event.name?.toLowerCase().includes(q);
        const matchesClient = item.client?.name?.toLowerCase().includes(q);
        const matchesVenue = item.event.venue?.toLowerCase().includes(q);
        if (!matchesName && !matchesClient && !matchesVenue) return false;
      }
      return true;
    }).sort((a, b) => {
      if (eventSortBy === "profit_desc") return b.lucroProjetado - a.lucroProjetado;
      if (eventSortBy === "price_desc") return b.precoClienteProjetado - a.precoClienteProjetado;
      if (eventSortBy === "pending_desc") return b.saldoAReceber - a.saldoAReceber;
      // Default: date (newest first)
      return new Date(b.event.startDate).getTime() - new Date(a.event.startDate).getTime();
    });
  }, [events, clients, movements, selectedMonth, eventStatusFilter, eventSearch, eventSortBy]);

  // Handle Add Income (Recebimento de Evento)
  const handleAddIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingIncome(true);
    setIncomeError(null);

    try {
      const selectedEv = events.find((ev) => ev.id === incomeEventId);
      const formData = new FormData();
      formData.set("type", "entrada");
      formData.set("description", incomeDesc.trim() || `Recebimento de Cliente · ${selectedEv?.name || "Evento"}`);
      formData.set("amount", incomeAmount.trim());
      formData.set("category", "Evento");
      formData.set("date", new Date(incomeDate).toISOString());
      if (incomeEventId) formData.set("eventId", incomeEventId);
      if (selectedEv?.clientId) formData.set("clientId", selectedEv.clientId);
      if (incomeNotes.trim()) formData.set("notes", incomeNotes.trim());

      const res = await onAddMovement(formData);
      if (res && res.success) {
        setShowAddIncomeModal(false);
        setIncomeEventId("");
        setIncomeAmount("");
        setIncomeDesc("");
        setIncomeNotes("");
      } else {
        setIncomeError(res?.error || "Erro ao registar entrada.");
      }
    } catch (err: any) {
      setIncomeError(err?.message || "Erro inesperado ao registar recebimento.");
    } finally {
      setIsSubmittingIncome(false);
    }
  };

  const handleOpenIncomeForEvent = (eventRow: any) => {
    setIncomeEventId(eventRow.event.id);
    setIncomeAmount(eventRow.saldoAReceber > 0 ? String(eventRow.saldoAReceber) : String(eventRow.precoClienteProjetado));
    setIncomeDesc(`Recebimento Cliente · ${eventRow.event.name}`);
    setIncomeDate(new Date().toISOString().slice(0, 10));
    setIncomeNotes(`Liquidação / sinal de cliente para ${eventRow.event.name}`);
    setShowAddIncomeModal(true);
  };

  // 2. Most Used Inventory Items Calculation
  const mostUsedItems = useMemo(() => {
    const usageMap: Record<
      string,
      {
        itemId: string;
        item: any;
        totalAllocatedQty: number;
        eventsSet: Set<string>;
        estimatedRevenue: number;
      }
    > = {};

    // Group all allocations by item (ignoring allocations for cancelled events)
    allocations.forEach((alc) => {
      if (alc.eventId && cancelledEventIds.has(alc.eventId)) {
        return;
      }
      const item = items.find((i) => i.id === alc.itemId);
      if (!usageMap[alc.itemId]) {
        usageMap[alc.itemId] = {
          itemId: alc.itemId,
          item: item || {
            id: alc.itemId,
            name: "Artigo Desconhecido",
            sku: "N/A",
            category: "Geral",
            totalQuantity: 1,
            unitPrice: 0,
          },
          totalAllocatedQty: 0,
          eventsSet: new Set(),
          estimatedRevenue: 0,
        };
      }
      usageMap[alc.itemId].totalAllocatedQty += alc.quantity || 0;
      if (alc.eventId) {
        usageMap[alc.itemId].eventsSet.add(alc.eventId);
      }
    });

    // Compute revenue and sort by total quantity allocated descending
    const list = Object.values(usageMap).map((entry) => {
      const unitPrice = entry.item.unitPrice || 0;
      const revenue = entry.totalAllocatedQty * unitPrice;
      const stockTotal = entry.item.totalQuantity || 1;
      const utilizationRate = Math.min(100, (entry.totalAllocatedQty / stockTotal) * 100);

      return {
        ...entry,
        eventsCount: entry.eventsSet.size,
        estimatedRevenue: revenue,
        utilizationRate,
      };
    });

    list.sort((a, b) => b.totalAllocatedQty - a.totalAllocatedQty);
    return list;
  }, [allocations, items, cancelledEventIds]);

  // Filtered expenses list for "Despesas Mensais" (strictly excluding cancelled events)
  const filteredExpenses = useMemo(() => {
    return activeMovements.filter((m) => {
      // Must be an outflow or investment (expense)
      if (m.type !== "saida" && m.type !== "investimento") return false;
      if (selectedMonth === "all") return true;
      return getMonthKey(m.date) === selectedMonth;
    });
  }, [activeMovements, selectedMonth]);

  // Spending by category breakdown
  const categorySpending = useMemo(() => {
    const cats: Record<string, number> = {};
    filteredExpenses.forEach((exp) => {
      const cat = exp.category || "Outros";
      cats[cat] = (cats[cat] || 0) + exp.amount;
    });
    return Object.entries(cats).sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  // Handle Add Monthly Expense submit
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
      const notePayload = [
        expenseNotes.trim(),
        isRecurring ? "[Despesa Fixa Recorrente Mensal]" : "",
      ]
        .filter(Boolean)
        .join(" · ");
      formData.set("notes", notePayload);

      const res = await onAddMovement(formData);
      if (res && res.success) {
        setShowAddExpenseModal(false);
        setExpenseDesc("");
        setExpenseAmount("");
        setExpenseNotes("");
        setIsRecurring(false);
      } else {
        setExpenseError(res?.error || "Erro ao adicionar despesa.");
      }
    } catch (err: any) {
      setExpenseError(err?.message || "Erro inesperado ao registar despesa.");
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  // Handle Delete Expense confirm
  const handleDeleteConfirm = async () => {
    if (!movementToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await onDeleteMovement(movementToDelete.id);
      if (res && res.success) {
        setMovementToDelete(null);
      } else {
        setDeleteError(res?.error || "Erro ao remover despesa.");
      }
    } catch (err: any) {
      setDeleteError(err?.message || "Erro inesperado ao remover.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Max value for visual bar chart calculation
  const maxBarValue = useMemo(() => {
    let max = 1000;
    monthlyData.forEach((m) => {
      if (m.entradas > max) max = m.entradas;
      if (m.totalGastos > max) max = m.totalGastos;
    });
    return max * 1.15; // 15% headroom
  }, [monthlyData]);

  return (
    <div className="space-y-6 pb-20">
      {/* ========================================================= */}
      {/* 1. VIEW HEADER & MONTH SELECTOR */}
      {/* ========================================================= */}
      <div className="bg-white border border-[#ececf0] rounded-[22px] p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-[#eaf8ee] text-[#217a3b] border border-[#217a3b]/20">
                Painel Financeiro CFM
              </span>
              <span className="text-[11px] text-[#8e8e93]">
                Análise Operacional & Rentabilidade
              </span>
            </div>
            <h1 className="text-[24px] sm:text-[28px] font-bold text-[#111111] tracking-[-0.5px]">
              Finanças & Lucro Mês a Mês
            </h1>
            <p className="text-xs sm:text-[13px] text-[#8e8e93] mt-1">
              Acompanhamento de lucros, volume de eventos, despesas operacionais e rotação de inventário
            </p>
          </div>

          {/* Quick Actions Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setIncomeEventId("");
                setIncomeAmount("");
                setIncomeDesc("");
                setIncomeNotes("");
                setShowAddIncomeModal(true);
              }}
              className="px-3.5 py-2 rounded-[12px] bg-[#217a3b] hover:bg-[#1b6330] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Coins className="w-4 h-4" />
              <span>Registar Recebimento</span>
            </button>

            <button
              onClick={() => setShowAddExpenseModal(true)}
              className="px-3.5 py-2 rounded-[12px] bg-[#111111] hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Despesa</span>
            </button>

            {onOpenItemWizard && (
              <button
                onClick={onOpenItemWizard}
                className="px-3.5 py-2 rounded-[12px] bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[#1c1c1e] text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                title="Novo artigo no stock com lançamento automático de despesa de compra"
              >
                <Package className="w-4 h-4 text-[#8e8e93]" />
                <span>Novo Artigo (+ Compra)</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter bar & Sub-tab navigation */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-t border-[#ececf0] pt-4">
          {/* Subtabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#f4f4f6] rounded-[14px]">
            <button
              onClick={() => setSubTab("overview")}
              className={`px-3.5 py-1.5 rounded-[10px] text-xs font-bold transition cursor-pointer ${
                subTab === "overview"
                  ? "bg-white text-[#111111] shadow-xs"
                  : "text-[#8e8e93] hover:text-[#111111]"
              }`}
            >
              Visão Geral & MoM
            </button>
            <button
              onClick={() => setSubTab("events-profitability")}
              className={`px-3.5 py-1.5 rounded-[10px] text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                subTab === "events-profitability"
                  ? "bg-white text-[#111111] shadow-xs"
                  : "text-[#8e8e93] hover:text-[#111111]"
              }`}
            >
              <span>Rentabilidade por Evento</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#6366f1]/10 text-[#4f46e5]">
                {events.filter((e) => countsForFinance(e)).length}
              </span>
            </button>
            <button
              onClick={() => setSubTab("expenses")}
              className={`px-3.5 py-1.5 rounded-[10px] text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                subTab === "expenses"
                  ? "bg-white text-[#111111] shadow-xs"
                  : "text-[#8e8e93] hover:text-[#111111]"
              }`}
            >
              <span>Despesas Mensais</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#fde8e8] text-[#b04a3f]">
                {filteredExpenses.length}
              </span>
            </button>
            <button
              onClick={() => setSubTab("inventory")}
              className={`px-3.5 py-1.5 rounded-[10px] text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                subTab === "inventory"
                  ? "bg-white text-[#111111] shadow-xs"
                  : "text-[#8e8e93] hover:text-[#111111]"
              }`}
            >
              <span>Inventário Mais Utilizado</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#eaf8ee] text-[#217a3b]">
                {mostUsedItems.length}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Display Mode Toggle */}
            <div className="flex items-center p-1 bg-[#f4f4f6] rounded-[12px] text-xs">
              <button
                type="button"
                onClick={() => setFinancialMode("comparative")}
                className={`px-2.5 py-1 rounded-[8px] font-semibold transition cursor-pointer ${
                  financialMode === "comparative"
                    ? "bg-white text-[#111] shadow-xs"
                    : "text-[#8e8e93] hover:text-[#111]"
                }`}
              >
                Comparativo
              </button>
              <button
                type="button"
                onClick={() => setFinancialMode("projected")}
                className={`px-2.5 py-1 rounded-[8px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                  financialMode === "projected"
                    ? "bg-white text-[#111] shadow-xs"
                    : "text-[#8e8e93] hover:text-[#111]"
                }`}
              >
                <span>Projetado</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1]"></span>
              </button>
              <button
                type="button"
                onClick={() => setFinancialMode("realized")}
                className={`px-2.5 py-1 rounded-[8px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                  financialMode === "realized"
                    ? "bg-white text-[#111] shadow-xs"
                    : "text-[#8e8e93] hover:text-[#111]"
                }`}
              >
                <span>Caixa Real</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#217a3b]"></span>
              </button>
            </div>

            {/* Month Selector Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8e8e93] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Mês:</span>
              </span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold bg-[#f8f8fa] border border-[#ececf0] rounded-[10px] text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#007aff] cursor-pointer"
              >
                <option value="all">Todos os Meses</option>
                {availableMonths.map((m) => (
                  <option key={m.monthKey} value={m.monthKey}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Automatic Stock Acquisition & Projection Info Banner */}
        <div className="p-3.5 rounded-[14px] bg-[#f8f8fa] border border-[#ececf0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5 text-[#3a3a3c]">
            <Sparkles className="w-4 h-4 text-[#6366f1] shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold text-[#111]">
                Cálculo Financeiro Dual CFM:
              </strong>{" "}
              Ao configurar um evento com preço cliente e orçamento interno, o sistema projeta imediatamente o <strong>lucro potencial</strong> (€{activeMetrics.lucroProjetado.toLocaleString("pt-PT")}) e confronta com as entradas e saídas de caixa efetivamente liquidadas.
              {activeMetrics.pendingStockPurchases > 0 && (
                <span className="block text-[11px] text-amber-700 mt-1 font-medium">
                  📦 <strong>Stock a Adquirir:</strong> {formatEuro(activeMetrics.pendingStockPurchases)} ({activeMetrics.pendingStockCount} artigos pendentes) deduzidos da projeção até efetivação da compra.
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setSubTab("events-profitability")}
            className="text-[11px] font-bold text-[#6366f1] hover:underline whitespace-nowrap cursor-pointer"
          >
            Ver Rentabilidade por Evento →
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. 4 CORE METRIC CARDS (REALIZED VS PROJECTED) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: Profits (Lucro Líquido / Lucro Projetado) */}
        <div className="bg-white border border-[#ececf0] rounded-[20px] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#8e8e93] mb-1.5">
              <span>
                {financialMode === "projected"
                  ? "Lucro Projetado (Eventos)"
                  : financialMode === "realized"
                  ? "Lucro Realizado (Caixa)"
                  : "Lucro Líquido (Real vs Projetado)"}
              </span>
              <div className="w-7 h-7 rounded-full bg-[#eaf8ee] text-[#217a3b] flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <div className={`text-[26px] font-bold tracking-[-0.7px] ${
                (financialMode === "projected" ? activeMetrics.lucroProjetado : activeMetrics.lucro) >= 0
                  ? "text-[#217a3b]"
                  : "text-[#b04a3f]"
              }`}>
                {formatEuro(financialMode === "projected" ? activeMetrics.lucroProjetado : activeMetrics.lucro)}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#f4f4f6] mt-3 text-xs">
            {financialMode === "comparative" ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#8e8e93]">Lucro Projetado:</span>
                  <span className="font-bold text-[#6366f1]">
                    {formatEuro(activeMetrics.lucroProjetado)}
                  </span>
                </div>
                {activeMetrics.pendingStockPurchases > 0 && (
                  <div className="flex items-center justify-between text-[10px] text-amber-700 font-medium">
                    <span>Stock pendente deduzido:</span>
                    <span>-{formatEuro(activeMetrics.pendingStockPurchases)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px] text-[#8e8e93]">
                  <span>Pendente a realizar:</span>
                  <span className="font-semibold text-[#111]">
                    {formatEuro(activeMetrics.aReceber)}
                  </span>
                </div>
              </div>
            ) : financialMode === "projected" ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#8e8e93]">Margem Prevista:</span>
                  <span className="font-bold text-[#6366f1]">
                    {activeMetrics.margemProjetadaPct.toFixed(1)}%
                  </span>
                </div>
                {activeMetrics.pendingStockPurchases > 0 && (
                  <div className="text-[10px] text-amber-700 font-medium text-right">
                    Deduzido {formatEuro(activeMetrics.pendingStockPurchases)} stock a comprar
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-[#8e8e93]">Variação MoM:</span>
                {activeMetrics.momProfitGrowth >= 0 ? (
                  <span className="inline-flex items-center gap-0.5 font-bold text-[#217a3b]">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    +{activeMetrics.momProfitGrowth.toFixed(1)}%
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 font-bold text-[#b04a3f]">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    {activeMetrics.momProfitGrowth.toFixed(1)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Metric 2: Amount of Events & Projected Revenue */}
        <div className="bg-white border border-[#ececf0] rounded-[20px] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#8e8e93] mb-1.5">
              <span>
                {financialMode === "realized" ? "Entradas Recebidas" : "Faturação Prevista"}
              </span>
              <div className="w-7 h-7 rounded-full bg-[#f2f2f5] text-[#111111] flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="text-[26px] font-bold tracking-[-0.7px] text-[#111111]">
              {formatEuro(financialMode === "realized" ? activeMetrics.entradas : activeMetrics.faturacaoProjetada)}
            </div>
          </div>

          <div className="pt-3 border-t border-[#f4f4f6] mt-3 text-xs">
            {financialMode === "comparative" ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#8e8e93]">Recebido em Caixa:</span>
                  <span className="font-bold text-[#217a3b]">
                    {formatEuro(activeMetrics.entradas)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#8e8e93]">A receber de clientes:</span>
                  <span className="font-semibold text-[#6366f1]">
                    {formatEuro(activeMetrics.aReceber)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-[#8e8e93]">Volume total:</span>
                <span className="font-bold text-[#111]">
                  {activeMetrics.eventsCount} eventos
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Metric 3: Spending & Internal Budget */}
        <div className="bg-white border border-[#ececf0] rounded-[20px] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#8e8e93] mb-1.5">
              <span>
                {financialMode === "projected" ? "Custos Previstos" : "Gastos & Despesas"}
              </span>
              <div className="w-7 h-7 rounded-full bg-[#fde8e8] text-[#b04a3f] flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-[26px] font-bold tracking-[-0.7px] text-[#b04a3f]">
              {formatEuro(financialMode === "projected" ? activeMetrics.custosProjetados : activeMetrics.totalGastos)}
            </div>
          </div>

          <div className="pt-3 border-t border-[#f4f4f6] mt-3 text-xs">
            {financialMode === "comparative" ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#8e8e93]">Custos Previstos:</span>
                  <span className="font-bold text-[#111]">
                    {formatEuro(activeMetrics.custosProjetados)}
                  </span>
                </div>
                {activeMetrics.pendingStockPurchases > 0 && (
                  <div className="flex items-center justify-between text-[10px] text-amber-700 font-medium">
                    <span>Inclui stock a comprar:</span>
                    <span>+{formatEuro(activeMetrics.pendingStockPurchases)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px] text-[#8e8e93]">
                  <span>Despesas pagas:</span>
                  <span className="font-semibold text-[#b04a3f]">
                    {formatEuro(activeMetrics.totalGastos)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#8e8e93]">
                    {financialMode === "projected" ? "Orçamento Eventos:" : "Investido em stock:"}
                  </span>
                  <span className="font-bold text-[#8c6417]">
                    {formatEuro(financialMode === "projected" ? activeMetrics.orcamentoCustos : activeMetrics.investimentos)}
                  </span>
                </div>
                {financialMode === "projected" && activeMetrics.pendingStockPurchases > 0 && (
                  <div className="flex items-center justify-between text-[10px] text-amber-700 font-medium">
                    <span>Stock a comprar:</span>
                    <span>+{formatEuro(activeMetrics.pendingStockPurchases)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Metric 4: Profit Margin */}
        <div className="bg-white border border-[#ececf0] rounded-[20px] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#8e8e93] mb-1.5">
              <span>Margem de Rentabilidade</span>
              <div className="w-7 h-7 rounded-full bg-[#f2f2f5] text-[#007aff] flex items-center justify-center">
                <PieChart className="w-4 h-4" />
              </div>
            </div>
            <div className="text-[26px] font-bold tracking-[-0.7px] text-[#111111]">
              {(financialMode === "realized" ? activeMetrics.margemPct : activeMetrics.margemProjetadaPct).toFixed(1)}%
            </div>
          </div>

          <div className="pt-3 border-t border-[#f4f4f6] mt-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#8e8e93]">Margem Projetada:</span>
                <strong className="text-[#6366f1]">{activeMetrics.margemProjetadaPct.toFixed(1)}%</strong>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#8e8e93]">
                <span>Margem Caixa Atual:</span>
                <span className="font-semibold text-[#111]">{activeMetrics.margemPct.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. SUBTAB 1: OVERVIEW & MONTH OVER MONTH EVOLUTION */}
      {/* ========================================================= */}
      {subTab === "overview" && (
        <div className="space-y-6">
          {/* Visual Chart Card */}
          <div className="bg-white border border-[#ececf0] rounded-[22px] p-5 sm:p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-bold text-[#111111]">
                  Evolução Comparativa Mês a Mês
                </h3>
                <p className="text-xs text-[#8e8e93] mt-0.5">
                  Receitas (Entradas), Despesas Totais e Lucro Líquido gerado por mês
                </p>
              </div>

              {/* Chart Legend */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#217a3b]"></span>
                  <span className="text-[#3a3a3c] font-medium">Entradas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#b04a3f]"></span>
                  <span className="text-[#3a3a3c] font-medium">Despesas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#111111]"></span>
                  <span className="text-[#3a3a3c] font-medium">Lucro Líquido</span>
                </div>
              </div>
            </div>

            {/* Visual Bar Graph */}
            <div className="pt-4 border-t border-[#f4f4f6]">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end min-h-[220px] pb-2">
                {monthlyData.map((m) => {
                  const entradasHeight = (m.entradas / maxBarValue) * 160;
                  const gastosHeight = (m.totalGastos / maxBarValue) * 160;
                  const isSelected = selectedMonth === m.monthKey;

                  return (
                    <div
                      key={m.monthKey}
                      onClick={() => setSelectedMonth(isSelected ? "all" : m.monthKey)}
                      className={`flex flex-col items-center p-3 rounded-[16px] transition cursor-pointer border ${
                        isSelected
                          ? "bg-[#007aff]/5 border-[#007aff]"
                          : "bg-[#f8f8fa] border-transparent hover:border-[#ececf0]"
                      }`}
                    >
                      {/* Events pill */}
                      <span className="mb-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white border border-[#ececf0] text-[#111]">
                        {m.eventsCount} {m.eventsCount === 1 ? "evento" : "eventos"}
                      </span>

                      {/* Side-by-side vertical bars */}
                      <div className="w-full flex items-end justify-center gap-2 h-[160px] pb-1">
                        {/* Entradas bar */}
                        <div
                          style={{ height: `${Math.max(12, entradasHeight)}px` }}
                          className="w-5 sm:w-6 bg-[#217a3b] rounded-t-[6px] transition-all hover:opacity-90 relative group"
                          title={`Entradas: ${formatEuro(m.entradas)}`}
                        ></div>

                        {/* Gastos bar */}
                        <div
                          style={{ height: `${Math.max(12, gastosHeight)}px` }}
                          className="w-5 sm:w-6 bg-[#b04a3f] rounded-t-[6px] transition-all hover:opacity-90 relative group"
                          title={`Gastos: ${formatEuro(m.totalGastos)}`}
                        ></div>
                      </div>

                      {/* Month Label & Profit */}
                      <div className="mt-2 text-center">
                        <div className="text-xs font-bold text-[#111111]">
                          {m.label.split(" ")[0]}
                        </div>
                        <div className="text-[11px] font-bold text-[#217a3b] mt-0.5">
                          {formatEuro(m.lucro)}
                        </div>
                        <div className="text-[10px] text-[#8e8e93]">
                          margem {m.marginPct.toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Month-over-Month Detailed Table */}
          <div className="bg-white border border-[#ececf0] rounded-[22px] p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[17px] font-bold text-[#111111]">
                  Matriz de Resultados Mês a Mês (MoM)
                </h3>
                <p className="text-xs text-[#8e8e93]">
                  Tabela histórica com variações percentuais de lucros, eventos e despesas
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#ececf0] text-[#8e8e93]">
                    <th className="pb-3 font-semibold">Mês</th>
                    <th className="pb-3 font-semibold">Eventos</th>
                    <th className="pb-3 font-semibold">Faturação Prevista</th>
                    <th className="pb-3 font-semibold">Receitas / Entradas Reais</th>
                    <th className="pb-3 font-semibold">Custos Orçados</th>
                    <th className="pb-3 font-semibold">Gastos Reais</th>
                    <th className="pb-3 font-semibold">Lucro Projetado</th>
                    <th className="pb-3 font-semibold">Lucro Realizado</th>
                    <th className="pb-3 font-semibold">Pendente a Receber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ececf0]">
                  {availableMonths.map((m) => {
                    const isProfitPositive = m.lucro >= 0;
                    const isProjPositive = m.lucroProjetado >= 0;
                    return (
                      <tr key={m.monthKey} className="hover:bg-[#f8f8fa] transition">
                        <td className="py-3.5 font-bold text-[#111111]">
                          {m.label}
                        </td>
                        <td className="py-3.5 text-[#3a3a3c]">
                          <span className="font-semibold">{m.eventsCount}</span> ev.
                          {m.eventsDelta !== 0 && (
                            <span
                              className={`ml-1 text-[10px] font-bold ${
                                m.eventsDelta > 0 ? "text-[#217a3b]" : "text-[#b04a3f]"
                              }`}
                            >
                              ({m.eventsDelta > 0 ? `+${m.eventsDelta}` : m.eventsDelta})
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 font-bold text-[#111111]">
                          {formatEuro(m.faturacaoProjetada)}
                        </td>
                        <td className="py-3.5 font-semibold text-[#217a3b]">
                          {formatEuro(m.entradas)}
                        </td>
                        <td className="py-3.5 font-medium text-[#b04a3f]">
                          {formatEuro(m.custosProjetados)}
                        </td>
                        <td className="py-3.5 font-semibold text-[#b04a3f]">
                          {formatEuro(m.totalGastos)}
                        </td>
                        <td
                          className={`py-3.5 font-bold ${
                            isProjPositive ? "text-[#217a3b]" : "text-[#b04a3f]"
                          }`}
                        >
                          {formatEuro(m.lucroProjetado)}
                        </td>
                        <td
                          className={`py-3.5 font-bold text-sm ${
                            isProfitPositive ? "text-[#217a3b]" : "text-[#b04a3f]"
                          }`}
                        >
                          {formatEuro(m.lucro)}
                        </td>
                        <td className="py-3.5 font-semibold text-[#6366f1]">
                          {formatEuro(m.aReceber)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3.1 SUBTAB: RENTABILIDADE POR EVENTO (PROJETADO VS ATUAL) */}
      {/* ========================================================= */}
      {subTab === "events-profitability" && (
        <div className="space-y-6">
          {/* Summary KPI Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border border-[#ececf0] rounded-[18px] p-4 shadow-xs">
              <div className="text-[11px] text-[#8e8e93] font-medium">Eventos Filtrados</div>
              <div className="text-xl font-bold text-[#111] mt-1">{eventProfitabilityList.length}</div>
              <div className="text-[10px] text-[#8e8e93] mt-0.5">no período selecionado</div>
            </div>

            <div className="bg-white border border-[#ececf0] rounded-[18px] p-4 shadow-xs">
              <div className="text-[11px] text-[#8e8e93] font-medium">Faturação Prevista</div>
              <div className="text-xl font-bold text-[#111] mt-1">
                {formatEuro(eventProfitabilityList.reduce((s, e) => s + e.precoClienteProjetado, 0))}
              </div>
              <div className="text-[10px] text-[#8e8e93] mt-0.5">total cobrado aos clientes</div>
            </div>

            <div className="bg-white border border-[#ececf0] rounded-[18px] p-4 shadow-xs">
              <div className="text-[11px] text-[#8e8e93] font-medium">Custos Orçados</div>
              <div className="text-xl font-bold text-[#b04a3f] mt-1">
                {formatEuro(eventProfitabilityList.reduce((s, e) => s + e.custoOrcadoProjetado, 0))}
              </div>
              <div className="text-[10px] text-[#8e8e93] mt-0.5">orçamento interno</div>
            </div>

            <div className="bg-white border border-[#217a3b]/20 bg-[#eaf8ee]/30 rounded-[18px] p-4 shadow-xs">
              <div className="text-[11px] text-[#217a3b] font-bold">Lucro Projetado</div>
              <div className="text-xl font-bold text-[#217a3b] mt-1">
                {formatEuro(eventProfitabilityList.reduce((s, e) => s + e.lucroProjetado, 0))}
              </div>
              <div className="text-[10px] text-[#217a3b] font-semibold mt-0.5">
                margem est. {
                  eventProfitabilityList.reduce((s, e) => s + e.precoClienteProjetado, 0) > 0
                    ? ((eventProfitabilityList.reduce((s, e) => s + e.lucroProjetado, 0) / eventProfitabilityList.reduce((s, e) => s + e.precoClienteProjetado, 0)) * 100).toFixed(1)
                    : 0
                }%
              </div>
            </div>

            <div className="bg-white border border-[#ececf0] rounded-[18px] p-4 shadow-xs">
              <div className="text-[11px] text-[#8e8e93] font-medium">Recebido em Caixa</div>
              <div className="text-xl font-bold text-[#217a3b] mt-1">
                {formatEuro(eventProfitabilityList.reduce((s, e) => s + e.entradasReais, 0))}
              </div>
              <div className="text-[10px] text-[#8e8e93] mt-0.5">pagamentos liquidados</div>
            </div>

            <div className="bg-white border border-[#ececf0] rounded-[18px] p-4 shadow-xs">
              <div className="text-[11px] text-[#8e8e93] font-medium">Pendente a Receber</div>
              <div className="text-xl font-bold text-[#6366f1] mt-1">
                {formatEuro(eventProfitabilityList.reduce((s, e) => s + e.saldoAReceber, 0))}
              </div>
              <div className="text-[10px] text-[#8e8e93] mt-0.5">a liquidar por clientes</div>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white border border-[#ececf0] rounded-[22px] p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-bold text-[#111111]">
                  Rentabilidade Individual de Eventos
                </h3>
                <p className="text-xs text-[#8e8e93] mt-0.5">
                  Confronte o valor e lucro projetado no setup de cada evento com os recebimentos e despesas reais de caixa
                </p>
              </div>

              {/* Search & Sort Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    placeholder="Pesquisar evento, cliente, venue..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-[#f8f8fa] border border-[#ececf0] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#007aff] w-52"
                  />
                </div>

                <select
                  value={eventStatusFilter}
                  onChange={(e) => setEventStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#f8f8fa] border border-[#ececf0] rounded-[10px] text-[#111] focus:outline-none focus:ring-2 focus:ring-[#007aff] cursor-pointer"
                >
                  <option value="todos">Todos os Estados</option>
                  <option value="planeamento">Planeamento</option>
                  <option value="orcamento">Orçamento</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="em_curso">Em Curso</option>
                  <option value="concluido">Concluído</option>
                </select>

                <select
                  value={eventSortBy}
                  onChange={(e) => setEventSortBy(e.target.value as any)}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#f8f8fa] border border-[#ececf0] rounded-[10px] text-[#111] focus:outline-none focus:ring-2 focus:ring-[#007aff] cursor-pointer"
                >
                  <option value="date">Ordenar por Data</option>
                  <option value="profit_desc">Maior Lucro Projetado</option>
                  <option value="price_desc">Maior Faturação Prevista</option>
                  <option value="pending_desc">Maior Saldo a Receber</option>
                </select>
              </div>
            </div>

            {/* Event Profitability Table */}
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#ececf0] text-[#8e8e93]">
                    <th className="pb-3 font-semibold">Evento & Cliente</th>
                    <th className="pb-3 font-semibold">Data / Estado</th>
                    <th className="pb-3 font-semibold">Preço Cliente (Proj.)</th>
                    <th className="pb-3 font-semibold">Custo Orçado (Proj.)</th>
                    <th className="pb-3 font-semibold">Lucro Projetado</th>
                    <th className="pb-3 font-semibold">Recebido em Caixa</th>
                    <th className="pb-3 font-semibold">Despesas Reais</th>
                    <th className="pb-3 font-semibold">Lucro Realizado</th>
                    <th className="pb-3 font-semibold">Saldo a Receber</th>
                    <th className="pb-3 font-semibold text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ececf0]">
                  {eventProfitabilityList.map((item) => {
                    const isFullyPaid = item.precoClienteProjetado > 0 && item.saldoAReceber === 0;
                    const isProfitPositive = item.lucroProjetado >= 0;

                    return (
                      <tr key={item.event.id} className="hover:bg-[#f8f8fa] transition group">
                        <td className="py-3.5 pr-2">
                          <div className="font-bold text-[#111111] text-[13px] flex items-center gap-1.5">
                            <span>{item.event.name}</span>
                            {item.event.category && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#f2f2f5] text-[#636366] font-normal">
                                {item.event.category}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#8e8e93] mt-0.5 flex items-center gap-2">
                            <span>{item.client?.name || "Sem cliente associado"}</span>
                            {item.event.venue && (
                              <>
                                <span>·</span>
                                <span>{item.event.venue}</span>
                              </>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 whitespace-nowrap">
                          <div className="font-medium text-[#111]">
                            {new Date(item.event.startDate).toLocaleDateString("pt-PT", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold capitalize bg-[#f2f2f5] text-[#3a3a3c] border border-[#ececf0]">
                            {item.event.status}
                          </span>
                        </td>

                        {/* Preço Cliente Projetado */}
                        <td className="py-3.5 font-bold text-[#111] whitespace-nowrap">
                          {formatEuro(item.precoClienteProjetado)}
                        </td>

                        {/* Custo Orçado Projetado */}
                        <td className="py-3.5 font-medium text-[#b04a3f] whitespace-nowrap">
                          {formatEuro(item.custoOrcadoProjetado)}
                        </td>

                        {/* Lucro Projetado */}
                        <td className="py-3.5 whitespace-nowrap">
                          <div className={`font-bold text-sm ${isProfitPositive ? "text-[#217a3b]" : "text-[#b04a3f]"}`}>
                            {formatEuro(item.lucroProjetado)}
                          </div>
                          <div className="text-[10px] font-semibold text-[#8e8e93]">
                            margem {item.margemProjetadaPct.toFixed(1)}%
                          </div>
                        </td>

                        {/* Recebido em Caixa (Realizado) */}
                        <td className="py-3.5 whitespace-nowrap">
                          <div className="font-semibold text-[#217a3b]">
                            {formatEuro(item.entradasReais)}
                          </div>
                          {/* Payment Progress Bar */}
                          <div className="w-20 bg-[#ececf0] h-1.5 rounded-full overflow-hidden mt-1">
                            <div
                              style={{ width: `${item.paymentProgressPct}%` }}
                              className={`h-full rounded-full ${
                                isFullyPaid ? "bg-[#217a3b]" : "bg-[#6366f1]"
                              }`}
                            ></div>
                          </div>
                          <div className="text-[10px] text-[#8e8e93] mt-0.5">
                            {item.paymentProgressPct}% liquidado
                          </div>
                        </td>

                        {/* Despesas Reais Pagas */}
                        <td className="py-3.5 font-semibold text-[#b04a3f] whitespace-nowrap">
                          {formatEuro(item.despesasReais)}
                        </td>

                        {/* Lucro Realizado */}
                        <td className="py-3.5 whitespace-nowrap">
                          <div className={`font-bold ${item.lucroRealizado >= 0 ? "text-[#217a3b]" : "text-[#b04a3f]"}`}>
                            {formatEuro(item.lucroRealizado)}
                          </div>
                        </td>

                        {/* Saldo a Receber */}
                        <td className="py-3.5 whitespace-nowrap">
                          {item.saldoAReceber > 0 ? (
                            <span className="font-bold text-[#6366f1]">
                              {formatEuro(item.saldoAReceber)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[#217a3b] font-bold text-[11px]">
                              <Check className="w-3 h-3" />
                              <span>Totalmente Pago</span>
                            </span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.saldoAReceber > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenIncomeForEvent(item)}
                                className="px-2.5 py-1 rounded-[8px] bg-[#217a3b] hover:bg-[#1b6330] text-white font-semibold text-[11px] transition inline-flex items-center gap-1 cursor-pointer shadow-xs"
                                title="Registar recebimento de cliente para este evento"
                              >
                                <Coins className="w-3 h-3" />
                                <span>Receber</span>
                              </button>
                            )}

                            <Link
                              href={`/eventos/${item.event.id}`}
                              className="px-2.5 py-1 rounded-[8px] bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[#111111] font-semibold text-[11px] transition inline-flex items-center gap-1 cursor-pointer"
                              title="Abrir detalhes operacionais do evento"
                            >
                              <span>Ver</span>
                              <ExternalLink className="w-3 h-3 text-[#8e8e93]" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {eventProfitabilityList.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-xs text-[#8e8e93]">
                        Nenhum evento encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. SUBTAB 2: MONTHLY EXPENSES (ADD & REMOVE) */}
      {/* ========================================================= */}
      {subTab === "expenses" && (
        <div className="space-y-6">
          {/* Category breakdown bar cards */}
          <div className="bg-white border border-[#ececf0] rounded-[22px] p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-[17px] font-bold text-[#111111]">
                  Despesas por Categoria ({activeMetrics.label})
                </h3>
                <p className="text-xs text-[#8e8e93]">
                  Distribuição de gastos operacionais, rendas, fornecedores e materiais
                </p>
              </div>

              <button
                onClick={() => setShowAddExpenseModal(true)}
                className="px-3.5 py-2 rounded-[12px] bg-[#111111] hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Despesa Mensal</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {categorySpending.map(([cat, amount]) => {
                const pct =
                  activeMetrics.totalGastos > 0
                    ? (amount / activeMetrics.totalGastos) * 100
                    : 0;
                return (
                  <div
                    key={cat}
                    className="p-3.5 rounded-[16px] bg-[#f8f8fa] border border-[#ececf0] flex flex-col justify-between"
                  >
                    <div className="text-[11px] text-[#8e8e93] font-medium truncate">
                      {cat}
                    </div>
                    <div className="text-base font-bold text-[#b04a3f] mt-1">
                      {formatEuro(amount)}
                    </div>
                    <div className="w-full bg-[#e5e5ea] h-1.5 rounded-full overflow-hidden mt-2">
                      <div
                        style={{ width: `${pct}%` }}
                        className="bg-[#b04a3f] h-full rounded-full"
                      ></div>
                    </div>
                    <div className="text-[10px] text-[#8e8e93] mt-1 text-right">
                      {pct.toFixed(0)}% do total
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Expenses List & Removal Table */}
          <div className="bg-white border border-[#ececf0] rounded-[22px] p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[17px] font-bold text-[#111111]">
                  Registo de Despesas Mensais
                </h3>
                <p className="text-xs text-[#8e8e93]">
                  Adicione novas despesas ou remova custos desnecessários com atualização imediata
                </p>
              </div>

              <div className="text-xs text-[#8e8e93]">
                Total de <strong className="text-[#111]">{filteredExpenses.length}</strong> despesas
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#ececf0] text-[#8e8e93]">
                    <th className="pb-3 font-semibold">Data</th>
                    <th className="pb-3 font-semibold">Descrição</th>
                    <th className="pb-3 font-semibold">Categoria</th>
                    <th className="pb-3 font-semibold">Tipo</th>
                    <th className="pb-3 font-semibold">Valor (€)</th>
                    <th className="pb-3 font-semibold text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ececf0]">
                  {filteredExpenses.map((m) => {
                    const isInvestment = m.type === "investimento";
                    const isStockAuto =
                      m.notes?.includes("Despesa gerada automaticamente") ||
                      m.category === "Material / Stock";

                    return (
                      <tr key={m.id} className="hover:bg-[#f8f8fa] transition group">
                        <td className="py-3.5 text-[#8e8e93] font-mono whitespace-nowrap">
                          {new Date(m.date).toLocaleDateString("pt-PT")}
                        </td>
                        <td className="py-3.5 pr-2">
                          <div className="font-bold text-[#111111]">{m.description}</div>
                          {m.notes && (
                            <div className="text-[10px] text-[#8e8e93] mt-0.5 line-clamp-1">
                              {m.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f2f2f5] text-[#3a3a3c] border border-[#ececf0]">
                            {m.category}
                          </span>
                        </td>
                        <td className="py-3.5">
                          {isStockAuto ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fff4df] text-[#8c6417] border border-[#f5dfa8]">
                              Compra Stock
                            </span>
                          ) : isInvestment ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fff4df] text-[#8c6417] border border-[#f5dfa8]">
                              Investimento
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fde8e8] text-[#b04a3f] border border-[#f8b4b4]">
                              Despesa
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 font-bold text-[#b04a3f] whitespace-nowrap">
                          −{formatEuro(m.amount)}
                        </td>
                        <td className="py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => setMovementToDelete(m)}
                            className="px-2.5 py-1 rounded-[8px] hover:bg-rose-50 text-[#8e8e93] hover:text-rose-600 transition flex items-center gap-1 ml-auto cursor-pointer"
                            title="Remover esta despesa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-semibold">Remover</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-xs text-[#8e8e93]">
                        Nenhuma despesa registada para este período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. SUBTAB 3: MOST USED INVENTORY ITEMS */}
      {/* ========================================================= */}
      {subTab === "inventory" && (
        <div className="space-y-6">
          {/* Top 3 Podium Cards */}
          {mostUsedItems.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {mostUsedItems.slice(0, 3).map((itemUsage, idx) => {
                const rankBadges = [
                  { label: "1º Mais Utilizado", color: "bg-[#fff8e1] text-[#b78103] border-[#ffe082]" },
                  { label: "2º Mais Utilizado", color: "bg-[#f5f5f7] text-[#424242] border-[#e0e0e0]" },
                  { label: "3º Mais Utilizado", color: "bg-[#fbe9e7] text-[#bf360c] border-[#ffccbc]" },
                ];
                const badge = rankBadges[idx];

                return (
                  <div
                    key={itemUsage.itemId}
                    className="bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-xs flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                        <span className="text-xs font-mono text-[#8e8e93]">
                          {itemUsage.item.sku}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        {itemUsage.item.imageUrl ? (
                          <img
                            src={itemUsage.item.imageUrl}
                            alt={itemUsage.item.name}
                            className="w-14 h-14 rounded-[12px] object-cover border border-[#ececf0]"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-[12px] bg-[#f8f8fa] flex items-center justify-center text-[#8e8e93]">
                            <Package className="w-6 h-6" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-[#111111] truncate">
                            {itemUsage.item.name}
                          </h4>
                          <div className="text-xs text-[#8e8e93] mt-0.5">
                            {itemUsage.item.category}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-[#f4f4f6] pt-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[#8e8e93]">Qtd. Total Requisitada:</span>
                        <strong className="text-sm font-bold text-[#111111]">
                          {itemUsage.totalAllocatedQty} un.
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#8e8e93]">Eventos onde participou:</span>
                        <strong className="text-[#111111]">
                          {itemUsage.eventsCount} eventos
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#8e8e93]">Faturação Estimada:</span>
                        <strong className="text-[#217a3b] font-bold">
                          {formatEuro(itemUsage.estimatedRevenue)}
                        </strong>
                      </div>

                      <div className="pt-2">
                        <Link
                          href={`/inventario/${itemUsage.itemId}`}
                          className="w-full py-1.5 rounded-[10px] bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[#111] font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>Ver Ficha de Stock</span>
                          <ExternalLink className="w-3 h-3 text-[#8e8e93]" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Complete Ranking Table */}
          <div className="bg-white border border-[#ececf0] rounded-[22px] p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[17px] font-bold text-[#111111]">
                  Classificação Completa de Utilização de Inventário
                </h3>
                <p className="text-xs text-[#8e8e93]">
                  Materiais mais requisitados pelas produções CFM, frequência e volume financeiro
                </p>
              </div>

              <div className="text-xs text-[#8e8e93]">
                <strong className="text-[#111]">{mostUsedItems.length}</strong> artigos catalogados
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#ececf0] text-[#8e8e93]">
                    <th className="pb-3 font-semibold">Posição</th>
                    <th className="pb-3 font-semibold">Artigo</th>
                    <th className="pb-3 font-semibold">Categoria</th>
                    <th className="pb-3 font-semibold">Qtd. Requisitada</th>
                    <th className="pb-3 font-semibold">Presença em Eventos</th>
                    <th className="pb-3 font-semibold">Taxa de Rotação</th>
                    <th className="pb-3 font-semibold">Receita Gerada</th>
                    <th className="pb-3 font-semibold text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ececf0]">
                  {mostUsedItems.map((entry, idx) => {
                    const maxQty = mostUsedItems[0]?.totalAllocatedQty || 1;
                    const barPct = (entry.totalAllocatedQty / maxQty) * 100;

                    return (
                      <tr key={entry.itemId} className="hover:bg-[#f8f8fa] transition">
                        <td className="py-3.5 font-bold text-[#111111]">
                          #{idx + 1}
                        </td>
                        <td className="py-3.5">
                          <div className="flex items-center gap-2.5">
                            {entry.item.imageUrl ? (
                              <img
                                src={entry.item.imageUrl}
                                alt={entry.item.name}
                                className="w-8 h-8 rounded-[8px] object-cover border border-[#ececf0]"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-[8px] bg-[#f8f8fa] flex items-center justify-center text-[#8e8e93]">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-[#111111]">
                                {entry.item.name}
                              </div>
                              <div className="text-[10px] text-[#8e8e93] font-mono">
                                {entry.item.sku}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 text-[#3a3a3c]">
                          {entry.item.category}
                        </td>
                        <td className="py-3.5">
                          <div className="font-bold text-[#111111]">
                            {entry.totalAllocatedQty} un.
                          </div>
                          <div className="w-24 bg-[#ececf0] h-1.5 rounded-full overflow-hidden mt-1">
                            <div
                              style={{ width: `${barPct}%` }}
                              className="bg-[#007aff] h-full rounded-full"
                            ></div>
                          </div>
                        </td>
                        <td className="py-3.5 text-[#3a3a3c]">
                          <span className="font-semibold">{entry.eventsCount}</span> eventos
                        </td>
                        <td className="py-3.5 font-semibold text-[#111111]">
                          {entry.utilizationRate.toFixed(0)}%
                        </td>
                        <td className="py-3.5 font-bold text-[#217a3b]">
                          {formatEuro(entry.estimatedRevenue)}
                        </td>
                        <td className="py-3.5 text-right">
                          <Link
                            href={`/inventario/${entry.itemId}`}
                            className="px-2.5 py-1 rounded-[8px] bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[#111111] font-semibold text-[11px] transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>Ver</span>
                            <ArrowUpRight className="w-3 h-3 text-[#8e8e93]" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. MODAL: ADICIONAR DESPESA MENSAL */}
      {/* ========================================================= */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[22px] w-full max-w-md border border-[#ececf0] shadow-xl overflow-y-auto max-h-[calc(100dvh-2rem)] p-5 sm:p-6 text-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[17px] font-bold text-[#111111]">
                  Adicionar Despesa Mensal
                </h2>
                <p className="text-[11px] text-[#8e8e93] mt-0.5">
                  Registo de custo operacional, fornecedor ou despesa fixa
                </p>
              </div>
              <button
                onClick={() => setShowAddExpenseModal(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {expenseError && (
              <div className="mb-4 p-3 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {expenseError}
              </div>
            )}

            <form onSubmit={handleAddExpenseSubmit} className="space-y-3.5">
              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">
                  Descrição da Despesa *
                </label>
                <input
                  type="text"
                  required
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="Ex: Renda Armazém Loures, Eletricidade, Seguro de Frota"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">
                    Valor (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">
                    Data / Mês *
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">
                  Categoria da Despesa
                </label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                >
                  <option value="Rendas & Instalações">Rendas & Instalações</option>
                  <option value="Utilidades">Utilidades (Eletricidade, Água, Net)</option>
                  <option value="Salários & Equipa">Salários & Equipa Operacional</option>
                  <option value="Seguros">Seguros & Licenças</option>
                  <option value="Material / Stock">Material / Stock & Compras</option>
                  <option value="Transporte">Transporte, Combustível & Portagens</option>
                  <option value="Subscrições & Software">Subscrições & Software ERP</option>
                  <option value="Fornecedor">Fornecedores AV, Som & Luz</option>
                  <option value="Outros">Outras Despesas</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">
                  Evento Associado (Opcional)
                </label>
                <select
                  value={expenseEventId}
                  onChange={(e) => setExpenseEventId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                >
                  <option value="">Geral / Despesa de Armazém</option>
                  {events.filter((ev) => countsForFinance(ev)).map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} ({new Date(ev.startDate).toLocaleDateString("pt-PT")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">
                  Notas / Observações
                </label>
                <input
                  type="text"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  placeholder="Ex: Fatura FT-2026/891 referente a Novembro"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>

              <div className="p-3 rounded-[12px] bg-[#f8f8fa] border border-[#ececf0] flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-[#111111]">
                    Despesa Fixa Recorrente
                  </div>
                  <div className="text-[11px] text-[#8e8e93]">
                    Marcar para identificação em despesas mensais regulares
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 text-[#007aff] rounded cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingExpense}
                className="w-full py-2.5 rounded-[12px] bg-[#111111] hover:bg-black text-white text-xs font-bold transition shadow-xs mt-2 cursor-pointer"
              >
                {isSubmittingExpense ? "A guardar despesa..." : "Registar Despesa Mensal"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6.1 MODAL: REGISTAR RECEBIMENTO / PAGAMENTO DE CLIENTE */}
      {/* ========================================================= */}
      {showAddIncomeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[22px] w-full max-w-md border border-[#ececf0] shadow-xl overflow-y-auto max-h-[calc(100dvh-2rem)] p-5 sm:p-6 text-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#eaf8ee] flex items-center justify-center text-[#217a3b]">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-[17px] font-bold text-[#111111]">
                    Registar Recebimento de Cliente
                  </h2>
                  <p className="text-[11px] text-[#8e8e93]">
                    Liquidação total ou adiantamento de cliente para um evento
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddIncomeModal(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {incomeError && (
              <div className="mb-4 p-3 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-700 text-xs">
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
                      const item = eventProfitabilityList.find((x) => x.event.id === ev.id);
                      if (item) {
                        setIncomeAmount(String(item.saldoAReceber > 0 ? item.saldoAReceber : item.precoClienteProjetado));
                      }
                      setIncomeDesc(`Recebimento Cliente · ${ev.name}`);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#217a3b]"
                >
                  <option value="">Selecione o evento...</option>
                  {events.filter((ev) => countsForFinance(ev)).map((ev) => (
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
                    className="w-full px-3 py-2 text-sm font-bold bg-white border border-[#ececf0] rounded-[12px] text-[#217a3b] focus:outline-none focus:ring-2 focus:ring-[#217a3b]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#111111] mb-1">
                    Data do Recebimento *
                  </label>
                  <input
                    type="date"
                    required
                    value={incomeDate}
                    onChange={(e) => setIncomeDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#217a3b]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#111111] mb-1">
                  Descrição do Movimento *
                </label>
                <input
                  type="text"
                  required
                  value={incomeDesc}
                  onChange={(e) => setIncomeDesc(e.target.value)}
                  placeholder="Ex: Pagamento final Gala Mastercard"
                  className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#217a3b]"
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
                  className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#217a3b]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingIncome || !incomeAmount.trim()}
                className="w-full py-2.5 rounded-[12px] bg-[#217a3b] hover:bg-[#1b6330] text-white text-xs font-bold transition shadow-xs mt-2 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Coins className="w-4 h-4" />
                <span>{isSubmittingIncome ? "A registar entrada..." : "Confirmar Recebimento em Caixa"}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. MODAL: CONFIRMAR REMOÇÃO DE DESPESA */}
      {/* ========================================================= */}
      {movementToDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[22px] w-full max-w-sm border border-[#ececf0] shadow-xl p-5 sm:p-6 text-xs space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#111111]">
                  Remover Despesa?
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
                Categoria: {movementToDelete.category}
              </div>
              <div className="text-base font-bold text-[#b04a3f] pt-1">
                −{formatEuro(movementToDelete.amount)}
              </div>
            </div>

            <p className="text-[#8e8e93] text-[11px]">
              O valor será eliminado do extrato e os cálculos de despesas e lucros mês a mês serão recalculados imediatamente.
            </p>

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
