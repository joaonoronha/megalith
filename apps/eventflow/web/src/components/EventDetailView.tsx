"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
  FileText,
  Package,
  CheckCircle2,
  Circle,
  AlertCircle,
  Sparkles,
  Plus,
  Trash2,
  ArrowLeft,
  DollarSign,
  Palette,
  ExternalLink,
  MessageSquare,
  ChevronDown,
  Edit3,
  X,
  Share2,
  Check,
  Copy,
  ShieldAlert,
} from "lucide-react";
import {
  updateEventDetailsAction,
  updateEventStatusAction,
  updateEventVibeAction,
  updateCustomerPriceAction,
  addEventAllocationAction,
  updateAllocationStatusAction,
  deleteAllocationAction,
  addEventTaskAction,
  toggleEventTaskAction,
  deleteEventTaskAction,
} from "@/app/actions";

interface Client {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  nif: string | null;
  address: string | null;
  notes: string | null;
  source: string | null;
}

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  totalQuantity: number;
  minStock: number | null;
  warehouseLocation: string | null;
  dimensions: string | null;
  unitPrice: number;
  replacementCost: number | null;
  imageUrl: string | null;
  damagedQuantity: number | null;
  inMaintenanceQuantity: number | null;
}

interface Allocation {
  id: string;
  eventId: string;
  itemId: string;
  quantity: number;
  status: string;
  notes: string | null;
  itemName: string;
  itemSku: string;
  itemCategory: string;
  itemUnitPrice: number;
  itemReplacementCost: number | null;
  itemWarehouseLocation: string | null;
  itemImageUrl: string | null;
  itemTotalQuantity: number;
}

interface Task {
  id: string;
  eventId: string;
  title: string;
  completed: boolean;
  dueDate: Date | null;
  priority: string | null;
  assignedTo: string | null;
  orderIndex: number | null;
}

interface Quote {
  id: string;
  quoteNumber: string;
  accessToken: string;
  status: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  createdAt: Date;
}

interface EventData {
  id: string;
  name: string;
  clientId: string | null;
  venue: string | null;
  startDate: Date;
  endDate: Date | null;
  prepDate: Date | null;
  returnDate: Date | null;
  status: string;
  totalBudget: number | null;
  customerPrice: number | null;
  category: string | null;
  theme: string | null;
  vibeColors: string | null;
  specialNeeds: string | null;
  notes: string | null;
  coverImageUrl: string | null;
}

interface Props {
  event: EventData;
  client: Client | null;
  allClients: Client[];
  allItems: InventoryItem[];
  initialAllocations: Allocation[];
  initialTasks: Task[];
  quotes: Quote[];
  currentUser: any;
}

const PRESET_PALETTES = [
  {
    name: "Winnie the Pooh",
    theme: "Winnie the Pooh",
    colors: ["#F5A623", "#D32F2F", "#5C7658", "#FFF8DC"],
  },
  {
    name: "Botânico Terracotta",
    theme: "Romântico & Terracotta",
    colors: ["#C97A63", "#E3C9B8", "#687B65", "#FAF6F0"],
  },
  {
    name: "Gala Black & Gold",
    theme: "Black & Gold Minimalist",
    colors: ["#111111", "#D4AF37", "#2C3E50", "#E0E0E0"],
  },
  {
    name: "Rose Gold Glamour",
    theme: "Rose Gold Glamour",
    colors: ["#B76E79", "#2E151B", "#E8D8D8", "#C0C0C0"],
  },
  {
    name: "Jardim Encantado",
    theme: "Jardim Encantado",
    colors: ["#88B04B", "#F7CAC9", "#92A8D1", "#FAF0E6"],
  },
  {
    name: "Minimal Chic",
    theme: "Minimal Chic",
    colors: ["#2B2B2B", "#706E6B", "#D6D1CD", "#FFFFFF"],
  },
];

