"use client";

import React, { useState, useTransition, useRef } from "react";
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
  X,
  Share2,
  Check,
  Copy,
  ShieldAlert,
  Loader2,
  Camera,
  Minus,
  History,
  Image as ImageIcon,
  Lightbulb,
  ZoomIn,
} from "lucide-react";
import AuditLogModal from "@/components/AuditLogModal";
import { formatRelativeTime } from "@/lib/date-format";
import {
  updateEventPatchAction,
  updateEventStatusAction,
  updateAllocationStatusAction,
  updateAllocationQuantityAction,
  deleteAllocationAction,
  addEventAllocationAction,
  addEventTaskAction,
  toggleEventTaskAction,
  deleteEventTaskAction,
  addEventMediaAction,
  deleteEventMediaAction,
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
  updatedAt?: Date | string | null;
  lastUpdatedByName?: string | null;
}

export interface EventMediaItem {
  id: string;
  eventId: string;
  type: "idea_board" | "final_outcome";
  title: string;
  description: string | null;
  imageUrl: string;
  tag: string | null;
  orderIndex: number | null;
  uploadedByName: string | null;
  createdAt: Date | string | null;
}

interface Props {
  event: EventData;
  client: Client | null;
  allClients: Client[];
  allItems: InventoryItem[];
  initialAllocations: Allocation[];
  initialTasks: Task[];
  initialMedia?: EventMediaItem[];
  quotes: Quote[];
  currentUser: any;
}

