"use client";

import React, { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  Layers,
  Package,
  FileText,
  DollarSign,
  Users,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Copy,
  Check,
  Building2,
  X,
  Wrench,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { createEventAction, createQuoteAction } from "@/app/actions";

interface Props {
  initialEvents: any[];
  initialItems: any[];
  initialClients: any[];
  initialQuotes: any[];
  initialMovements: any[];
  initialTemplate: any;
}

export default function EventFlowApp({
  initialEvents,
  initialItems,
  initialClients,
  initialQuotes,
  initialMovements,
  initialTemplate,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    "home" | "calendar" | "events" | "inventory" | "quotes" | "finance" | "clients"
  >("home");

  const [eventsList, setEventsList] = useState(initialEvents);
  const [quotesList, setQuotesList] = useState(initialQuotes);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Wizard Modals
  const [showEventWizard, setShowEventWizard] = useState(false);
  const [showQuoteWizard, setShowQuoteWizard] = useState(false);

  // Mini Calendar State
  // Default to October 2026 to match prototype sample events
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date("2026-10-01"));
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(6);

  // Financial aggregates
  const totalEntradas = initialMovements
    .filter((m) => m.type === "entrada")
    .reduce((sum, m) => sum + m.amount, 0);

  const totalSaidas = initialMovements
    .filter((m) => m.type === "saida")
    .reduce((sum, m) => sum + m.amount, 0);

  const totalInvestido = initialMovements
    .filter((m) => m.type === "investimento")
    .reduce((sum, m) => sum + m.amount, 0);

  const resultadoLiquido = totalEntradas - totalSaidas - totalInvestido;

  const handleStatusChange = (eventId: string, newStatus: string) => {
    setEventsList((prev) =>
      prev.map((evt) => (evt.id === eventId ? { ...evt, status: newStatus } : evt))
    );
  };

  const copyQuoteLink = (token: string) => {
    const url = `${window.location.origin}/proposta/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    planeamento: { bg: "bg-gray-100", text: "text-gray-700", label: "Planeamento" },
    orcamento: { bg: "bg-purple-100", text: "text-purple-700", label: "Orçamento" },
    confirmado: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Confirmado" },
    preparacao: { bg: "bg-amber-100", text: "text-amber-700", label: "Preparação" },
    em_curso: { bg: "bg-blue-100", text: "text-blue-700", label: "Em curso" },
    devolucao: { bg: "bg-teal-100", text: "text-teal-700", label: "Devolução" },
    concluido: { bg: "bg-green-100", text: "text-green-700", label: "Concluído" },
    cancelado: { bg: "bg-rose-100", text: "text-rose-700", label: "Cancelado" },
  };

  // Calendar calculations
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0

  // Find events on dates in current month
  const eventsByDay = useMemo(() => {
    const map = new Map<number, any[]>();
    eventsList.forEach((evt) => {
      const d = new Date(evt.startDate);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        const list = map.get(day) || [];
        list.push(evt);
        map.set(day, list);
      }
    });
    return map;
  }, [eventsList, year, month]);

  const monthName = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(
    currentCalendarDate
  );

  const selectedDayEvents = selectedCalendarDay ? eventsByDay.get(selectedCalendarDay) || [] : [];

  return (
    <div className="min-h-screen bg-[#f8f8fa] pb-24 text-[#111111]">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-[#ececf0] px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center font-black text-sm tracking-tighter shadow-sm">
              EF
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-[#111111]">EventFlow</span>
              <span className="text-xs text-[#8e8e93] ml-2">CFM Eventos</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#eaf8ee] text-[#24793a]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34c759]"></span>
              Turso Edge DB Conectado
            </span>
            <div className="w-8 h-8 rounded-full bg-[#ececf0] flex items-center justify-center text-xs font-semibold text-[#555]">
              CFM
            </div>
          </div>
        </div>
      </header>

      {/* Main Content View */}
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* TAB 1: HOME */}
        {activeTab === "home" && (
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#8e8e93] absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Pesquisar artigos, eventos, clientes, orçamentos..."
                className="w-full bg-white border border-[#ececf0] rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#007aff] shadow-xs"
              />
            </div>

            {/* Financial Overview Card */}
            <div className="bg-white border border-[#ececf0] rounded-2xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold tracking-tight">Resumo Financeiro Operacional</h2>
                  <p className="text-xs text-[#8e8e93]">Valores em tempo real calculados pelo ledger</p>
                </div>
                <button
                  onClick={() => setActiveTab("finance")}
                  className="text-xs font-medium text-[#007aff] hover:underline"
                >
                  Ver detalhe →
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-[#f8f8fa] border border-[#ececf0]">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#24793a] mb-1">
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>Entradas</span>
                  </div>
                  <div className="text-xl font-bold tracking-tight">
                    €{totalEntradas.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-[#8e8e93] mt-0.5">Recebido este período</div>
                </div>

                <div className="p-4 rounded-xl bg-[#f8f8fa] border border-[#ececf0]">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#a62a24] mb-1">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Saídas</span>
                  </div>
                  <div className="text-xl font-bold tracking-tight">
                    €{totalSaidas.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-[#8e8e93] mt-0.5">Despesas operacionais</div>
                </div>

                <div className="p-4 rounded-xl bg-[#f8f8fa] border border-[#ececf0]">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#845000] mb-1">
                    <Package className="w-3.5 h-3.5" />
                    <span>Investido</span>
                  </div>
                  <div className="text-xl font-bold tracking-tight">
                    €{totalInvestido.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-[#8e8e93] mt-0.5">Novo material & stock</div>
                </div>

                <div className="p-4 rounded-xl bg-[#f8f8fa] border border-[#ececf0]">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#007aff] mb-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Resultado Líquido</span>
                  </div>
                  <div className="text-xl font-bold tracking-tight">
                    €{resultadoLiquido.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-[#8e8e93] mt-0.5">Entradas − saídas − invest.</div>
                </div>
              </div>

              {/* 2 ACTION BUTTONS UNDER FINANCE: Novo evento & Novo orcamento */}
              <div className="mt-5 pt-4 border-t border-[#ececf0] flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setShowEventWizard(true)}
                  className="px-4 py-2.5 rounded-xl bg-[#007aff] hover:bg-[#0062cc] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo evento</span>
                </button>

                <button
                  onClick={() => setShowQuoteWizard(true)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-[#ececf0] hover:bg-[#f2f2f5] text-[#111111] text-xs font-bold flex items-center gap-2 shadow-xs transition"
                >
                  <FileText className="w-4 h-4 text-[#007aff]" />
                  <span>Novo orçamento</span>
                </button>
              </div>
            </div>

            {/* ROW 1: 2/3 PROXIMOS EVENTOS + 1/3 CALENDAR PICKER */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 2/3 Column: Próximos Eventos */}
              <div className="lg:col-span-8 bg-white border border-[#ececf0] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold tracking-tight">Próximos eventos</h2>
                      <p className="text-xs text-[#8e8e93]">Lista cronológica com detalhes e estado operacional</p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#f2f2f5] text-[#3a3a3c]">
                      {eventsList.length} eventos
                    </span>
                  </div>

                  {/* List of Events */}
                  <div className="divide-y divide-[#ececf0]">
                    {eventsList.map((evt) => {
                      const d = new Date(evt.startDate);
                      const dayNumber = d.getDate().toString().padStart(2, "0");
                      const monthShort = d
                        .toLocaleDateString("pt-PT", { month: "short" })
                        .replace(".", "")
                        .toUpperCase();

                      const formattedDateHour = `${d.getDate()} de ${d.toLocaleDateString("pt-PT", {
                        month: "long",
                      })} · ${d.toLocaleTimeString("pt-PT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`;

                      const statusInfo = statusColors[evt.status] || {
                        bg: "bg-gray-100",
                        text: "text-gray-700",
                        label: evt.status,
                      };

                      return (
                        <div
                          key={evt.id}
                          className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          {/* Left Column: Image with Day Overlay + Title + Muted Bytext */}
                          <div className="flex items-center gap-3.5">
                            {/* Image with day badge overlay */}
                            <div className="relative w-24 h-16 sm:w-28 sm:h-18 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 shadow-xs border border-black/5">
                              {evt.coverImageUrl ? (
                                <img
                                  src={evt.coverImageUrl}
                                  alt={evt.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-[#ececf0] flex items-center justify-center text-xs font-bold text-[#8e8e93]">
                                  CFM
                                </div>
                              )}
                              {/* Day overlay pill on the image */}
                              <div className="absolute bottom-1.5 left-1.5 bg-black/75 backdrop-blur-md text-white px-2 py-0.5 rounded-lg text-center flex items-center gap-1">
                                <span className="text-xs font-black leading-none">{dayNumber}</span>
                                <span className="text-[9px] font-semibold tracking-wider text-white/80 leading-none">
                                  {monthShort}
                                </span>
                              </div>
                            </div>

                            {/* Title & Bytext */}
                            <div>
                              <h3 className="font-bold text-sm text-[#111111] hover:text-[#007aff] transition cursor-pointer">
                                {evt.name}
                              </h3>
                              <div className="text-xs text-[#8e8e93] mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span>{formattedDateHour}</span>
                                {evt.venue && (
                                  <>
                                    <span>·</span>
                                    <span className="flex items-center gap-0.5">
                                      <MapPin className="w-3 h-3 text-[#8e8e93]" />
                                      {evt.venue}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right Column: Status */}
                          <div className="flex items-center gap-2 sm:self-center">
                            <select
                              value={evt.status}
                              onChange={(e) => handleStatusChange(evt.id, e.target.value)}
                              className={`text-xs font-bold px-3 py-1.5 rounded-xl border border-transparent cursor-pointer focus:outline-none shadow-xs transition ${statusInfo.bg} ${statusInfo.text}`}
                            >
                              <option value="planeamento">Planeamento</option>
                              <option value="orcamento">Orçamento</option>
                              <option value="confirmado">Confirmado</option>
                              <option value="preparacao">Preparação</option>
                              <option value="em_curso">Em curso</option>
                              <option value="devolucao">Devolução</option>
                              <option value="concluido">Concluído</option>
                              <option value="cancelado">Cancelado</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 1/3 Column: Calendar Picker of the Current Month */}
              <div className="lg:col-span-4 bg-white border border-[#ececf0] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold tracking-tight capitalize">{monthName}</h2>
                      <p className="text-xs text-[#8e8e93]">Dias com eventos assinalados</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          setCurrentCalendarDate(
                            new Date(year, month - 1, 1)
                          )
                        }
                        className="w-7 h-7 rounded-lg border border-[#ececf0] flex items-center justify-center text-[#8e8e93] hover:text-[#111111]"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setCurrentCalendarDate(
                            new Date(year, month + 1, 1)
                          )
                        }
                        className="w-7 h-7 rounded-lg border border-[#ececf0] flex items-center justify-center text-[#8e8e93] hover:text-[#111111]"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-[#8e8e93] mb-2">
                    <div>Seg</div>
                    <div>Ter</div>
                    <div>Qua</div>
                    <div>Qui</div>
                    <div>Sex</div>
                    <div>Sáb</div>
                    <div>Dom</div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center">
                    {/* Empty leading days */}
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`blank-${i}`} className="h-8"></div>
                    ))}

                    {/* Day numbers */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const hasEvents = eventsByDay.has(day);
                      const isSelected = selectedCalendarDay === day;

                      return (
                        <button
                          key={`day-${day}`}
                          onClick={() => setSelectedCalendarDay(day)}
                          className={`h-8 rounded-lg text-xs font-semibold relative flex flex-col items-center justify-center transition ${
                            isSelected
                              ? "bg-[#007aff] text-white shadow-xs font-bold"
                              : hasEvents
                              ? "bg-[#eaf8ee] text-[#24793a] font-bold hover:bg-[#d8f2df]"
                              : "text-[#3a3a3c] hover:bg-[#f2f2f5]"
                          }`}
                        >
                          <span>{day}</span>
                          {hasEvents && !isSelected && (
                            <span className="w-1 h-1 rounded-full bg-[#34c759] absolute bottom-1"></span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Day Event Preview */}
                <div className="mt-5 pt-4 border-t border-[#ececf0]">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#8e8e93] mb-2">
                    {selectedCalendarDay
                      ? `Eventos no dia ${selectedCalendarDay} de ${monthName}`
                      : "Seleciona um dia"}
                  </div>

                  {selectedDayEvents.length > 0 ? (
                    <div className="space-y-2">
                      {selectedDayEvents.map((e) => (
                        <div
                          key={e.id}
                          className="p-2.5 rounded-xl bg-[#f8f8fa] border border-[#ececf0] text-xs flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-[#111111]">{e.name}</span>
                            <div className="text-[11px] text-[#8e8e93]">
                              {e.venue || "Local a confirmar"}
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#007aff] border border-[#ececf0]">
                            {e.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-[#8e8e93] italic py-2">
                      Nenhum evento agendado para esta data.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ROW 2: 2/3 INVENTÁRIO + 1/3 ACTIONABLE ITEMS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 2/3 Column: Inventário */}
              <div className="lg:col-span-8 bg-white border border-[#ececf0] rounded-2xl p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold tracking-tight">Inventário & Stock Disponível</h2>
                    <p className="text-xs text-[#8e8e93]">
                      Catálogo de materiais, stock em armazém e reservas ativas
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("inventory")}
                    className="text-xs font-semibold text-[#007aff] hover:underline"
                  >
                    Ver catálogo completo →
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {initialItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-[#ececf0] bg-[#fafafa] flex gap-3.5 items-center"
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-black/5">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#8e8e93] uppercase">
                            {item.sku}
                          </span>
                          <span className="text-xs font-bold text-[#007aff]">
                            €{item.unitPrice.toFixed(2)}/dia
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-[#111111] truncate">{item.name}</h4>
                        <div className="text-[11px] text-[#8e8e93] mt-0.5">{item.warehouseLocation}</div>

                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="text-[#8e8e93]">Stock total:</span>
                          <span className="font-bold text-[#111111]">{item.totalQuantity} un.</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 1/3 Column: Actionable Items & Alerts */}
              <div className="lg:col-span-4 bg-white border border-[#ececf0] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold tracking-tight">Ações Requeridas</h2>
                      <p className="text-xs text-[#8e8e93]">Pontos críticos que exigem intervenção</p>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                  </div>

                  <div className="space-y-3">
                    {/* Action 1: Low stock */}
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/60 text-xs">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-amber-900 block">Stock Baixo: Vela LED Âmbar</span>
                          <span className="text-amber-800/80 text-[11px] block mt-0.5">
                            Apenas 8 disponíveis. Stock mínimo (20) em risco para a Mastercard Gala.
                          </span>
                        </div>
                      </div>
                      <div className="mt-2.5 flex justify-end">
                        <button
                          onClick={() => setActiveTab("inventory")}
                          className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold text-[10px] hover:bg-amber-100/50"
                        >
                          Ver stock
                        </button>
                      </div>
                    </div>

                    {/* Action 2: Damaged gear */}
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/60 text-xs">
                      <div className="flex items-start gap-2.5">
                        <Wrench className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-rose-900 block">3 Cadeiras Chiavari Danificadas</span>
                          <span className="text-rose-800/80 text-[11px] block mt-0.5">
                            Devolvidas com avaria no evento anterior. Requerem reparação ou abate.
                          </span>
                        </div>
                      </div>
                      <div className="mt-2.5 flex justify-end">
                        <button
                          onClick={() => alert("Triagem de manutenção aberta para MOB-CHA-001")}
                          className="px-2.5 py-1 rounded-lg bg-white border border-rose-300 text-rose-900 font-bold text-[10px] hover:bg-rose-100/50"
                        >
                          Fazer triagem
                        </button>
                      </div>
                    </div>

                    {/* Action 3: Upcoming event needing prep */}
                    <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200/60 text-xs">
                      <div className="flex items-start gap-2.5">
                        <Clock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-blue-900 block">Preparação Pendente</span>
                          <span className="text-blue-800/80 text-[11px] block mt-0.5">
                            Mastercard Gala (6 Out): faltam carregar 214 unidades para o camião.
                          </span>
                        </div>
                      </div>
                      <div className="mt-2.5 flex justify-end">
                        <button
                          onClick={() => setActiveTab("events")}
                          className="px-2.5 py-1 rounded-lg bg-white border border-blue-300 text-blue-900 font-bold text-[10px] hover:bg-blue-100/50"
                        >
                          Ver ficha de carga
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#ececf0] text-[11px] text-[#8e8e93] text-center">
                  Todos os alertas são atualizados em tempo real com base no armazém.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CALENDAR FULL */}
        {activeTab === "calendar" && (
          <div className="bg-white border border-[#ececf0] rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Calendário Completo de Produção</h2>
                <p className="text-xs text-[#8e8e93]">
                  Visão cronológica de eventos, preparações em armazém e devoluções
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#f2f2f5] text-[#3a3a3c]">
                  Calendly Auto-Sync Ativo
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {eventsList.map((evt) => (
                <div
                  key={evt.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-[#ececf0] hover:border-[#007aff]/40 transition gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#f8f8fa] flex flex-col items-center justify-center text-center">
                      <span className="text-xs font-bold text-[#007aff]">
                        {new Date(evt.startDate).toLocaleDateString("pt-PT", { month: "short" }).toUpperCase()}
                      </span>
                      <span className="text-sm font-black">
                        {new Date(evt.startDate).getDate()}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-sm">{evt.name}</h3>
                      <div className="text-xs text-[#8e8e93] flex items-center gap-2 mt-0.5">
                        <span>{evt.venue}</span>
                        <span>·</span>
                        <span>
                          {new Date(evt.startDate).toLocaleTimeString("pt-PT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <select
                      value={evt.status}
                      onChange={(e) => handleStatusChange(evt.id, e.target.value)}
                      className="text-xs font-medium bg-[#f8f8fa] border border-[#ececf0] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#007aff]"
                    >
                      <option value="planeamento">Planeamento</option>
                      <option value="orcamento">Orçamento</option>
                      <option value="confirmado">Confirmado</option>
                      <option value="preparacao">Preparação</option>
                      <option value="em_curso">Em curso</option>
                      <option value="devolucao">Devolução</option>
                      <option value="concluido">Concluído</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: EVENTS PIPELINE */}
        {activeTab === "events" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Pipeline de Eventos</h2>
                <p className="text-xs text-[#8e8e93]">
                  Acompanhamento de estágios operacionais da CFM Eventos
                </p>
              </div>
              <button
                onClick={() => setShowEventWizard(true)}
                className="px-3.5 py-2 rounded-xl bg-[#007aff] hover:bg-[#0062cc] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Novo evento</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {eventsList.map((evt) => {
                const statusInfo = statusColors[evt.status] || {
                  bg: "bg-gray-100",
                  text: "text-gray-700",
                  label: evt.status,
                };

                return (
                  <div
                    key={evt.id}
                    className="bg-white border border-[#ececf0] rounded-2xl p-5 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusInfo.bg} ${statusInfo.text}`}
                        >
                          {statusInfo.label}
                        </span>
                        <span className="text-xs text-[#8e8e93]">
                          {new Date(evt.startDate).toLocaleDateString("pt-PT", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>

                      <h3 className="font-bold text-base tracking-tight text-[#111111]">{evt.name}</h3>
                      <p className="text-xs text-[#8e8e93] mt-1 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {evt.venue}
                      </p>

                      {evt.notes && (
                        <p className="text-xs text-[#555] mt-3 p-2.5 rounded-xl bg-[#f8f8fa] border border-[#ececf0] line-clamp-2">
                          {evt.notes}
                        </p>
                      )}
                    </div>

                    <div className="mt-5 pt-3 border-t border-[#ececf0] flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-[#8e8e93] uppercase font-bold">Alterar Estado</div>
                        <select
                          value={evt.status}
                          onChange={(e) => handleStatusChange(evt.id, e.target.value)}
                          className="text-xs font-semibold bg-transparent text-[#007aff] cursor-pointer focus:outline-none"
                        >
                          <option value="planeamento">Planeamento</option>
                          <option value="orcamento">Orçamento</option>
                          <option value="confirmado">Confirmado</option>
                          <option value="preparacao">Preparação</option>
                          <option value="em_curso">Em curso</option>
                          <option value="devolucao">Devolução</option>
                          <option value="concluido">Concluído</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] text-[#8e8e93] uppercase font-bold">Orçamento</div>
                        <div className="text-xs font-bold">
                          €{evt.totalBudget?.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: INVENTORY FULL */}
        {activeTab === "inventory" && (
          <div className="bg-white border border-[#ececf0] rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Inventário & Material de Aluguer</h2>
                <p className="text-xs text-[#8e8e93]">
                  Catálogo com localização de armazém, controlo de stocks e avarias
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 text-xs rounded-full bg-[#f2f2f5] font-semibold">
                  {initialItems.length} Artigos Registados
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {initialItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#ececf0] p-4 bg-[#fafafa] flex flex-col justify-between"
                >
                  <div>
                    {item.imageUrl && (
                      <div className="h-32 w-full rounded-xl overflow-hidden mb-3 bg-gray-100">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#8e8e93] tracking-wider uppercase">
                        {item.sku}
                      </span>
                      <span className="text-xs font-bold text-[#007aff]">
                        €{item.unitPrice.toFixed(2)} / dia
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-[#111111] mt-0.5">{item.name}</h3>
                    <div className="text-xs text-[#8e8e93] mt-1">{item.category}</div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#ececf0] space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8e8e93]">Localização:</span>
                      <span className="font-medium text-[#111111]">{item.warehouseLocation}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8e8e93]">Stock Total:</span>
                      <span className="font-bold text-[#111111]">{item.totalQuantity} un.</span>
                    </div>
                    <div className="w-full bg-[#ececf0] h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#34c759] h-full w-[70%]"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: QUOTES FULL */}
        {activeTab === "quotes" && (
          <div className="bg-white border border-[#ececf0] rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Orçamentos & Links de Adjudicação</h2>
                <p className="text-xs text-[#8e8e93]">
                  Propostas comerciais com aprovação digital instantânea do cliente
                </p>
              </div>
              <button
                onClick={() => setShowQuoteWizard(true)}
                className="px-3.5 py-2 rounded-xl bg-[#007aff] hover:bg-[#0062cc] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Novo orçamento</span>
              </button>
            </div>

            <div className="space-y-4">
              {quotesList.map((q) => {
                const isApproved = q.status === "aprovado";
                return (
                  <div
                    key={q.id}
                    className="p-5 rounded-2xl border border-[#ececf0] bg-[#fafafa] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-[#111111]">{q.quoteNumber}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            isApproved
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isApproved ? "✓ Aprovado pelo Cliente" : "Aguardando Aprovação"}
                        </span>
                      </div>
                      <div className="text-xs text-[#8e8e93]">
                        Subtotal: €{q.subtotal.toFixed(2)} · IVA (23%): €{q.vatAmount.toFixed(2)}
                      </div>
                      <div className="text-sm font-bold text-[#111111] mt-1">
                        Total: €{q.total.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyQuoteLink(q.accessToken)}
                        className="px-3.5 py-2 rounded-xl bg-white border border-[#ececf0] text-xs font-semibold text-[#111111] hover:bg-[#f2f2f5] flex items-center gap-1.5 transition shadow-xs"
                      >
                        {copiedToken === q.accessToken ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#34c759]" />
                            <span>Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Link de Aprovação</span>
                          </>
                        )}
                      </button>

                      <a
                        href={`/proposta/${q.accessToken}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-[#007aff] hover:bg-[#0062cc] text-xs font-semibold text-white flex items-center gap-1.5 transition shadow-xs"
                      >
                        <span>Abrir Proposta</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 6: FINANCE FULL */}
        {activeTab === "finance" && (
          <div className="bg-white border border-[#ececf0] rounded-2xl p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Livro de Movimentos Financeiros</h2>
              <p className="text-xs text-[#8e8e93]">
                Registo de entradas, despesas de produção e investimento em material
              </p>
            </div>

            <div className="divide-y divide-[#ececf0]">
              {initialMovements.map((mov) => {
                const isEntrada = mov.type === "entrada";
                const isSaida = mov.type === "saida";

                return (
                  <div key={mov.id} className="py-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          isEntrada
                            ? "bg-emerald-100 text-emerald-700"
                            : isSaida
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {isEntrada ? "+" : "-"}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-[#111111]">
                          {mov.description}
                        </div>
                        <div className="text-[#8e8e93] text-[11px] mt-0.5">
                          {mov.category} · {new Date(mov.date).toLocaleDateString("pt-PT")}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`text-sm font-bold ${
                        isEntrada ? "text-[#24793a]" : "text-[#111111]"
                      }`}
                    >
                      {isEntrada ? "+" : "-"}€
                      {mov.amount.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 7: CLIENTS FULL */}
        {activeTab === "clients" && (
          <div className="bg-white border border-[#ececf0] rounded-2xl p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight">CRM & Diretório de Clientes</h2>
              <p className="text-xs text-[#8e8e93]">
                Registo de clientes corporativos, contactos particulares e leads do Calendly
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {initialClients.map((c) => (
                <div
                  key={c.id}
                  className="p-5 rounded-2xl border border-[#ececf0] bg-[#fafafa] flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="w-8 h-8 rounded-xl bg-white border border-[#ececf0] flex items-center justify-center text-xs font-bold text-[#111111]">
                        <Building2 className="w-4 h-4" />
                      </span>
                      {c.source === "calendly" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                          via Calendly
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-sm text-[#111111]">{c.name}</h3>
                    {c.contactName && (
                      <div className="text-xs text-[#8e8e93] mt-0.5">Contacto: {c.contactName}</div>
                    )}
                    {c.email && <div className="text-xs text-[#8e8e93] mt-0.5">{c.email}</div>}
                    {c.phone && <div className="text-xs text-[#8e8e93] mt-0.5">{c.phone}</div>}
                  </div>

                  {c.notes && (
                    <div className="mt-3 pt-3 border-t border-[#ececf0] text-[11px] text-[#555]">
                      {c.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* NOVO EVENTO WIZARD MODAL */}
      {showEventWizard && (
        <EventWizardModal
          clients={initialClients}
          onClose={() => setShowEventWizard(false)}
          onCreated={(newEvent) => {
            setEventsList((prev) => [newEvent, ...prev]);
            setShowEventWizard(false);
          }}
        />
      )}

      {/* NOVO ORCAMENTO WIZARD MODAL */}
      {showQuoteWizard && (
        <QuoteWizardModal
          clients={initialClients}
          events={eventsList}
          inventory={initialItems}
          onClose={() => setShowQuoteWizard(false)}
          onCreated={(newQuote) => {
            setQuotesList((prev) => [newQuote, ...prev]);
            setShowQuoteWizard(false);
          }}
        />
      )}

      {/* Floating Bottom Navigation Bar (Apple Style) */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md border border-[#ececf0] shadow-lg rounded-2xl px-3 py-2 flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => setActiveTab("home")}
          className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition ${
            activeTab === "home" ? "text-[#007aff] font-bold" : "text-[#8e8e93] hover:text-[#111111]"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Início</span>
        </button>

        <button
          onClick={() => setActiveTab("calendar")}
          className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition ${
            activeTab === "calendar" ? "text-[#007aff] font-bold" : "text-[#8e8e93] hover:text-[#111111]"
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Calendário</span>
        </button>

        <button
          onClick={() => setActiveTab("events")}
          className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition ${
            activeTab === "events" ? "text-[#007aff] font-bold" : "text-[#8e8e93] hover:text-[#111111]"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Eventos</span>
        </button>

        <button
          onClick={() => setActiveTab("inventory")}
          className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition ${
            activeTab === "inventory" ? "text-[#007aff] font-bold" : "text-[#8e8e93] hover:text-[#111111]"
          }`}
        >
          <Package className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Stock</span>
        </button>

        <button
          onClick={() => setActiveTab("quotes")}
          className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition ${
            activeTab === "quotes" ? "text-[#007aff] font-bold" : "text-[#8e8e93] hover:text-[#111111]"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Orçamentos</span>
        </button>

        <button
          onClick={() => setActiveTab("finance")}
          className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition ${
            activeTab === "finance" ? "text-[#007aff] font-bold" : "text-[#8e8e93] hover:text-[#111111]"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Financeiro</span>
        </button>

        <button
          onClick={() => setActiveTab("clients")}
          className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition ${
            activeTab === "clients" ? "text-[#007aff] font-bold" : "text-[#8e8e93] hover:text-[#111111]"
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Clientes</span>
        </button>
      </nav>
    </div>
  );
}

// -------------------------------------------------------------
// EVENT WIZARD MODAL COMPONENT
// -------------------------------------------------------------
function EventWizardModal({
  clients,
  onClose,
  onCreated,
}: {
  clients: any[];
  onClose: () => void;
  onCreated: (event: any) => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [venue, setVenue] = useState("");
  const [startDate, setStartDate] = useState("2026-10-15T18:00");
  const [endDate, setEndDate] = useState("2026-10-15T23:59");
  const [prepDate, setPrepDate] = useState("2026-10-14T09:00");
  const [returnDate, setReturnDate] = useState("2026-10-16T12:00");
  const [status, setStatus] = useState("planeamento");
  const [totalBudget, setTotalBudget] = useState("3500");
  const [notes, setNotes] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState(
    "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=600&q=80"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("clientId", clientId);
      formData.set("venue", venue);
      formData.set("startDate", startDate);
      formData.set("endDate", endDate);
      formData.set("prepDate", prepDate);
      formData.set("returnDate", returnDate);
      formData.set("status", status);
      formData.set("totalBudget", totalBudget);
      formData.set("notes", notes);
      formData.set("coverImageUrl", coverImageUrl);

      const res = await createEventAction(formData);

      onCreated({
        id: res.id,
        name,
        clientId,
        venue,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        prepDate: new Date(prepDate),
        returnDate: new Date(returnDate),
        status,
        totalBudget: parseFloat(totalBudget || "0"),
        notes,
        coverImageUrl,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg border border-[#ececf0] shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#ececf0] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#007aff] uppercase tracking-wider">
              Passo {step} de 3
            </div>
            <h2 className="text-base font-bold text-[#111111]">Novo Evento</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Nome do Evento *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Gala de Natal Santander"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Cliente Associado</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.contactName || "Sem contacto"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Localização / Venue</label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Ex: Pavilhão Carlos Lopes, Lisboa"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">URL Fotografia de Capa</label>
                <input
                  type="url"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">Início do Evento *</label>
                  <input
                    type="datetime-local"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">Fim do Evento</label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#f8f8fa] border border-[#ececf0] rounded-xl space-y-3">
                <div className="font-bold text-[11px] text-[#007aff] uppercase tracking-wider">
                  Datas Logísticas de Armazém
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-[#555] mb-1">Carga / Montagem</label>
                    <input
                      type="datetime-local"
                      value={prepDate}
                      onChange={(e) => setPrepDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#ececf0] rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-[#555] mb-1">Devolução Armazém</label>
                    <input
                      type="datetime-local"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#ececf0] rounded-lg focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Estado Inicial</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                >
                  <option value="planeamento">Planeamento</option>
                  <option value="orcamento">Orçamento</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="preparacao">Preparação</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Orçamento Estimado (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={totalBudget}
                  onChange={(e) => setTotalBudget(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Notas Operacionais</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Necessária equipa de 4 montadores e carrinha extra."
                  className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="pt-4 border-t border-[#ececf0] flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 rounded-xl bg-white border border-[#ececf0] text-xs font-bold hover:bg-[#f2f2f5]"
              >
                Voltar
              </button>
            ) : (
              <div></div>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="px-4 py-2 rounded-xl bg-[#007aff] text-white text-xs font-bold hover:bg-[#0062cc]"
              >
                Continuar
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#007aff] hover:bg-[#0062cc] text-white text-xs font-bold shadow-xs transition"
              >
                {isSubmitting ? "A criar evento..." : "Criar Evento"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// NOVO ORÇAMENTO WIZARD MODAL COMPONENT
// -------------------------------------------------------------
function QuoteWizardModal({
  clients,
  events,
  inventory,
  onClose,
  onCreated,
}: {
  clients: any[];
  events: any[];
  inventory: any[];
  onClose: () => void;
  onCreated: (quote: any) => void;
}) {
  const [step, setStep] = useState(1);
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [eventId, setEventId] = useState(events[0]?.id || "");
  const [validityDays, setValidityDays] = useState("15");

  // Selected lines
  const [lines, setLines] = useState<
    Array<{ itemId?: string; description: string; quantity: number; unitPrice: number }>
  >([
    {
      itemId: inventory[0]?.id,
      description: inventory[0]?.name || "Cadeira Chiavari Dourada",
      quantity: 50,
      unitPrice: inventory[0]?.unitPrice || 6.0,
    },
    {
      description: "Produção e montagem técnica",
      quantity: 1,
      unitPrice: 850.0,
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        itemId: inventory[0]?.id,
        description: inventory[0]?.name || "Artigo",
        quantity: 10,
        unitPrice: inventory[0]?.unitPrice || 5.0,
      },
    ]);
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, key: string, value: any) => {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [key]: value } : l))
    );
  };

  const subtotal = lines.reduce((sum, l) => sum + (l.quantity * l.unitPrice), 0);
  const vatAmount = subtotal * 0.23;
  const total = subtotal + vatAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const quoteNumber = `ORC-2026-${Math.floor(100 + Math.random() * 900)}`;
      const formData = new FormData();
      formData.set("quoteNumber", quoteNumber);
      formData.set("clientId", clientId);
      formData.set("eventId", eventId);
      formData.set("validityDays", validityDays);
      formData.set("lines", JSON.stringify(lines));

      const res = await createQuoteAction(formData);

      onCreated({
        id: res.id,
        quoteNumber,
        clientId,
        eventId,
        accessToken: res.accessToken,
        status: "enviado",
        subtotal,
        vatAmount,
        total,
        createdAt: new Date(),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl border border-[#ececf0] shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#ececf0] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#007aff] uppercase tracking-wider">
              Passo {step} de 3
            </div>
            <h2 className="text-base font-bold text-[#111111]">Novo Orçamento</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Cliente</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Evento Associado</label>
                <select
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                >
                  {events.map((evt) => (
                    <option key={evt.id} value={evt.id}>
                      {evt.name} ({new Date(evt.startDate).toLocaleDateString("pt-PT")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Validade da Proposta (Dias)</label>
                <input
                  type="number"
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#111111]">Linhas de Artigos & Serviços</span>
                <button
                  type="button"
                  onClick={addLine}
                  className="text-xs font-bold text-[#007aff] hover:underline"
                >
                  + Adicionar linha
                </button>
              </div>

              <div className="space-y-2.5 max-h-60 overflow-y-auto">
                {lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#f8f8fa] border border-[#ececf0] rounded-xl grid grid-cols-12 gap-2 items-center"
                  >
                    <div className="col-span-6">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => updateLine(idx, "description", e.target.value)}
                        placeholder="Descrição"
                        className="w-full px-2 py-1 bg-white border border-[#ececf0] rounded-lg text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, "quantity", parseInt(e.target.value || "1", 10))}
                        className="w-full px-2 py-1 bg-white border border-[#ececf0] rounded-lg text-xs text-center"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(idx, "unitPrice", parseFloat(e.target.value || "0"))}
                        className="w-full px-2 py-1 bg-white border border-[#ececf0] rounded-lg text-xs text-right"
                      />
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="text-[#8e8e93] hover:text-rose-600"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 bg-[#f8f8fa] border border-[#ececf0] rounded-xl space-y-2">
                <div className="flex justify-between text-xs text-[#8e8e93]">
                  <span>Subtotal</span>
                  <span>€{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#8e8e93]">
                  <span>IVA (23%)</span>
                  <span>€{vatAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-[#ececf0] text-[#111111]">
                  <span>Total da Proposta</span>
                  <span className="text-[#007aff]">€{total.toFixed(2)}</span>
                </div>
              </div>

              <div className="text-[11px] text-[#8e8e93]">
                Ao gerar este orçamento, será criado um link de aprovação direta para o cliente com assinatura digital.
              </div>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="pt-4 border-t border-[#ececf0] flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 rounded-xl bg-white border border-[#ececf0] text-xs font-bold hover:bg-[#f2f2f5]"
              >
                Voltar
              </button>
            ) : (
              <div></div>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="px-4 py-2 rounded-xl bg-[#007aff] text-white text-xs font-bold hover:bg-[#0062cc]"
              >
                Continuar
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#007aff] hover:bg-[#0062cc] text-white text-xs font-bold shadow-xs transition"
              >
                {isSubmitting ? "A gerar orçamento..." : "Gerar Orçamento & Link"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
