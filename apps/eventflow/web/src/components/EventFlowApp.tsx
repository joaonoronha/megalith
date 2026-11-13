"use client";

import React, { useState, useEffect, useTransition, useMemo, useRef } from "react";
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
  User,
  Building,
  FileText,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  History,
  MapPin,
  SlidersHorizontal,
  Filter,
  Tag,
  Bell,
  Clock,
  CheckCheck,
  LogOut,
  LogIn,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Video,
  ScanLine,
  Camera,
  Upload,
  Trash2,
  Loader2,
} from "lucide-react";
import AuditLogModal from "@/components/AuditLogModal";
import AlertsDrawerModal from "@/components/AlertsDrawerModal";
import StorageLocationsModal, { StorageLocation } from "@/components/StorageLocationsModal";
import ReceiptScannerModal from "@/components/ReceiptScannerModal";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import FinanceView from "@/components/FinanceView";
import CompletedEventsProfitChart from "@/components/CompletedEventsProfitChart";
import { usePresence } from "@/lib/usePresence";
import { formatRelativeTime } from "@/lib/date-format";
import { isMeetingEvent, canEventReceiveQuote, countsForFinance, isCancelledEvent } from "@/lib/events";
import { computeCompletedEventsProfit } from "@/lib/profit-trajectory";
import {
  createEventAction,
  updateEventStatusAction,
  createQuoteAction,
  createMovementAction,
  deleteMovementAction,
  createItemAction,
  updateItemTriageAction,
  createClientAction,
  loginAction,
  logoutAction,
  createUserAction,
  updateUserAction,
  markItemAsBoughtAction,
  snoozeAlertAction,
  acknowledgeAlertAction,
  dismissAlertAction,
  syncCalendlyMeetingsAction,
  deleteInventoryItemAction,
  uploadItemPhotoAction,
} from "@/app/actions";

interface Props {
  currentUser: { id: string; name: string; email: string; role: string; avatarUrl?: string | null } | null;
  initialUsers: any[];
  initialEvents: any[];
  initialItems: any[];
  initialClients: any[];
  initialQuotes: any[];
  initialMovements: any[];
  initialTemplate: any;
  initialAlerts?: any[];
  initialLocations?: any[];
  initialAllocations?: any[];
  initialCustomItems?: any[];
  initialMeetings?: any[];
  initialTab?: "home" | "calendar" | "events" | "inventory" | "finance" | "more";
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

function isCalendlyMeeting(evt: any): boolean {
  return isMeetingEvent(evt);
}

function formatMeetingTimeRange(start: any, end?: any) {
  if (!start) return "";
  const dStart = new Date(start);
  const sh = String(dStart.getHours()).padStart(2, "0");
  const sm = String(dStart.getMinutes()).padStart(2, "0");
  if (!end) return `${sh}:${sm}`;
  const dEnd = new Date(end);
  const eh = String(dEnd.getHours()).padStart(2, "0");
  const em = String(dEnd.getMinutes()).padStart(2, "0");
  return `${sh}:${sm} – ${eh}:${em}`;
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
  initialAlerts = [],
  initialLocations = [],
  initialAllocations = [],
  initialCustomItems = [],
  initialMeetings = [],
  initialTab = "home",
}: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  const getTabFromPath = (path: string): "home" | "calendar" | "events" | "inventory" | "finance" | "more" => {
    if (path === "/calendario" || path === "/calendar") return "calendar";
    if (path === "/eventos" || path === "/events") return "events";
    if (path === "/inventario" || path === "/inventory") return "inventory";
    if (path === "/financas" || path === "/finance") return "finance";
    if (path === "/mais" || path === "/more") return "more";
    if (path === "/") return "home";
    return initialTab || "home";
  };

  // Core App State
  const [user, setUser] = useState(currentUser);
  const { onlineUsers } = usePresence({ currentUser: user, pollIntervalMs: 10000 });
  const [teamUsers, setTeamUsers] = useState(initialUsers);
  const [eventsList, setEventsList] = useState(initialEvents);
  const [meetingsList, setMeetingsList] = useState(initialMeetings);
  const [itemsList, setItemsList] = useState(initialItems);
  const [clientsList, setClientsList] = useState(initialClients);
  const [quotesList, setQuotesList] = useState(initialQuotes);
  const [movementsList, setMovementsList] = useState(initialMovements);
  const [allocationsList, setAllocationsList] = useState<any[]>(initialAllocations);
  const [customItemsList, setCustomItemsList] = useState<any[]>(initialCustomItems);
  const [locationsList, setLocationsList] = useState<any[]>(initialLocations);
  const [showLocationsModal, setShowLocationsModal] = useState(false);
  const [locationsModalInitialMode, setLocationsModalInitialMode] = useState<"list" | "create">("list");
  const [alertsList, setAlertsList] = useState<any[]>(initialAlerts || []);
  const [showAlertsDrawer, setShowAlertsDrawer] = useState(false);
  const [homeAlertFilter, setHomeAlertFilter] = useState<"all" | "new" | "snoozed">("all");
  const [openHomeSnoozeMenuId, setOpenHomeSnoozeMenuId] = useState<string | null>(null);

  // Synchronize state when initial props update (e.g. on router.refresh() or server sync)
  useEffect(() => {
    setMeetingsList(initialMeetings);
  }, [initialMeetings]);

  // Synchronize state when initial props update (e.g. on router.refresh() or server sync)
  useEffect(() => {
    setEventsList(initialEvents);
  }, [initialEvents]);

  useEffect(() => {
    setClientsList(initialClients);
  }, [initialClients]);

  useEffect(() => {
    setItemsList(initialItems);
  }, [initialItems]);

  useEffect(() => {
    setQuotesList(initialQuotes);
  }, [initialQuotes]);

  useEffect(() => {
    setMovementsList(initialMovements);
  }, [initialMovements]);

  useEffect(() => {
    setAllocationsList(initialAllocations);
  }, [initialAllocations]);

  useEffect(() => {
    setLocationsList(initialLocations);
  }, [initialLocations]);

  useEffect(() => {
    setAlertsList(initialAlerts || []);
  }, [initialAlerts]);

  useEffect(() => {
    setUser(currentUser);
  }, [currentUser]);

  useEffect(() => {
    setTeamUsers(initialUsers);
  }, [initialUsers]);

  useEffect(() => {
    const handleUserUpdated = (e: CustomEvent<any>) => {
      const updated = e.detail;
      if (!updated || !updated.id) return;
      setTeamUsers((prev: any[]) =>
        prev.map((u: any) => (u.id === updated.id ? { ...u, ...updated } : u))
      );
      if (user && user.id === updated.id) {
        setUser((prev: any) => ({ ...prev, ...updated }));
      }
      setLocationsList((prev: any[]) =>
        prev.map((loc: any) =>
          loc.managerUserId === updated.id
            ? { ...loc, managerName: updated.name }
            : loc
        )
      );
    };

    window.addEventListener("eventflow:user-updated", handleUserUpdated as EventListener);
    return () => {
      window.removeEventListener("eventflow:user-updated", handleUserUpdated as EventListener);
    };
  }, [user]);

  // Dynamic Alerts Computation (New vs Active vs Snoozed)
  const nowMs = Date.now();
  const activeAlerts = useMemo(() => {
    return alertsList.filter((a) => {
      if (a.status === "resolved") return false;
      if (a.status === "snoozed") {
        if (a.snoozedUntil && new Date(a.snoozedUntil).getTime() > nowMs) {
          return false;
        }
      }
      return true;
    });
  }, [alertsList, nowMs]);

  const snoozedAlerts = useMemo(() => {
    return alertsList.filter((a) => {
      return (
        a.status === "snoozed" &&
        a.snoozedUntil &&
        new Date(a.snoozedUntil).getTime() > nowMs
      );
    });
  }, [alertsList, nowMs]);

  const newAlerts = useMemo(() => {
    return activeAlerts.filter((a) => !a.acknowledgedAt);
  }, [activeAlerts]);

  const newAlertsCount = newAlerts.length;

  const handleSnoozeAlert = async (alertId: string, hours: number) => {
    const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
    setAlertsList((prev) =>
      prev.map((a) =>
        a.id === alertId ? { ...a, status: "snoozed", snoozedUntil } : a
      )
    );
    setOpenHomeSnoozeMenuId(null);
    startTransition(async () => {
      await snoozeAlertAction(alertId, hours);
    });
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    setAlertsList((prev) =>
      prev.map((a) =>
        a.id === alertId ? { ...a, acknowledgedAt: new Date() } : a
      )
    );
    startTransition(async () => {
      await acknowledgeAlertAction(alertId);
    });
  };

  const handleDismissAlert = async (alertId: string) => {
    setAlertsList((prev) =>
      prev.map((a) =>
        a.id === alertId ? { ...a, status: "resolved" } : a
      )
    );
    setOpenHomeSnoozeMenuId(null);
    startTransition(async () => {
      await dismissAlertAction(alertId);
    });
  };

  const handleMarkAllAlertsRead = async () => {
    const idsToAck = newAlerts.map((a) => a.id);
    setAlertsList((prev) =>
      prev.map((a) => (idsToAck.includes(a.id) ? { ...a, acknowledgedAt: new Date() } : a))
    );
    startTransition(async () => {
      for (const id of idsToAck) {
        await acknowledgeAlertAction(id);
      }
    });
  };

  const handleAlertActionClick = (alert: any) => {
    handleAcknowledgeAlert(alert.id);
    if (alert.type === "damaged_stock") {
      const item = itemsList.find((i) => i.id === alert.entityId);
      if (item) {
        setTriageItem(item);
        setShowTriageModal(true);
      } else {
        router.push(`/inventario/${alert.entityId}`);
      }
    } else if (alert.type === "low_stock") {
      router.push(`/inventario/${alert.entityId}`);
    } else if (alert.type === "event_unprepared") {
      router.push(`/eventos/${alert.entityId}`);
    } else if (alert.type === "payment_due" || alert.type === "missing_completed_payment") {
      setShowMovementModal(true);
    }
  };

  // Search & Navigation
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<
    "home" | "calendar" | "events" | "inventory" | "finance" | "more"
  >(() => getTabFromPath(pathname));

  const handleTabSwitch = (
    tab: "home" | "calendar" | "events" | "inventory" | "finance" | "more",
    href: string,
    e?: React.MouseEvent
  ) => {
    if (e) {
      e.preventDefault();
    }
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      if (window.location.pathname !== href) {
        window.history.pushState({ tab }, "", href);
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        setActiveTab(getTabFromPath(window.location.pathname));
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    setActiveTab(getTabFromPath(pathname));
  }, [pathname]);