const MEDIA_INSPIRATION_PRESETS = [
  {
    type: "idea_board" as const,
    tag: "Flores & Centros",
    title: "Centros de Mesa em Terracotta & Eucalipto",
    url: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
    description: "Arranjos orgânicos baixos com folhagens secas, rosas e apontamentos rústicos",
  },
  {
    type: "idea_board" as const,
    tag: "Iluminação & Ambiente",
    title: "Varal de Micro-Lâmpadas Fairy Lights",
    url: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80",
    description: "Céu estrelado sobre a zona de refeições e mesas compridas",
  },
  {
    type: "idea_board" as const,
    tag: "Cerimónia & Altar",
    title: "Arco Floral Circular Boho Minimal",
    url: "https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80",
    description: "Estrutura metálica dourada com pampas grass e hortênsias brancas",
  },
  {
    type: "idea_board" as const,
    tag: "Lounge & Mobiliário",
    title: "Zona Lounge Rústica com Sofás Chesterfield",
    url: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80",
    description: "Conjunto exterior para convidados com tapetes persas e mesas de apoio em madeira",
  },
  {
    type: "final_outcome" as const,
    tag: "Resultado Real",
    title: "Execução Final das Mesas dos Convidados",
    url: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=80",
    description: "Fotografia tirada 30 min antes da abertura de portas aos convidados na Quinta",
  },
  {
    type: "final_outcome" as const,
    tag: "Resultado Real",
    title: "Zona de Cocktail e Iluminação Noturna Ativa",
    url: "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=80",
    description: "Ambiente com velas acesas e luz quente na receção",
  },
  {
    type: "idea_board" as const,
    tag: "Bolo & Doces",
    title: "Candy Bar e Mesa de Sobremesas Temática",
    url: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1200&q=80",
    description: "Mesa rústica de madeira com doces finos, lettering e apontamentos temáticos",
  },
  {
    type: "final_outcome" as const,
    tag: "Resultado Real",
    title: "Foto Oficial dos Noivos na Zona de Fotos",
    url: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80",
    description: "Cenografia de fundo montada pela CFM Eventos totalmente aprovada pelo cliente",
  },
];

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
    name: "Black & Gold",
    theme: "Black & Gold Minimalist",
    colors: ["#111111", "#D4AF37", "#2C3E50", "#E0E0E0"],
  },
  {
    name: "Rose Gold",
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

const PRESET_COVERS = [
  { label: "Infantil / Winnie", url: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1200&q=80" },
  { label: "Gala / Noite", url: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80" },
  { label: "Casamento Jardim", url: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80" },
  { label: "Jantar Elegante", url: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=80" },
];

export default function EventDetailView({
  event: initialEvent,
  client: initialClient,
  allClients,
  allItems,
  initialAllocations,
  initialTasks,
  initialMedia = [],
  quotes,
  currentUser,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const [event, setEvent] = useState(initialEvent);
  const [client, setClient] = useState(initialClient);
  const [allocations, setAllocations] = useState(initialAllocations);
  const [tasks, setTasks] = useState(initialTasks);

  // Media state: Idea Boards & Final Outcomes
  const [mediaList, setMediaList] = useState<EventMediaItem[]>(initialMedia || []);
  const [mediaFilter, setMediaFilter] = useState<"all" | "idea_board" | "final_outcome">("all");
  const [lightboxItem, setLightboxItem] = useState<EventMediaItem | null>(null);
  const [showAddMediaModal, setShowAddMediaModal] = useState(false);

  // New media modal form state
  const [newMediaType, setNewMediaType] = useState<"idea_board" | "final_outcome">("idea_board");
  const [newMediaTitle, setNewMediaTitle] = useState("");
  const [newMediaTag, setNewMediaTag] = useState("Flores & Centros");
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [newMediaDescription, setNewMediaDescription] = useState("");

  // Auto-save status: "saved" | "saving" | "error"
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Modals for adding items
  const [showAddAllocationModal, setShowAddAllocationModal] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);

  // New task inline state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"baixa" | "media" | "alta" | "urgente">("media");

  // Add allocation state
  const [selectedItemId, setSelectedItemId] = useState(allItems[0]?.id || "");
  const [allocationQty, setAllocationQty] = useState(1);
  const [allocationNotes, setAllocationNotes] = useState("");
  const [itemSearchQuery, setItemSearchQuery] = useState("");

  // Copied proposal link & event ID
  const [copiedQuoteId, setCopiedQuoteId] = useState<string | null>(null);
  const [copiedEventId, setCopiedEventId] = useState(false);

  // Parse Vibe Colors helper
  const parseVibeColors = (raw: string | null): string[] => {
    try {
      if (!raw) return ["#111111", "#8E8E93", "#E5E5EA"];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : ["#111111"];
    } catch {
      return ["#111111", "#8E8E93", "#E5E5EA"];
    }
  };

  const currentColors = parseVibeColors(event.vibeColors);

  // Format date helper for input type="datetime-local"
  const toInputDate = (d: Date | null) => {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // -------------------------------------------------------------
  // INSTANTANEOUS AUTO-SAVE ENGINE
  // -------------------------------------------------------------
  const savePatch = async (patch: Record<string, any>) => {
    setSaveStatus("saving");
    try {
      const res = await updateEventPatchAction(event.id, patch);
      if (res.success) {
        setSaveStatus("saved");
      } else {
        setSaveStatus("error");
      }
    } catch (e) {
      console.error("Auto-save error:", e);
      setSaveStatus("error");
    }
  };

  const handleFieldChange = (field: string, value: any, immediate = false) => {
    // 1. Optimistic local update
    setEvent((prev) => ({ ...prev, [field]: value }));

    // 2. Debounced or immediate server persist
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    if (immediate) {
      savePatch({ [field]: value });
    } else {
      setSaveStatus("saving");
      saveTimeoutRef.current = setTimeout(() => {
        savePatch({ [field]: value });
      }, 500);
    }
  };

  // Client switcher
  const handleClientChange = (newClientId: string) => {
    const foundClient = allClients.find((c) => c.id === newClientId) || null;
    setClient(foundClient);
    setEvent((prev) => ({ ...prev, clientId: newClientId || null }));
    savePatch({ clientId: newClientId || null });
  };

  // Vibe Palette change
  const handlePresetPalette = (preset: typeof PRESET_PALETTES[0]) => {
    const jsonColors = JSON.stringify(preset.colors);
    setEvent((prev) => ({
      ...prev,
      theme: preset.theme,
      vibeColors: jsonColors,
    }));
    savePatch({
      theme: preset.theme,
      vibeColors: jsonColors,
    });
  };

  const handleColorChange = (index: number, newHex: string) => {
    const updated = [...currentColors];
    updated[index] = newHex;
    const jsonColors = JSON.stringify(updated);
    setEvent((prev) => ({ ...prev, vibeColors: jsonColors }));
    savePatch({ vibeColors: jsonColors });
  };

  const handleAddColor = () => {
    const updated = [...currentColors, "#D4AF37"];
    const jsonColors = JSON.stringify(updated);
    setEvent((prev) => ({ ...prev, vibeColors: jsonColors }));
    savePatch({ vibeColors: jsonColors });
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

  // Handlers for tasks
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

  // Handlers for allocations
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

  const handleUpdateAllocationQty = async (allocationId: string, newQty: number) => {
    if (newQty < 1) return;
    setAllocations((prev) =>
      prev.map((a) => (a.id === allocationId ? { ...a, quantity: newQty } : a))
    );
    startTransition(async () => {
      await updateAllocationQuantityAction(allocationId, newQty, event.id);
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
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-[#ececf0] px-3.5 sm:px-4 py-2.5 sm:py-3">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between gap-2">
          <Link
            href="/eventos"
            className="inline-flex items-center gap-1.5 sm:gap-2 text-xs font-semibold text-[#636366] hover:text-[#111111] transition bg-[#f2f2f5] hover:bg-[#e5e5ea] px-2.5 sm:px-3 py-1.5 rounded-full flex-shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar<span className="hidden sm:inline"> aos Eventos</span></span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Auto-save Status Indicator */}
            <div className="flex items-center gap-1.5 text-xs font-medium px-2 sm:px-2.5 py-1 rounded-full bg-[#fafafc] border border-[#ececf0] flex-shrink-0">
              {saveStatus === "saving" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#007aff]" />
                  <span className="text-[#007aff] font-semibold text-[11px] sm:text-xs">A guardar...</span>
                </>
              ) : saveStatus === "saved" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold text-[11px] sm:text-xs">
                    <span className="hidden sm:inline">Guardado instantaneamente</span>
                    <span className="sm:hidden">Guardado</span>
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-rose-600 font-semibold text-[11px] sm:text-xs">Erro ao guardar</span>
                </>
              )}
            </div>

            {/* Status Dropdown */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <span className="text-[11px] font-medium text-[#8e8e93] hidden md:inline">Estado:</span>
              <select
                value={event.status}
                onChange={(e) => handleFieldChange("status", e.target.value, true)}
                className={`text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-full border outline-none cursor-pointer transition ${
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

            {/* Auditing Log & Last Updated */}
            <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-[#ececf0] flex-shrink-0">
              <span className="hidden lg:inline text-[11px] text-[#8e8e93]">
                Last updated by <strong className="text-[#3a3a3c] font-semibold">{event.lastUpdatedByName || "Administrador CFM"}</strong> {formatRelativeTime(event.updatedAt, "en")}
              </span>
              <button
                type="button"
                onClick={() => setShowAuditModal(true)}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[#007aff] hover:text-[#005bb5] font-semibold text-xs transition cursor-pointer"
                title="Ver histórico de alterações do evento"
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Histórico</span>
              </button>
            </div>
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
          <div className="relative min-h-[240px] md:min-h-[280px] w-full overflow-hidden bg-neutral-900 flex flex-col justify-between p-6">
            <img
              src={
                event.coverImageUrl ||
                "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80"
              }
              alt={event.name}
              className="absolute inset-0 w-full h-full object-cover object-center opacity-75 pointer-events-none"
            />
            {/* Chromatic overlay gradient inspired by vibe colors */}
            <div
              className="absolute inset-0 opacity-40 mix-blend-multiply pointer-events-none"
              style={{
                background: `linear-gradient(135deg, ${currentColors[0] || "#111"} 0%, ${
                  currentColors[1] || currentColors[0] || "#333"
                } 100%)`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/30 pointer-events-none" />

            {/* Top Badges over image */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Category Inline Selector */}
                <select
                  value={event.category || "Geral"}
                  onChange={(e) => handleFieldChange("category", e.target.value, true)}
                  className="px-3 py-1 rounded-full text-xs font-bold bg-white/95 text-[#111] shadow-xs border-0 outline-none cursor-pointer hover:bg-white transition"
                  title="Alterar categoria do evento"
                >
                  <option value="Aniversário Infantil">Aniversário Infantil</option>
                  <option value="Casamento">Casamento</option>
                  <option value="Gala Corporativa">Gala Corporativa</option>
                  <option value="Jantar de Marca">Jantar de Marca</option>
                  <option value="Festa Privada">Festa Privada</option>
                  <option value="Batizado">Batizado</option>
                  <option value="Geral">Geral</option>
                </select>

                {/* Event Unique ID Badge */}
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

                {/* Theme Inline Editable Tag */}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5A623] text-black shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-[11px] font-bold">Tema:</span>
                  <input
                    type="text"
                    value={event.theme || ""}
                    placeholder="Sem tema..."
                    onChange={(e) => handleFieldChange("theme", e.target.value)}
                    className="bg-transparent border-b border-black/30 hover:border-black focus:border-black text-xs font-bold text-black placeholder:text-black/60 outline-none px-1 py-0 w-36 transition"
                  />
                </div>
              </div>

              {/* Cover Image Quick Switcher */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCoverPicker(!showCoverPicker)}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-black/50 hover:bg-black/80 backdrop-blur-md text-white/90 border border-white/20 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Alterar Imagem</span>
                </button>

                {showCoverPicker && (
                  <div className="absolute right-0 top-9 w-72 bg-white rounded-[16px] shadow-xl border border-[#ececf0] p-3 text-xs text-[#111] z-20 space-y-2">
                    <div className="font-bold text-xs">Foto de Capa do Evento</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PRESET_COVERS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            handleFieldChange("coverImageUrl", preset.url, true);
                            setShowCoverPicker(false);
                          }}
                          className="p-1.5 text-left rounded-lg bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[11px] font-medium truncate"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#8e8e93] font-bold uppercase mb-1">Ou URL personalizado:</label>
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/..."
                        defaultValue={event.coverImageUrl || ""}
                        onBlur={(e) => {
                          if (e.target.value.trim()) {
                            handleFieldChange("coverImageUrl", e.target.value.trim(), true);
                            setShowCoverPicker(false);
                          }
                        }}
                        className="w-full px-2 py-1 text-xs border border-[#ececf0] rounded-md outline-none focus:ring-1 focus:ring-[#007aff]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Title & Venue on Image */}
            <div className="relative z-10 text-white space-y-2 pt-8">
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/90 font-medium">
                <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-md">
                  <MapPin className="w-3.5 h-3.5 text-white/70" />
                  <input
                    type="text"
                    value={event.venue || ""}
                    placeholder="Adicionar local / quinta..."
                    onChange={(e) => handleFieldChange("venue", e.target.value)}
                    className="bg-transparent text-white placeholder:text-white/60 text-xs font-semibold outline-none border-b border-transparent hover:border-white/40 focus:border-white px-1 py-0 w-52 transition"
                  />
                </div>
              </div>

              {/* Instantaneously Editable Event Name */}
              <input
                type="text"
                value={event.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                placeholder="Nome do Evento..."
                className="w-full text-2xl md:text-3xl font-extrabold tracking-tight text-white bg-transparent border-b border-transparent hover:border-white/30 focus:border-white focus:bg-black/30 px-2 py-1 rounded-lg outline-none transition drop-shadow-sm"
              />
            </div>
          </div>

          {/* VIBE & PALETTE RIBBON (Directly Clickable & Customizable) */}
          <div className="px-6 py-4 bg-[#fafafc] border-b border-[#ececf0] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#111]">
                <Palette className="w-4 h-4 text-[#8e8e93]" />
                <span>Paleta & Cores (Clique para mudar):</span>
              </div>

              {/* Direct Color Pickers */}
              <div className="flex items-center gap-2 flex-wrap">
                {currentColors.map((hex, idx) => (
                  <label
                    key={idx}
                    className="relative flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#ececf0] shadow-2xs cursor-pointer hover:border-[#d2d2d7] transition"
                    title="Clique para escolher nova cor"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shadow-inner border border-black/10 inline-block pointer-events-none"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="text-[11px] font-mono font-bold text-[#636366]">
                      {hex.toUpperCase()}
                    </span>
                    <input
                      type="color"
                      value={hex}
                      onChange={(e) => handleColorChange(idx, e.target.value)}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                    />
                  </label>
                ))}

                <button
                  type="button"
                  onClick={handleAddColor}
                  className="w-7 h-7 rounded-full bg-white border border-[#ececf0] hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93] hover:text-[#111] transition shadow-2xs"
                  title="Adicionar cor à paleta"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick Palettes Presets Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <span className="text-[11px] text-[#8e8e93] font-medium flex-shrink-0">Temas rápidos:</span>
              {PRESET_PALETTES.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handlePresetPalette(preset)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white hover:bg-[#111] hover:text-white border border-[#ececf0] transition shadow-2xs flex-shrink-0 cursor-pointer"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* TOP METRICS & FINANCIALS (Directly Editable Inline) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#ececf0] p-4 bg-white">
            {/* 1. Customer Price (Directly Editable) */}
            <div className="p-3 space-y-1">
              <div className="text-[#8e8e93] text-xs font-medium">Valor Cobrado ao Cliente (€)</div>
              <div className="flex items-center gap-1">
                <span className="text-xl font-black text-[#111]">€</span>
                <input
                  type="number"
                  step="0.01"
                  value={event.customerPrice || ""}
                  onChange={(e) =>
                    handleFieldChange(
                      "customerPrice",
                      e.target.value === "" ? 0 : parseFloat(e.target.value)
                    )
                  }
                  className="w-full text-xl md:text-2xl font-black text-[#111] bg-transparent border-b border-transparent hover:border-[#ececf0] focus:border-[#007aff] outline-none px-1 py-0.5 rounded transition"
                  placeholder="0.00"
                />
              </div>
              <div className="text-[11px] text-[#8e8e93]">
                Margem bruta est.:{" "}
                <strong className={estimatedMargin >= 0 ? "text-emerald-700" : "text-rose-600"}>
                  €{estimatedMargin.toFixed(2)}
                </strong>
              </div>
            </div>

            {/* 2. Internal Production Budget (Directly Editable) */}
            <div className="p-3 space-y-1">
              <div className="text-[#8e8e93] text-xs font-medium">Custo Interno Orçado (€)</div>
              <div className="flex items-center gap-1">
                <span className="text-xl font-black text-[#111]">€</span>
                <input
                  type="number"
                  step="0.01"
                  value={event.totalBudget || ""}
                  onChange={(e) =>
                    handleFieldChange(
                      "totalBudget",
                      e.target.value === "" ? 0 : parseFloat(e.target.value)
                    )
                  }
                  className="w-full text-xl md:text-2xl font-black text-[#111] bg-transparent border-b border-transparent hover:border-[#ececf0] focus:border-[#007aff] outline-none px-1 py-0.5 rounded transition"
                  placeholder="0.00"
                />
              </div>
              <div className="text-[11px] text-[#8e8e93]">
                Valor material alugado: €{totalAllocatedRentalValue.toFixed(2)}
              </div>
            </div>

            {/* 3. Action Items Checklist Progress */}
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

            {/* 4. Client Selector & Contact Info */}
            <div className="p-3 space-y-1">
              <div className="text-[#8e8e93] text-xs font-medium">Cliente Associado</div>
              <select
                value={event.clientId || ""}
                onChange={(e) => handleClientChange(e.target.value)}
                className="w-full font-bold text-sm text-[#111] bg-[#fafafc] hover:bg-[#f2f2f5] border border-[#ececf0] rounded-lg px-2.5 py-1 outline-none cursor-pointer truncate transition"
              >
                <option value="">(Sem cliente associado)</option>
                {allClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.contactName ? `(${c.contactName})` : ""}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-[#8e8e93] truncate pt-0.5">
                {client?.phone || client?.email || "Sem dados de contacto adicionais"}
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
                  className="px-4 py-2 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition self-start sm:self-auto shadow-xs cursor-pointer"
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
                    className="px-4 py-2 rounded-[12px] bg-[#111] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
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
                          <Link href={`/inventario/${a.itemId}`} className="flex-shrink-0" title="Ver ficha do artigo">
                            <img
                              src={a.itemImageUrl}
                              alt={a.itemName}
                              className="w-12 h-12 rounded-[10px] object-cover border border-black/5 hover:opacity-85 transition"
                            />
                          </Link>
                        ) : (
                          <Link
                            href={`/inventario/${a.itemId}`}
                            className="w-12 h-12 rounded-[10px] bg-[#ececf0] hover:bg-[#e5e5ea] flex items-center justify-center text-[#8e8e93] font-bold text-xs flex-shrink-0 transition"
                            title="Ver ficha do artigo"
                          >
                            {a.itemSku?.substring(0, 3)}
                          </Link>
                        )}

                        <div className="min-w-0">
                          <div className="font-bold text-sm text-[#111] truncate">
                            <Link
                              href={`/inventario/${a.itemId}`}
                              className="hover:text-[#007aff] transition"
                              title="Ver ficha do artigo no inventário"
                            >
                              {a.itemName}
                            </Link>
                          </div>
                          <div className="text-xs text-[#8e8e93] flex flex-wrap items-center gap-2 mt-0.5">
                            <Link
                              href={`/inventario/${a.itemId}`}
                              className="font-mono bg-white hover:bg-[#f2f2f5] px-1.5 py-0.5 rounded border border-[#ececf0] text-[10px] transition"
                              title="SKU do Artigo"
                            >
                              {a.itemSku}
                            </Link>
                            <Link
                              href={`/inventario/${a.itemId}`}
                              className="font-mono text-[#8e8e93] hover:text-[#007aff] text-[10px] transition"
                              title="ID do Artigo"
                            >
                              #{a.itemId}
                            </Link>
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

                      {/* Right side controls: Instant Quantity & Status */}
                      <div className="flex items-center justify-between md:justify-end gap-3 flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#ececf0]">
                        {/* Instant Qty Adjustment Buttons */}
                        <div className="flex items-center gap-1.5 bg-white border border-[#ececf0] rounded-[10px] p-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateAllocationQty(a.id, a.quantity - 1)}
                            disabled={a.quantity <= 1}
                            className="w-6 h-6 rounded-md hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93] hover:text-[#111] disabled:opacity-30"
                            title="Diminuir quantidade"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-xs font-extrabold text-[#111]">
                            {a.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateAllocationQty(a.id, a.quantity + 1)}
                            className="w-6 h-6 rounded-md hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93] hover:text-[#111]"
                            title="Aumentar quantidade"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="text-right min-w-[65px]">
                          <div className="text-[11px] font-semibold text-[#111]">
                            €{(a.quantity * (a.itemUnitPrice || 0)).toFixed(2)}
                          </div>
                          <div className="text-[9px] text-[#8e8e93]">
                            €{a.itemUnitPrice?.toFixed(2)}/un
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

                        {/* Delete action */}
                        <button
                          onClick={() => handleDeleteAllocation(a.id)}
                          className="p-1.5 text-[#8e8e93] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          title="Remover alocação"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ----------------------------------------------------------------- */}
            {/* ACTION ITEMS CHECKLIST */}
            {/* ----------------------------------------------------------------- */}
            <section className="bg-white border border-[#ececf0] rounded-[22px] p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
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
                  className="px-4 py-2 bg-[#111] hover:bg-black disabled:opacity-50 text-white rounded-[12px] text-xs font-bold transition flex items-center gap-1 cursor-pointer"
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
                          className="flex-shrink-0 text-[#111] focus:outline-none cursor-pointer"
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
                          className="p-1 text-[#8e8e93] hover:text-rose-600 rounded-md transition cursor-pointer"
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

          {/* RIGHT COLUMN: CRONOGRAMA, PEDIDOS ESPECIAIS, NOTAS & CLIENT CONTACT */}
          <div className="space-y-6">
            {/* ----------------------------------------------------------------- */}
            {/* SCHEDULE & CRONOGRAMA (Directly Editable Datetime Inputs) */}
            {/* ----------------------------------------------------------------- */}
            <section className="bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#111]" />
                  <h3 className="text-sm font-bold text-[#111]">Cronograma Operacional</h3>
                </div>
                <span className="text-[10px] text-[#8e8e93]">Edição imediata</span>
              </div>

              <div className="space-y-3 text-xs">
                {/* 1. Prep Date */}
                <div className="p-2.5 rounded-[12px] bg-[#fafafc] border border-[#ececf0] space-y-1">
                  <span className="text-[#8e8e93] font-medium block text-[11px]">Montagem / Carga:</span>
                  <input
                    type="datetime-local"
                    value={toInputDate(event.prepDate)}
                    onChange={(e) => handleFieldChange("prepDate", e.target.value, true)}
                    className="w-full bg-white border border-[#ececf0] rounded-md px-2 py-1 text-xs font-semibold text-[#111] outline-none cursor-pointer"
                  />
                </div>

                {/* 2. Start Date */}
                <div className="p-2.5 rounded-[12px] bg-emerald-50/70 border border-emerald-200/80 space-y-1">
                  <span className="text-emerald-800 font-bold block text-[11px]">Início do Evento:</span>
                  <input
                    type="datetime-local"
                    value={toInputDate(event.startDate)}
                    onChange={(e) => handleFieldChange("startDate", e.target.value, true)}
                    className="w-full bg-white border border-emerald-200 rounded-md px-2 py-1 text-xs font-bold text-emerald-950 outline-none cursor-pointer"
                  />
                </div>

                {/* 3. End Date */}
                <div className="p-2.5 rounded-[12px] bg-emerald-50/70 border border-emerald-200/80 space-y-1">
                  <span className="text-emerald-800 font-bold block text-[11px]">Fim do Evento:</span>
                  <input
                    type="datetime-local"
                    value={toInputDate(event.endDate)}
                    onChange={(e) => handleFieldChange("endDate", e.target.value, true)}
                    className="w-full bg-white border border-emerald-200 rounded-md px-2 py-1 text-xs font-bold text-emerald-950 outline-none cursor-pointer"
                  />
                </div>

                {/* 4. Return Date */}
                <div className="p-2.5 rounded-[12px] bg-[#fafafc] border border-[#ececf0] space-y-1">
                  <span className="text-[#8e8e93] font-medium block text-[11px]">Desmontagem & Recolha:</span>
                  <input
                    type="datetime-local"
                    value={toInputDate(event.returnDate)}
                    onChange={(e) => handleFieldChange("returnDate", e.target.value, true)}
                    className="w-full bg-white border border-[#ececf0] rounded-md px-2 py-1 text-xs font-semibold text-[#111] outline-none cursor-pointer"
                  />
                </div>
              </div>
            </section>

            {/* ----------------------------------------------------------------- */}
            {/* SPECIAL NEEDS & RESTRICTIONS (Directly Editable Inline) */}
            {/* ----------------------------------------------------------------- */}
            <section className="bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#D32F2F]" />
                  <h3 className="text-sm font-bold text-[#111]">Pedidos Especiais & Alergias</h3>
                </div>
                <span className="text-[10px] text-[#8e8e93]">Guarda ao escrever</span>
              </div>

              <textarea
                rows={3}
                value={event.specialNeeds || ""}
                onChange={(e) => handleFieldChange("specialNeeds", e.target.value)}
                placeholder="Ex: Alergia a amendoim, restrição de ruído após as 22h, tomadas 220V no jardim..."
                className="w-full p-3 bg-rose-50/60 border border-rose-200/80 rounded-[12px] text-xs text-rose-950 placeholder:text-rose-900/40 outline-none focus:ring-1 focus:ring-rose-400 transition"
              />

              <div className="pt-2 border-t border-[#ececf0]">
                <div className="font-bold text-xs text-[#111] mb-1.5">Notas Operacionais Internas:</div>
                <textarea
                  rows={2}
                  value={event.notes || ""}
                  onChange={(e) => handleFieldChange("notes", e.target.value)}
                  placeholder="Instruções de logística, montagem ou camiões..."
                  className="w-full p-3 bg-[#fafafc] border border-[#ececf0] rounded-[12px] text-xs text-[#111] placeholder:text-[#8e8e93] outline-none focus:ring-1 focus:ring-[#007aff] transition"
                />
              </div>
            </section>

            {/* ----------------------------------------------------------------- */}
            {/* CLIENT CONTACT CARD */}
            {/* ----------------------------------------------------------------- */}
            <section className="bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#111]" />
                  <h3 className="text-sm font-bold text-[#111]">Ficha do Cliente</h3>
                </div>
                {client?.id && (
                  <span className="font-mono text-[10px] text-[#8e8e93] bg-[#fafafc] px-1.5 py-0.5 rounded border border-[#ececf0]">
                    #{client.id}
                  </span>
                )}
              </div>

              {client ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="font-bold text-sm text-[#111]">{client.name}</div>
                    {client.contactName && (
                      <div className="text-[#8e8e93] text-[11px] mt-0.5">
                        Contacto direto: {client.contactName}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-1 border-t border-[#ececf0]">
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
                              rel="noreferrer"
                              className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-bold flex items-center gap-1"
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
                </div>
              ) : (
                <div className="text-xs text-[#8e8e93] py-2 italic">
                  Selecione um cliente no topo para ver os contactos diretos aqui.
                </div>
              )}
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
                        <button
                          onClick={() => handleCopyQuoteLink(q.accessToken, q.id)}
                          className="px-2.5 py-1 rounded-[8px] bg-white border border-[#ececf0] hover:bg-[#f2f2f5] text-[11px] font-semibold text-[#111] flex items-center gap-1 transition cursor-pointer"
                        >
                          {copiedQuoteId === q.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="w-3 h-3 text-[#8e8e93]" />
                              <span>Link</span>
                            </>
                          )}
                        </button>

                        <a
                          href={`/proposta/${q.accessToken}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-[8px] bg-[#111] hover:bg-black text-white text-xs"
                          title="Abrir proposta pública"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
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
      {/* MODAL: ADD ALLOCATION (For selecting items from warehouse catalog) */}
      {/* ===================================================================== */}
      {showAddAllocationModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] w-full max-w-md border border-[#ececf0] shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#ececf0]">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#111]" />
                <h3 className="text-base font-bold text-[#111]">Alocar Material do Armazém</h3>
              </div>
              <button
                onClick={() => setShowAddAllocationModal(false)}
                className="text-[#8e8e93] hover:text-[#111] p-1 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAllocation} className="space-y-3.5 text-xs">
              {/* Item Search / Selector */}
              <div>
                <label className="block font-bold text-[#111] mb-1">Pesquisar ou Selecionar Artigo</label>
                <input
                  type="text"
                  placeholder="Filtrar por nome ou SKU..."
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#fafafc] border border-[#ececf0] rounded-[10px] text-xs mb-2"
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
                  placeholder="Ex: Mesa de honra, Bar exterior, Zona de fotos"
                  value={allocationNotes}
                  onChange={(e) => setAllocationNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-[#ececf0] rounded-[12px] text-xs"
                />
              </div>

              <div className="pt-3 border-t border-[#ececf0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddAllocationModal(false)}
                  className="px-4 py-2 rounded-[12px] bg-[#f2f2f5] text-xs font-bold text-[#111] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold cursor-pointer"
                >
                  Confirmar Alocação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      <AuditLogModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        entityType="event"
        entityId={event.id}
        entityTitle={event.name}
      />
    </div>
  );
}
