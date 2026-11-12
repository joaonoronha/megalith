"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  X,
  Plus,
  ArrowRight,
  Calendar as CalendarIcon,
  Search,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  DollarSign,
  Package,
  Users,
  FileText,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import {
  createEventAction,
  updateEventStatusAction,
  createQuoteAction,
  createMovementAction,
  createItemAction,
  updateItemTriageAction,
  createClientAction,
  loginAction,
  logoutAction,
  createUserAction,
} from "@/app/actions";

interface Props {
  currentUser: { id: string; name: string; email: string; role: string } | null;
  initialUsers: any[];
  initialEvents: any[];
  initialItems: any[];
  initialClients: any[];
  initialQuotes: any[];
  initialMovements: any[];
  initialTemplate: any;
  initialTab?: "home" | "calendar" | "events" | "inventory" | "more";
}

// Helpers
function formatEventByline(startDate: Date | string, venue?: string | null) {
  const d = new Date(startDate);
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const months = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  const weekday = weekdays[d.getDay()] || "Dia";
  const day = d.getDate();
  const month = months[d.getMonth()] || "";
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${weekday} · ${day} ${month} · ${hours}:${minutes}${
    venue ? ` · ${venue}` : ""
  }`;
}

function getStatusStyle(status: string) {
  switch (status?.toLowerCase()) {
    case "confirmado":
      return {
        bg: "bg-[#eaf8ee]",
        text: "text-[#24793a]",
        label: "Confirmado",
      };
    case "preparacao":
    case "preparação":
      return {
        bg: "bg-[#fff4df]",
        text: "text-[#9a5b00]",
        label: "Preparação",
      };
    case "planeamento":
      return {
        bg: "bg-[#f2f2f4]",
        text: "text-[#48484a]",
        label: "Planeamento",
      };
    case "orcamento":
    case "orçamento":
      return {
        bg: "bg-[#ebf5fb]",
        text: "text-[#1b6ca8]",
        label: "Orçamento",
      };
    case "concluido":
    case "concluído":
      return {
        bg: "bg-[#ececf0]",
        text: "text-[#636366]",
        label: "Concluído",
      };
    default:
      return {
        bg: "bg-[#f2f2f4]",
        text: "text-[#48484a]",
        label: status || "Pendente",
      };
  }
}

export default function EventFlowApp({
  currentUser,
  initialUsers,
  initialEvents,
  initialItems,
  initialClients,
  initialQuotes,
  initialMovements,
  initialTemplate,
  initialTab = "home",
}: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  const getTabFromPath = (path: string): "home" | "calendar" | "events" | "inventory" | "more" => {
    if (path === "/calendario" || path === "/calendar") return "calendar";
    if (path === "/eventos" || path === "/events") return "events";
    if (path === "/inventario" || path === "/inventory") return "inventory";
    if (path === "/mais" || path === "/more") return "more";
    if (path === "/") return "home";
    return initialTab || "home";
  };

  // Core App State
  const [user, setUser] = useState(currentUser);
  const [teamUsers, setTeamUsers] = useState(initialUsers);
  const [eventsList, setEventsList] = useState(initialEvents);
  const [itemsList, setItemsList] = useState(initialItems);
  const [clientsList, setClientsList] = useState(initialClients);
  const [quotesList, setQuotesList] = useState(initialQuotes);
  const [movementsList, setMovementsList] = useState(initialMovements);

  // Search & Navigation
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<
    "home" | "calendar" | "events" | "inventory" | "more"
  >(() => getTabFromPath(pathname));

  useEffect(() => {
    setActiveTab(getTabFromPath(pathname));
  }, [pathname]);

  // Calendar State & Interactive Day Details Modal
  const [today] = useState(() => new Date());
  const [currentCalendarDate, setCurrentCalendarDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const currentCalendarYear = currentCalendarDate.getFullYear();
  const currentCalendarMonth = currentCalendarDate.getMonth();

  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
    };
  });

  const [calendarPopupDate, setCalendarPopupDate] = useState<{
    year: number;
    month: number;
    day: number;
  } | null>(null);

  const [eventWizardInitialDate, setEventWizardInitialDate] = useState<string | null>(null);
  const [activeStatusDropdown, setActiveStatusDropdown] = useState<string | null>(
    null
  );

  // Modals
  const [showEventWizard, setShowEventWizard] = useState(false);
  const [showQuoteWizard, setShowQuoteWizard] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showItemWizard, setShowItemWizard] = useState(false);
  const [showClientWizard, setShowClientWizard] = useState(false);
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [triageItem, setTriageItem] = useState<any>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [selectedEventForQuote, setSelectedEventForQuote] = useState<string>("");

  // Copied link feedback
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Financial aggregates
  const totalEntradas = movementsList
    .filter((m) => m.type === "entrada")
    .reduce((sum, m) => sum + m.amount, 0);

  const totalSaidas = movementsList
    .filter((m) => m.type === "saida")
    .reduce((sum, m) => sum + m.amount, 0);

  const totalInvestido = movementsList
    .filter((m) => m.type === "investimento")
    .reduce((sum, m) => sum + m.amount, 0);

  const resultadoLiquido = totalEntradas - totalSaidas - totalInvestido;

  // Change Event Status handler
  const handleStatusChange = async (eventId: string, newStatus: string) => {
    setActiveStatusDropdown(null);
    // Optimistic update
    setEventsList((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, status: newStatus } : e))
    );
    startTransition(async () => {
      await updateEventStatusAction(eventId, newStatus);
    });
  };

  // Triage Repair handler
  const handleRepairItem = async (itemId: string) => {
    setItemsList((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, damagedQuantity: 0, inMaintenanceQuantity: 0 }
          : item
      )
    );
    startTransition(async () => {
      await updateItemTriageAction(itemId, "repair_all");
    });
    setShowTriageModal(false);
  };

  // Filtered Events
  const filteredEvents = eventsList.filter((e) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      e.name?.toLowerCase().includes(term) ||
      e.venue?.toLowerCase().includes(term) ||
      e.status?.toLowerCase().includes(term)
    );
  });

  // Filtered Inventory
  const filteredItems = itemsList.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.name?.toLowerCase().includes(term) ||
      item.sku?.toLowerCase().includes(term) ||
      item.category?.toLowerCase().includes(term) ||
      item.warehouseLocation?.toLowerCase().includes(term)
    );
  });

  // Dynamic Calendar Calculations
  const daysInMonth = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
  const firstDayOfWeek = (new Date(currentCalendarYear, currentCalendarMonth, 1).getDay() + 6) % 7;

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const currentMonthName = monthNames[currentCalendarMonth];

  const handlePrevMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarYear, currentCalendarMonth - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarYear, currentCalendarMonth + 1, 1));
  };
  const handleTodayMonth = () => {
    const now = new Date();
    setCurrentCalendarDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate({
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
    });
  };

  const getEventsForCalendarDay = (day: number, month = currentCalendarMonth, year = currentCalendarYear) => {
    return eventsList.filter((e) => {
      if (!e.startDate) return false;
      const d = new Date(e.startDate);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  // Days with events in current calendar month
  const eventDays = new Set(
    eventsList
      .filter((e) => {
        if (!e.startDate) return false;
        const d = new Date(e.startDate);
        return d.getFullYear() === currentCalendarYear && d.getMonth() === currentCalendarMonth;
      })
      .map((e) => new Date(e.startDate).getDate())
  );

  // Events for selected day (matches selectedDate day, month and year)
  const eventsForSelectedDay = getEventsForCalendarDay(
    selectedDate.day,
    selectedDate.month,
    selectedDate.year
  );

  const handleCalendarDayClick = (day: number, month = currentCalendarMonth, year = currentCalendarYear) => {
    setSelectedDate({ year, month, day });
    setCalendarPopupDate({ year, month, day });
  };

  const eventsForPopupDate = calendarPopupDate
    ? getEventsForCalendarDay(calendarPopupDate.day, calendarPopupDate.month, calendarPopupDate.year)
    : [];

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#111111] pb-28 font-sans antialiased">
      {/* Main Content Area */}
      <main className="max-w-[940px] mx-auto px-4 pt-8 pb-10">
        {/* ========================================================= */}
        {/* TAB 1: HOME */}
        {/* ========================================================= */}
        {activeTab === "home" && (
          <section className="space-y-4">
            {/* Header Greeting */}
            <div className="mb-4">
              <h1 className="text-[36px] sm:text-[39px] font-extrabold tracking-[-1.5px] text-[#111111] leading-none mb-3.5">
                Olá CFM Eventos.
              </h1>

              {/* Search bar matching prototype */}
              <div className="w-full max-w-[720px] h-[50px] bg-white border border-[#ececf0] rounded-[15px] px-4 flex items-center gap-3 shadow-[0_1px_0_rgba(0,0,0,0.015)]">
                <Search className="w-4 h-4 text-[#8e8e93]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquisar artigos, eventos, clientes..."
                  className="w-full text-[14px] text-[#111111] placeholder-[#8e8e93] bg-transparent outline-none"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="p-1 rounded-full text-[#8e8e93] hover:text-[#111] hover:bg-[#f2f2f5]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* 2 Buttons under Search / Greeting */}
              <div className="flex flex-wrap items-center gap-2.5 mt-3">
                <button
                  onClick={() => setShowEventWizard(true)}
                  className="min-h-[44px] px-4 py-2.5 rounded-[12px] bg-[#111111] hover:bg-black text-white text-[13px] font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <span className="text-base font-normal leading-none">＋</span>
                  <span>Novo evento</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedEventForQuote("");
                    setShowQuoteWizard(true);
                  }}
                  className="min-h-[44px] px-4 py-2.5 rounded-[12px] bg-white border border-black/10 hover:bg-[#f8f8fa] text-[#111111] text-[13px] font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <span className="text-base font-normal leading-none">＋</span>
                  <span>Novo orçamento</span>
                </button>
              </div>
            </div>

            {/* Resumo Financeiro Card */}
            <div className="bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
              {/* Head */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[18px] font-bold tracking-[-0.35px] text-[#111111]">
                    Resumo financeiro
                  </div>
                  <div className="text-[12px] text-[#8e8e93]">
                    Outubro 2026 · valores operacionais CFM
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setShowLedgerModal(true)}
                    className="text-[13px] font-semibold text-[#007aff] hover:underline cursor-pointer"
                  >
                    Ver detalhe →
                  </button>
                  <button
                    onClick={() => setShowMovementModal(true)}
                    className="w-[34px] h-[34px] rounded-full bg-[#1c1c1e] text-white flex items-center justify-center font-bold text-base hover:bg-black transition shadow-xs cursor-pointer"
                    aria-label="Novo movimento"
                    title="Adicionar entrada, saída ou investimento"
                  >
                    ＋
                  </button>
                </div>
              </div>

              {/* 4 Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-[#f7f7f9] border border-black/[0.035] rounded-[16px] p-3.5">
                  <div className="text-[12px] text-[#8e8e93] mb-1.5">Entradas</div>
                  <div className="text-[24px] font-bold tracking-[-0.7px] text-[#217a3b]">
                    €{totalEntradas.toLocaleString("pt-PT")}
                  </div>
                  <div className="text-[11px] text-[#8e8e93] mt-1">Recebido este mês</div>
                </div>

                <div className="bg-[#f7f7f9] border border-black/[0.035] rounded-[16px] p-3.5">
                  <div className="text-[12px] text-[#8e8e93] mb-1.5">Saídas</div>
                  <div className="text-[24px] font-bold tracking-[-0.7px] text-[#b04a3f]">
                    €{totalSaidas.toLocaleString("pt-PT")}
                  </div>
                  <div className="text-[11px] text-[#8e8e93] mt-1">Despesas operacionais</div>
                </div>

                <div className="bg-[#f7f7f9] border border-black/[0.035] rounded-[16px] p-3.5">
                  <div className="text-[12px] text-[#8e8e93] mb-1.5">Investido</div>
                  <div className="text-[24px] font-bold tracking-[-0.7px] text-[#8c6417]">
                    €{totalInvestido.toLocaleString("pt-PT")}
                  </div>
                  <div className="text-[11px] text-[#8e8e93] mt-1">Material e equipamento</div>
                </div>

                <div className="bg-[#f7f7f9] border border-black/[0.035] rounded-[16px] p-3.5">
                  <div className="text-[12px] text-[#8e8e93] mb-1.5">Resultado líquido</div>
                  <div className="text-[24px] font-bold tracking-[-0.7px] text-[#111111]">
                    €{resultadoLiquido.toLocaleString("pt-PT")}
                  </div>
                  <div className="text-[11px] text-[#8e8e93] mt-1">
                    Entradas − saídas − investimento
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-[#ececf0] pt-3.5 mt-3.5 text-[12px] text-[#8e8e93]">
                <div>
                  Faturado <strong className="text-[#111111] font-semibold">€15.650</strong> · A
                  receber <strong className="text-[#111111] font-semibold">€3.200</strong>
                </div>
                <div>
                  Margem operacional{" "}
                  <strong className="text-[#111111] font-semibold">
                    {totalEntradas > 0
                      ? (((totalEntradas - totalSaidas) / totalEntradas) * 100).toFixed(1)
                      : "47,6"}
                    %
                  </strong>
                </div>
              </div>
            </div>

            {/* ROW 1: 2/3 Próximos Eventos + 1/3 Calendário */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
              {/* 2/3 COLUMN: Próximos Eventos */}
              <div className="lg:col-span-8 bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[18px] font-bold tracking-[-0.35px] text-[#111111]">
                    Próximos eventos
                  </h3>
                  <Link
                    href="/eventos"
                    className="text-[12px] text-[#8e8e93] hover:text-[#007aff] cursor-pointer"
                  >
                    Ver todos ({filteredEvents.length}) →
                  </Link>
                </div>

                <div className="divide-y divide-[#f0f0f3]">
                  {filteredEvents.slice(0, 4).map((evt) => {
                    const dayBadge = String(
                      new Date(evt.startDate).getDate()
                    ).padStart(2, "0");
                    const statusObj = getStatusStyle(evt.status);
                    const isDropdownOpen = activeStatusDropdown === evt.id;

                    return (
                      <div
                        key={evt.id}
                        onClick={() => router.push(`/eventos/${evt.id}`)}
                        className="py-3 px-3 -mx-3 rounded-[16px] hover:bg-[#f8f8fa] active:bg-[#f0f0f3] flex items-center justify-between gap-3 relative cursor-pointer transition group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Image with Day Overlay */}
                          <div
                            className="w-[58px] h-[58px] rounded-[14px] flex-shrink-0 bg-cover bg-center relative overflow-hidden border border-black/5 group-hover:scale-102 transition duration-200"
                            style={{
                              backgroundImage: `url("${
                                evt.coverImageUrl ||
                                "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80"
                              }")`,
                            }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                            <span className="absolute left-2 bottom-1.5 text-white text-[13px] font-extrabold tracking-[-0.2px] drop-shadow-sm">
                              {dayBadge}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="text-[14px] font-bold text-[#111111] group-hover:text-[#007aff] transition truncate"
                              >
                                {evt.name}
                              </span>
                              <span
                                className="font-mono text-[10px] text-[#8e8e93] bg-[#fafafc] group-hover:bg-white px-1.5 py-0.5 rounded border border-[#ececf0] flex-shrink-0 transition"
                                title="ID do Evento"
                              >
                                #{evt.id}
                              </span>
                              {evt.theme && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#fef7e0] text-[#b06000] border border-[#feefc3] flex items-center gap-1 flex-shrink-0">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  <span>{evt.theme}</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[12px] text-[#8e8e93] mt-0.5 truncate">
                              {formatEventByline(evt.startDate, evt.venue)}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge with Quick State Dropdown */}
                        <div
                          className="relative flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() =>
                              setActiveStatusDropdown(
                                isDropdownOpen ? null : evt.id
                              )
                            }
                            className={`px-3 py-1 rounded-full text-[12px] font-semibold ${statusObj.bg} ${statusObj.text} hover:opacity-85 transition cursor-pointer flex items-center gap-1`}
                            title="Clique para alterar estado"
                          >
                            <span>{statusObj.label}</span>
                            <span className="text-[9px] opacity-60">▼</span>
                          </button>

                          {isDropdownOpen && (
                            <div className="absolute right-0 top-full mt-1.5 z-30 bg-white border border-[#ececf0] rounded-xl shadow-lg p-1.5 w-36 text-xs space-y-1">
                              {[
                                "confirmado",
                                "preparacao",
                                "planeamento",
                                "orcamento",
                                "concluido",
                              ].map((st) => (
                                <button
                                  key={st}
                                  onClick={() => handleStatusChange(evt.id, st)}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#f5f5f7] flex items-center justify-between font-medium capitalize"
                                >
                                  <span>{st}</span>
                                  {evt.status === st && (
                                    <Check className="w-3.5 h-3.5 text-[#007aff]" />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {filteredEvents.length === 0 && (
                    <div className="py-8 text-center text-xs text-[#8e8e93]">
                      Nenhum evento encontrado para "{searchTerm}".
                    </div>
                  )}
                </div>
              </div>

              {/* 1/3 COLUMN: Calendar Picker */}
              <div className="lg:col-span-4 bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[18px] font-bold tracking-[-0.35px] text-[#111111]">
                      {currentMonthName}
                    </div>
                    <div className="text-[12px] text-[#8e8e93]">{currentCalendarYear}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handlePrevMonth}
                      className="p-1 rounded-lg hover:bg-[#f2f2f5] text-[#8e8e93] hover:text-[#111] transition cursor-pointer"
                      title="Mês anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleTodayMonth}
                      className="px-1.5 py-0.5 rounded-lg hover:bg-[#f2f2f5] text-[10px] font-bold text-[#8e8e93] hover:text-[#111] transition cursor-pointer"
                      title="Ir para hoje"
                    >
                      Hoje
                    </button>
                    <button
                      onClick={handleNextMonth}
                      className="p-1 rounded-lg hover:bg-[#f2f2f5] text-[#8e8e93] hover:text-[#111] transition cursor-pointer"
                      title="Mês seguinte"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <Link
                      href="/calendario"
                      className="text-[12px] text-[#8e8e93] hover:text-[#007aff] cursor-pointer ml-1"
                    >
                      Abrir →
                    </Link>
                  </div>
                </div>

                {/* Day of Week Labels */}
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[#8e8e93] font-medium mb-1">
                  <div>S</div>
                  <div>T</div>
                  <div>Q</div>
                  <div>Q</div>
                  <div>S</div>
                  <div>S</div>
                  <div>D</div>
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1 text-center text-[12px]">
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`blank-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isSelected =
                      selectedDate.year === currentCalendarYear &&
                      selectedDate.month === currentCalendarMonth &&
                      selectedDate.day === day;
                    const isToday =
                      today.getFullYear() === currentCalendarYear &&
                      today.getMonth() === currentCalendarMonth &&
                      today.getDate() === day;
                    const hasEvent = eventDays.has(day);
                    const dayEvents = getEventsForCalendarDay(day);

                    return (
                      <button
                        key={day}
                        onClick={() => handleCalendarDayClick(day)}
                        className={`h-8 flex flex-col items-center justify-center rounded-[9px] transition cursor-pointer relative ${
                          isSelected
                            ? "bg-[#111] text-white font-bold shadow-xs"
                            : isToday
                            ? "border border-[#007aff] text-[#007aff] font-bold hover:bg-[#007aff]/10"
                            : hasEvent
                            ? "bg-[#f0f0f2] text-[#3a3a3c] font-semibold hover:bg-[#e4e4e7]"
                            : "text-[#454549] hover:bg-[#f7f7f9]"
                        }`}
                        title={
                          hasEvent
                            ? `${dayEvents.length} evento(s) no dia ${day} de ${currentMonthName}`
                            : `Dia ${day} de ${currentMonthName}`
                        }
                      >
                        <span>{day}</span>
                        {hasEvent && (
                          <span
                            className={`w-1 h-1 rounded-full absolute bottom-1 ${
                              isSelected ? "bg-white" : "bg-[#007aff]"
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Date Peek */}
                <div className="mt-3.5 pt-3 border-t border-[#ececf0]">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider">
                      {selectedDate.day} de {monthNames[selectedDate.month]}
                      {selectedDate.year === today.getFullYear() &&
                        selectedDate.month === today.getMonth() &&
                        selectedDate.day === today.getDate() && (
                          <span className="ml-1.5 text-[#007aff] font-bold">· Hoje</span>
                        )}
                    </div>
                    <button
                      onClick={() =>
                        handleCalendarDayClick(
                          selectedDate.day,
                          selectedDate.month,
                          selectedDate.year
                        )
                      }
                      className="text-[11px] text-[#007aff] hover:underline font-semibold cursor-pointer"
                    >
                      Ver detalhes →
                    </button>
                  </div>
                  {eventsForSelectedDay.length > 0 ? (
                    <div className="space-y-1.5">
                      {eventsForSelectedDay.map((e) => (
                        <Link
                          key={e.id}
                          href={`/eventos/${e.id}`}
                          className="p-2 rounded-xl bg-[#f8f8fa] hover:bg-[#f0f0f5] cursor-pointer transition flex items-center justify-between text-xs group"
                        >
                          <div className="font-semibold truncate text-[#111] group-hover:text-[#007aff]">
                            {e.name}
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              getStatusStyle(e.status).bg
                            } ${getStatusStyle(e.status).text}`}
                          >
                            {e.status}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[12px] text-[#8e8e93]">
                      <span>Sem eventos marcados.</span>
                      <button
                        onClick={() => {
                          const formattedIsoDate = `${selectedDate.year}-${String(selectedDate.month + 1).padStart(2, "0")}-${String(selectedDate.day).padStart(2, "0")}T10:00`;
                          setEventWizardInitialDate(formattedIsoDate);
                          setShowEventWizard(true);
                        }}
                        className="text-[11px] text-[#007aff] font-bold hover:underline cursor-pointer"
                      >
                        ＋ Criar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ROW 2: 2/3 Inventário + 1/3 Alertas Importantes */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
              {/* 2/3 COLUMN: Inventário */}
              <div className="lg:col-span-8 bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[18px] font-bold tracking-[-0.35px] text-[#111111]">
                    Inventário
                  </h3>
                  <Link
                    href="/inventario"
                    className="text-[12px] text-[#8e8e93] hover:text-[#007aff] cursor-pointer"
                  >
                    Abrir inventário ({filteredItems.length}) →
                  </Link>
                </div>

                <div className="divide-y divide-[#f0f0f3]">
                  {filteredItems.slice(0, 3).map((item) => {
                    const isLow =
                      item.totalQuantity - (item.damagedQuantity || 0) <
                      item.minStock;
                    const hasDamage = (item.damagedQuantity || 0) > 0;

                    let icon = "🪑";
                    if (item.category?.toLowerCase().includes("vel") || item.category?.toLowerCase().includes("ilumin")) {
                      icon = "🕯️";
                    } else if (item.category?.toLowerCase().includes("mes")) {
                      icon = "◉";
                    } else if (item.category?.toLowerCase().includes("têxtil")) {
                      icon = "🧺";
                    }

                    return (
                      <div
                        key={item.id}
                        className="py-3 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-[42px] h-[42px] rounded-[10px] bg-[#f2f2f4] flex items-center justify-center text-[21px] flex-shrink-0">
                            {icon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/inventario/${item.id}`}
                                className="text-[14px] font-bold text-[#111111] hover:text-[#007aff] transition truncate"
                                title="Ver ficha do artigo"
                              >
                                {item.name}
                              </Link>
                              <Link
                                href={`/inventario/${item.id}`}
                                className="font-mono text-[10px] text-[#8e8e93] hover:text-[#007aff] bg-[#fafafc] hover:bg-[#f2f2f5] px-1.5 py-0.5 rounded border border-[#ececf0] flex-shrink-0 transition"
                                title="ID do Artigo"
                              >
                                #{item.id}
                              </Link>
                            </div>
                            <div className="text-[12px] text-[#8e8e93] mt-0.5 truncate">
                              {item.totalQuantity - (item.damagedQuantity || 0)} disponíveis de{" "}
                              {item.totalQuantity}
                              {hasDamage && ` (${item.damagedQuantity} danificados)`}
                            </div>
                          </div>
                        </div>

                        {hasDamage ? (
                          <span
                            onClick={() => {
                              setTriageItem(item);
                              setShowTriageModal(true);
                            }}
                            className="px-3 py-1 rounded-full text-[12px] font-semibold bg-[#ff3b30]/10 text-[#a62a24] hover:bg-[#ff3b30]/20 cursor-pointer transition"
                            title="Clique para fazer triagem"
                          >
                            Dano
                          </span>
                        ) : isLow ? (
                          <span className="px-3 py-1 rounded-full text-[12px] font-semibold bg-[#fff4df] text-[#9a5b00]">
                            Baixo
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-[12px] font-semibold bg-[#eaf8ee] text-[#24793a]">
                            Disponível
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 1/3 COLUMN: Alertas Importantes */}
              <div className="lg:col-span-4 pt-1">
                <div className="flex items-center gap-2.5 mb-2.5 px-1">
                  <div className="w-[34px] h-[34px] rounded-[11px] bg-white text-[#ff3b30] border border-[#ff3b30]/15 flex items-center justify-center font-bold text-[16px] shadow-xs">
                    !
                  </div>
                  <div>
                    <div className="text-[14px] font-bold text-[#111111]">
                      Alertas importantes
                    </div>
                    <div className="text-[12px] text-[#8e8e93]">
                      3 itens requerem atenção
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {/* Alert 1: Low stock */}
                  <Link
                    href="/inventario"
                    className="cursor-pointer bg-[#ff9f0a]/[0.115] border border-[#ff9f0a]/[0.17] text-[#845000] rounded-[15px] p-3.5 flex items-center gap-3 transition hover:opacity-90 block"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-[9px] h-[9px] rounded-full bg-[#ff9f0a] flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-[#845000]">
                          Velas LED abaixo do mínimo
                        </div>
                        <div className="text-[11px] text-[#845000]/70 mt-0.5">
                          8 disponíveis · mínimo 20
                        </div>
                      </div>
                      <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-white/70 text-[#845000]">
                        Stock
                      </span>
                    </div>
                  </Link>

                  {/* Alert 2: Damaged item with instant triage */}
                  <div
                    onClick={() => {
                      const chair = itemsList.find((i) =>
                        i.name.includes("Cadeira")
                      ) || itemsList[0];
                      setTriageItem(chair);
                      setShowTriageModal(true);
                    }}
                    className="cursor-pointer bg-[#ff3b30]/[0.09] border border-[#ff3b30]/[0.16] text-[#a62a24] rounded-[15px] p-3.5 flex items-center gap-3 transition hover:opacity-90"
                  >
                    <div className="w-[9px] h-[9px] rounded-full bg-[#ff3b30] flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-[#a62a24]">
                        3 cadeiras danificadas
                      </div>
                      <div className="text-[11px] text-[#a62a24]/70 mt-0.5">
                        Cadeira Chiavari Dourada · Fazer triagem →
                      </div>
                    </div>
                    <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-white/70 text-[#a62a24]">
                      Dano
                    </span>
                  </div>

                  {/* Alert 3: Event in prep */}
                  <Link
                    href="/eventos"
                    className="cursor-pointer bg-[#ff9f0a]/[0.115] border border-[#ff9f0a]/[0.17] text-[#845000] rounded-[15px] p-3.5 flex items-center gap-3 transition hover:opacity-90 block"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-[9px] h-[9px] rounded-full bg-[#ff9f0a] flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-[#845000]">
                          Mastercard Gala em preparação
                        </div>
                        <div className="text-[11px] text-[#845000]/70 mt-0.5">
                          Material ainda não está 100% preparado
                        </div>
                      </div>
                      <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-white/70 text-[#845000]">
                        Evento
                      </span>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* TAB 2: CALENDAR */}
        {/* ========================================================= */}
        {activeTab === "calendar" && (
          <section className="bg-white border border-[#ececf0] rounded-[22px] p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-[24px] font-bold text-[#111111]">
                    {currentMonthName} {currentCalendarYear}
                  </h2>
                  <div className="flex items-center gap-1 bg-[#f2f2f5] p-1 rounded-xl">
                    <button
                      onClick={handlePrevMonth}
                      className="p-1 rounded-lg hover:bg-white text-[#636366] hover:text-[#111] transition cursor-pointer"
                      title="Mês anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleTodayMonth}
                      className="px-2 py-0.5 rounded-lg hover:bg-white text-[11px] font-bold text-[#636366] hover:text-[#111] transition cursor-pointer"
                      title="Ir para o mês atual"
                    >
                      Hoje
                    </button>
                    <button
                      onClick={handleNextMonth}
                      className="p-1 rounded-lg hover:bg-white text-[#636366] hover:text-[#111] transition cursor-pointer"
                      title="Mês seguinte"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[#8e8e93] mt-1">
                  Clique em qualquer dia para ver o resumo dos eventos ou criar novos eventos.
                </p>
              </div>

              <button
                onClick={() => {
                  setEventWizardInitialDate(null);
                  setShowEventWizard(true);
                }}
                className="px-4 py-2 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-semibold self-start sm:self-auto flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <span>＋</span>
                <span>Novo evento</span>
              </button>
            </div>

            {/* Interactive Monthly Calendar Grid */}
            <div className="border border-[#ececf0] rounded-[20px] overflow-hidden bg-white shadow-2xs">
              <div className="grid grid-cols-7 border-b border-[#ececf0] bg-[#fafafc] text-center text-xs font-semibold text-[#8e8e93] py-2.5">
                <div>Segunda</div>
                <div>Terça</div>
                <div>Quarta</div>
                <div>Quinta</div>
                <div>Sexta</div>
                <div>Sábado</div>
                <div>Domingo</div>
              </div>

              <div className="grid grid-cols-7 divide-x divide-y divide-[#f0f0f3] bg-[#f9f9fb]">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`cal-blank-${i}`} className="min-h-[96px] bg-[#f5f5f7]/40 p-2" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dayEvents = getEventsForCalendarDay(day);
                  const isSelected =
                    selectedDate.year === currentCalendarYear &&
                    selectedDate.month === currentCalendarMonth &&
                    selectedDate.day === day;
                  const isToday =
                    today.getFullYear() === currentCalendarYear &&
                    today.getMonth() === currentCalendarMonth &&
                    today.getDate() === day;
                  const hasEvents = dayEvents.length > 0;

                  return (
                    <div
                      key={`cal-day-${day}`}
                      onClick={() => handleCalendarDayClick(day)}
                      className={`min-h-[96px] p-2 transition cursor-pointer flex flex-col justify-between group ${
                        isSelected
                          ? "bg-[#111]/[0.035] ring-2 ring-inset ring-[#111]"
                          : hasEvents
                          ? "bg-white hover:bg-[#fafafc]"
                          : "bg-white/80 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                            isSelected
                              ? "bg-[#111] text-white shadow-xs"
                              : isToday
                              ? "border-2 border-[#007aff] text-[#007aff] font-bold"
                              : hasEvents
                              ? "bg-[#2c2c2e] text-white"
                              : "text-[#48484a] group-hover:bg-[#f0f0f3]"
                          }`}
                        >
                          {day}
                        </span>

                        {hasEvents && (
                          <span className="text-[10px] font-bold text-[#24793a] bg-[#eaf8ee] px-1.5 py-0.5 rounded-full">
                            {dayEvents.length} {dayEvents.length === 1 ? "evt" : "evts"}
                          </span>
                        )}
                      </div>

                      {/* Event pills preview */}
                      <div className="space-y-1 my-1.5 flex-1 min-w-0">
                        {dayEvents.slice(0, 2).map((evt) => {
                          const statusObj = getStatusStyle(evt.status);
                          return (
                            <div
                              key={evt.id}
                              className={`px-1.5 py-0.5 rounded-[6px] text-[10px] font-semibold truncate border border-black/5 ${statusObj.bg} ${statusObj.text} flex items-center gap-1`}
                              title={evt.name}
                            >
                              <span className="w-1 h-1 rounded-full bg-current flex-shrink-0" />
                              <span className="truncate">{evt.name}</span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <div className="text-[9px] font-bold text-[#8e8e93] px-1">
                            +{dayEvents.length - 2} mais...
                          </div>
                        )}
                      </div>

                      <div className="text-[10px] text-[#8e8e93] opacity-0 group-hover:opacity-100 transition flex items-center justify-end font-semibold">
                        {hasEvents ? "Ver resumo →" : "＋ Criar"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Event Timeline List */}
            <div className="pt-2">
              <div className="text-[16px] font-bold text-[#111111] mb-3">
                Cronograma de Eventos ({eventsList.length})
              </div>
              <div className="divide-y divide-[#ececf0] border border-[#ececf0] rounded-[18px] overflow-hidden bg-white shadow-xs">
                {eventsList.map((e) => {
                  const statusObj = getStatusStyle(e.status);
                  const startDate = new Date(e.startDate);

                  return (
                    <div
                      key={e.id}
                      onClick={() => router.push(`/eventos/${e.id}`)}
                      className="p-4 bg-white hover:bg-[#fafafa] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-12 h-12 rounded-[12px] bg-[#f2f2f7] border border-black/5 flex flex-col items-center justify-center flex-shrink-0 group-hover:bg-[#111] group-hover:text-white transition duration-200">
                          <span className="text-[9px] uppercase font-bold text-[#8e8e93] group-hover:text-white/80">
                            {monthNames[startDate.getMonth()]?.slice(0, 3) || "OUT"}
                          </span>
                          <span className="text-base font-extrabold text-[#111] group-hover:text-white">
                            {startDate.getDate()}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#111] group-hover:text-[#007aff] transition truncate">
                              {e.name}
                            </span>
                            <span className="font-mono text-[10px] text-[#8e8e93] bg-[#fafafc] px-1.5 py-0.5 rounded border border-[#ececf0] flex-shrink-0">
                              #{e.id}
                            </span>
                          </div>
                          <div className="text-xs text-[#8e8e93] mt-0.5 truncate">
                            {formatEventByline(e.startDate, e.venue)}
                          </div>
                          {e.notes && (
                            <div className="text-[11px] text-[#6e6e73] mt-1 bg-[#f8f8fa] px-2 py-0.5 rounded-md inline-block truncate max-w-md">
                              {e.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${statusObj.bg} ${statusObj.text}`}
                        >
                          {statusObj.label}
                        </span>
                        <ChevronRight className="w-4 h-4 text-[#8e8e93] group-hover:text-[#111] group-hover:translate-x-0.5 transition" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* TAB 3: EVENTS */}
        {/* ========================================================= */}
        {activeTab === "events" && (
          <section className="bg-white border border-[#ececf0] rounded-[22px] p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-[22px] font-bold text-[#111111]">
                  Gestão de Eventos
                </h2>
                <p className="text-xs text-[#8e8e93]">
                  Acompanhamento de orçamento, cronograma e estado de produção
                </p>
              </div>
              <button
                onClick={() => setShowEventWizard(true)}
                className="px-4 py-2 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-auto"
              >
                <span>＋</span>
                <span>Novo evento</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3.5">
              {eventsList.map((e) => {
                const statusObj = getStatusStyle(e.status);
                const dayBadge = String(
                  new Date(e.startDate).getDate()
                ).padStart(2, "0");

                return (
                  <div
                    key={e.id}
                    onClick={() => router.push(`/eventos/${e.id}`)}
                    className="p-5 rounded-[18px] border border-[#ececf0] bg-[#fafafa] hover:bg-white hover:border-[#d2d2d7] transition flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group"
                  >
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div
                        className="w-[64px] h-[64px] rounded-[14px] bg-cover bg-center relative overflow-hidden flex-shrink-0 border border-black/5"
                        style={{
                          backgroundImage: `url("${
                            e.coverImageUrl ||
                            "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80"
                          }")`,
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                        <span className="absolute left-2 bottom-1.5 text-white text-[13px] font-extrabold">
                          {dayBadge}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/eventos/${e.id}`}
                            className="font-bold text-[16px] text-[#111] hover:text-[#007aff] transition"
                          >
                            {e.name}
                          </Link>
                          <Link
                            href={`/eventos/${e.id}`}
                            className="font-mono text-[10px] text-[#8e8e93] hover:text-[#007aff] bg-[#f2f2f5] hover:bg-[#e5e5ea] px-1.5 py-0.5 rounded border border-[#e5e5ea] transition"
                            title="ID do Evento"
                          >
                            #{e.id}
                          </Link>
                          {e.category && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f2f2f5] text-[#48484a]">
                              {e.category}
                            </span>
                          )}
                          {e.theme && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fef7e0] text-[#b06000] border border-[#feefc3] flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-[#b06000]" />
                              <span>{e.theme}</span>
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-[#8e8e93] mt-1 flex flex-wrap items-center gap-2">
                          <span>{formatEventByline(e.startDate, e.venue)}</span>
                          {/* Vibe color preview dots */}
                          {e.vibeColors && (() => {
                            try {
                              const colors = JSON.parse(e.vibeColors);
                              if (Array.isArray(colors) && colors.length > 0) {
                                return (
                                  <div className="flex items-center gap-1 ml-1" title="Vibe & Paleta do Evento">
                                    {colors.map((c: string, ci: number) => (
                                      <span
                                        key={ci}
                                        className="w-2.5 h-2.5 rounded-full border border-black/15 shadow-2xs"
                                        style={{ backgroundColor: c }}
                                      />
                                    ))}
                                  </div>
                                );
                              }
                            } catch {}
                            return null;
                          })()}
                        </div>

                        <div className="text-xs font-semibold text-[#111] mt-1.5 flex flex-wrap items-center gap-3">
                          {e.customerPrice && e.customerPrice > 0 ? (
                            <span className="text-[#137333] font-bold">
                              A Pagar (Cliente): €{e.customerPrice.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
                            </span>
                          ) : null}
                          <span className="text-[#8e8e93]">
                            Orçamento: €{(e.totalBudget || 0).toLocaleString("pt-PT")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Direct Link to Dedicated Event Page */}
                      <Link
                        href={`/eventos/${e.id}`}
                        className="px-3.5 py-1.5 rounded-[10px] bg-[#111] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition"
                      >
                        <span>Gerir Evento & Inventário</span>
                        <span>→</span>
                      </Link>

                      {/* Interactive Status Selector */}
                      <select
                        value={e.status}
                        onChange={(evt) =>
                          handleStatusChange(e.id, evt.target.value)
                        }
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full border border-black/5 outline-none cursor-pointer ${statusObj.bg} ${statusObj.text}`}
                      >
                        <option value="confirmado">Confirmado</option>
                        <option value="preparacao">Preparação</option>
                        <option value="planeamento">Planeamento</option>
                        <option value="orcamento">Orçamento</option>
                        <option value="concluido">Concluído</option>
                        <option value="cancelado">Cancelado</option>
                      </select>

                      <button
                        onClick={() => {
                          setSelectedEventForQuote(e.id);
                          setShowQuoteWizard(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white border border-[#ececf0] text-xs font-semibold text-[#111] hover:bg-[#f2f2f5] transition"
                      >
                        + Gerar Orçamento
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* TAB 4: INVENTORY */}
        {/* ========================================================= */}
        {activeTab === "inventory" && (
          <section className="bg-white border border-[#ececf0] rounded-[22px] p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-[22px] font-bold text-[#111111]">
                  Catálogo de Stock & Armazém
                </h2>
                <p className="text-xs text-[#8e8e93]">
                  Controlo de stock físico, inventário e triagem de materiais
                </p>
              </div>

              <button
                onClick={() => setShowItemWizard(true)}
                className="px-4 py-2 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
              >
                <span>＋</span>
                <span>Novo artigo</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {itemsList.map((item) => {
                const damaged = item.damagedQuantity || 0;
                const available = item.totalQuantity - damaged;
                const isLow = available < item.minStock;

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-[16px] border border-[#ececf0] bg-[#fafafa] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/inventario/${item.id}`}
                            className="text-[11px] font-bold text-[#8e8e93] hover:text-[#111] uppercase tracking-wider transition"
                            title="SKU do Artigo"
                          >
                            {item.sku}
                          </Link>
                          <Link
                            href={`/inventario/${item.id}`}
                            className="font-mono text-[10px] text-[#8e8e93] hover:text-[#007aff] bg-white px-1.5 py-0.5 rounded border border-[#ececf0] transition"
                            title="Ver ficha do artigo"
                          >
                            #{item.id}
                          </Link>
                        </div>
                        {damaged > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                            {damaged} Danificado(s)
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            Stock Baixo
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Disponível
                          </span>
                        )}
                      </div>

                      <div className="font-bold text-sm text-[#111]">
                        <Link
                          href={`/inventario/${item.id}`}
                          className="hover:text-[#007aff] transition"
                          title="Ver ficha do artigo"
                        >
                          {item.name}
                        </Link>
                      </div>
                      <div className="text-xs text-[#8e8e93] mt-0.5">
                        {item.warehouseLocation || "Armazém Principal"}
                      </div>

                      <div className="mt-3 pt-3 border-t border-[#ececf0] grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[#8e8e93]">Disponível:</span>{" "}
                          <strong className="text-[#111]">{available} un.</strong>
                        </div>
                        <div>
                          <span className="text-[#8e8e93]">Total:</span>{" "}
                          <strong className="text-[#111]">{item.totalQuantity} un.</strong>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#ececf0] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#111]">
                          €{(item.unitPrice || 0).toFixed(2)}/dia
                        </span>
                        <Link
                          href={`/inventario/${item.id}`}
                          className="text-[11px] font-semibold text-[#007aff] hover:underline"
                        >
                          Ver ficha →
                        </Link>
                      </div>

                      {damaged > 0 && (
                        <button
                          onClick={() => {
                            setTriageItem(item);
                            setShowTriageModal(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#111] text-white text-[11px] font-semibold hover:bg-black transition"
                        >
                          Fazer triagem
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* TAB 5: MORE (CRM, Quotes, Finance & Team) */}
        {/* ========================================================= */}
        {activeTab === "more" && (
          <section className="bg-white border border-[#ececf0] rounded-[22px] p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-[22px] font-bold text-[#111111]">
                Gestão & Definições CFM
              </h2>
              <p className="text-xs text-[#8e8e93]">
                Equipa de acesso administrativo, CRM de clientes e propostas comerciais
              </p>
            </div>

            {/* Session Card */}
            <div className="p-4 rounded-[16px] bg-[#f8f8fa] border border-[#ececf0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold text-sm">
                  {user ? user.name.slice(0, 2).toUpperCase() : "CFM"}
                </div>
                <div>
                  <div className="font-bold text-sm text-[#111111]">
                    {user ? user.name : "Sessão não iniciada"}
                  </div>
                  <div className="text-xs text-[#8e8e93]">
                    {user
                      ? `${user.email} · Acesso ${user.role}`
                      : "Inicia sessão com credenciais de administrador"}
                  </div>
                </div>
              </div>

              <div>
                {user ? (
                  <form
                    action={async () => {
                      await logoutAction();
                      setUser(null);
                    }}
                  >
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-[10px] bg-white border border-[#ececf0] text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    >
                      Terminar sessão
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="px-4 py-2 rounded-[10px] bg-[#111111] text-white text-xs font-semibold hover:bg-black transition cursor-pointer"
                  >
                    Iniciar sessão
                  </button>
                )}
              </div>
            </div>

            {/* Team Accounts Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[#111111]">
                    Equipa CFM & Contas Administrativas
                  </h3>
                  <p className="text-xs text-[#8e8e93]">
                    Gestão de múltiplos utilizadores com privilégios de acesso
                  </p>
                </div>

                <button
                  onClick={() => setShowNewUserModal(true)}
                  className="px-3.5 py-1.5 rounded-[10px] bg-[#111111] hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>＋</span>
                  <span>Criar conta</span>
                </button>
              </div>

              <div className="divide-y divide-[#ececf0] border border-[#ececf0] rounded-[16px] overflow-hidden">
                {teamUsers.map((u: any) => (
                  <div
                    key={u.id}
                    className="p-3.5 bg-white flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#f2f2f7] text-[#111111] flex items-center justify-center font-bold text-xs">
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/utilizadores/${u.id}`}
                            className="font-bold text-sm text-[#111111] hover:text-[#007aff] transition"
                            title="Ver perfil do utilizador"
                          >
                            {u.name}
                          </Link>
                          <Link
                            href={`/utilizadores/${u.id}`}
                            className="font-mono text-[10px] text-[#8e8e93] hover:text-[#007aff] bg-[#fafafc] hover:bg-[#f2f2f5] px-1.5 py-0.5 rounded border border-[#ececf0] transition"
                            title="ID do Utilizador"
                          >
                            #{u.id}
                          </Link>
                        </div>
                        <div className="text-[11px] text-[#8e8e93]">{u.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#eaf8ee] text-[#24793a] capitalize">
                        {u.role}
                      </span>
                      <Link
                        href={`/utilizadores/${u.id}`}
                        className="text-[11px] font-semibold text-[#8e8e93] hover:text-[#111] transition"
                        title="Ver detalhes da conta"
                      >
                        Ver perfil →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CRM Clientes Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[#111111]">
                    Clientes CRM
                  </h3>
                  <p className="text-xs text-[#8e8e93]">
                    Base de contactos e histórico comercial
                  </p>
                </div>

                <button
                  onClick={() => setShowClientWizard(true)}
                  className="px-3.5 py-1.5 rounded-[10px] bg-[#111111] hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>＋</span>
                  <span>Novo cliente</span>
                </button>
              </div>

              <div className="divide-y divide-[#ececf0] border border-[#ececf0] rounded-[16px] overflow-hidden">
                {clientsList.map((client) => (
                  <div
                    key={client.id}
                    className="p-3.5 bg-white flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#111]">{client.name}</span>
                        <span className="font-mono text-[10px] text-[#8e8e93] bg-[#fafafc] px-1.5 py-0.5 rounded border border-[#ececf0]">
                          #{client.id}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#8e8e93]">
                        {client.contactName ? `${client.contactName} · ` : ""}
                        {client.email || "Sem email"} · {client.phone || "Sem telefone"}
                      </div>
                    </div>

                    {client.nif && (
                      <span className="text-[11px] text-[#8e8e93] bg-[#f2f2f7] px-2 py-0.5 rounded">
                        NIF {client.nif}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Generated Quotes Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[#111111]">
                    Orçamentos & Links de Proposta
                  </h3>
                  <p className="text-xs text-[#8e8e93]">
                    Propostas emitidas com acesso digital para o cliente
                  </p>
                </div>

                <button
                  onClick={() => setShowQuoteWizard(true)}
                  className="px-3.5 py-1.5 rounded-[10px] bg-[#111111] hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>＋</span>
                  <span>Novo orçamento</span>
                </button>
              </div>

              <div className="divide-y divide-[#ececf0] border border-[#ececf0] rounded-[16px] overflow-hidden">
                {quotesList.map((q) => {
                  const client = clientsList.find((c) => c.id === q.clientId);
                  const isApproved = q.status === "aprovado";

                  return (
                    <div
                      key={q.id}
                      className="p-3.5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#111]">
                            {q.quoteNumber}
                          </span>
                          <span className="font-mono text-[10px] text-[#8e8e93] bg-[#fafafc] px-1.5 py-0.5 rounded border border-[#ececf0]">
                            #{q.id}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isApproved
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {isApproved ? "Aprovado" : "Enviado"}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#8e8e93] mt-0.5">
                          {client?.name || "Cliente"} · Total: €
                          {(q.total || 0).toLocaleString("pt-PT", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/proposta/${q.accessToken}`;
                            navigator.clipboard.writeText(url);
                            setCopiedToken(q.id);
                            setTimeout(() => setCopiedToken(null), 2000);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#f2f2f5] hover:bg-[#e8e8ed] text-[#111] text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                          title="Copiar link da proposta"
                        >
                          {copiedToken === q.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-[#8e8e93]" />
                              <span>Copiar Link</span>
                            </>
                          )}
                        </button>

                        <a
                          href={`/proposta/${q.accessToken}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-[#111] hover:bg-black text-white text-xs font-semibold flex items-center gap-1 transition"
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

            {/* Calendly Integration Notice */}
            <div className="p-4 rounded-[16px] bg-[#f8f8fa] border border-[#ececf0] text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-[#111]">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Integração Calendly Ativa</span>
              </div>
              <p className="text-[#6e6e73]">
                Reuniões marcadas via Calendly são transformadas automaticamente em
                clientes CRM e eventos no estado <em>Planeamento</em>.
              </p>
              <div className="pt-1 text-[11px] text-[#8e8e93]">
                Webhook Endpoint: <code className="bg-white px-1.5 py-0.5 rounded border border-[#ececf0]">/api/webhooks/calendly</code>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Floating Bottom Navigation Bar (Apple-style matching prototype) */}
      <aside className="fixed bottom-0 left-0 right-0 z-40 bg-[rgba(249,249,251,0.96)] backdrop-blur-[24px] border-t border-[#ececf0] py-2 flex items-center justify-center">
        <div className="w-full max-w-[650px] flex items-center justify-around h-[52px]">
          {/* 1. Início */}
          <Link
            href="/"
            onClick={() => setActiveTab("home")}
            className="w-[44px] h-[44px] rounded-[13px] flex items-center justify-center transition cursor-pointer"
            style={{
              backgroundColor:
                activeTab === "home" ? "rgba(0,122,255,0.11)" : "transparent",
              color: activeTab === "home" ? "#007aff" : "#8e8e93",
            }}
            title="Início"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3.25 10.6 12 3.45l8.75 7.15" />
              <path d="M5.35 9.25V20.2h13.3V9.25" />
              <path d="M9.25 20.2v-6.35h5.5v6.35" />
            </svg>
          </Link>

          {/* 2. Calendário */}
          <Link
            href="/calendario"
            onClick={() => setActiveTab("calendar")}
            className="w-[44px] h-[44px] rounded-[13px] flex items-center justify-center transition cursor-pointer"
            style={{
              backgroundColor:
                activeTab === "calendar"
                  ? "rgba(0,122,255,0.11)"
                  : "transparent",
              color: activeTab === "calendar" ? "#007aff" : "#8e8e93",
            }}
            title="Calendário"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3.25" y="4.75" width="17.5" height="16" rx="2.6" />
              <path d="M7.45 3.2v4M16.55 3.2v4M3.25 9.4h17.5" />
              <path d="M7.2 13.1h2.15M11 13.1h2.15M14.8 13.1h2.15M7.2 16.8h2.15M11 16.8h2.15" />
            </svg>
          </Link>

          {/* 3. Eventos */}
          <Link
            href="/eventos"
            onClick={() => setActiveTab("events")}
            className="w-[44px] h-[44px] rounded-[13px] flex items-center justify-center transition cursor-pointer"
            style={{
              backgroundColor:
                activeTab === "events"
                  ? "rgba(0,122,255,0.11)"
                  : "transparent",
              color: activeTab === "events" ? "#007aff" : "#8e8e93",
            }}
            title="Eventos"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3.25 7.15h17.5v3.05a2.35 2.35 0 0 0 0 4.7v3.95H3.25V14.9a2.35 2.35 0 0 0 0-4.7z" />
              <path d="M9.2 7.15v11.7" />
              <path
                d="M13.2 10.45v5.1M15.75 10.45v5.1"
                strokeDasharray="1.1 2.1"
              />
            </svg>
          </Link>

          {/* 4. Stock */}
          <Link
            href="/inventario"
            onClick={() => setActiveTab("inventory")}
            className="w-[44px] h-[44px] rounded-[13px] flex items-center justify-center transition cursor-pointer"
            style={{
              backgroundColor:
                activeTab === "inventory"
                  ? "rgba(0,122,255,0.11)"
                  : "transparent",
              color: activeTab === "inventory" ? "#007aff" : "#8e8e93",
            }}
            title="Stock"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3.5 7.1 12 2.95l8.5 4.15v9.8L12 21.05 3.5 16.9z" />
              <path d="M3.85 7.3 12 11.45l8.15-4.15M12 11.45v9.6" />
              <path d="m8.05 4.9 8.25 4.2" />
            </svg>
          </Link>

          {/* 5. Mais */}
          <Link
            href="/mais"
            onClick={() => setActiveTab("more")}
            className="w-[44px] h-[44px] rounded-[13px] flex items-center justify-center transition cursor-pointer"
            style={{
              backgroundColor:
                activeTab === "more" ? "rgba(0,122,255,0.11)" : "transparent",
              color: activeTab === "more" ? "#007aff" : "#8e8e93",
            }}
            title="Mais"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3.6" y="3.6" width="6.6" height="6.6" rx="1.85" />
              <rect x="13.8" y="3.6" width="6.6" height="6.6" rx="1.85" />
              <rect x="3.6" y="13.8" width="6.6" height="6.6" rx="1.85" />
              <rect x="13.8" y="13.8" width="6.6" height="6.6" rx="1.85" />
            </svg>
          </Link>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* MODALS */}
      {/* ========================================================= */}

      {/* 0. CALENDAR DAY POPUP MODAL */}
      {calendarPopupDate && (
        <CalendarDayPopupModal
          dateInfo={calendarPopupDate}
          events={eventsForPopupDate}
          clients={clientsList}
          onClose={() => setCalendarPopupDate(null)}
          onCreateEvent={(dateStr) => {
            setEventWizardInitialDate(dateStr);
            setCalendarPopupDate(null);
            setShowEventWizard(true);
          }}
        />
      )}

      {/* 1. EVENT WIZARD MODAL */}
      {showEventWizard && (
        <EventWizardModal
          clients={clientsList}
          initialDate={eventWizardInitialDate}
          onClose={() => {
            setShowEventWizard(false);
            setEventWizardInitialDate(null);
          }}
          onCreated={(newEvent) => {
            setEventsList((prev) => [newEvent, ...prev]);
            setShowEventWizard(false);
            setEventWizardInitialDate(null);
          }}
        />
      )}

      {/* 2. QUOTE WIZARD MODAL */}
      {showQuoteWizard && (
        <QuoteWizardModal
          clients={clientsList}
          events={eventsList}
          inventory={itemsList}
          initialEventId={selectedEventForQuote}
          onClose={() => setShowQuoteWizard(false)}
          onCreated={(newQuote) => {
            setQuotesList((prev) => [newQuote, ...prev]);
            setShowQuoteWizard(false);
          }}
        />
      )}

      {/* 3. MOVEMENT MODAL ("Novo movimento") */}
      {showMovementModal && (
        <MovementModal
          events={eventsList}
          clients={clientsList}
          onClose={() => setShowMovementModal(false)}
          onCreated={(newMovement) => {
            setMovementsList((prev) => [newMovement, ...prev]);
            setShowMovementModal(false);
          }}
        />
      )}

      {/* 4. LEDGER MODAL ("Ver detalhe financeiro") */}
      {showLedgerModal && (
        <LedgerModal
          movements={movementsList}
          onClose={() => setShowLedgerModal(false)}
        />
      )}

      {/* 5. ITEM WIZARD MODAL ("Novo artigo") */}
      {showItemWizard && (
        <ItemWizardModal
          onClose={() => setShowItemWizard(false)}
          onCreated={(newItem) => {
            setItemsList((prev) => [...prev, newItem]);
            setShowItemWizard(false);
          }}
        />
      )}

      {/* 6. CLIENT WIZARD MODAL ("Novo cliente CRM") */}
      {showClientWizard && (
        <ClientWizardModal
          onClose={() => setShowClientWizard(false)}
          onCreated={(newClient) => {
            setClientsList((prev) => [...prev, newClient]);
            setShowClientWizard(false);
          }}
        />
      )}

      {/* 7. TRIAGE MODAL */}
      {showTriageModal && triageItem && (
        <TriageModal
          item={triageItem}
          onClose={() => setShowTriageModal(false)}
          onRepaired={() => handleRepairItem(triageItem.id)}
        />
      )}

      {/* 8. LOGIN MODAL */}
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            setShowLoginModal(false);
          }}
        />
      )}

      {/* 9. CREATE NEW USER MODAL */}
      {showNewUserModal && (
        <NewUserModal
          onClose={() => setShowNewUserModal(false)}
          onCreated={(newUser) => {
            setTeamUsers((prev: any[]) => [...prev, newUser]);
            setShowNewUserModal(false);
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// MOVEMENT MODAL COMPONENT (Cash flow entry)
// -------------------------------------------------------------
function MovementModal({
  events,
  clients,
  onClose,
  onCreated,
}: {
  events: any[];
  clients: any[];
  onClose: () => void;
  onCreated: (movement: any) => void;
}) {
  const [type, setType] = useState<"entrada" | "saida" | "investimento">("entrada");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Adjudicação");
  const [eventId, setEventId] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("type", type);
      formData.set("description", description);
      formData.set("amount", amount);
      formData.set("category", category);
      formData.set("eventId", eventId);
      formData.set("notes", notes);
      formData.set("date", new Date().toISOString());

      const res = await createMovementAction(formData);
      if (res.success && res.movement) {
        onCreated(res.movement);
      } else {
        setError(res.error || "Erro ao guardar movimento.");
      }
    } catch (err: any) {
      setError(err?.message || "Erro inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-[22px] w-full max-w-md border border-[#ececf0] shadow-xl overflow-hidden p-6 text-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[17px] font-bold text-[#111111]">Novo Movimento Financeiro</h2>
            <p className="text-[11px] text-[#8e8e93] mt-0.5">Registo de fluxo de caixa CFM</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block font-bold text-[#3a3a3c] mb-1">Tipo de Movimento</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setType("entrada");
                  setCategory("Adjudicação");
                }}
                className={`py-2 rounded-xl text-xs font-bold border transition ${
                  type === "entrada"
                    ? "bg-[#eaf8ee] border-[#24793a] text-[#24793a]"
                    : "bg-[#f8f8fa] border-[#ececf0] text-[#3a3a3c]"
                }`}
              >
                Entrada (+)
              </button>
              <button
                type="button"
                onClick={() => {
                  setType("saida");
                  setCategory("Operações");
                }}
                className={`py-2 rounded-xl text-xs font-bold border transition ${
                  type === "saida"
                    ? "bg-[#fde8e8] border-[#b04a3f] text-[#b04a3f]"
                    : "bg-[#f8f8fa] border-[#ececf0] text-[#3a3a3c]"
                }`}
              >
                Saída (−)
              </button>
              <button
                type="button"
                onClick={() => {
                  setType("investimento");
                  setCategory("Equipamento");
                }}
                className={`py-2 rounded-xl text-xs font-bold border transition ${
                  type === "investimento"
                    ? "bg-[#fff4df] border-[#8c6417] text-[#8c6417]"
                    : "bg-[#f8f8fa] border-[#ececf0] text-[#3a3a3c]"
                }`}
              >
                Investido
              </button>
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#3a3a3c] mb-1">Descrição *</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Sinal Casamento Marta & João"
              className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#3a3a3c] mb-1">Valor (€) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
              />
            </div>
            <div>
              <label className="block font-bold text-[#3a3a3c] mb-1">Categoria</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex: Adjudicação"
                className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#3a3a3c] mb-1">Evento Associado (Opcional)</label>
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            >
              <option value="">Nenhum / Geral</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-[12px] bg-[#111111] hover:bg-black text-white text-xs font-bold transition shadow-xs mt-2 cursor-pointer"
          >
            {isSubmitting ? "A guardar movimento..." : "Registar Movimento"}
          </button>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// LEDGER MODAL COMPONENT ("Ver detalhe financeiro")
// -------------------------------------------------------------
function LedgerModal({
  movements,
  onClose,
}: {
  movements: any[];
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<string>("todos");

  const filtered = movements.filter((m) => {
    if (filter === "todos") return true;
    return m.type === filter;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-[22px] w-full max-w-2xl border border-[#ececf0] shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-5 border-b border-[#ececf0] flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-bold text-[#111111]">
              Extrato Financeiro de Movimentos
            </h2>
            <p className="text-[11px] text-[#8e8e93] mt-0.5">
              Histórico detalhado de entradas, despesas e investimentos
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="px-5 py-3 border-b border-[#ececf0] flex gap-2 text-xs">
          {["todos", "entrada", "saida", "investimento"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full font-semibold capitalize transition ${
                filter === f
                  ? "bg-[#111] text-white"
                  : "bg-[#f2f2f5] text-[#3a3a3c] hover:bg-[#e5e5ea]"
              }`}
            >
              {f === "todos" ? "Todos os movimentos" : f}
            </button>
          ))}
        </div>

        {/* Movement Rows */}
        <div className="overflow-y-auto flex-1 divide-y divide-[#ececf0] p-4 text-xs">
          {filtered.map((m) => {
            const isEntrada = m.type === "entrada";
            const isSaida = m.type === "saida";
            const colorClass = isEntrada
              ? "text-[#217a3b]"
              : isSaida
              ? "text-[#b04a3f]"
              : "text-[#8c6417]";

            const prefix = isEntrada ? "+" : isSaida ? "−" : "";

            return (
              <div
                key={m.id}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-sm text-[#111]">
                    {m.description}
                  </div>
                  <div className="text-[11px] text-[#8e8e93] mt-0.5">
                    {new Date(m.date).toLocaleDateString("pt-PT")} · {m.category}
                  </div>
                </div>

                <div className={`text-base font-bold ${colorClass}`}>
                  {prefix}€{m.amount.toLocaleString("pt-PT")}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-8 text-center text-xs text-[#8e8e93]">
              Sem movimentos para esta categoria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// TRIAGE MODAL COMPONENT (Stock repair & triage)
// -------------------------------------------------------------
function TriageModal({
  item,
  onClose,
  onRepaired,
}: {
  item: any;
  onClose: () => void;
  onRepaired: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRepair = async () => {
    setIsSubmitting(true);
    await onRepaired();
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-[22px] w-full max-w-sm border border-[#ececf0] shadow-xl overflow-hidden p-6 text-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[17px] font-bold text-[#111111]">
              Triagem de Material Danificado
            </h2>
            <p className="text-[11px] text-[#8e8e93] mt-0.5">{item.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 space-y-1 mb-4">
          <div className="font-bold text-sm">
            {item.damagedQuantity || 3} unidades danificadas
          </div>
          <div className="text-[11px] opacity-80">
            Localização: {item.warehouseLocation || "Armazém Principal"}
          </div>
        </div>

        <p className="text-xs text-[#555] mb-5">
          Após verificação e reparação técnica, confirme a reintegração dos
          artigos no stock operacional disponível da CFM Eventos.
        </p>

        <div className="space-y-2">
          <button
            onClick={handleRepair}
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-[12px] bg-[#217a3b] hover:bg-[#1b6230] text-white font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isSubmitting
                ? "A atualizar..."
                : "Registar Reparação (Repor Stock)"}
            </span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 rounded-[12px] bg-[#f2f2f5] text-[#3a3a3c] font-semibold hover:bg-[#e5e5ea] transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// ITEM WIZARD MODAL COMPONENT (Stock Add)
// -------------------------------------------------------------
function ItemWizardModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (item: any) => void;
}) {
  const [sku, setSku] = useState("");
  const [customId, setCustomId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Mobiliário");
  const [totalQuantity, setTotalQuantity] = useState("50");
  const [minStock, setMinStock] = useState("10");
  const [unitPrice, setUnitPrice] = useState("6.00");
  const [warehouseLocation, setWarehouseLocation] = useState("Armazém Principal");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("sku", sku);
      if (customId.trim()) formData.set("customId", customId.trim());
      formData.set("name", name);
      formData.set("category", category);
      formData.set("totalQuantity", totalQuantity);
      formData.set("minStock", minStock);
      formData.set("unitPrice", unitPrice);
      formData.set("warehouseLocation", warehouseLocation);

      const res = await createItemAction(formData);
      if (res.success && res.item) {
        onCreated(res.item);
      } else {
        setError(res.error || "Erro ao criar artigo.");
      }
    } catch (err: any) {
      setError(err?.message || "Erro inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-[22px] w-full max-w-md border border-[#ececf0] shadow-xl overflow-hidden p-6 text-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[17px] font-bold text-[#111111]">
              Novo Artigo de Stock
            </h2>
            <p className="text-[11px] text-[#8e8e93] mt-0.5">
              Adicionar material ao inventário permanente
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#3a3a3c] mb-1">SKU / Código *</label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Ex: CAD-CHIA-DOU"
                className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
              />
            </div>
            <div>
              <label className="block font-bold text-[#3a3a3c] mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
              >
                <option value="Mobiliário">Mobiliário</option>
                <option value="Iluminação">Iluminação</option>
                <option value="Decoração">Decoração</option>
                <option value="Têxtil">Têxtil</option>
                <option value="Som e Luz">Som e Luz</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#3a3a3c] mb-1">Nome do Artigo *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Cadeira Chiavari Dourada"
              className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#3a3a3c] mb-1">
              ID Único Personalizado (Opcional)
            </label>
            <input
              type="text"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder="Ex: itm-cadeira-chiavari (vazio = automático)"
              className="w-full px-3 py-2 text-xs font-mono bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block font-bold text-[#3a3a3c] mb-1">Qtd. Total</label>
              <input
                type="number"
                min="1"
                required
                value={totalQuantity}
                onChange={(e) => setTotalQuantity(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
              />
            </div>
            <div>
              <label className="block font-bold text-[#3a3a3c] mb-1">Mínimo Alerta</label>
              <input
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
              />
            </div>
            <div>
              <label className="block font-bold text-[#3a3a3c] mb-1">Preço/dia (€)</label>
              <input
                type="number"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#3a3a3c] mb-1">Localização em Armazém</label>
            <input
              type="text"
              value={warehouseLocation}
              onChange={(e) => setWarehouseLocation(e.target.value)}
              placeholder="Ex: Corredor A, Prateleira 2"
              className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-[12px] bg-[#111111] hover:bg-black text-white text-xs font-bold transition shadow-xs mt-2 cursor-pointer"
          >
            {isSubmitting ? "A guardar artigo..." : "Adicionar ao Catálogo"}
          </button>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// CLIENT WIZARD MODAL COMPONENT (CRM Client Add)
// -------------------------------------------------------------
function ClientWizardModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (client: any) => void;
}) {
  const [name, setName] = useState("");
  const [customId, setCustomId] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nif, setNif] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("name", name);
      if (customId.trim()) formData.set("customId", customId.trim());
      formData.set("contactName", contactName);
      formData.set("email", email);
      formData.set("phone", phone);
      formData.set("nif", nif);
      formData.set("notes", notes);

      const res = await createClientAction(formData);
      if (res.success && res.client) {
        onCreated(res.client);
      } else {
        setError(res.error || "Erro ao criar cliente.");
      }
    } catch (err: any) {
      setError(err?.message || "Erro inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-[22px] w-full max-w-md border border-[#ececf0] shadow-xl overflow-hidden p-6 text-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[17px] font-bold text-[#111111]">Novo Cliente CRM</h2>
            <p className="text-[11px] text-[#8e8e93] mt-0.5">Registo de cliente e contactos</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block font-bold text-[#3a3a3c] mb-1">
              Nome da Empresa / Cliente *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Santander Portugal ou Marta Silva"
              className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#3a3a3c] mb-1">
              ID Único Personalizado (Opcional)
            </label>
            <input
              type="text"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder="Ex: cli-santander (vazio = automático cli_...)"
              className="w-full px-3 py-2 text-xs font-mono bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#3a3a3c] mb-1">Pessoa de Contacto</label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Ex: Drª Sofia Antunes"
              className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#3a3a3c] mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contacto@empresa.pt"
                className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
              />
            </div>
            <div>
              <label className="block font-bold text-[#3a3a3c] mb-1">Telefone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+351 912 345 678"
                className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#3a3a3c] mb-1">NIF / Número Fiscal</label>
            <input
              type="text"
              value={nif}
              onChange={(e) => setNif(e.target.value)}
              placeholder="Ex: 509123456"
              className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-[12px] bg-[#111111] hover:bg-black text-white text-xs font-bold transition shadow-xs mt-2 cursor-pointer"
          >
            {isSubmitting ? "A guardar cliente..." : "Guardar Cliente"}
          </button>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// LOGIN MODAL COMPONENT
// -------------------------------------------------------------
function LoginModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (user: any) => void;
}) {
  const [email, setEmail] = useState("admin@cfmeventos.pt");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("password", password);

      const res = await loginAction(formData);
      if (res.success) {
        onSuccess({
          email,
          name: "Administrador CFM",
          role: "admin",
        });
      } else {
        setError(res.error || "Erro ao iniciar sessão.");
      }
    } catch (err: any) {
      setError(err?.message || "Erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-[22px] w-full max-w-sm border border-[#ececf0] shadow-xl overflow-hidden p-6 text-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[17px] font-bold text-[#111111]">Iniciar Sessão</h2>
            <p className="text-[11px] text-[#8e8e93] mt-0.5">Acesso administrativo CFM Eventos</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block font-bold text-[#3a3a3c] mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#3a3a3c] mb-1">Palavra-passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-[12px] bg-[#111111] hover:bg-black text-white text-xs font-bold transition shadow-xs mt-2 cursor-pointer"
          >
            {isLoading ? "A verificar..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// NEW USER MODAL COMPONENT (CREATE TEAM ACCOUNT)
// -------------------------------------------------------------
function NewUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (user: any) => void;
}) {
  const [name, setName] = useState("");
  const [customId, setCustomId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("name", name);
      if (customId.trim()) formData.set("customId", customId.trim());
      formData.set("email", email);
      formData.set("password", password);
      formData.set("role", role);

      const res = await createUserAction(formData);
      if (res.success && "id" in res) {
        onCreated({
          id: res.id,
          name,
          email,
          role,
        });
      } else {
        setError("error" in res ? res.error : "Erro ao criar utilizador.");
      }
    } catch (err: any) {
      setError(err?.message || "Erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-[22px] w-full max-w-sm border border-[#ececf0] shadow-xl overflow-hidden p-6 text-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[17px] font-bold text-[#111111]">Criar Conta de Equipa</h2>
            <p className="text-[11px] text-[#8e8e93] mt-0.5">Adicionar utilizador com acesso admin</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block font-bold text-[#3a3a3c] mb-1">Nome Completo *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Sofia Ribeiro"
              className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#3a3a3c] mb-1">
              ID de Utilizador (Opcional)
            </label>
            <input
              type="text"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder="Ex: usr-sofia (vazio = automático usr_...)"
              className="w-full px-3 py-2 text-xs font-mono bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#3a3a3c] mb-1">Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemplo@cfmeventos.pt"
              className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#3a3a3c] mb-1">Palavra-passe Inicial *</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Definir palavra-passe"
              className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#3a3a3c] mb-1">Nível de Acesso</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            >
              <option value="admin">Administrador (Total)</option>
              <option value="producer">Gestor / Produtor de Eventos</option>
              <option value="warehouse">Armazém / Logística</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-[12px] bg-[#111111] hover:bg-black text-white text-xs font-bold transition shadow-xs mt-2 cursor-pointer"
          >
            {isLoading ? "A guardar conta..." : "Criar Conta de Acesso"}
          </button>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// EVENT WIZARD MODAL COMPONENT
// -------------------------------------------------------------
function EventWizardModal({
  clients,
  initialDate,
  onClose,
  onCreated,
}: {
  clients: any[];
  initialDate?: string | null;
  onClose: () => void;
  onCreated: (event: any) => void;
}) {
  const baseDate = initialDate
    ? initialDate.split("T")[0]
    : new Date().toISOString().split("T")[0];
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [customId, setCustomId] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [venue, setVenue] = useState("");
  const [category, setCategory] = useState("Aniversário Infantil");
  const [theme, setTheme] = useState("");
  const [customerPrice, setCustomerPrice] = useState("3850");
  const [specialNeeds, setSpecialNeeds] = useState("");
  const [startDate, setStartDate] = useState(
    initialDate
      ? (initialDate.includes("T") ? initialDate : `${initialDate}T18:00`)
      : `${baseDate}T18:00`
  );
  const [endDate, setEndDate] = useState(`${baseDate}T23:59`);
  const [prepDate, setPrepDate] = useState(`${baseDate}T09:00`);
  const [returnDate, setReturnDate] = useState(() => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 1);
    const nextDay = d.toISOString().split("T")[0];
    return `${nextDay}T12:00`;
  });
  const [status, setStatus] = useState("planeamento");
  const [totalBudget, setTotalBudget] = useState("1800");
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
      if (customId.trim()) formData.set("customId", customId.trim());
      formData.set("clientId", clientId);
      formData.set("venue", venue);
      formData.set("category", category);
      formData.set("theme", theme);
      formData.set("customerPrice", customerPrice);
      formData.set("specialNeeds", specialNeeds);
      formData.set("startDate", startDate);
      formData.set("endDate", endDate);
      formData.set("prepDate", prepDate);
      formData.set("returnDate", returnDate);
      formData.set("status", status);
      formData.set("totalBudget", totalBudget);
      formData.set("notes", notes);
      formData.set("coverImageUrl", coverImageUrl);

      // Default vibe palette (e.g. honey and earth tones if theme like Winnie the Pooh, otherwise elegant neutrals)
      const defaultColors = theme.toLowerCase().includes("pooh")
        ? ["#F5A623", "#D32F2F", "#5C7658", "#FFF8DC"]
        : ["#111111", "#D4AF37", "#2C3E50", "#E0E0E0"];
      formData.set("vibeColors", JSON.stringify(defaultColors));

      const res = await createEventAction(formData);

      onCreated({
        id: res.id,
        name,
        clientId,
        venue,
        category,
        theme,
        customerPrice: parseFloat(customerPrice || "0"),
        specialNeeds,
        vibeColors: JSON.stringify(defaultColors),
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
      <div className="bg-white rounded-[22px] w-full max-w-lg border border-[#ececf0] shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-[#ececf0] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#007aff] uppercase tracking-wider">
              Passo {step} de 3
            </div>
            <h2 className="text-[17px] font-bold text-[#111111]">Novo Evento</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

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
                  placeholder="Ex: Aniversário Martim · Winnie the Pooh"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">
                  ID Personalizado do Evento (Opcional)
                </label>
                <input
                  type="text"
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value)}
                  placeholder="Ex: evt-aniversario-martim (vazio = automático evt_...)"
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
                <span className="text-[10px] text-[#8e8e93] mt-0.5 block">
                  Identificador único do evento no sistema. Se omitido, é gerado um ID criptográfico sem colisões.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">Categoria</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  >
                    <option value="Aniversário Infantil">Aniversário Infantil</option>
                    <option value="Casamento">Casamento</option>
                    <option value="Gala Corporativa">Gala Corporativa</option>
                    <option value="Jantar de Marca">Jantar de Marca</option>
                    <option value="Festa Privada">Festa Privada</option>
                    <option value="Batizado">Batizado</option>
                    <option value="Geral">Geral</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">Tema do Evento</label>
                  <input
                    type="text"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder="Ex: Winnie the Pooh, Gatsby, Boho"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Cliente Associado</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
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
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
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
                    className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">Fim do Evento</label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#f8f8fa] border border-[#ececf0] rounded-[14px] space-y-3">
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
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                >
                  <option value="planeamento">Planeamento</option>
                  <option value="orcamento">Orçamento</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="preparacao">Preparação</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">Valor a Pagar Cliente (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={customerPrice}
                    onChange={(e) => setCustomerPrice(e.target.value)}
                    placeholder="Ex: 3850"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">Orçamento Interno (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={totalBudget}
                    onChange={(e) => setTotalBudget(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">
                  Pedidos Especiais / Alergias / Necessidades
                </label>
                <input
                  type="text"
                  value={specialNeeds}
                  onChange={(e) => setSpecialNeeds(e.target.value)}
                  placeholder="Ex: Sem frutos secos, arco de balões mel e vermelho, tomada 220V..."
                  className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Notas Operacionais</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Necessária equipa de 4 montadores e carrinha extra."
                  className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-[#ececf0] flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 rounded-[12px] bg-white border border-[#ececf0] text-xs font-bold hover:bg-[#f2f2f5] cursor-pointer"
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
                className="px-4 py-2 rounded-[12px] bg-[#111] text-white text-xs font-bold hover:bg-black cursor-pointer"
              >
                Continuar
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold shadow-xs transition cursor-pointer"
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
  initialEventId,
  onClose,
  onCreated,
}: {
  clients: any[];
  events: any[];
  inventory: any[];
  initialEventId?: string;
  onClose: () => void;
  onCreated: (quote: any) => void;
}) {
  const [step, setStep] = useState(1);
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [eventId, setEventId] = useState(initialEventId || events[0]?.id || "");
  const [validityDays, setValidityDays] = useState("15");

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

  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
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
      <div className="bg-white rounded-[22px] w-full max-w-xl border border-[#ececf0] shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-[#ececf0] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#007aff] uppercase tracking-wider">
              Passo {step} de 3
            </div>
            <h2 className="text-[17px] font-bold text-[#111111]">Novo Orçamento</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Cliente</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
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
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                >
                  {events.map((evt) => (
                    <option key={evt.id} value={evt.id}>
                      {evt.name} ({new Date(evt.startDate).toLocaleDateString("pt-PT")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">
                  Validade da Proposta (Dias)
                </label>
                <input
                  type="number"
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#111111]">
                  Linhas de Artigos & Serviços
                </span>
                <button
                  type="button"
                  onClick={addLine}
                  className="text-xs font-bold text-[#007aff] hover:underline cursor-pointer"
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
                        onChange={(e) =>
                          updateLine(idx, "quantity", parseInt(e.target.value || "1", 10))
                        }
                        className="w-full px-2 py-1 bg-white border border-[#ececf0] rounded-lg text-xs text-center"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) =>
                          updateLine(idx, "unitPrice", parseFloat(e.target.value || "0"))
                        }
                        className="w-full px-2 py-1 bg-white border border-[#ececf0] rounded-lg text-xs text-right"
                      />
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="text-[#8e8e93] hover:text-rose-600 cursor-pointer"
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
                  <span className="text-[#111111]">€{total.toFixed(2)}</span>
                </div>
              </div>

              <div className="text-[11px] text-[#8e8e93]">
                Ao gerar este orçamento, será criado um link de aprovação direta para o cliente
                com assinatura digital.
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-[#ececf0] flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 rounded-[12px] bg-white border border-[#ececf0] text-xs font-bold hover:bg-[#f2f2f5] cursor-pointer"
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
                className="px-4 py-2 rounded-[12px] bg-[#111] text-white text-xs font-bold hover:bg-black cursor-pointer"
              >
                Continuar
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold shadow-xs transition cursor-pointer"
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

// -------------------------------------------------------------
// CALENDAR DAY POPUP MODAL COMPONENT
// -------------------------------------------------------------
function CalendarDayPopupModal({
  dateInfo,
  events,
  clients,
  onClose,
  onCreateEvent,
}: {
  dateInfo: { year: number; month: number; day: number };
  events: any[];
  clients: any[];
  onClose: () => void;
  onCreateEvent: (dateStr: string) => void;
}) {
  const router = useRouter();
  const dateObj = new Date(dateInfo.year, dateInfo.month, dateInfo.day);
  const weekdays = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
  ];
  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const weekdayName = weekdays[dateObj.getDay()] || "Dia";
  const monthName = months[dateInfo.month] || "";
  const dateFormatted = `${weekdayName}, ${dateInfo.day} de ${monthName} de ${dateInfo.year}`;

  const formattedIsoDate = `${dateInfo.year}-${String(dateInfo.month + 1).padStart(2, "0")}-${String(dateInfo.day).padStart(2, "0")}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[24px] w-full max-w-lg border border-[#ececf0] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#ececf0] flex items-center justify-between bg-[#fafafc]">
          <div>
            <div className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider">
              Agenda Diária · {monthName} {dateInfo.year}
            </div>
            <h2 className="text-[18px] font-bold text-[#111111] mt-0.5">
              {dateFormatted}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#8e8e93] hover:text-[#111111] hover:bg-[#f2f2f5] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {events.length > 0 ? (
            <>
              <div className="flex items-center justify-between text-xs text-[#8e8e93] font-medium px-1">
                <span>
                  {events.length === 1
                    ? "1 evento agendado"
                    : `${events.length} eventos agendados`}
                </span>
                <span className="text-[11px] text-[#24793a] bg-[#eaf8ee] px-2 py-0.5 rounded-full font-bold">
                  Dia com Produção
                </span>
              </div>

              <div className="space-y-3">
                {events.map((evt) => {
                  const statusObj = getStatusStyle(evt.status);
                  const client = clients.find((c) => c.id === evt.clientId);

                  return (
                    <div
                      key={evt.id}
                      className="p-4 rounded-[18px] border border-[#ececf0] bg-[#fafafa] hover:bg-white hover:border-[#d2d2d7] transition shadow-xs space-y-3"
                    >
                      <div className="flex items-start gap-3">
                        {/* Cover Image Thumbnail */}
                        <div
                          className="w-14 h-14 rounded-[12px] bg-cover bg-center flex-shrink-0 border border-black/5 overflow-hidden"
                          style={{
                            backgroundImage: `url("${
                              evt.coverImageUrl ||
                              "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80"
                            }")`,
                          }}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[15px] text-[#111] truncate">
                              {evt.name}
                            </span>
                            <span className="font-mono text-[10px] text-[#8e8e93] bg-[#f2f2f5] px-1.5 py-0.5 rounded border border-[#e5e5ea]">
                              #{evt.id}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusObj.bg} ${statusObj.text}`}
                            >
                              {statusObj.label}
                            </span>
                          </div>

                          <div className="text-xs text-[#8e8e93] mt-1">
                            {formatEventByline(evt.startDate, evt.venue)}
                          </div>
                        </div>
                      </div>

                      {/* Event Extra Details Summary */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#f0f0f3]">
                        {client && (
                          <div className="text-[#636366]">
                            <span className="text-[#8e8e93] block text-[10px] uppercase font-semibold">Cliente</span>
                            <span className="font-medium text-[#111] truncate block">{client.name}</span>
                          </div>
                        )}
                        {evt.category && (
                          <div className="text-[#636366]">
                            <span className="text-[#8e8e93] block text-[10px] uppercase font-semibold">Categoria</span>
                            <span className="font-medium text-[#111] truncate block">{evt.category}</span>
                          </div>
                        )}
                        {evt.customerPrice && evt.customerPrice > 0 ? (
                          <div className="text-[#636366]">
                            <span className="text-[#8e8e93] block text-[10px] uppercase font-semibold">Valor Cobrado</span>
                            <span className="font-bold text-[#137333]">€{evt.customerPrice.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}</span>
                          </div>
                        ) : null}
                        {evt.totalBudget && evt.totalBudget > 0 ? (
                          <div className="text-[#636366]">
                            <span className="text-[#8e8e93] block text-[10px] uppercase font-semibold">Budget Produção</span>
                            <span className="font-semibold text-[#111]">€{evt.totalBudget.toLocaleString("pt-PT")}</span>
                          </div>
                        ) : null}
                      </div>

                      {/* Action Button to Open Event Detail Page */}
                      <Link
                        href={`/eventos/${evt.id}`}
                        onClick={onClose}
                        className="w-full py-2.5 px-3 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
                      >
                        <span>Abrir Página do Evento</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  );
                })}
              </div>

              {/* Button to allow creating multiple events on the same day */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onCreateEvent(`${formattedIsoDate}T10:00`)}
                  className="w-full py-2.5 px-4 rounded-[14px] bg-[#f5f5f7] hover:bg-[#ebebed] text-[#111] text-xs font-bold border border-[#ececf0] flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-[#007aff]" />
                  <span>Criar outro evento neste dia</span>
                </button>
              </div>
            </>
          ) : (
            /* Empty State: No events on this day */
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#f2f2f7] mx-auto flex items-center justify-center text-[#8e8e93]">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-[16px] font-bold text-[#111]">
                  Nenhum evento agendado
                </h3>
                <p className="text-xs text-[#8e8e93] max-w-xs mx-auto">
                  Não existem eventos, montagens ou desmontagens agendadas para o dia {dateInfo.day} de {monthName}.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onCreateEvent(`${formattedIsoDate}T10:00`)}
                  className="px-5 py-2.5 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar evento para este dia</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