  // Calendly OAuth callback notice banner
  const [calendlyBanner, setCalendlyBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const status = params.get("calendly_status");
      const err = params.get("calendly_error");
      if (status === "connected") {
        setCalendlyBanner({
          type: "success",
          message: "Conta Calendly ligada com sucesso! Sincronização pronta.",
        });
      } else if (status === "code_received") {
        setCalendlyBanner({
          type: "success",
          message: "Código Calendly recebido com sucesso.",
        });
      } else if (err || status === "error" || status === "exchange_failed") {
        setCalendlyBanner({
          type: "error",
          message: `Erro na integração Calendly: ${err || status}`,
        });
      }
    }
  }, []);

  // Calendly Sync state & filter
  const [isSyncingCalendly, setIsSyncingCalendly] = useState(false);
  const [showCalendlySyncModal, setShowCalendlySyncModal] = useState(false);
  const [calendlyCustomToken, setCalendlyCustomToken] = useState("");
  const [calendarFilter, setCalendarFilter] = useState<"all" | "meetings" | "events">("all");

  const calendlyMeetingsCount = useMemo(() => {
    return meetingsList.filter((m) => !isCancelledEvent(m)).length;
  }, [meetingsList]);

  const productionEventsCount = useMemo(() => {
    return eventsList.filter((e) => !isCancelledEvent(e)).length;
  }, [eventsList]);

  const handleSyncCalendly = async (token?: string) => {
    setIsSyncingCalendly(true);
    try {
      const res = await syncCalendlyMeetingsAction(token);
      if (res.success) {
        if (res.events) {
          setEventsList(res.events);
        }
        if (res.clients) {
          setClientsList(res.clients);
        }
        if (res.meetings) {
          setMeetingsList(res.meetings);
        }
        setCalendlyBanner({
          type: "success",
          message: `${res.count} reuniões do Calendly sincronizadas com sucesso! Destacadas a roxo na agenda.`,
        });
        setShowCalendlySyncModal(false);
        router.refresh();
      } else {
        setCalendlyBanner({
          type: "error",
          message: res.message || "Erro ao sincronizar com o Calendly.",
        });
        if (res.message?.includes("Nenhum token")) {
          setShowCalendlySyncModal(true);
        }
      }
    } catch (err: any) {
      setCalendlyBanner({
        type: "error",
        message: "Falha na sincronização: " + (err?.message || "Erro desconhecido"),
      });
    } finally {
      setIsSyncingCalendly(false);
    }
  };

  // Automatic Hourly Calendly Synchronization for active sessions
  useEffect(() => {
    const hourlySync = async () => {
      try {
        const res = await syncCalendlyMeetingsAction();
        if (res.success) {
          if (res.events) setEventsList(res.events);
          if (res.clients) setClientsList(res.clients);
          router.refresh();
        }
      } catch (err) {
        console.warn("Background hourly Calendly sync:", err);
      }
    };

    // Every 60 minutes (1 hour)
    const interval = setInterval(hourlySync, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showClientWizard, setShowClientWizard] = useState(false);
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [triageItem, setTriageItem] = useState<any>(null);
  const [deleteItemModal, setDeleteItemModal] = useState<{
    isOpen: boolean;
    item: any | null;
    upcomingAllocations: any[];
  }>({
    isOpen: false,
    item: null,
    upcomingAllocations: [],
  });
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  const getItemUpcomingAllocations = (itemId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const itemAllocs = allocationsList.filter((a) => a.itemId === itemId);
    return itemAllocs
      .map((a) => {
        const ev = eventsList.find((e) => e.id === a.eventId);
        return {
          allocation: a,
          event: ev,
        };
      })
      .filter((entry) => {
        if (!entry.event) return false;
        if (entry.event.status === "cancelado" || entry.event.status === "concluido") return false;
        const end = entry.event.endDate ? new Date(entry.event.endDate) : new Date(entry.event.startDate);
        return end >= today;
      });
  };

  const handleDeleteItemClick = (item: any) => {
    const upcoming = getItemUpcomingAllocations(item.id);
    setDeleteItemModal({
      isOpen: true,
      item,
      upcomingAllocations: upcoming,
    });
  };

  const handleConfirmDeleteItem = async () => {
    if (!deleteItemModal.item) return;
    setIsDeletingItem(true);
    try {
      const res = await deleteInventoryItemAction(deleteItemModal.item.id);
      if (res.success) {
        setItemsList((prev) => prev.filter((i) => i.id !== deleteItemModal.item.id));
        setDeleteItemModal({ isOpen: false, item: null, upcomingAllocations: [] });
      } else {
        alert(res.error || "Erro ao eliminar artigo.");
      }
    } catch (err: any) {
      alert(err?.message || "Erro ao eliminar artigo.");
    } finally {
      setIsDeletingItem(false);
    }
  };

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [editingTeamUser, setEditingTeamUser] = useState<any | null>(null);
  const [dashboardFinanceMode, setDashboardFinanceMode] = useState<"comparative" | "realized" | "projected">("comparative");
  const [selectedEventForQuote, setSelectedEventForQuote] = useState<string>("");
  const [auditModal, setAuditModal] = useState<{
    isOpen: boolean;
    entityType: "event" | "inventory" | "quote";
    entityId: string;
    entityTitle: string;
  }>({
    isOpen: false,
    entityType: "event",
    entityId: "",
    entityTitle: "",
  });

  // Copied link feedback
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Inventory Filtering & Listing State
  const [inventorySearch, setInventorySearch] = useState<string>("");
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<string>("all");
  const [inventoryLocationFilter, setInventoryLocationFilter] = useState<string>("all");
  const [inventoryAlertFilter, setInventoryAlertFilter] = useState<"all" | "alerts">("all");

  // Distinct categories and warehouse locations
  const inventoryCategories = useMemo(() => {
    const cats = new Set<string>();
    itemsList.forEach((i) => {
      if (i.category?.trim()) cats.add(i.category.trim());
    });
    return Array.from(cats).sort();
  }, [itemsList]);

  const inventoryLocations = useMemo(() => {
    const locs = new Set<string>();
    locationsList.forEach((l) => {
      if (l.name?.trim()) locs.add(l.name.trim());
    });
    itemsList.forEach((i) => {
      const loc = i.warehouseLocation?.trim() || "Armazém Principal";
      locs.add(loc);
    });
    return Array.from(locs).sort();
  }, [itemsList, locationsList]);

  // Helper to resolve manager for an item's location
  const getLocationDetails = (locNameOrId?: string | null, locationId?: string | null) => {
    if (locationId) {
      const found = locationsList.find((l) => l.id === locationId);
      if (found) return found;
    }
    if (!locNameOrId) return locationsList[0] || null;
    const clean = locNameOrId.toLowerCase();
    return (
      locationsList.find(
        (l) => clean.includes(l.name.toLowerCase()) || l.name.toLowerCase().includes(clean)
      ) || null
    );
  };

  // Alert counters
  const inventoryAlertCounters = useMemo(() => {
    let lowCount = 0;
    let damagedCount = 0;
    let totalAlerts = 0;
    itemsList.forEach((item) => {
      const damaged = item.damagedQuantity || 0;
      const available = item.totalQuantity - damaged;
      const isLow = available < item.minStock;
      if (damaged > 0) damagedCount += 1;
      if (isLow) lowCount += 1;
      if (damaged > 0 || isLow) totalAlerts += 1;
    });
    return { lowCount, damagedCount, totalAlerts };
  }, [itemsList]);

  // Purchase status counters & costs (Bought vs Not Yet Bought)
  const inventoryPurchaseStats = useMemo(() => {
    let boughtCount = 0;
    let notBoughtCount = 0;
    let notBoughtCost = 0;
    itemsList.forEach((item) => {
      if (item.purchaseStatus === "not_bought") {
        notBoughtCount += 1;
        const cost = Number(item.purchaseCost) > 0
          ? Number(item.purchaseCost)
          : (Number(item.replacementCost) || 0) * (Number(item.totalQuantity) || 1);
        notBoughtCost += cost;
      } else {
        boughtCount += 1;
      }
    });
    return { boughtCount, notBoughtCount, notBoughtCost };
  }, [itemsList]);

  // Filtered inventory list
  const processedInventoryItems = useMemo(() => {
    return itemsList.filter((item) => {
      const damaged = item.damagedQuantity || 0;
      const available = item.totalQuantity - damaged;
      const isLow = available < item.minStock;
      const hasAlert = damaged > 0 || isLow;

      // 1. Text search strictly by name
      if (inventorySearch.trim()) {
        const query = inventorySearch.toLowerCase().trim();
        if (!item.name?.toLowerCase().includes(query)) return false;
      }

      // 2. Category filter
      if (inventoryCategoryFilter !== "all" && item.category !== inventoryCategoryFilter) {
        return false;
      }

      // 3. Location filter
      if (inventoryLocationFilter !== "all") {
        const loc = item.warehouseLocation || "Armazém Principal";
        const matchesLoc =
          loc === inventoryLocationFilter ||
          loc.toLowerCase().includes(inventoryLocationFilter.toLowerCase()) ||
          item.locationId === inventoryLocationFilter;
        if (!matchesLoc) return false;
      }

      // 4. Alert filter ("all" or "alerts")
      if (inventoryAlertFilter === "alerts" && !hasAlert) return false;

      return true;
    });
  }, [itemsList, locationsList, inventorySearch, inventoryCategoryFilter, inventoryLocationFilter, inventoryAlertFilter]);

  // Set of cancelled / ineligible event IDs
  const cancelledEventIds = useMemo(() => {
    return new Set(
      eventsList.filter((e) => isCancelledEvent(e) || !countsForFinance(e)).map((e) => e.id)
    );
  }, [eventsList]);

  // Movements strictly excluding any movement associated with a cancelled event
  const activeMovements = useMemo(() => {
    return movementsList.filter((m) => !m.eventId || !cancelledEventIds.has(m.eventId));
  }, [movementsList, cancelledEventIds]);

  // Financial aggregates (Realized Cash Flow - strictly ignores cancelled events)
  const totalEntradas = activeMovements
    .filter((m) => m.type === "entrada")
    .reduce((sum, m) => sum + m.amount, 0);

  const totalSaidas = activeMovements
    .filter((m) => m.type === "saida")
    .reduce((sum, m) => sum + m.amount, 0);

  const totalInvestido = activeMovements
    .filter((m) => m.type === "investimento")
    .reduce((sum, m) => sum + m.amount, 0);

  const resultadoLiquido = totalEntradas - totalSaidas - totalInvestido;

  // Pending Stock Purchases (Items with purchaseStatus === "not_bought")
  // Only bought items can be accounted for finance (cash).
  // Not yet bought items are deducted from the projected value.
  const pendingStockPurchases = useMemo(() => {
    return itemsList
      .filter((item) => item.purchaseStatus === "not_bought")
      .reduce((sum, item) => {
        const cost = Number(item.purchaseCost) > 0
          ? Number(item.purchaseCost)
          : (Number(item.replacementCost) || 0) * (Number(item.totalQuantity) || 1);
        return sum + cost;
      }, 0);
  }, [itemsList]);

  const pendingStockItemsCount = useMemo(() => {
    return itemsList.filter((item) => item.purchaseStatus === "not_bought").length;
  }, [itemsList]);

  // Projected aggregates from pipeline events (excluding cancelled events)
  // Not bought items are deducted from the projected value.
  const projectedMetrics = useMemo(() => {
    const activeEvents = eventsList.filter((e) => countsForFinance(e));
    const faturacao = activeEvents.reduce((sum, e) => sum + (Number(e.customerPrice) || 0), 0);
    const orcamentoCustos = activeEvents.reduce((sum, e) => sum + (Number(e.totalBudget) || 0), 0);
    const totalCustosProjetados = orcamentoCustos + pendingStockPurchases;
    const lucroProjetado = faturacao - totalCustosProjetados;
    const margemProjetada = faturacao > 0 ? ((lucroProjetado / faturacao) * 100).toFixed(1) : "0.0";
    const aReceber = Math.max(0, faturacao - totalEntradas);
    return {
      faturacao,
      orcamentoCustos,
      pendingStockPurchases,
      pendingStockItemsCount,
      totalCustosProjetados,
      lucroProjetado,
      margemProjetada,
      aReceber,
    };
  }, [eventsList, totalEntradas, pendingStockPurchases, pendingStockItemsCount]);

  // Completed events financial profit & monthly trajectory
  const completedEventsProfitData = useMemo(() => {
    return computeCompletedEventsProfit(eventsList, activeMovements);
  }, [eventsList, activeMovements]);

  // Mark Item as Bought Handler
  const handleMarkAsBought = async (itemToBuy: any) => {
    const cost = Number(itemToBuy.purchaseCost) > 0
      ? Number(itemToBuy.purchaseCost)
      : (Number(itemToBuy.replacementCost) || 0) * (Number(itemToBuy.totalQuantity) || 1);

    // Optimistic update
    setItemsList((prev) =>
      prev.map((i) =>
        i.id === itemToBuy.id
          ? { ...i, purchaseStatus: "bought", purchaseCost: cost }
          : i
      )
    );

    startTransition(async () => {
      const res = await markItemAsBoughtAction(itemToBuy.id, cost);
      if (res.success && res.movement) {
        setMovementsList((prev) => [res.movement, ...prev]);
      }
    });
  };

  const totalFaturado = projectedMetrics.faturacao > 0
    ? projectedMetrics.faturacao
    : quotesList
        .filter((q) => !q.eventId || !cancelledEventIds.has(q.eventId))
        .reduce((sum, q) => sum + (q.total || 0), 0);

  const totalAReceber = projectedMetrics.aReceber;

  const margemOperacional = totalEntradas > 0
    ? (((totalEntradas - totalSaidas) / totalEntradas) * 100).toFixed(1)
    : "0.0";

  const currentMonthSubtitle = useMemo(() => {
    const formatted = new Date().toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1) + " · valores operacionais CFM";
  }, []);

  const userFirstName = useMemo(() => {
    if (!user?.name) return "CFM Events";
    const first = user.name.trim().split(/\s+/)[0];
    return first || "CFM Events";
  }, [user?.name]);

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

  // Upcoming Events for Overview (from today onwards, excluding cancelled and completed)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return eventsList
      .filter((e) => {
        // Exclude cancelled events
        if (isCancelledEvent(e)) return false;
        const status = (e.status || "").toLowerCase().trim();
        if (status === "cancelado" || status === "cancelada" || status === "cancelled") return false;
        // Completed events belong in past completed events / finance, not upcoming
        if (status === "concluido" || status === "concluído") return false;

        const endMs = e.endDate ? new Date(e.endDate).getTime() : new Date(e.startDate).getTime();
        const startMs = new Date(e.startDate).getTime();
        const eventTime = !isNaN(endMs) ? endMs : startMs;

        return !isNaN(eventTime) && eventTime >= startOfToday;
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [eventsList]);

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

  // Unified Calendar Items: merges production events and meetings (excluding cancelled)
  const allCalendarItems = useMemo(() => {
    const eventItems = eventsList
      .filter((e) => !isCancelledEvent(e))
      .map((e) => ({
        ...e,
        isMeeting: false,
        detailUrl: `/eventos/${e.id}`,
        displayTitle: e.name,
      }));
    const meetingItems = meetingsList
      .filter((m) => !isCancelledEvent(m))
      .map((m) => ({
        ...m,
        name: m.title || m.name || "Reunião",
        isMeeting: true,
        detailUrl: `/reunioes/${m.id}`,
        displayTitle: m.title || m.name || "Reunião",
        category: "Reunião Calendly",
        venue: m.location || m.venue || "Google Meet",
      }));
    return [...eventItems, ...meetingItems];
  }, [eventsList, meetingsList]);

  const getEventsForCalendarDay = (
    day: number,
    month = currentCalendarMonth,
    year = currentCalendarYear,
    filterMode: "all" | "meetings" | "events" = "all"
  ) => {
    return allCalendarItems.filter((e) => {
      if (!e.startDate) return false;
      const d = new Date(e.startDate);
      const matchesDate = d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
      if (!matchesDate) return false;
      if (filterMode === "meetings") return e.isMeeting;
      if (filterMode === "events") return !e.isMeeting;
      return true;
    });
  };

  // Days with events in current calendar month
  const eventDays = new Set(
    allCalendarItems
      .filter((e) => {
        if (!e.startDate) return false;
        const d = new Date(e.startDate);
        return d.getFullYear() === currentCalendarYear && d.getMonth() === currentCalendarMonth;
      })
      .map((e) => new Date(e.startDate).getDate())
  );

  // Days with Calendly meetings in current calendar month
  const calendlyEventDays = new Set(
    allCalendarItems
      .filter((e) => {
        if (!e.startDate || !e.isMeeting) return false;
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
    <div className="min-h-screen bg-[#f5f5f7] text-[#111111] pb-[max(6.5rem,calc(5.5rem+env(safe-area-inset-bottom)))] font-sans antialiased">
      {/* Top Global Header Bar */}
      <header className="sticky top-0 z-30 bg-[#f5f5f7]/90 backdrop-blur-md border-b border-[#ececf0]/80">
        <div className="max-w-[940px] mx-auto px-3 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[15px] tracking-tight text-[#111]">CFM Events</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 text-[#636366] uppercase tracking-wider hidden xs:inline">
              EventFlow
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Global Notification Bell */}
            <button
              onClick={() => setShowAlertsDrawer(true)}
              className="relative min-w-[38px] min-h-[38px] p-2 rounded-xl text-[#3a3a3c] hover:bg-black/5 active:bg-black/10 transition cursor-pointer flex items-center justify-center touch-manipulation"
              title="Centro de Alertas & Notificações"
              aria-label="Alertas e Notificações"
            >
              <Bell className="w-5 h-5" />
              {newAlertsCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 bg-[#ff3b30] text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-in zoom-in-75">
                  {newAlertsCount}
                </span>
              )}
            </button>

            {user ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Link
                  href={`/utilizadores/${user.id}`}
                  className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-xl bg-white hover:bg-[#fafafc] border border-[#ececf0] text-xs font-semibold shadow-2xs transition group"
                  title={`${user.name} (${user.email}) · Acesso ${user.role} · Ver Perfil`}
                >
                  <div className="w-5 h-5 rounded-full bg-[#111] text-white flex items-center justify-center text-[10px] font-bold overflow-hidden flex-shrink-0">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      user.name.charAt(0)
                    )}
                  </div>
                  <span className="text-[#111] group-hover:text-[#007aff] transition hidden sm:inline">{user.name.split(" ")[0]}</span>
                </Link>

                <button
                  type="button"
                  onClick={async () => {
                    await logoutAction();
                    setUser(null);
                  }}
                  className="min-h-[36px] p-2 sm:px-2.5 sm:py-1 rounded-xl bg-white border border-[#ececf0] hover:border-rose-200 active:bg-rose-100 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer flex items-center gap-1.5 shadow-2xs touch-manipulation"
                  title="Terminar sessão"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="min-h-[36px] p-2 sm:px-3 sm:py-1 rounded-xl bg-white border border-[#ececf0] text-xs font-semibold text-[#111] hover:bg-[#fafafc] active:bg-[#f2f2f5] transition cursor-pointer shadow-2xs touch-manipulation flex items-center gap-1.5"
                title="Iniciar sessão"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Entrar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-[940px] mx-auto px-3.5 sm:px-6 pt-4 sm:pt-6 pb-10">
        {calendlyBanner && (
          <div
            className={`mb-4 p-3.5 rounded-[14px] text-xs flex items-center justify-between border ${
              calendlyBanner.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : "bg-rose-50 text-rose-900 border-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  calendlyBanner.type === "success" ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />
              <span className="font-semibold">{calendlyBanner.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setCalendlyBanner(null)}
              className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 1: HOME */}
        {/* ========================================================= */}
        {activeTab === "home" && (
          <section className="space-y-4">
            {/* Header Greeting */}
            <div className="mb-2">
              <h1 className="text-[28px] sm:text-[39px] font-extrabold tracking-[-1px] sm:tracking-[-1.5px] text-[#111111] leading-tight">
                Olá {userFirstName}.
              </h1>
            </div>

            {/* Resumo Financeiro Card (Lucro de Eventos Concluídos & Trajetória Mensal) */}
            <CompletedEventsProfitChart
              totalProfit={completedEventsProfitData.totalProfit}
              totalRevenue={completedEventsProfitData.totalRevenue}
              totalCosts={completedEventsProfitData.totalCosts}
              avgMargin={completedEventsProfitData.avgMargin}
              events={completedEventsProfitData.events}
              monthlyTrajectory={completedEventsProfitData.monthlyTrajectory}
              onSelectEvent={(eventId) => router.push(`/eventos/${eventId}`)}
              onNavigateFinance={(e) => handleTabSwitch("finance", "/financas", e)}
            />

            {/* ROW: 2/3 Próximos Eventos + 1/3 Alertas Importantes */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
              {/* 2/3 COLUMN: Próximos Eventos */}
              <div className="lg:col-span-8 bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[18px] font-bold tracking-[-0.35px] text-[#111111]">
                    Próximos eventos
                  </h3>
                  <Link
                    href="/eventos"
                    onClick={(e) => handleTabSwitch("events", "/eventos", e)}
                    className="text-[12px] text-[#8e8e93] hover:text-[#007aff] cursor-pointer"
                  >
                    Ver todos ({upcomingEvents.length}) →
                  </Link>
                </div>

                <div className="divide-y divide-[#f0f0f3]">
                  {upcomingEvents.slice(0, 5).map((evt) => {
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

                  {upcomingEvents.length === 0 && (
                    <div className="py-8 text-center text-xs text-[#8e8e93]">
                      Sem eventos futuros agendados.
                    </div>
                  )}
                </div>
              </div>

              {/* 1/3 COLUMN: Equipa Online Agora & Alertas Importantes */}
              <div className="lg:col-span-4 space-y-3.5">
                {/* Equipa Online Agora Card */}
                <div className="bg-white border border-[#ececf0] rounded-[22px] p-4 sm:p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      </div>
                      <h3 className="text-[15px] font-bold tracking-tight text-[#111111]">
                        Equipa online agora
                      </h3>
                    </div>

                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                      {onlineUsers.length} online
                    </span>
                  </div>

                  <div className="space-y-2">
                    {onlineUsers.length === 0 ? (
                      <div className="py-4 text-center text-xs text-[#8e8e93]">
                        Nenhum membro ativo detectado.
                      </div>
                    ) : (
                      onlineUsers.map((u) => {
                        const isSelf = user?.id === u.userId;
                        const isEditing = !!u.editingEntityType && !!u.editingEntityId;

                        return (
                          <div
                            key={u.userId}
                            className="flex items-center justify-between gap-2.5 p-2 rounded-[14px] hover:bg-[#f8f8fa] transition"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <Link
                                href={`/utilizadores/${u.userId}`}
                                className="relative flex-shrink-0 group"
                                title={`Ver perfil de ${u.userName}`}
                              >
                                <div className="w-8 h-8 rounded-full bg-[#111] text-white flex items-center justify-center text-xs font-bold overflow-hidden border border-black/5 group-hover:ring-2 group-hover:ring-[#007aff] transition">
                                  {u.avatarUrl ? (
                                    <img src={u.avatarUrl} alt={u.userName} className="w-full h-full object-cover" />
                                  ) : (
                                    u.userName.slice(0, 2).toUpperCase()
                                  )}
                                </div>
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
                              </Link>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <Link
                                    href={`/utilizadores/${u.userId}`}
                                    className="text-xs font-bold text-[#111] hover:text-[#007aff] transition truncate"
                                  >
                                    {u.userName}
                                  </Link>
                                  {isSelf && (
                                    <span className="text-[9px] font-extrabold text-[#007aff] bg-blue-50 px-1.5 py-0.2 rounded-full border border-blue-200/60">
                                      Tu
                                    </span>
                                  )}
                                </div>

                                {isEditing ? (
                                  <Link
                                    href={
                                      u.editingEntityType === "event"
                                        ? `/eventos/${u.editingEntityId}`
                                        : `/inventario/${u.editingEntityId}`
                                    }
                                    className="text-[11px] font-semibold text-[#007aff] hover:underline flex items-center gap-1.5 truncate mt-0.5"
                                    title={u.editingEntityTitle || ""}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#007aff] animate-ping flex-shrink-0" />
                                    <span className="truncate">
                                      A editar {u.editingEntityType === "event" ? "evento" : "artigo"}:{" "}
                                      <strong>{u.editingEntityTitle || u.editingEntityId}</strong>
                                    </span>
                                  </Link>
                                ) : (
                                  <div className="text-[11px] text-[#8e8e93] truncate">
                                    Ativo na aplicação
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Alertas Importantes */}
                <div className="bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-[34px] h-[34px] rounded-[11px] bg-white text-[#ff3b30] border border-[#ff3b30]/15 flex items-center justify-center font-bold text-[16px] shadow-xs">
                      !
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-[#111111]">
                        Alertas importantes
                      </div>
                      <div className="text-[12px] text-[#8e8e93]">
                        {activeAlerts.length}{" "}
                        {activeAlerts.length === 1
                          ? "item requer atenção"
                          : "itens requerem atenção"}
                        {newAlertsCount > 0 && ` · ${newAlertsCount} novo${newAlertsCount > 1 ? "s" : ""}`}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowAlertsDrawer(true)}
                    className="text-[12px] font-semibold text-[#007aff] hover:underline cursor-pointer"
                  >
                    Gerir →
                  </button>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 mb-2.5 px-0.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
                  <button
                    onClick={() => setHomeAlertFilter("all")}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer touch-manipulation ${
                      homeAlertFilter === "all"
                        ? "bg-[#111] text-white"
                        : "bg-white text-[#636366] hover:bg-[#ececf0] border border-[#ececf0]"
                    }`}
                  >
                    Todos ({activeAlerts.length})
                  </button>
                  <button
                    onClick={() => setHomeAlertFilter("new")}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 touch-manipulation ${
                      homeAlertFilter === "new"
                        ? "bg-[#007aff] text-white"
                        : "bg-white text-[#636366] hover:bg-[#ececf0] border border-[#ececf0]"
                    }`}
                  >
                    <span>Novos</span>
                    {newAlertsCount > 0 && (
                      <span
                        className={`text-[10px] px-1 rounded-full font-bold ${
                          homeAlertFilter === "new"
                            ? "bg-white text-[#007aff]"
                            : "bg-[#007aff] text-white"
                        }`}
                      >
                        {newAlertsCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setHomeAlertFilter("snoozed")}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer touch-manipulation ${
                      homeAlertFilter === "snoozed"
                        ? "bg-[#111] text-white"
                        : "bg-white text-[#636366] hover:bg-[#ececf0] border border-[#ececf0]"
                    }`}
                  >
                    Adiados ({snoozedAlerts.length})
                  </button>
                </div>

                <div className="space-y-2">
                  {(() => {
                    const list =
                      homeAlertFilter === "new"
                        ? newAlerts
                        : homeAlertFilter === "snoozed"
                        ? snoozedAlerts
                        : activeAlerts;

                    if (list.length === 0) {
                      return (
                        <div className="bg-white border border-[#ececf0] rounded-[15px] p-4 text-center">
                          <div className="text-[12px] font-bold text-[#111]">
                            {homeAlertFilter === "snoozed"
                              ? "Sem alertas adiados"
                              : homeAlertFilter === "new"
                              ? "Sem alertas novos por ler"
                              : "Sem pendências"}
                          </div>
                          <div className="text-[11px] text-[#8e8e93] mt-0.5">
                            Tudo operacional e em dia
                          </div>
                        </div>
                      );
                    }

                    return list.slice(0, 4).map((alert) => {
                      const isNew = !alert.acknowledgedAt;
                      const isSnoozeOpen = openHomeSnoozeMenuId === alert.id;

                      const isRed =
                        alert.type === "damaged_stock" ||
                        alert.type === "payment_due" ||
                        alert.type === "missing_completed_payment";

                      const categoryTag =
                        alert.type === "damaged_stock"
                          ? "Dano"
                          : alert.type === "low_stock"
                          ? "Stock"
                          : alert.type === "event_unprepared"
                          ? "Prep"
                          : alert.type === "payment_due"
                          ? "Sinal"
                          : "Cobrança";

                      return (
                        <div
                          key={alert.id}
                          className={`relative rounded-[15px] p-3 border transition ${
                            isRed
                              ? "bg-[#ff3b30]/[0.08] border-[#ff3b30]/[0.17] text-[#a62a24]"
                              : "bg-[#ff9f0a]/[0.11] border-[#ff9f0a]/[0.18] text-[#845000]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div
                              onClick={() => handleAlertActionClick(alert)}
                              className="flex-1 min-w-0 cursor-pointer"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`w-[8px] h-[8px] rounded-full flex-shrink-0 ${
                                    isRed ? "bg-[#ff3b30]" : "bg-[#ff9f0a]"
                                  }`}
                                />
                                <span className="text-[13px] font-bold truncate">
                                  {alert.title}
                                </span>
                                {isNew && (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-[#007aff] text-white">
                                    Novo
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] opacity-80 line-clamp-2">
                                {alert.message}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/70">
                                {categoryTag}
                              </span>

                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenHomeSnoozeMenuId(
                                      isSnoozeOpen ? null : alert.id
                                    );
                                  }}
                                  className="w-8 h-8 rounded-lg hover:bg-black/5 active:bg-black/10 text-inherit opacity-75 hover:opacity-100 transition cursor-pointer flex items-center justify-center touch-manipulation"
                                  title="Adiar..."
                                  aria-label="Adiar alerta"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                </button>

                                {isSnoozeOpen && (
                                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-[#ececf0] rounded-2xl shadow-xl p-1.5 z-30 text-[#111] animate-in fade-in zoom-in-95 duration-150">
                                    <div className="text-[9px] font-bold text-[#8e8e93] uppercase px-2 py-1">
                                      Adiar alerta
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleSnoozeAlert(alert.id, 4)}
                                      className="w-full text-left px-2.5 py-2 text-xs sm:text-sm hover:bg-[#f2f2f5] active:bg-[#e5e5ea] rounded-xl transition cursor-pointer"
                                    >
                                      🕒 4 horas
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSnoozeAlert(alert.id, 24)}
                                      className="w-full text-left px-2.5 py-2 text-xs sm:text-sm hover:bg-[#f2f2f5] active:bg-[#e5e5ea] rounded-xl transition cursor-pointer"
                                    >
                                      🕒 1 dia
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSnoozeAlert(alert.id, 72)}
                                      className="w-full text-left px-2.5 py-2 text-xs sm:text-sm hover:bg-[#f2f2f5] active:bg-[#e5e5ea] rounded-xl transition cursor-pointer"
                                    >
                                      🕒 3 dias
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSnoozeAlert(alert.id, 168)}
                                      className="w-full text-left px-2.5 py-2 text-xs sm:text-sm hover:bg-[#f2f2f5] active:bg-[#e5e5ea] rounded-xl transition cursor-pointer"
                                    >
                                      🕒 1 semana
                                    </button>
                                    <div className="border-t border-[#ececf0] my-1" />
                                    <button
                                      type="button"
                                      onClick={() => handleDismissAlert(alert.id)}
                                      className="w-full text-left px-2.5 py-2 text-xs sm:text-sm text-rose-600 hover:bg-rose-50 active:bg-rose-100 rounded-xl transition cursor-pointer font-medium"
                                    >
                                      Dispensar
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-black/5 flex items-center justify-between gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleAlertActionClick(alert)}
                              className="min-h-[34px] px-2 py-1 text-[11px] sm:text-xs font-bold hover:underline active:opacity-70 flex items-center gap-1 cursor-pointer touch-manipulation"
                            >
                              <span>Resolver agora</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                            {isNew && (
                              <button
                                type="button"
                                onClick={() => handleAcknowledgeAlert(alert.id)}
                                className="min-h-[34px] px-2 py-1 text-[10px] sm:text-[11px] opacity-75 hover:opacity-100 active:opacity-50 hover:underline cursor-pointer touch-manipulation"
                              >
                                Marcar lido
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
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
                  Reuniões agendadas por clientes via Calendly e produções de eventos CFM em agenda única.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleSyncCalendly()}
                  disabled={isSyncingCalendly}
                  className="px-3.5 py-2 rounded-[12px] bg-[#eeeffe] hover:bg-[#e0e3ff] text-[#4338ca] text-xs font-bold border border-indigo-200/80 flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-60"
                  title="Puxar reuniões agendadas pelos clientes no Calendly"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-[#6366f1] ${
                      isSyncingCalendly ? "animate-spin" : ""
                    }`}
                  />
                  <span>
                    {isSyncingCalendly ? "A sincronizar..." : "Sincronizar Calendly"}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setEventWizardInitialDate(null);
                    setShowEventWizard(true);
                  }}
                  className="px-4 py-2 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <span>＋</span>
                  <span>Novo evento</span>
                </button>
              </div>
            </div>

            {/* Filter Pills & Color Legend */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 pb-1 border-y border-[#ececf0]">
              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                <button
                  type="button"
                  onClick={() => setCalendarFilter("all")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                    calendarFilter === "all"
                      ? "bg-[#111] text-white shadow-xs"
                      : "bg-[#f2f2f5] text-[#636366] hover:bg-[#e5e5ea]"
                  }`}
                >
                  Todos ({allCalendarItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarFilter("meetings")}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    calendarFilter === "meetings"
                      ? "bg-[#6366f1] text-white shadow-xs"
                      : "bg-[#eeeffe] text-[#4338ca] hover:bg-[#e0e3ff] border border-indigo-200/60"
                  }`}
                >
                  <Video className="w-3 h-3 text-indigo-400" />
                  <span>Reuniões Calendly ({calendlyMeetingsCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarFilter("events")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                    calendarFilter === "events"
                      ? "bg-[#111] text-white shadow-xs"
                      : "bg-[#f2f2f5] text-[#636366] hover:bg-[#e5e5ea]"
                  }`}
                >
                  Produções CFM ({productionEventsCount})
                </button>
              </div>

              {/* Visual Legend */}
              <div className="flex items-center gap-3 text-[11px] text-[#636366] flex-wrap">
                <span className="flex items-center gap-1.5 font-bold text-[#4338ca]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#6366f1] shadow-xs ring-2 ring-indigo-200" />
                  <span>Reunião Calendly</span>
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#24793a]" />
                  <span>Confirmado</span>
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#9a5b00]" />
                  <span>Preparação / Orçamento</span>
                </span>
              </div>
            </div>

            {/* Interactive Monthly Calendar Grid */}
            <div className="border border-[#ececf0] rounded-[20px] overflow-hidden bg-white shadow-2xs">
              <div className="grid grid-cols-7 border-b border-[#ececf0] bg-[#fafafc] text-center text-xs font-semibold text-[#8e8e93] py-2 sm:py-2.5">
                <div><span className="hidden sm:inline">Segunda</span><span className="sm:hidden">Seg</span></div>
                <div><span className="hidden sm:inline">Terça</span><span className="sm:hidden">Ter</span></div>
                <div><span className="hidden sm:inline">Quarta</span><span className="sm:hidden">Qua</span></div>
                <div><span className="hidden sm:inline">Quinta</span><span className="sm:hidden">Qui</span></div>
                <div><span className="hidden sm:inline">Sexta</span><span className="sm:hidden">Sex</span></div>
                <div><span className="hidden sm:inline">Sábado</span><span className="sm:hidden">Sáb</span></div>
                <div><span className="hidden sm:inline">Domingo</span><span className="sm:hidden">Dom</span></div>
              </div>

              <div className="grid grid-cols-7 divide-x divide-y divide-[#f0f0f3] bg-[#f9f9fb]">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`cal-blank-${i}`} className="min-h-[58px] sm:min-h-[96px] bg-[#f5f5f7]/40 p-1 sm:p-2" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dayEvents = getEventsForCalendarDay(
                    day,
                    currentCalendarMonth,
                    currentCalendarYear,
                    calendarFilter
                  );
                  const isSelected =
                    selectedDate.year === currentCalendarYear &&
                    selectedDate.month === currentCalendarMonth &&
                    selectedDate.day === day;
                  const isToday =
                    today.getFullYear() === currentCalendarYear &&
                    today.getMonth() === currentCalendarMonth &&
                    today.getDate() === day;
                  const hasEvents = dayEvents.length > 0;
                  const hasCalendlyInDay = dayEvents.some(isCalendlyMeeting);

                  return (
                    <div
                      key={`cal-day-${day}`}
                      onClick={() => handleCalendarDayClick(day)}
                      className={`min-h-[58px] sm:min-h-[96px] p-1 sm:p-2 transition cursor-pointer flex flex-col justify-between group overflow-hidden ${
                        isSelected
                          ? "bg-[#111]/[0.035] ring-2 ring-inset ring-[#111]"
                          : hasCalendlyInDay
                          ? "bg-[#faf9ff] hover:bg-[#f3f0ff]"
                          : hasEvents
                          ? "bg-white hover:bg-[#fafafc]"
                          : "bg-white/80 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 min-w-0">
                        <span
                          className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold transition ${
                            isSelected
                              ? "bg-[#111] text-white shadow-xs"
                              : isToday
                              ? "border-2 border-[#007aff] text-[#007aff] font-bold"
                              : hasCalendlyInDay
                              ? "bg-[#6366f1] text-white shadow-2xs"
                              : hasEvents
                              ? "bg-[#2c2c2e] text-white"
                              : "text-[#48484a] group-hover:bg-[#f0f0f3]"
                          }`}
                        >
                          {day}
                        </span>

                        {hasEvents && (
                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1 ${
                                hasCalendlyInDay
                                  ? "text-[#4338ca] bg-[#eeeffe] border border-indigo-200/60"
                                  : "text-[#24793a] bg-[#eaf8ee]"
                              }`}
                            >
                              {hasCalendlyInDay && (
                                <Video className="w-2.5 h-2.5 text-[#6366f1] shrink-0" />
                              )}
                              <span className="hidden lg:inline">
                                {dayEvents.length} {dayEvents.length === 1 ? "agendado" : "agendados"}
                              </span>
                              <span className="lg:hidden">{dayEvents.length}</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Event pills preview on Desktop */}
                      <div className="hidden sm:block space-y-1 my-1.5 flex-1 min-w-0">
                        {dayEvents.slice(0, 2).map((evt) => {
                          const isMeeting = Boolean(evt.isMeeting || isCalendlyMeeting(evt));
                          if (isMeeting) {
                            return (
                              <div
                                key={evt.id}
                                className="px-1.5 py-0.5 rounded-[6px] text-[10px] font-bold truncate bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white shadow-xs flex items-center gap-1 border border-indigo-700/30 ring-1 ring-indigo-400/20"
                                title={`Reunião: ${evt.name}`}
                              >
                                <Video className="w-2.5 h-2.5 flex-shrink-0 text-white/90" />
                                <span className="truncate">
                                  {evt.name.replace(/^Reunião:\s*/i, "")}
                                </span>
                              </div>
                            );
                          }

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

                      {/* Event dots preview on Mobile */}
                      {hasEvents && (
                        <div className="sm:hidden flex items-center justify-center gap-0.5 sm:gap-1 mt-1">
                          {dayEvents.slice(0, 3).map((evt) => (
                            <span
                              key={evt.id}
                              className={`w-1.5 h-1.5 rounded-full ${
                                (evt.isMeeting || isCalendlyMeeting(evt))
                                  ? "bg-[#6366f1] ring-1 ring-white"
                                  : "bg-[#007aff]"
                              }`}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-[8px] font-bold text-[#8e8e93] leading-none">+</span>
                          )}
                        </div>
                      )}
                      {/* Hover action on Desktop */}
                      <div className="hidden sm:flex text-[10px] text-[#8e8e93] opacity-0 group-hover:opacity-100 transition items-center justify-end font-semibold">
                        {hasEvents ? "Ver resumo →" : "＋ Criar"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Event Timeline List */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[16px] font-bold text-[#111111]">
                  Cronograma da Agenda ({allCalendarItems.filter((e) => {
                    if (calendarFilter === "meetings") return e.isMeeting;
                    if (calendarFilter === "events") return !e.isMeeting;
                    return true;
                  }).length})
                </div>
                {calendarFilter !== "all" && (
                  <button
                    onClick={() => setCalendarFilter("all")}
                    className="text-xs text-[#6366f1] font-semibold hover:underline"
                  >
                    Limpar filtro (Mostrar todos)
                  </button>
                )}
              </div>

              <div className="divide-y divide-[#ececf0] border border-[#ececf0] rounded-[18px] overflow-hidden bg-white shadow-xs">
                {allCalendarItems
                  .filter((e) => {
                    if (calendarFilter === "meetings") return e.isMeeting;
                    if (calendarFilter === "events") return !e.isMeeting;
                    return true;
                  })
                  .map((e) => {
                    const isMeeting = Boolean(e.isMeeting);
                    const statusObj = getStatusStyle(e.status);
                    const startDate = new Date(e.startDate);

                    return (
                      <div
                        key={e.id}
                        onClick={() => router.push(e.detailUrl || (isMeeting ? `/reunioes/${e.id}` : `/eventos/${e.id}`))}
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition cursor-pointer group ${
                          isMeeting
                            ? "bg-[#faf9ff] hover:bg-[#f3f0ff]"
                            : "bg-white hover:bg-[#fafafa]"
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className={`w-12 h-12 rounded-[12px] border flex flex-col items-center justify-center flex-shrink-0 transition duration-200 ${
                              isMeeting
                                ? "bg-gradient-to-b from-[#eeeffe] to-[#e0e3ff] border-indigo-200 text-[#4338ca] group-hover:bg-[#4338ca] group-hover:text-white"
                                : "bg-[#f2f2f7] border-black/5 group-hover:bg-[#111] group-hover:text-white"
                            }`}
                          >
                            <span
                              className={`text-[9px] uppercase font-bold ${
                                isMeeting
                                  ? "text-[#6366f1] group-hover:text-white/80"
                                  : "text-[#8e8e93] group-hover:text-white/80"
                              }`}
                            >
                              {monthNames[startDate.getMonth()]?.slice(0, 3) || "OUT"}
                            </span>
                            <span
                              className={`text-base font-extrabold ${
                                isMeeting
                                  ? "text-[#4338ca] group-hover:text-white"
                                  : "text-[#111] group-hover:text-white"
                              }`}
                            >
                              {startDate.getDate()}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isMeeting && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#6366f1] text-white flex items-center gap-1 shadow-2xs">
                                  <Video className="w-2.5 h-2.5" />
                                  <span>Reunião Calendly</span>
                                </span>
                              )}
                              <span className="font-bold text-sm text-[#111] group-hover:text-[#007aff] transition truncate">
                                {e.name}
                              </span>
                            </div>
                            <div className="text-xs text-[#8e8e93] mt-0.5 truncate flex items-center gap-1.5">
                              {isMeeting && e.startDate && (
                                <span className="font-bold text-[#4338ca]">
                                  🕒 {formatMeetingTimeRange(e.startDate, e.endDate)} ·
                                </span>
                              )}
                              <span>{formatEventByline(e.startDate, e.venue)}</span>
                            </div>
                            {e.notes && (
                              <div
                                className={`text-[11px] mt-1 px-2 py-0.5 rounded-md inline-block truncate max-w-md ${
                                  isMeeting
                                    ? "bg-indigo-50/70 text-indigo-900 border border-indigo-100/60"
                                    : "bg-[#f8f8fa] text-[#6e6e73]"
                                }`}
                              >
                                {e.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          {isMeeting ? (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#eeeffe] text-[#4338ca] border border-indigo-200">
                              Briefing Marcado
                            </span>
                          ) : (
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${statusObj.bg} ${statusObj.text}`}
                            >
                              {statusObj.label}
                            </span>
                          )}
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
                            prefetch={false}
                            className="font-bold text-[16px] text-[#111] hover:text-[#007aff] transition"
                          >
                            {e.name}
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

                        <div className="flex items-center gap-2 text-[11px] text-[#8e8e93] mt-2">
                          <span>
                            Last updated by <strong className="text-[#3a3a3c] font-semibold">{e.lastUpdatedByName || "Administrador CFM"}</strong> {formatRelativeTime(e.updatedAt, "en")}
                          </span>
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setAuditModal({
                                isOpen: true,
                                entityType: "event",
                                entityId: e.id,
                                entityTitle: e.name,
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[#ececf0] hover:bg-[#f2f2f5] text-[#007aff] transition cursor-pointer text-[10px] font-semibold shadow-2xs"
                            title="Ver histórico de alterações"
                          >
                            <History className="w-3 h-3" />
                            <span>Histórico de Alterações</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Direct Link to Dedicated Event Page */}
                      <Link
                        href={`/eventos/${e.id}`}
                        prefetch={false}
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

                      {!isCalendlyMeeting(e) && (
                        <Link
                          href={`/eventos/${e.id}?action=novo-orcamento`}
                          prefetch={false}
                          onClick={(ev) => ev.stopPropagation()}
                          className="px-3 py-1.5 rounded-lg bg-white border border-[#ececf0] text-xs font-semibold text-[#111] hover:bg-[#f2f2f5] transition flex items-center gap-1 shadow-2xs"
                          title="Abrir configuração do evento para gerar orçamento"
                        >
                          <span>+ Gerar Orçamento</span>
                        </Link>
                      )}
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
          <section className="bg-white border border-[#ececf0] rounded-[22px] p-4 sm:p-6 shadow-xs space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111]">
                  Inventário
                </h2>
                <p className="text-xs text-[#8e8e93]">
                  Controlo de stock físico e triagem de itens
                </p>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 self-start sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setLocationsModalInitialMode("list");
                    setShowLocationsModal(true);
                  }}
                  className="p-2.5 sm:px-3.5 sm:py-2.5 rounded-[12px] bg-white border border-[#ececf0] hover:bg-[#f2f2f5] text-[#111] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title={`Locais & Gestores (${locationsList.length})`}
                  aria-label="Locais & Gestores"
                >
                  <Building className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[#636366]" />
                  <span className="hidden sm:inline">Locais & Gestores</span>
                  <span className="hidden sm:inline px-1.5 py-0.2 rounded-full text-[10px] bg-[#f2f2f5] text-[#3a3a3c] font-bold border border-[#ececf0]">
                    {locationsList.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowReceiptScanner(true)}
                  className="p-2.5 sm:px-3.5 sm:py-2.5 rounded-[12px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm shadow-blue-500/20"
                  title="Digitalizar fatura/recibo com Gemini AI para adicionar stock ou novos artigos"
                  aria-label="Digitalizar Fatura"
                >
                  <FileText className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                  <span className="hidden sm:inline">Digitalizar Fatura</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowBarcodeScanner(true)}
                  className="p-2.5 sm:px-3.5 sm:py-2.5 rounded-[12px] bg-white border border-[#ececf0] hover:bg-[#f2f2f5] text-[#111] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title="Ler Código de Barras (Câmara do dispositivo)"
                  aria-label="Ler Código de Barras"
                >
                  <ScanLine className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[#007aff]" />
                  <span className="hidden sm:inline">Código de Barras</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowItemWizard(true)}
                  className="p-2.5 sm:px-4 sm:py-2.5 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title="Novo Artigo"
                  aria-label="Novo Artigo"
                >
                  <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                  <span className="hidden sm:inline">Novo Artigo</span>
                </button>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-[#fafafa] border border-[#ececf0] rounded-[18px] p-3.5 sm:p-4 space-y-3">
              {/* Row 1: Search + Category + Storage Location */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                {/* Search */}
                <div className="sm:col-span-5 relative">
                  <Search className="w-4 h-4 text-[#8e8e93] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    placeholder="Pesquisar por nome do artigo..."
                    className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff] transition"
                  />
                  {inventorySearch && (
                    <button
                      type="button"
                      onClick={() => setInventorySearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8e8e93] hover:text-[#111] p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Filter */}
                <div className="sm:col-span-4 relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#8e8e93]">
                    <Tag className="w-3.5 h-3.5" />
                  </div>
                  <select
                    value={inventoryCategoryFilter}
                    onChange={(e) => setInventoryCategoryFilter(e.target.value)}
                    className="w-full pl-8 pr-7 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff] transition appearance-none cursor-pointer"
                  >
                    <option value="all">Todas as Categorias ({itemsList.length})</option>
                    {inventoryCategories.map((cat) => {
                      const count = itemsList.filter((i) => i.category === cat).length;
                      return (
                        <option key={cat} value={cat}>
                          {cat} ({count})
                        </option>
                      );
                    })}
                  </select>
                  <ChevronRight className="w-3.5 h-3.5 text-[#8e8e93] absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                </div>

                {/* Storage Location Filter */}
                <div className="sm:col-span-3 relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#8e8e93]">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <select
                    value={inventoryLocationFilter}
                    onChange={(e) => setInventoryLocationFilter(e.target.value)}
                    className="w-full pl-8 pr-7 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff] transition appearance-none cursor-pointer"
                  >
                    <option value="all">Todos os Locais ({itemsList.length})</option>
                    {locationsList.map((loc) => {
                      const count = itemsList.filter(
                        (i) => i.locationId === loc.id || (i.warehouseLocation || "Armazém Principal").includes(loc.name)
                      ).length;
                      return (
                        <option key={loc.id} value={loc.name}>
                          {loc.name} · {loc.managerName} ({count})
                        </option>
                      );
                    })}
                    {inventoryLocations
                      .filter((loc) => !locationsList.some((l) => l.name === loc))
                      .map((loc) => {
                        const count = itemsList.filter(
                          (i) => (i.warehouseLocation || "Armazém Principal") === loc
                        ).length;
                        return (
                          <option key={loc} value={loc}>
                            {loc} ({count})
                          </option>
                        );
                      })}
                  </select>
                  <ChevronRight className="w-3.5 h-3.5 text-[#8e8e93] absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                </div>
              </div>

              {/* Row 2: Alert filter chips & Summary */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#ececf0]/70">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-[#8e8e93] mr-1 hidden sm:inline">
                    Alertas:
                  </span>

                  {/* All */}
                  <button
                    type="button"
                    onClick={() => setInventoryAlertFilter("all")}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                      inventoryAlertFilter === "all"
                        ? "bg-[#111] text-white shadow-2xs"
                        : "bg-white border border-[#ececf0] text-[#3a3a3c] hover:bg-[#f2f2f5]"
                    }`}
                  >
                    Todos ({itemsList.length})
                  </button>

                  {/* With Alerts */}
                  <button
                    type="button"
                    onClick={() => setInventoryAlertFilter("alerts")}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition flex items-center gap-1 cursor-pointer ${
                      inventoryAlertFilter === "alerts"
                        ? "bg-rose-600 text-white shadow-2xs"
                        : inventoryAlertCounters.totalAlerts > 0
                        ? "bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100"
                        : "bg-white border border-[#ececf0] text-[#8e8e93] hover:bg-[#f2f2f5]"
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>Com Alertas ({inventoryAlertCounters.totalAlerts})</span>
                  </button>
                </div>

                {/* Reset button if filters active */}
                {(inventorySearch ||
                  inventoryCategoryFilter !== "all" ||
                  inventoryLocationFilter !== "all" ||
                  inventoryAlertFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setInventorySearch("");
                      setInventoryCategoryFilter("all");
                      setInventoryLocationFilter("all");
                      setInventoryAlertFilter("all");
                    }}
                    className="text-xs font-semibold text-[#007aff] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Limpar filtros</span>
                  </button>
                )}
              </div>
            </div>

            {/* Inventory Results Count */}
            <div className="flex items-center justify-between text-xs text-[#8e8e93] px-1">
              <span>
                A mostrar <strong className="text-[#111]">{processedInventoryItems.length}</strong> de{" "}
                <strong className="text-[#111]">{itemsList.length}</strong> artigos
              </span>
            </div>

            {/* List Items Container */}
            {processedInventoryItems.length === 0 ? (
              <div className="p-12 text-center bg-[#fafafa] border border-dashed border-[#ececf0] rounded-[20px] space-y-3">
                <div className="w-12 h-12 rounded-[16px] bg-white border border-[#ececf0] flex items-center justify-center mx-auto text-[#8e8e93]">
                  <Package className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-[#111]">
                  Nenhum artigo encontrado
                </h3>
                <p className="text-xs text-[#8e8e93] max-w-sm mx-auto">
                  Não foram encontrados artigos que correspondam aos filtros de pesquisa atuais.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setInventorySearch("");
                    setInventoryCategoryFilter("all");
                    setInventoryLocationFilter("all");
                    setInventoryAlertFilter("all");
                  }}
                  className="px-3.5 py-1.5 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-semibold transition"
                >
                  Limpar todos os filtros
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-[20px] border border-[#ececf0] overflow-hidden shadow-2xs divide-y divide-[#ececf0]">
                {/* Desktop Table Header */}
                <div className="hidden lg:grid grid-cols-12 gap-3 px-5 py-3 bg-[#f8f8fa] text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider">
                  <div className="col-span-4">Artigo</div>
                  <div className="col-span-2">Categoria</div>
                  <div className="col-span-2">Localização</div>
                  <div className="col-span-2">Stock</div>
                  <div className="col-span-2 text-right">Preço</div>
                </div>

                {/* List Item Rows */}
                {processedInventoryItems.map((item) => {
                  const damaged = item.damagedQuantity || 0;
                  const available = item.totalQuantity - damaged;
                  const isLow = available < item.minStock;

                  return (
                    <div
                      key={item.id}
                      onClick={() => router.push(`/inventario/${item.id}`)}
                      className="hover:bg-[#fafafa] transition cursor-pointer group"
                    >
                      {/* MOBILE ROW (< lg): Slim & Compact with Just Icons */}
                      <div className="lg:hidden p-3 flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="shrink-0 relative">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-11 h-11 rounded-[10px] object-cover border border-[#ececf0] group-hover:scale-105 transition"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-[10px] bg-[#f2f2f5] border border-[#ececf0] flex items-center justify-center text-[#8e8e93]">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-[13px] text-[#111] group-hover:text-[#007aff] transition truncate leading-snug" title={item.name}>
                              {item.name}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-[#8e8e93]">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#f2f2f5] text-[#3a3a3c]">
                                {item.category || "Geral"}
                              </span>
                              <span>·</span>
                              <span className="inline-flex items-center gap-0.5 text-[#636366] truncate max-w-[110px]">
                                <MapPin className="w-2.5 h-2.5 text-[#007aff] shrink-0" />
                                <span className="truncate">{item.warehouseLocation || "Armazém Principal"}</span>
                              </span>
                              <span>·</span>
                              <span className="text-xs font-bold text-[#111]">
                                €{(item.replacementCost || item.unitPrice || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right side: Stock badge + Icon-only action buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div
                            className={`font-bold text-[11px] px-2 py-0.5 rounded-full border ${
                              damaged > 0
                                ? "bg-rose-50 text-rose-700 border-rose-200/60"
                                : isLow
                                ? "bg-amber-50 text-amber-700 border-amber-200/60"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                            }`}
                          >
                            {available} un.
                          </div>

                          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                            {item.purchaseStatus === "not_bought" && (
                              <button
                                type="button"
                                onClick={() => handleMarkAsBought(item)}
                                className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center justify-center cursor-pointer shadow-2xs"
                                title="Marcar como Comprado"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {damaged > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTriageItem(item);
                                  setShowTriageModal(true);
                                }}
                                className="p-1.5 rounded-lg bg-[#111] hover:bg-black text-white transition flex items-center justify-center cursor-pointer shadow-2xs"
                                title="Triagem de material danificado"
                              >
                                <Wrench className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setAuditModal({
                                  isOpen: true,
                                  entityType: "inventory",
                                  entityId: item.id,
                                  entityTitle: item.name,
                                });
                              }}
                              className="p-1.5 rounded-lg text-[#8e8e93] hover:text-[#007aff] hover:bg-[#f2f2f5] active:bg-[#e5e5ea] transition cursor-pointer"
                              title="Histórico de alterações"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteItemClick(item)}
                              className="p-1.5 rounded-lg text-[#8e8e93] hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition cursor-pointer"
                              title="Eliminar este artigo do inventário"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* DESKTOP ROW (hidden lg:grid) */}
                      <div className="hidden lg:grid grid-cols-12 items-center gap-3 px-5 py-3.5">
                        {/* Column 1: Item Thumbnail & Name */}
                        <div className="col-span-4 flex items-center gap-3">
                          <div className="shrink-0 relative">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-12 h-12 rounded-[12px] object-cover border border-[#ececf0] group-hover:scale-105 transition"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-[12px] bg-[#f2f2f5] border border-[#ececf0] flex items-center justify-center text-[#8e8e93] group-hover:scale-105 transition">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-sm text-[#111] group-hover:text-[#007aff] transition line-clamp-1" title={item.name}>
                              {item.name}
                            </div>
                          </div>
                        </div>

                        {/* Column 2: Category */}
                        <div className="col-span-2 text-xs">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#f2f2f5] text-[#3a3a3c]">
                            {item.category || "Geral"}
                          </span>
                        </div>

                        {/* Column 3: Warehouse Location */}
                        <div className="col-span-2 text-xs">
                          <div className="inline-flex items-center gap-1.5 text-xs text-[#3a3a3c]">
                            <MapPin className="w-3.5 h-3.5 text-[#007aff] shrink-0" />
                            <span className="truncate max-w-[170px] font-medium">
                              {item.warehouseLocation || "Armazém Principal"}
                            </span>
                          </div>
                        </div>

                        {/* Column 4: Stock */}
                        <div className="col-span-2 text-xs">
                          <div
                            className={`font-bold text-sm ${
                              damaged > 0
                                ? "text-rose-600"
                                : isLow
                                ? "text-amber-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {available} un.
                          </div>
                        </div>

                        {/* Column 5: Price */}
                        <div className="col-span-2 flex items-center justify-end gap-3">
                          <div className="text-right">
                            <div className="text-xs font-bold text-[#111]">
                              €{(item.replacementCost || item.unitPrice || 0).toFixed(2)}
                            </div>
                            <div className="flex items-center justify-end gap-2 mt-0.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAuditModal({
                                    isOpen: true,
                                    entityType: "inventory",
                                    entityId: item.id,
                                    entityTitle: item.name,
                                  });
                                }}
                                className="inline-flex items-center gap-1 text-[10px] text-[#007aff] hover:underline cursor-pointer"
                                title="Ver histórico de alterações"
                              >
                                <History className="w-3 h-3" />
                                <span>Histórico</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteItemClick(item);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                                title="Eliminar este artigo do inventário"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Eliminar</span>
                              </button>
                            </div>
                          </div>

                          {(item.purchaseStatus === "not_bought" || damaged > 0) && (
                            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {item.purchaseStatus === "not_bought" && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkAsBought(item)}
                                  className="px-2.5 py-1.5 rounded-[10px] bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                  title="Marcar como Comprado e lançar despesa em Finanças"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Comprar</span>
                                </button>
                              )}

                              {damaged > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTriageItem(item);
                                    setShowTriageModal(true);
                                  }}
                                  className="px-2.5 py-1.5 rounded-[10px] bg-[#111] hover:bg-black text-white text-[11px] font-semibold transition cursor-pointer"
                                  title="Fazer triagem do material danificado"
                                >
                                  Triagem
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ========================================================= */}
        {/* TAB 5: FINANCE & PROFITABILITY (Finanças & Lucros MoM) */}
        {/* ========================================================= */}
        {activeTab === "finance" && (
          <FinanceView
            events={eventsList}
            items={itemsList}
            movements={activeMovements}
            allocations={allocationsList}
            clients={clientsList}
            quotes={quotesList.filter((q) => !q.eventId || !cancelledEventIds.has(q.eventId))}
            onAddMovement={async (formData) => {
              const res = await createMovementAction(formData);
              if (res && res.success && res.movement) {
                setMovementsList((prev) => [res.movement, ...prev]);
              }
              return res;
            }}
            onDeleteMovement={async (id) => {
              const res = await deleteMovementAction(id);
              if (res && res.success) {
                setMovementsList((prev) => prev.filter((m) => m.id !== id));
              }
              return res;
            }}
            onOpenItemWizard={() => setShowItemWizard(true)}
            onOpenMovementModal={() => setShowMovementModal(true)}
          />
        )}

        {/* ========================================================= */}
        {/* TAB 6: MORE (CRM, Quotes, Finance & Team) */}
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

            {/* Quick Access to Finance */}
            <div
              onClick={(e) => handleTabSwitch("finance", "/financas", e)}
              className="p-4 rounded-[16px] bg-[#f8f8fa] hover:bg-[#f2f2f5] border border-[#ececf0] flex items-center justify-between cursor-pointer transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#eaf8ee] text-[#217a3b] flex items-center justify-center font-bold">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-[#111111]">
                    Painel Financeiro & Despesas Mensais
                  </div>
                  <div className="text-xs text-[#8e8e93]">
                    Lucro mês a mês, volume de eventos, controlo de despesas e inventário mais requisitado
                  </div>
                </div>
              </div>
              <span className="text-[#007aff] font-semibold text-xs flex items-center gap-1">
                Abrir Painel →
              </span>
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
                      : "Inicia sessão no topo da página"}
                  </div>
                </div>
              </div>

              <div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  {user ? "Sessão Ativa" : "Visitante"}
                </span>
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

                {user?.role === "admin" && (
                  <button
                    onClick={() => setShowNewUserModal(true)}
                    className="px-3.5 py-1.5 rounded-[10px] bg-[#111111] hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span>＋</span>
                    <span>Criar conta</span>
                  </button>
                )}
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
                        </div>
                        <div className="text-[11px] text-[#8e8e93]">{u.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#eaf8ee] text-[#24793a] capitalize">
                        {u.role}
                      </span>
                      {user?.role === "admin" && (
                        <button
                          onClick={() => setEditingTeamUser(u)}
                          className="text-[11px] font-semibold text-[#007aff] hover:underline cursor-pointer"
                        >
                          Editar
                        </button>
                      )}
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
                    Propostas emitidas. Os orçamentos são gerados dentro da configuração de cada evento.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab("events")}
                  className="px-3.5 py-1.5 rounded-[10px] bg-white border border-[#ececf0] hover:bg-[#f2f2f5] text-[#111111] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title="Abrir lista de eventos para aceder à configuração de evento"
                >
                  <Package className="w-3.5 h-3.5 text-[#007aff]" />
                  <span>Gerir Eventos para Orçamentos →</span>
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
                        <div className="flex items-center gap-1.5 text-[11px] text-[#8e8e93] mt-1">
                          <span>
                            Last updated by <strong className="text-[#3a3a3c] font-semibold">{q.lastUpdatedByName || "Administrador CFM"}</strong> {formatRelativeTime(q.updatedAt, "en")}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setAuditModal({
                                isOpen: true,
                                entityType: "quote",
                                entityId: q.id,
                                entityTitle: `Orçamento ${q.quoteNumber}`,
                              });
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-[#ececf0] text-[#007aff] transition cursor-pointer text-[10px] font-medium"
                            title="Ver histórico do orçamento"
                          >
                            <History className="w-3 h-3" />
                            <span>Histórico</span>
                          </button>
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
            <div className="p-4 rounded-[16px] bg-[#f8f8fa] border border-[#ececf0] text-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-[#111]">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>Integração Calendly</span>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                  OAuth & Webhooks Ativos
                </span>
              </div>
              <p className="text-[#6e6e73]">
                Reuniões marcadas via Calendly são transformadas automaticamente em
                clientes CRM e eventos no estado <em>Planeamento</em>.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#ececf0]">
                <div className="space-y-1 text-[11px] text-[#8e8e93]">
                  <div>Webhook: <code className="bg-white px-1.5 py-0.5 rounded border border-[#ececf0] text-[#111]">/api/webhooks/calendly</code></div>
                  <div>Callback: <code className="bg-white px-1.5 py-0.5 rounded border border-[#ececf0] text-[#111]">/api/auth/callback/calendly</code></div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSyncCalendly()}
                    disabled={isSyncingCalendly}
                    className="px-3.5 py-2 rounded-[12px] bg-[#eeeffe] hover:bg-[#e0e3ff] text-[#4338ca] font-bold text-xs inline-flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer border border-indigo-200"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCalendly ? "animate-spin" : ""}`} />
                    <span>{isSyncingCalendly ? "A sincronizar..." : "Puxar Reuniões"}</span>
                  </button>

                  <a
                    href={`https://auth.calendly.com/oauth/authorize?client_id=gi5vz5VLp5Gmtlhe3Cz24tsAB-PMkAZUL4zi5YDFbyw&response_type=code&redirect_uri=${encodeURIComponent(
                      typeof window !== "undefined" && window.location.origin.includes("localhost")
                        ? "http://localhost:3000/api/auth/callback/calendly"
                        : "https://cfm-events.vercel.app/api/auth/callback/calendly"
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-[12px] bg-[#007aff] hover:bg-[#0062cc] text-white font-semibold text-xs inline-flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Ligar / Autorizar Calendly</span>
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Floating Bottom Navigation Bar (Apple-style matching prototype) */}
      <aside className="fixed bottom-0 left-0 right-0 z-40 bg-[rgba(249,249,251,0.96)] backdrop-blur-[24px] border-t border-[#ececf0] pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] px-3 flex items-center justify-center shadow-[0_-1px_12px_rgba(0,0,0,0.04)]">
        <div className="w-full max-w-[650px] flex items-center justify-around h-[52px]">
          {/* 1. Início */}
          <Link
            href="/"
            onClick={(e) => handleTabSwitch("home", "/", e)}
            className="w-[48px] h-[48px] sm:w-[44px] sm:h-[44px] rounded-[13px] flex items-center justify-center transition cursor-pointer"
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
            onClick={(e) => handleTabSwitch("calendar", "/calendario", e)}
            className="w-[48px] h-[48px] sm:w-[44px] sm:h-[44px] rounded-[13px] flex items-center justify-center transition cursor-pointer"
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
            onClick={(e) => handleTabSwitch("events", "/eventos", e)}
            className="w-[48px] h-[48px] sm:w-[44px] sm:h-[44px] rounded-[13px] flex items-center justify-center transition cursor-pointer"
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
            onClick={(e) => handleTabSwitch("inventory", "/inventario", e)}
            className="w-[48px] h-[48px] sm:w-[44px] sm:h-[44px] rounded-[13px] flex items-center justify-center transition cursor-pointer"
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

          {/* 5. Finanças */}
          <Link
            href="/financas"
            onClick={(e) => handleTabSwitch("finance", "/financas", e)}
            className="w-[48px] h-[48px] sm:w-[44px] sm:h-[44px] rounded-[13px] flex items-center justify-center transition cursor-pointer"
            style={{
              backgroundColor:
                activeTab === "finance"
                  ? "rgba(0,122,255,0.11)"
                  : "transparent",
              color: activeTab === "finance" ? "#007aff" : "#8e8e93",
            }}
            title="Finanças"
          >
            <TrendingUp className="w-5 h-5" />
          </Link>

          {/* 6. Mais */}
          <Link
            href="/mais"
            onClick={(e) => handleTabSwitch("more", "/mais", e)}
            className="w-[48px] h-[48px] sm:w-[44px] sm:h-[44px] rounded-[13px] flex items-center justify-center transition cursor-pointer"
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

      {/* AUDIT LOG MODAL */}
      <AuditLogModal
        isOpen={auditModal.isOpen}
        onClose={() => setAuditModal((prev) => ({ ...prev, isOpen: false }))}
        entityType={auditModal.entityType}
        entityId={auditModal.entityId}
        entityTitle={auditModal.entityTitle}
      />

      {/* ALERTS DRAWER MODAL */}
      <AlertsDrawerModal
        isOpen={showAlertsDrawer}
        onClose={() => setShowAlertsDrawer(false)}
        alerts={alertsList}
        onSnooze={handleSnoozeAlert}
        onAcknowledge={handleAcknowledgeAlert}
        onDismiss={handleDismissAlert}
        onMarkAllAsRead={handleMarkAllAlertsRead}
        onActionClick={handleAlertActionClick}
      />

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
          onClientCreated={(newClient) => {
            setClientsList((prev) => [newClient, ...prev]);
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
          allocations={allocationsList}
          customItems={customItemsList}
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
          locations={locationsList}
          users={teamUsers}
          onCreated={(newItem, newLocation, createdMovement) => {
            setItemsList((prev) => [...prev, newItem]);
            if (newLocation) {
              setLocationsList((prev) => [...prev, newLocation]);
            }
            if (createdMovement) {
              setMovementsList((prev) => [createdMovement, ...prev]);
            }
            setShowItemWizard(false);
          }}
        />
      )}

      {/* 5.0.1 DELETE INVENTORY ITEM MODAL (SOFT DELETE WITH UPCOMING EVENTS CAUTION) */}
      {deleteItemModal.isOpen && deleteItemModal.item && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] w-full max-w-lg border border-[#ececf0] shadow-2xl overflow-hidden p-6 text-xs space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#ececf0] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#111]">Eliminar Artigo do Inventário</h3>
                  <p className="text-[11px] text-[#8e8e93]">
                    {deleteItemModal.item.name} ({deleteItemModal.item.sku})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteItemModal({ isOpen: false, item: null, upcomingAllocations: [] })}
                className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Caution if item is being used in upcoming events */}
            {deleteItemModal.upcomingAllocations.length > 0 ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-xs text-amber-900">
                      Atenção: Este artigo está atualmente alocado a {deleteItemModal.upcomingAllocations.length} evento(s) futuro(s)!
                    </h4>
                    <p className="text-[11px] text-amber-800 mt-1">
                      O artigo continua programado para a produção dos seguintes eventos:
                    </p>
                  </div>
                </div>

                <div className="bg-white/80 rounded-xl p-2.5 divide-y divide-amber-200/50 max-h-40 overflow-y-auto">
                  {deleteItemModal.upcomingAllocations.map((entry, idx) => (
                    <div key={idx} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-[11px]">
                      <div>
                        <strong className="text-[#111]">{entry.event.name}</strong>
                        <div className="text-[10px] text-[#636366]">
                          {new Date(entry.event.startDate).toLocaleDateString("pt-PT")} {entry.event.venue ? `· ${entry.event.venue}` : ""}
                        </div>
                      </div>
                      <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full text-[10px]">
                        {entry.allocation.quantity} un.
                      </span>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-amber-800">
                  Ao confirmar a eliminação, é aplicado um <strong>soft delete</strong>: o artigo deixará de constar no inventário ativo e catálogo, mas todo o histórico e registos em eventos anteriores e futuros serão devidamente preservados.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-[#fafafa] border border-[#ececf0] text-[#3a3a3c] space-y-2">
                <p className="text-xs">
                  Tem a certeza que deseja remover <strong>"{deleteItemModal.item.name}"</strong> do inventário ativo?
                </p>
                <p className="text-[11px] text-[#8e8e93]">
                  Será aplicado um <strong>soft delete</strong> que preserva o histórico de eventos anteriores onde o artigo foi utilizado.
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-[#ececf0] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteItemModal({ isOpen: false, item: null, upcomingAllocations: [] })}
                disabled={isDeletingItem}
                className="px-4 py-2 rounded-[12px] bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[#3a3a3c] font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteItem}
                disabled={isDeletingItem}
                className="px-4 py-2 rounded-[12px] bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                {isDeletingItem ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>A eliminar...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar Artigo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5.1 RECEIPT SCANNER MODAL (Gemini Receipt Reader) */}
      {showReceiptScanner && (
        <ReceiptScannerModal
          onClose={() => setShowReceiptScanner(false)}
          inventoryItems={itemsList}
          storageLocations={locationsList}
          onSuccess={() => {
            setShowReceiptScanner(false);
            window.location.reload();
          }}
        />
      )}

      {/* 5.2 BARCODE SCANNER MODAL (zxing-wasm Camera Scanner) */}
      {showBarcodeScanner && (
        <BarcodeScannerModal
          isOpen={showBarcodeScanner}
          onClose={() => setShowBarcodeScanner(false)}
          storageLocations={locationsList}
          onItemAddedOrUpdated={() => {
            window.location.reload();
          }}
        />
      )}

      {/* STORAGE LOCATIONS & MANAGERS MODAL */}
      {showLocationsModal && (
        <StorageLocationsModal
          isOpen={showLocationsModal}
          onClose={() => setShowLocationsModal(false)}
          locations={locationsList}
          items={itemsList}
          users={teamUsers}
          initialMode={locationsModalInitialMode}
          onLocationsChange={(newLocs) => setLocationsList(newLocs)}
          onSelectLocationForFilter={(locName) => setInventoryLocationFilter(locName)}
        />
      )}

      {/* CALENDLY SYNC MODAL */}
      {showCalendlySyncModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowCalendlySyncModal(false)}
        >
          <div
            className="bg-white rounded-[24px] max-w-md w-full p-6 shadow-2xl border border-[#ececf0] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#ececf0] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#eeeffe] text-[#4338ca] flex items-center justify-center">
                  <Video className="w-4 h-4 text-[#6366f1]" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#111]">Sincronizar Calendly</h3>
                  <p className="text-[11px] text-[#8e8e93]">Puxar reuniões de clientes e briefings</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCalendlySyncModal(false)}
                className="p-1.5 rounded-full text-[#8e8e93] hover:text-[#111] hover:bg-[#f2f2f5] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#6e6e73] leading-relaxed">
              As reuniões agendadas pelos clientes no Calendly são sincronizadas para o CFM Events e destacadas a <strong>roxo</strong> na sua agenda.
            </p>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-[#111] mb-1">
                  Personal Access Token (Opcional)
                </label>
                <input
                  type="password"
                  placeholder="Cole aqui o token da Calendly se não usar OAuth..."
                  value={calendlyCustomToken}
                  onChange={(e) => setCalendlyCustomToken(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-[#fafafc] border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                />
                <span className="text-[10px] text-[#8e8e93] mt-0.5 block">
                  Se autorizou via OAuth, deixe em branco.
                </span>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleSyncCalendly(calendlyCustomToken || undefined)}
                  disabled={isSyncingCalendly}
                  className="w-full py-2.5 rounded-[12px] bg-[#4338ca] hover:bg-[#3730a3] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCalendly ? "animate-spin" : ""}`} />
                  <span>{isSyncingCalendly ? "A sincronizar..." : "Sincronizar Reuniões Agora"}</span>
                </button>

                <a
                  href={`https://auth.calendly.com/oauth/authorize?client_id=gi5vz5VLp5Gmtlhe3Cz24tsAB-PMkAZUL4zi5YDFbyw&response_type=code&redirect_uri=${encodeURIComponent(
                    typeof window !== "undefined" && window.location.origin.includes("localhost")
                      ? "http://localhost:3000/api/auth/callback/calendly"
                      : "https://cfm-events.vercel.app/api/auth/callback/calendly"
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-[12px] bg-[#f5f5f7] hover:bg-[#ebebed] text-[#111] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border border-[#ececf0]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Autorizar Calendly via OAuth</span>
                </a>
              </div>
            </div>
          </div>
        </div>
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

      {/* 10. EDIT USER MODAL */}
      {editingTeamUser && (
        <EditUserModal
          user={editingTeamUser}
          onClose={() => setEditingTeamUser(null)}
          onUpdated={(updated) => {
            const oldName = editingTeamUser.name;
            setTeamUsers((prev: any[]) =>
              prev.map((u: any) => (u.id === updated.id ? { ...u, ...updated } : u))
            );
            if (user && user.id === updated.id) {
              setUser((prev: any) => ({ ...prev, ...updated }));
            }
            setLocationsList((prev: any[]) =>
              prev.map((loc: any) =>
                loc.managerUserId === updated.id || loc.managerName === oldName
                  ? { ...loc, managerName: updated.name }
                  : loc
              )
            );
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("eventflow:user-updated", { detail: updated })
              );
            }
            router.refresh();
            setEditingTeamUser(null);
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
      <div className="bg-white rounded-[22px] w-full max-w-md border border-[#ececf0] shadow-xl overflow-y-auto max-h-[calc(100dvh-2rem)] p-5 sm:p-6 text-xs">
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
      <div className="bg-white rounded-[22px] w-full max-w-sm border border-[#ececf0] shadow-xl overflow-y-auto max-h-[calc(100dvh-2rem)] p-5 sm:p-6 text-xs">
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
          artigos no stock operacional disponível da CFM Events.
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
  locations = [],
  users = [],
}: {
  onClose: () => void;
  onCreated: (item: any, newLocation?: any, movement?: any) => void;
  locations?: any[];
  users?: any[];
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Mobiliário");
  const [totalQuantity, setTotalQuantity] = useState("50");
  const [minStock, setMinStock] = useState("10");
  const [purchasePrice, setPurchasePrice] = useState("45.00");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoCameraInputRef = useRef<HTMLInputElement | null>(null);
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Location State (Only existing locations)
  const defaultLoc = locations[0];
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    defaultLoc?.id || ""
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadItemPhotoAction(fd);
      if (res.success && res.url) {
        setImageUrl(res.url);
      } else {
        setError(res.error || "Não foi possível carregar a fotografia.");
      }
    } catch (err: any) {
      setError(err?.message || "Erro ao processar fotografia.");
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Indique o nome do artigo.");
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const slug = name
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const formData = new FormData();
      formData.set("sku", slug || `artigo-${Date.now()}`);
      formData.set("name", name.trim());
      formData.set("category", category);
      formData.set("totalQuantity", totalQuantity);
      formData.set("minStock", minStock);
      formData.set("unitPrice", purchasePrice);
      formData.set("purchasePrice", purchasePrice);
      formData.set("replacementCost", purchasePrice);
      const totalCost = (
        (parseFloat(purchasePrice) || 0) * (parseInt(totalQuantity, 10) || 1)
      ).toFixed(2);
      formData.set("totalPurchasePrice", totalCost);
      formData.set("purchaseStatus", "bought");
      formData.set("isConsumable", "false");
      formData.set("packageUnits", "1");
      if (imageUrl) {
        formData.set("imageUrl", imageUrl);
      }

      const matched = locations.find((l) => l.id === selectedLocationId);
      const chosenLocationId = matched ? matched.id : defaultLoc?.id || null;
      const chosenWarehouseLocation = matched ? matched.name : defaultLoc?.name || "Armazém Principal";

      if (chosenLocationId) {
        formData.set("locationId", chosenLocationId);
      }
      formData.set("warehouseLocation", chosenWarehouseLocation);

      const res = await createItemAction(formData);
      if (res.success && res.item) {
        onCreated(res.item, null, res.movement);
      } else {
        setError(res.error || "Erro ao criar artigo.");
      }
    } catch (err: any) {
      setError(err?.message || "Erro inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedLocObj = locations.find((l) => l.id === selectedLocationId) || defaultLoc;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-[22px] w-full max-w-lg border border-[#ececf0] shadow-xl overflow-y-auto max-h-[calc(100dvh-2rem)] p-5 sm:p-6 text-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[17px] font-bold text-[#111111]">
              Novo Artigo
            </h2>
            <p className="text-[11px] text-[#8e8e93] mt-0.5">
              Adicionar artigo ao inventário
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
          {/* Opção de Fotografia do Artigo */}
          <div className="p-3 rounded-[14px] bg-[#fafafc] border border-[#ececf0] space-y-2">
            <input
              ref={photoCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <input
              ref={photoFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />

            <div className="flex items-center justify-between">
              <label className="font-bold text-[#3a3a3c] flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-[#007aff]" />
                <span>Fotografia do Artigo (Opcional)</span>
              </label>
              {isUploadingPhoto && (
                <span className="text-[11px] text-[#007aff] font-semibold flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>A processar foto...</span>
                </span>
              )}
            </div>

            {imageUrl ? (
              <div className="flex items-center gap-3 p-2 bg-white border border-[#ececf0] rounded-[12px]">
                <img
                  src={imageUrl}
                  alt="Foto do Artigo"
                  className="w-14 h-14 rounded-[10px] object-cover bg-[#f2f2f5] border border-[#ececf0] shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">
                    Fotografia Anexada
                  </span>
                  <p className="font-medium text-xs text-[#111] truncate">{name || "Novo Artigo"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 transition cursor-pointer"
                  title="Remover foto"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => photoCameraInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="p-2.5 rounded-[12px] border border-dashed border-[#c6c6c8] hover:border-[#007aff] bg-white text-[#111] hover:text-[#007aff] flex items-center justify-center gap-1.5 text-xs font-semibold transition cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-[#007aff]" />
                  <span>Tirar Foto</span>
                </button>
                <button
                  type="button"
                  onClick={() => photoFileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="p-2.5 rounded-[12px] border border-dashed border-[#c6c6c8] hover:border-[#007aff] bg-white text-[#111] hover:text-[#007aff] flex items-center justify-center gap-1.5 text-xs font-semibold transition cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-[#636366]" />
                  <span>Carregar Imagem</span>
                </button>
              </div>
            )}
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

          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="block font-bold text-[#3a3a3c] mb-1">Preço (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          {/* STORAGE LOCATION SELECTION (Existing locations only) */}
          <div className="pt-2 border-t border-[#ececf0] space-y-2">
            <label className="block font-bold text-[#3a3a3c] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#007aff]" />
              <span>Local de Armazenamento</span>
            </label>

            {locations.length > 0 ? (
              <select
                value={selectedLocationId || defaultLoc?.id}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {loc.managerName ? `— Gestor: ${loc.managerName}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 text-xs bg-[#f2f2f5] border border-[#ececf0] rounded-[12px] text-[#3a3a3c]">
                Armazém Principal
              </div>
            )}

            {selectedLocObj && (
              <div className="p-2.5 rounded-[12px] bg-[#fafafc] border border-[#ececf0] flex items-center justify-between text-[11px] text-[#636366]">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#007aff]" />
                  <span>
                    Gestor do Local: <strong className="font-semibold text-[#111]">{selectedLocObj.managerName || "Administrador CFM"}</strong>
                  </span>
                </div>
                {selectedLocObj.managerContact && (
                  <span className="font-mono text-[10px] text-[#8e8e93]">
                    {selectedLocObj.managerContact}
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-[12px] bg-[#111111] hover:bg-black text-white text-xs font-bold transition shadow-xs mt-2 cursor-pointer"
          >
            {isSubmitting ? "A guardar artigo..." : "Novo Artigo"}
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
      <div className="bg-white rounded-[22px] w-full max-w-md border border-[#ececf0] shadow-xl overflow-y-auto max-h-[calc(100dvh-2rem)] p-5 sm:p-6 text-xs">
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
  const [email, setEmail] = useState("");
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
      if (res.success && "user" in res && res.user) {
        onSuccess(res.user);
        onClose();
      } else if (res.success) {
        onSuccess({
          email,
          name: email.split("@")[0],
          role: "admin",
        });
        onClose();
      } else {
        setError(("error" in res && res.error) || "Erro ao iniciar sessão.");
      }
    } catch (err: any) {
      setError(err?.message || "Erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-[22px] w-full max-w-sm border border-[#ececf0] shadow-xl overflow-y-auto max-h-[calc(100dvh-2rem)] p-5 sm:p-6 text-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[17px] font-bold text-[#111111]">Iniciar Sessão</h2>
            <p className="text-[11px] text-[#8e8e93] mt-0.5">Acesso administrativo CFM Events</p>
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
      <div className="bg-white rounded-[22px] w-full max-w-sm border border-[#ececf0] shadow-xl overflow-y-auto max-h-[calc(100dvh-2rem)] p-5 sm:p-6 text-xs">
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
// EDIT USER MODAL COMPONENT (EDIT TEAM ACCOUNT)
// -------------------------------------------------------------
function EditUserModal({
  user,
  onClose,
  onUpdated,
}: {
  user: any;
  onClose: () => void;
  onUpdated: (user: any) => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user.role);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("userId", user.id);
      formData.set("name", name);
      formData.set("email", email);
      if (password.trim()) formData.set("password", password.trim());
      formData.set("role", role);

      const res = await updateUserAction(formData);
      if (res.success) {
        onUpdated((res as any).user || {
          id: user.id,
          name,
          email,
          role,
        });
      } else {
        setError(res.error || "Erro ao atualizar utilizador.");
      }
    } catch (err: any) {
      setError(err?.message || "Erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-[22px] w-full max-w-sm border border-[#ececf0] shadow-xl overflow-y-auto max-h-[calc(100dvh-2rem)] p-5 sm:p-6 text-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[17px] font-bold text-[#111111]">Editar Conta de Equipa</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93] cursor-pointer"
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
              className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#3a3a3c] mb-1">Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#3a3a3c] mb-1">
              Nova Palavra-passe (deixar em branco para manter)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
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

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[12px] bg-[#f2f2f5] text-[#3a3a3c] font-semibold hover:bg-[#e5e5ea] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 rounded-[12px] bg-[#111111] hover:bg-black text-white font-bold transition shadow-xs cursor-pointer disabled:opacity-60"
            >
              {isLoading ? "A guardar..." : "Guardar Alterações"}
            </button>
          </div>
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
  onClientCreated,
}: {
  clients: any[];
  initialDate?: string | null;
  onClose: () => void;
  onCreated: (event: any) => void;
  onClientCreated?: (client: any) => void;
}) {
  const baseDate = initialDate
    ? initialDate.split("T")[0]
    : new Date().toISOString().split("T")[0];
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [customId, setCustomId] = useState("");
  const [localClients, setLocalClients] = useState(clients);
  const [clientId, setClientId] = useState("");
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
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
        clientId: clientId || null,
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-[#3a3a3c]">Cliente Associado (Opcional)</label>
                  <button
                    type="button"
                    onClick={() => setShowCreateClientModal(true)}
                    className="text-[11px] font-bold text-[#007aff] hover:text-[#0051a8] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Novo Cliente</span>
                  </button>
                </div>
                <select
                  value={clientId}
                  onChange={(e) => {
                    if (e.target.value === "__create_new__") {
                      setShowCreateClientModal(true);
                    } else {
                      setClientId(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                >
                  <option value="">(Sem cliente associado - definir mais tarde)</option>
                  {localClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.contactName ? `(${c.contactName})` : ""}
                    </option>
                  ))}
                  <option value="__create_new__">+ Criar novo cliente...</option>
                </select>
                <span className="text-[10px] text-[#8e8e93] mt-0.5 block">
                  Pode criar o evento sem cliente e atribuir ou registar um novo cliente mais tarde na edição do evento.
                </span>
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

      {showCreateClientModal && (
        <ClientWizardModal
          onClose={() => setShowCreateClientModal(false)}
          onCreated={(newClient) => {
            setLocalClients((prev) => [newClient, ...prev]);
            setClientId(newClient.id);
            if (onClientCreated) onClientCreated(newClient);
            setShowCreateClientModal(false);
          }}
        />
      )}
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
  allocations = [],
  customItems = [],
  initialEventId,
  onClose,
  onCreated,
}: {
  clients: any[];
  events: any[];
  inventory: any[];
  allocations?: any[];
  customItems?: any[];
  initialEventId?: string;
  onClose: () => void;
  onCreated: (quote: any) => void;
}) {
  const eligibleEvents = events.filter((e) => canEventReceiveQuote(e));
  const [step, setStep] = useState(1);
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [eventId, setEventId] = useState(
    initialEventId && eligibleEvents.some((e) => e.id === initialEventId)
      ? initialEventId
      : eligibleEvents[0]?.id || ""
  );
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

  const importEventItems = () => {
    const eventAllocations = allocations.filter((a: any) => a.eventId === eventId);
    const eventCustom = customItems.filter((c: any) => c.eventId === eventId);
    const newLines: Array<{ itemId?: string; description: string; quantity: number; unitPrice: number }> = [];

    eventAllocations.forEach((a: any) => {
      const inv = inventory.find((i: any) => i.id === a.itemId);
      newLines.push({
        itemId: a.itemId,
        description: inv?.name || "Artigo de Armazém",
        quantity: a.quantity || 1,
        unitPrice: inv?.unitPrice || 0,
      });
    });

    eventCustom.forEach((c: any) => {
      newLines.push({
        description: `${c.name} (${c.category || "Personalizado"})`,
        quantity: c.quantity || 1,
        unitPrice: c.unitPrice || 0,
      });
    });

    if (newLines.length > 0) {
      setLines(newLines);
    }
  };

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
                <label className="block font-bold text-[#3a3a3c] mb-1">
                  Evento Associado (Apenas Eventos de Produção)
                </label>
                <select
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                >
                  {eligibleEvents.map((evt) => (
                    <option key={evt.id} value={evt.id}>
                      {evt.name} ({new Date(evt.startDate).toLocaleDateString("pt-PT")})
                    </option>
                  ))}
                </select>
                {eligibleEvents.length === 0 && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">
                    Não existem eventos de produção disponíveis. Reuniões Calendly não recebem orçamentos.
                  </p>
                )}
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
                <div className="flex items-center gap-2">
                  {(allocations.filter((a: any) => a.eventId === eventId).length > 0 ||
                    customItems.filter((c: any) => c.eventId === eventId).length > 0) && (
                    <button
                      type="button"
                      onClick={importEventItems}
                      className="px-2.5 py-1 rounded-lg bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[11px] font-semibold text-[#111] transition cursor-pointer"
                      title="Importar artigos reservados do stock e artigos exclusivos deste evento"
                    >
                      Importar Artigos do Evento
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={addLine}
                    className="text-xs font-bold text-[#007aff] hover:underline cursor-pointer"
                  >
                    + Adicionar linha
                  </button>
                </div>
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
                  const isMeeting = isCalendlyMeeting(evt);
                  const statusObj = getStatusStyle(evt.status);
                  const client = clients.find((c) => c.id === evt.clientId);

                  if (isMeeting) {
                    return (
                      <div
                        key={evt.id}
                        className="p-4 rounded-[18px] border border-indigo-200 bg-gradient-to-b from-[#faf9ff] to-white shadow-xs space-y-3 ring-1 ring-indigo-400/20"
                      >
                        {/* Header badge */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-[#6366f1] to-[#4338ca] text-white flex items-center gap-1.5 shadow-2xs">
                            <Video className="w-3 h-3" />
                            <span>Reunião Calendly · Briefing de Cliente</span>
                          </span>
                          <span className="text-xs font-bold text-[#4338ca] bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#6366f1]" />
                            <span>{formatMeetingTimeRange(evt.startDate, evt.endDate)}</span>
                          </span>
                        </div>

                        <div className="flex items-start gap-3">
                          <div
                            className="w-14 h-14 rounded-[12px] bg-cover bg-center flex-shrink-0 border border-indigo-200 overflow-hidden shadow-2xs"
                            style={{
                              backgroundImage: `url("${
                                evt.coverImageUrl ||
                                "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=600&q=80"
                              }")`,
                            }}
                          />

                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-[15px] text-[#111] leading-tight">
                              {evt.name}
                            </h3>
                            <div className="text-xs text-[#6366f1] font-semibold mt-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{evt.venue || "Google Meet (Online)"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Client details & purpose */}
                        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-indigo-100">
                          {client && (
                            <div className="text-[#636366]">
                              <span className="text-[#8e8e93] block text-[10px] uppercase font-semibold">Cliente / Lead</span>
                              <span className="font-semibold text-indigo-950 truncate block">{client.name}</span>
                              {client.email && (
                                <span className="text-[10px] text-gray-500 truncate block">{client.email}</span>
                              )}
                            </div>
                          )}
                          <div className="text-[#636366]">
                            <span className="text-[#8e8e93] block text-[10px] uppercase font-semibold">Objetivo da Reunião</span>
                            <span className="font-medium text-indigo-950 truncate block">Discussão de Evento & Decoração</span>
                          </div>
                        </div>

                        {evt.notes && (
                          <div className="p-3 rounded-[12px] bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-[#4338ca] block">
                              Respostas do Cliente / Notas de Briefing:
                            </span>
                            <p className="whitespace-pre-line text-indigo-900 leading-relaxed font-normal text-[11px]">
                              {evt.notes}
                            </p>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="pt-1 flex items-center gap-2">
                          <Link
                            href={`/reunioes/${evt.id}`}
                            onClick={onClose}
                            className="flex-1 py-2.5 px-3 rounded-[12px] bg-[#4338ca] hover:bg-[#3730a3] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
                          >
                            <span>Ver Ficha da Reunião</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  }

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