export default function EventDetailView({
  event: initialEvent,
  client: initialClient,
  allClients,
  allItems,
  initialAllocations,
  initialTasks,
  quotes,
  currentUser,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const [event, setEvent] = useState(initialEvent);
  const [client, setClient] = useState(initialClient);
  const [allocations, setAllocations] = useState(initialAllocations);
  const [tasks, setTasks] = useState(initialTasks);

  // Modals & Panels
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVibeModal, setShowVibeModal] = useState(false);
  const [showAddAllocationModal, setShowAddAllocationModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);

  // New task inline state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"baixa" | "media" | "alta" | "urgente">("media");

  // Vibe Palette edit state
  const parseVibeColors = (raw: string | null): string[] => {
    try {
      if (!raw) return ["#111111", "#8E8E93", "#E5E5EA"];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : ["#111111"];
    } catch {
      return ["#111111", "#8E8E93", "#E5E5EA"];
    }
  };

  const [vibeTheme, setVibeTheme] = useState(event.theme || "");
  const [vibeColors, setVibeColors] = useState<string[]>(parseVibeColors(event.vibeColors));
  const [newColorHex, setNewColorHex] = useState("#F5A623");

  // Quick Customer Price edit state
  const [priceInput, setPriceInput] = useState(String(event.customerPrice || 0));

  // Add allocation state
  const [selectedItemId, setSelectedItemId] = useState(allItems[0]?.id || "");
  const [allocationQty, setAllocationQty] = useState(1);
  const [allocationNotes, setAllocationNotes] = useState("");
  const [itemSearchQuery, setItemSearchQuery] = useState("");

  // Copied proposal link & event ID
  const [copiedQuoteId, setCopiedQuoteId] = useState<string | null>(null);
  const [copiedEventId, setCopiedEventId] = useState(false);

  // Format Dates
  const formatDate = (d: Date | null) => {
    if (!d) return "Não definida";
    return new Date(d).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatShortDate = (d: Date | null) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Status Styling
  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "confirmado":
        return { bg: "bg-[#e1f5ea] text-[#137333] border-[#ceead6]", label: "Confirmado" };
      case "preparacao":
      case "preparação":
        return { bg: "bg-[#fef7e0] text-[#b06000] border-[#feefc3]", label: "Preparação" };
      case "em_curso":
        return { bg: "bg-[#e8f0fe] text-[#1a73e8] border-[#d2e3fc]", label: "Em Curso" };
      case "planeamento":
        return { bg: "bg-[#f1f3f4] text-[#3c4043] border-[#dadce0]", label: "Planeamento" };
      case "orcamento":
      case "orçamento":
        return { bg: "bg-[#e8eaed] text-[#202124] border-[#dadce0]", label: "Orçamento" };
      case "concluido":
      case "concluído":
        return { bg: "bg-[#f8f9fa] text-[#5f6368] border-[#dadce0]", label: "Concluído" };
      case "cancelado":
        return { bg: "bg-[#fce8e6] text-[#c5221f] border-[#fad2cf]", label: "Cancelado" };
      default:
        return { bg: "bg-[#f1f3f4] text-[#3c4043] border-[#dadce0]", label: status };
    }
  };

  // Handlers
  const handleStatusChange = async (newStatus: string) => {
    setEvent((prev) => ({ ...prev, status: newStatus }));
    startTransition(async () => {
      await updateEventStatusAction(event.id, newStatus);
    });
  };

  const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !currentStatus } : t))
    );
    startTransition(async () => {
      await toggleEventTaskAction(taskId, !currentStatus, event.id);
    });
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const tempId = `tsk-temp-${Date.now()}`;
    const newTask: Task = {
      id: tempId,
      eventId: event.id,
      title: newTaskTitle.trim(),
      completed: false,
      dueDate: null,
      priority: newTaskPriority,
      assignedTo: null,
      orderIndex: Date.now(),
    };

    setTasks((prev) => [...prev, newTask]);
    const titleToAdd = newTaskTitle.trim();
    const priorityToAdd = newTaskPriority;
    setNewTaskTitle("");

    startTransition(async () => {
      const res = await addEventTaskAction(event.id, titleToAdd, priorityToAdd);
      if (res.success && res.id) {
        setTasks((prev) =>
          prev.map((t) => (t.id === tempId ? { ...t, id: res.id! } : t))
        );
      }
    });
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    startTransition(async () => {
      await deleteEventTaskAction(taskId, event.id);
    });
  };

  const handleUpdateAllocationStatus = async (
    allocationId: string,
    status: "reservado" | "despachado" | "devolvido" | "danificado"
  ) => {
    setAllocations((prev) =>
      prev.map((a) => (a.id === allocationId ? { ...a, status } : a))
    );
    startTransition(async () => {
      await updateAllocationStatusAction(allocationId, status, event.id);
    });
  };

  const handleDeleteAllocation = async (allocationId: string) => {
    setAllocations((prev) => prev.filter((a) => a.id !== allocationId));
    startTransition(async () => {
      await deleteAllocationAction(allocationId, event.id);
    });
  };

  const handleAddAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetItem = allItems.find((i) => i.id === selectedItemId);
    if (!targetItem) return;

    const tempId = `alc-temp-${Date.now()}`;
    const newAllocation: Allocation = {
      id: tempId,
      eventId: event.id,
      itemId: targetItem.id,
      quantity: allocationQty,
      status: "reservado",
      notes: allocationNotes || null,
      itemName: targetItem.name,
      itemSku: targetItem.sku,
      itemCategory: targetItem.category,
      itemUnitPrice: targetItem.unitPrice,
      itemReplacementCost: targetItem.replacementCost,
      itemWarehouseLocation: targetItem.warehouseLocation,
      itemImageUrl: targetItem.imageUrl,
      itemTotalQuantity: targetItem.totalQuantity,
    };

    setAllocations((prev) => [...prev, newAllocation]);
    setShowAddAllocationModal(false);

    const formData = new FormData();
    formData.append("eventId", event.id);
    formData.append("itemId", targetItem.id);
    formData.append("quantity", String(allocationQty));
    formData.append("status", "reservado");
    formData.append("notes", allocationNotes);

    setAllocationQty(1);
    setAllocationNotes("");

    startTransition(async () => {
      const res = await addEventAllocationAction(formData);
      if (res.success && res.id) {
        setAllocations((prev) =>
          prev.map((a) => (a.id === tempId ? { ...a, id: res.id! } : a))
        );
      }
    });
  };

  const handleSaveVibe = async () => {
    setEvent((prev) => ({
      ...prev,
      theme: vibeTheme,
      vibeColors: JSON.stringify(vibeColors),
    }));
    setShowVibeModal(false);

    startTransition(async () => {
      await updateEventVibeAction(event.id, vibeTheme, vibeColors);
    });
  };

  const handleSaveCustomerPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(priceInput) || 0;
    setEvent((prev) => ({ ...prev, customerPrice: parsed }));
    setShowPriceModal(false);

    startTransition(async () => {
      await updateCustomerPriceAction(event.id, parsed);
    });
  };

  const handleCopyQuoteLink = (token: string, quoteId: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://cfm-events.vercel.app";
    navigator.clipboard.writeText(`${origin}/proposta/${token}`);
    setCopiedQuoteId(quoteId);
    setTimeout(() => setCopiedQuoteId(null), 2500);
  };

  // Calculations
  const completedTasksCount = tasks.filter((t) => t.completed).length;
  const totalTasksCount = tasks.length;
  const pendingTasksCount = totalTasksCount - completedTasksCount;
  const completionPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  const totalAllocatedItems = allocations.reduce((sum, a) => sum + a.quantity, 0);
  const totalAllocatedRentalValue = allocations.reduce((sum, a) => sum + a.quantity * (a.itemUnitPrice || 0), 0);

  const customerPriceVal = event.customerPrice || 0;
  const totalBudgetVal = event.totalBudget || 0;
  const estimatedMargin = customerPriceVal - totalBudgetVal;

  const currentColors = parseVibeColors(event.vibeColors);

  // WhatsApp helper
  const cleanPhone = client?.phone?.replace(/\D/g, "");
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
        `Olá ${client?.contactName || client?.name || ""}, referente ao evento "${event.name}" com a CFM Eventos:`
      )}`
    : null;

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#111111] pb-24 font-sans antialiased">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-[#ececf0] px-4 py-3">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#636366] hover:text-[#111111] transition bg-[#f2f2f5] hover:bg-[#e5e5ea] px-3 py-1.5 rounded-full"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar aos Eventos</span>
          </Link>

          <div className="flex items-center gap-3">
            {/* Status Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-[#8e8e93] hidden sm:inline">Estado:</span>
              <select
                value={event.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border outline-none cursor-pointer transition ${
                  getStatusBadge(event.status).bg
                }`}
              >
                <option value="planeamento">Planeamento</option>
                <option value="orcamento">Orçamento</option>
                <option value="confirmado">Confirmado</option>
                <option value="preparacao">Preparação</option>
                <option value="em_curso">Em Curso</option>
                <option value="devolucao">Devolução</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111] bg-white border border-[#ececf0] hover:bg-[#f2f2f5] px-3.5 py-1.5 rounded-[12px] shadow-2xs transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar Evento</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1100px] mx-auto px-4 pt-6 space-y-6">
        {/* ================================================================= */}
        {/* HERO / EVENT VIBE & THEME HEADER */}
        {/* ================================================================= */}
        <section className="bg-white border border-[#ececf0] rounded-[24px] overflow-hidden shadow-xs">
          {/* Cover / Vibe Banner */}
          <div className="relative h-[220px] md:h-[260px] w-full overflow-hidden bg-neutral-900">
            <img
              src={
                event.coverImageUrl ||
                "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80"
              }
              alt={event.name}
              className="w-full h-full object-cover object-center opacity-75"
            />
            {/* Chromatic overlay gradient inspired by vibe colors */}
            <div
              className="absolute inset-0 opacity-40 mix-blend-multiply"
              style={{
                background: `linear-gradient(135deg, ${currentColors[0] || "#111"} 0%, ${
                  currentColors[1] || currentColors[0] || "#333"
                } 100%)`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

            {/* Top Badges over image */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/90 backdrop-blur-md text-[#111] shadow-xs">
                  {event.category || "Evento Geral"}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(event.id);
                    setCopiedEventId(true);
                    setTimeout(() => setCopiedEventId(false), 2000);
                  }}
                  className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-black/50 hover:bg-black/75 backdrop-blur-md text-white/90 border border-white/20 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Clique para copiar o ID do evento"
                >
                  <span>#{event.id}</span>
                  {copiedEventId ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-white/70" />
                  )}
                </button>

                {event.theme && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F5A623] text-black shadow-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Tema: {event.theme}</span>
                  </span>
                )}
              </div>

              {/* Vibe Palette Customizer Trigger */}
              <button
                onClick={() => {
                  setVibeTheme(event.theme || "");
                  setVibeColors(parseVibeColors(event.vibeColors));
                  setShowVibeModal(true);
                }}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/20 transition flex items-center gap-1.5 shadow-md"
              >
                <Palette className="w-3.5 h-3.5 text-[#F5A623]" />
                <span>Paleta & Vibe</span>
              </button>
            </div>

            {/* Bottom Title on Image */}
            <div className="absolute bottom-4 left-5 right-5 text-white">
              <div className="flex items-center gap-2 text-xs text-white/80 font-medium mb-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDate(event.startDate)}</span>
                {event.venue && (
                  <>
                    <span>•</span>
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{event.venue}</span>
                  </>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white drop-shadow-xs">
                {event.name}
              </h1>
            </div>
          </div>

          {/* VIBE & PALETTE RIBBON */}
          <div className="px-6 py-4 bg-[#fafafc] border-b border-[#ececf0] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#111]">
                <Palette className="w-4 h-4 text-[#8e8e93]" />
                <span>Paleta de Cores & Vibe do Evento:</span>
              </div>

              {/* Visual Color Dots */}
              <div className="flex items-center gap-2">
                {currentColors.map((hex, idx) => (
                  <div
                    key={idx}
                    className="group relative flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#ececf0] shadow-2xs"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shadow-inner border border-black/10 inline-block"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="text-[11px] font-mono font-medium text-[#636366]">
                      {hex.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#8e8e93]">Tema Definido:</span>
              <span className="font-bold text-[#111] bg-white px-2.5 py-1 rounded-[8px] border border-[#ececf0]">
                {event.theme || "Padrão CFM"}
              </span>
            </div>
          </div>

          {/* TOP METRICS GRID */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#ececf0] p-4 bg-white">
            {/* 1. Customer Price */}
            <div className="p-3">
              <div className="flex items-center justify-between text-[#8e8e93] text-xs font-medium mb-1">
                <span>Valor a Pagar (Cliente)</span>
                <button
                  onClick={() => {
                    setPriceInput(String(event.customerPrice || 0));
                    setShowPriceModal(true);
                  }}
                  className="text-[#007aff] hover:underline text-[11px] font-semibold"
                >
                  Alterar
                </button>
              </div>
              <div className="text-xl md:text-2xl font-black text-[#111]">
                €{(event.customerPrice || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-[#8e8e93] mt-0.5">
                Custo interno orçado: €{(event.totalBudget || 0).toLocaleString("pt-PT")}
              </div>
            </div>

            {/* 2. Action Items Left */}
            <div className="p-3">
              <div className="text-[#8e8e93] text-xs font-medium mb-1">Ações de Conclusão</div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl md:text-2xl font-black text-[#111]">
                  {pendingTasksCount}
                </span>
                <span className="text-xs text-[#8e8e93] font-medium">
                  pendentes ({completedTasksCount}/{totalTasksCount})
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-[#f2f2f5] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-[#137333] h-full transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>

            {/* 3. Inventory Allocated */}
            <div className="p-3">
              <div className="text-[#8e8e93] text-xs font-medium mb-1">Inventário Alocado</div>
              <div className="text-xl md:text-2xl font-black text-[#111]">
                {totalAllocatedItems} <span className="text-xs font-normal text-[#8e8e93]">unid.</span>
              </div>
              <div className="text-[11px] text-[#8e8e93] mt-0.5">
                {allocations.length} tipos de artigos no evento
              </div>
            </div>

            {/* 4. Client Contact */}
            <div className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[#8e8e93] text-xs font-medium">Cliente / Contacto</span>
                {client?.id && (
                  <span className="font-mono text-[10px] text-[#8e8e93] bg-[#fafafc] px-1.5 py-0.5 rounded border border-[#ececf0]">
                    #{client.id}
                  </span>
                )}
              </div>
              <div className="text-sm font-bold text-[#111] truncate">
                {client?.name || "Sem cliente associado"}
              </div>
              <div className="text-[11px] text-[#8e8e93] truncate mt-0.5">
                {client?.contactName ? `${client.contactName} • ` : ""}
                {client?.phone || client?.email || "Sem dados de contacto"}
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* TWO-COLUMN DETAILS GRID */}
        {/* ================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT 2 COLUMNS: INVENTORY ALLOCATION & ACTION ITEMS */}
          <div className="lg:col-span-2 space-y-6">
            {/* ----------------------------------------------------------------- */}
            {/* INVENTORY MANAGEMENT */}
            {/* ----------------------------------------------------------------- */}
            <section className="bg-white border border-[#ececf0] rounded-[22px] p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-[#111]" />
                    <h2 className="text-lg font-bold text-[#111]">
                      Gestão de Inventário Alocado ao Evento
                    </h2>
                  </div>
                  <p className="text-xs text-[#8e8e93] mt-0.5">
                    Artigos reservados, despachados e devolvidos para este evento
                  </p>
                </div>

                <button
                  onClick={() => setShowAddAllocationModal(true)}
                  className="px-4 py-2 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition self-start sm:self-auto shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Alocar Artigo</span>
                </button>
              </div>

              {allocations.length === 0 ? (
                <div className="text-center py-10 px-4 border border-dashed border-[#ececf0] rounded-[16px] bg-[#fafafc]">
                  <Package className="w-9 h-9 text-[#8e8e93] mx-auto mb-2 opacity-50" />
                  <div className="text-sm font-bold text-[#111]">Nenhum artigo alocado</div>
                  <p className="text-xs text-[#8e8e93] max-w-sm mx-auto mt-1 mb-4">
                    Adicione cadeiras, mesas, velas, copos ou mobiliário para gerir a preparação e montagem deste evento.
                  </p>
                  <button
                    onClick={() => setShowAddAllocationModal(true)}
                    className="px-4 py-2 rounded-[12px] bg-[#111] text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar primeiro artigo</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {allocations.map((a) => (
                    <div
                      key={a.id}
                      className="p-4 rounded-[16px] border border-[#ececf0] bg-[#fafafc] hover:bg-white transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {a.itemImageUrl ? (
                          <img
                            src={a.itemImageUrl}
                            alt={a.itemName}
                            className="w-12 h-12 rounded-[10px] object-cover border border-black/5 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-[10px] bg-[#ececf0] flex items-center justify-center text-[#8e8e93] font-bold text-xs flex-shrink-0">
                            {a.itemSku?.substring(0, 3)}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="font-bold text-sm text-[#111] truncate">{a.itemName}</div>
                          <div className="text-xs text-[#8e8e93] flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#ececf0] text-[10px]" title="SKU">
                              {a.itemSku}
                            </span>
                            <span className="font-mono text-[#8e8e93] text-[10px]" title="ID do Artigo">
                              #{a.itemId}
                            </span>
                            <span>•</span>
                            <span>{a.itemCategory}</span>
                            {a.itemWarehouseLocation && (
                              <>
                                <span>•</span>
                                <span className="text-[#007aff]">{a.itemWarehouseLocation}</span>
                              </>
                            )}
                          </div>
                          {a.notes && (
                            <div className="text-[11px] text-[#48484a] italic mt-1 bg-white/70 px-2 py-0.5 rounded border border-[#ececf0]/60 inline-block">
                              Nota: {a.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right side controls */}
                      <div className="flex items-center justify-between md:justify-end gap-3 flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#ececf0]">
                        <div className="text-right">
                          <div className="text-sm font-extrabold text-[#111]">
                            {a.quantity} <span className="text-xs font-normal text-[#8e8e93]">unid.</span>
                          </div>
                          <div className="text-[11px] text-[#8e8e93]">
                            €{(a.quantity * (a.itemUnitPrice || 0)).toFixed(2)}
                          </div>
                        </div>

                        {/* Status selector */}
                        <select
                          value={a.status}
                          onChange={(e) =>
                            handleUpdateAllocationStatus(
                              a.id,
                              e.target.value as "reservado" | "despachado" | "devolvido" | "danificado"
                            )
                          }
                          className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border outline-none cursor-pointer ${
                            a.status === "despachado"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : a.status === "devolvido"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : a.status === "danificado"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          <option value="reservado">Reservado</option>
                          <option value="despachado">Despachado</option>
                          <option value="devolvido">Devolvido</option>
                          <option value="danificado">Danificado</option>
                        </select>

                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteAllocation(a.id)}
                          className="p-1.5 text-[#8e8e93] hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Remover do evento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Total summary row */}
                  <div className="pt-3 border-t border-[#ececf0] flex items-center justify-between text-xs font-bold text-[#111] px-2">
                    <span>Total de Aluguer Alocado</span>
                    <span className="text-sm">€{totalAllocatedRentalValue.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </section>

            {/* ----------------------------------------------------------------- */}
            {/* ACTION ITEMS CHECKLIST (What's left to complete the event) */}
            {/* ----------------------------------------------------------------- */}
            <section className="bg-white border border-[#ececf0] rounded-[22px] p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#137333]" />
                    <h2 className="text-lg font-bold text-[#111]">
                      Ações Pendentes para Conclusão do Evento
                    </h2>
                  </div>
                  <p className="text-xs text-[#8e8e93] mt-0.5">
                    Checklist operacional de preparação, montagem, cliente e desmontagem
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#f2f2f5] text-[#111]">
                    {pendingTasksCount} por concluir
                  </span>
                </div>
              </div>

              {/* Add task inline form */}
              <form onSubmit={handleAddTask} className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Adicionar nova ação ou tarefa... (ex: Confirmar bolo e balões Winnie the Pooh)"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="flex-1 px-3.5 py-2 text-xs bg-[#fafafc] border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff] transition"
                />
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as any)}
                  className="px-2.5 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] text-[#48484a]"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
                <button
                  type="submit"
                  disabled={!newTaskTitle.trim()}
                  className="px-4 py-2 bg-[#111] hover:bg-black disabled:opacity-50 text-white rounded-[12px] text-xs font-bold transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar</span>
                </button>
              </form>

              {/* Task list */}
              {tasks.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#8e8e93]">
                  Nenhuma ação adicionada ainda. Escreva acima para criar o checklist deste evento.
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((t) => (
                    <div
                      key={t.id}
                      className={`p-3.5 rounded-[14px] border transition flex items-center justify-between gap-3 ${
                        t.completed
                          ? "bg-[#fafafc] border-[#f2f2f5] opacity-75"
                          : "bg-white border-[#ececf0] hover:border-[#d2d2d7]"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleTask(t.id, t.completed)}
                          className="flex-shrink-0 text-[#111] focus:outline-none"
                        >
                          {t.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-[#137333] fill-emerald-100" />
                          ) : (
                            <Circle className="w-5 h-5 text-[#8e8e93] hover:text-[#111]" />
                          )}
                        </button>

                        <div className="min-w-0">
                          <span
                            className={`text-xs font-medium block truncate ${
                              t.completed ? "line-through text-[#8e8e93]" : "text-[#111]"
                            }`}
                          >
                            {t.title}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-mono text-[10px] text-[#8e8e93]" title="ID da Tarefa">
                          #{t.id}
                        </span>
                        {/* Priority tag */}
                        {t.priority && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              t.priority === "urgente"
                                ? "bg-red-100 text-red-700"
                                : t.priority === "alta"
                                ? "bg-amber-100 text-amber-800"
                                : t.priority === "media"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-neutral-100 text-neutral-600"
                            }`}
                          >
                            {t.priority}
                          </span>
                        )}

                        <button
                          onClick={() => handleDeleteTask(t.id)}
                          className="text-[#8e8e93] hover:text-red-600 p-1 rounded transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN: CLIENT INFO, SPECIAL NEEDS, CRONOGRAMA, PROPOSTAS */}
          <div className="space-y-6">
            {/* ----------------------------------------------------------------- */}
            {/* CLIENT / CONTACT INFORMATION */}
            {/* ----------------------------------------------------------------- */}
            <section className="bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#111]" />
                  <h3 className="text-sm font-bold text-[#111]">Informações de Contacto</h3>
                </div>
                {client && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f2f2f5] text-[#48484a] uppercase">
                    {client.source || "CRM"}
                  </span>
                )}
              </div>

              {client ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="font-extrabold text-[#111] text-[15px]">{client.name}</div>
                    {client.contactName && client.contactName !== client.name && (
                      <div className="text-[#8e8e93]">Pessoa de contacto: {client.contactName}</div>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[#ececf0]">
                    {client.phone && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#48484a]">
                          <Phone className="w-3.5 h-3.5 text-[#8e8e93]" />
                          <span>{client.phone}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`tel:${client.phone}`}
                            className="px-2 py-0.5 rounded bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[11px] font-semibold text-[#111]"
                          >
                            Ligar
                          </a>
                          {whatsappUrl && (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-[11px] font-bold text-emerald-700 flex items-center gap-1"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>WhatsApp</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {client.email && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#48484a] truncate">
                          <Mail className="w-3.5 h-3.5 text-[#8e8e93]" />
                          <span className="truncate">{client.email}</span>
                        </div>
                        <a
                          href={`mailto:${client.email}`}
                          className="px-2 py-0.5 rounded bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[11px] font-semibold text-[#111]"
                        >
                          Email
                        </a>
                      </div>
                    )}

                    {client.nif && (
                      <div className="flex items-center justify-between text-[#8e8e93]">
                        <span>NIF / Contribuinte:</span>
                        <span className="font-mono text-[#111]">{client.nif}</span>
                      </div>
                    )}
                  </div>

                  {client.notes && (
                    <div className="pt-2 border-t border-[#ececf0] text-[11px] text-[#636366] bg-[#fafafc] p-2 rounded-[10px]">
                      {client.notes}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-[#8e8e93] py-4 text-center">
                  Sem cliente associado. Edite o evento para vincular um cliente do CRM.
                </div>
              )}
            </section>

            {/* ----------------------------------------------------------------- */}
            {/* SPECIAL NEEDS & RESTRICTIONS ASKS */}
            {/* ----------------------------------------------------------------- */}
            <section className="bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#D32F2F]" />
                  <h3 className="text-sm font-bold text-[#111]">Pedidos Especiais & Notas</h3>
                </div>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="text-xs text-[#007aff] hover:underline font-semibold"
                >
                  Editar
                </button>
              </div>

              {event.specialNeeds ? (
                <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-[14px] text-xs text-[#78281F] leading-relaxed">
                  <div className="font-bold mb-1 flex items-center gap-1.5 text-rose-800">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Alergias, Restrições & Especificações do Cliente:</span>
                  </div>
                  {event.specialNeeds}
                </div>
              ) : (
                <div className="text-xs text-[#8e8e93] italic py-2">
                  Nenhum pedido especial ou restrição registada (ex: sem glúten, sem nozes, limite de ruído, tomadas elétricas).
                </div>
              )}

              {event.notes && (
                <div className="mt-3 pt-3 border-t border-[#ececf0] text-xs text-[#48484a] leading-relaxed">
                  <div className="font-bold text-[#111] mb-1">Notas Internas:</div>
                  {event.notes}
                </div>
              )}
            </section>

            {/* ----------------------------------------------------------------- */}
            {/* SCHEDULE & CRONOGRAMA */}
            {/* ----------------------------------------------------------------- */}
            <section className="bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-[#111]" />
                <h3 className="text-sm font-bold text-[#111]">Cronograma Operacional</h3>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded-[10px] bg-[#fafafc]">
                  <span className="text-[#8e8e93]">Montagem / Carga:</span>
                  <span className="font-semibold text-[#111]">{formatShortDate(event.prepDate)}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-[10px] bg-emerald-50/60 border border-emerald-100">
                  <span className="text-emerald-800 font-bold">Início do Evento:</span>
                  <span className="font-extrabold text-emerald-900">{formatShortDate(event.startDate)}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-[10px] bg-emerald-50/60 border border-emerald-100">
                  <span className="text-emerald-800 font-bold">Fim do Evento:</span>
                  <span className="font-extrabold text-emerald-900">{formatShortDate(event.endDate)}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-[10px] bg-[#fafafc]">
                  <span className="text-[#8e8e93]">Desmontagem:</span>
                  <span className="font-semibold text-[#111]">{formatShortDate(event.returnDate)}</span>
                </div>
              </div>
            </section>

            {/* ----------------------------------------------------------------- */}
            {/* DIGITAL PROPOSALS & QUOTES */}
            {/* ----------------------------------------------------------------- */}
            <section className="bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#111]" />
                  <h3 className="text-sm font-bold text-[#111]">Propostas & Orçamentos</h3>
                </div>
              </div>

              {quotes.length === 0 ? (
                <div className="text-xs text-[#8e8e93] py-2">
                  Nenhum orçamento emitido especificamente para este evento.
                </div>
              ) : (
                <div className="space-y-2">
                  {quotes.map((q) => (
                    <div
                      key={q.id}
                      className="p-3 rounded-[14px] border border-[#ececf0] bg-[#fafafc] flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-[#111]">{q.quoteNumber}</span>
                          <span className="font-mono text-[10px] text-[#8e8e93]">#{q.id}</span>
                        </div>
                        <div className="text-[11px] font-semibold text-[#137333]">
                          €{q.total.toFixed(2)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/proposta/${q.accessToken}`}
                          target="_blank"
                          className="px-2.5 py-1 rounded-lg bg-white border border-[#ececf0] text-[11px] font-semibold text-[#111] hover:bg-[#f2f2f5] flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Abrir</span>
                        </Link>
                        <button
                          onClick={() => handleCopyQuoteLink(q.accessToken, q.id)}
                          className="p-1 rounded-lg bg-white border border-[#ececf0] text-[#111] hover:bg-[#f2f2f5]"
                          title="Copiar link da proposta para o cliente"
                        >
                          {copiedQuoteId === q.id ? (
                            <Check className="w-3.5 h-3.5 text-[#137333]" />
                          ) : (
                            <Share2 className="w-3.5 h-3.5 text-[#8e8e93]" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* ===================================================================== */}
      {/* MODAL 1: CUSTOMIZE VIBE PALETTE & THEME */}
      {/* ===================================================================== */}
      {showVibeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] w-full max-w-lg border border-[#ececf0] shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#ececf0]">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#F5A623]" />
                <h3 className="text-base font-bold text-[#111]">Paleta de Cores & Vibe do Evento</h3>
              </div>
              <button
                onClick={() => setShowVibeModal(false)}
                className="text-[#8e8e93] hover:text-[#111] p-1 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Theme Name */}
            <div>
              <label className="block text-xs font-bold text-[#111] mb-1">
                Nome do Tema do Evento
              </label>
              <input
                type="text"
                placeholder="Ex: Winnie the Pooh, Sunset Gala, Romântico Boho"
                value={vibeTheme}
                onChange={(e) => setVibeTheme(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-[#fafafc] border border-[#ececf0] rounded-[12px] focus:ring-2 focus:ring-[#007aff] outline-none"
              />
            </div>

            {/* Current Palette */}
            <div>
              <label className="block text-xs font-bold text-[#111] mb-2">
                Cores Atuais da Paleta
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {vibeColors.map((hex, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#fafafc] border border-[#ececf0]"
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-black/10 shadow-inner"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="text-xs font-mono font-bold text-[#111]">{hex.toUpperCase()}</span>
                    {vibeColors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setVibeColors(vibeColors.filter((_, i) => i !== index))}
                        className="text-[#8e8e93] hover:text-red-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add custom color */}
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="color"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value)}
                  className="w-8 h-8 rounded-full border-0 cursor-pointer p-0"
                />
                <input
                  type="text"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value)}
                  placeholder="#F5A623"
                  className="px-3 py-1.5 text-xs font-mono uppercase bg-[#fafafc] border border-[#ececf0] rounded-[10px] w-28"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newColorHex && !vibeColors.includes(newColorHex)) {
                      setVibeColors([...vibeColors, newColorHex]);
                    }
                  }}
                  className="px-3 py-1.5 bg-[#f2f2f5] hover:bg-[#e5e5ea] text-xs font-bold rounded-[10px] text-[#111]"
                >
                  ＋ Adicionar Cor
                </button>
              </div>
            </div>

            {/* Presets */}
            <div>
              <label className="block text-xs font-bold text-[#8e8e93] mb-2">
                Inspiração / Paletas Prontas
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_PALETTES.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setVibeTheme(preset.theme);
                      setVibeColors(preset.colors);
                    }}
                    className="p-2.5 rounded-[12px] border border-[#ececf0] hover:border-[#111] bg-white text-left transition flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#111] truncate">{preset.name}</div>
                      <div className="flex items-center gap-1 mt-1.5">
                        {preset.colors.map((c, i) => (
                          <span
                            key={i}
                            className="w-3 h-3 rounded-full border border-black/10"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-[#ececf0] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowVibeModal(false)}
                className="px-4 py-2 rounded-[12px] bg-[#f2f2f5] text-xs font-bold text-[#111]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveVibe}
                className="px-5 py-2 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold shadow-xs"
              >
                Guardar Paleta & Tema
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: ADD INVENTORY ALLOCATION */}
      {/* ===================================================================== */}
      {showAddAllocationModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] w-full max-w-lg border border-[#ececf0] shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#ececf0]">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#111]" />
                <h3 className="text-base font-bold text-[#111]">Alocar Artigo do Inventário</h3>
              </div>
              <button
                onClick={() => setShowAddAllocationModal(false)}
                className="text-[#8e8e93] hover:text-[#111] p-1 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAllocation} className="space-y-4 text-xs">
              {/* Item selection with search */}
              <div>
                <label className="block font-bold text-[#111] mb-1">Selecionar Artigo</label>
                <input
                  type="text"
                  placeholder="Pesquisar por nome ou SKU..."
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 mb-2 bg-[#fafafc] border border-[#ececf0] rounded-[10px] text-xs"
                />
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#ececf0] rounded-[12px] text-xs font-semibold"
                >
                  {allItems
                    .filter(
                      (item) =>
                        item.name.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
                        item.sku.toLowerCase().includes(itemSearchQuery.toLowerCase())
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.sku}) — Stock total: {item.totalQuantity} | €{item.unitPrice.toFixed(2)}
                      </option>
                    ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block font-bold text-[#111] mb-1">Quantidade a Reservar</label>
                <input
                  type="number"
                  min="1"
                  value={allocationQty}
                  onChange={(e) => setAllocationQty(parseInt(e.target.value || "1", 10))}
                  className="w-full px-3.5 py-2 bg-white border border-[#ececf0] rounded-[12px] text-xs"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-[#111] mb-1">
                  Notas de Utilização / Local no Espaço (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Mesa de honra, Bar exterior, Zona de fotografias"
                  value={allocationNotes}
                  onChange={(e) => setAllocationNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-[#ececf0] rounded-[12px] text-xs"
                />
              </div>

              <div className="pt-3 border-t border-[#ececf0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddAllocationModal(false)}
                  className="px-4 py-2 rounded-[12px] bg-[#f2f2f5] text-xs font-bold text-[#111]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold"
                >
                  Confirmar Alocação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: CUSTOMER PRICE EDIT */}
      {/* ===================================================================== */}
      {showPriceModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] w-full max-w-sm border border-[#ececf0] shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#ececf0]">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#111]" />
                <h3 className="text-base font-bold text-[#111]">Valor a Pagar pelo Cliente</h3>
              </div>
              <button
                onClick={() => setShowPriceModal(false)}
                className="text-[#8e8e93] hover:text-[#111] p-1 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerPrice} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#111] mb-1">Valor Total Cobrado (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base font-bold bg-[#fafafc] border border-[#ececf0] rounded-[12px] text-[#111] outline-none"
                />
                <p className="text-[11px] text-[#8e8e93] mt-1">
                  Este valor representa o total acordado que o cliente pagará pelo evento completo.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPriceModal(false)}
                  className="px-4 py-2 rounded-[12px] bg-[#f2f2f5] text-xs font-bold text-[#111]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold"
                >
                  Guardar Valor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: FULL EVENT EDIT MODAL */}
      {/* ===================================================================== */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] w-full max-w-xl border border-[#ececf0] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-[#ececf0] flex items-center justify-between">
              <h3 className="text-base font-bold text-[#111]">Editar Informações do Evento</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-[#8e8e93] hover:text-[#111] p-1 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              action={async (formData) => {
                await updateEventDetailsAction(formData);
                setShowEditModal(false);
                // Refresh client side
                window.location.reload();
              }}
              className="p-6 overflow-y-auto flex-1 space-y-4 text-xs"
            >
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="vibeColors" value={event.vibeColors || ""} />

              <div>
                <label className="block font-bold text-[#111] mb-1">Identificador Único (ID)</label>
                <input
                  type="text"
                  value={event.id}
                  disabled
                  className="w-full px-3 py-2 bg-[#f2f2f7] text-[#8e8e93] font-mono border border-[#ececf0] rounded-[10px] cursor-not-allowed select-all"
                />
              </div>

              <div>
                <label className="block font-bold text-[#111] mb-1">Nome do Evento</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={event.name}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#111] mb-1">Categoria</label>
                  <select
                    name="category"
                    defaultValue={event.category || "Geral"}
                    className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px]"
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
                  <label className="block font-bold text-[#111] mb-1">Tema do Evento</label>
                  <input
                    type="text"
                    name="theme"
                    placeholder="Ex: Winnie the Pooh"
                    defaultValue={event.theme || ""}
                    className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#111] mb-1">Cliente</label>
                  <select
                    name="clientId"
                    defaultValue={event.clientId || ""}
                    className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px]"
                  >
                    <option value="">(Sem cliente)</option>
                    {allClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#111] mb-1">Local / Quinta</label>
                  <input
                    type="text"
                    name="venue"
                    defaultValue={event.venue || ""}
                    className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#111] mb-1">Data Início</label>
                  <input
                    type="datetime-local"
                    name="startDate"
                    defaultValue={event.startDate ? new Date(event.startDate).toISOString().slice(0, 16) : ""}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#111] mb-1">Data Fim</label>
                  <input
                    type="datetime-local"
                    name="endDate"
                    defaultValue={event.endDate ? new Date(event.endDate).toISOString().slice(0, 16) : ""}
                    className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#111] mb-1">Valor a Pagar Cliente (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="customerPrice"
                    defaultValue={event.customerPrice || 0}
                    className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#111] mb-1">Custo / Orçamento Interno (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="totalBudget"
                    defaultValue={event.totalBudget || 0}
                    className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#111] mb-1">
                  Pedidos Especiais / Alergias / Necessidades Específicas
                </label>
                <textarea
                  name="specialNeeds"
                  rows={3}
                  placeholder="Ex: Alergia a amendoim, restrição de ruído a partir das 22h, tomada 220V no jardim..."
                  defaultValue={event.specialNeeds || ""}
                  className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#111] mb-1">Notas Gerais</label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={event.notes || ""}
                  className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px]"
                />
              </div>

              <div className="pt-3 border-t border-[#ececf0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-[12px] bg-[#f2f2f5] text-xs font-bold text-[#111]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold"
                >
                  Guardar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
