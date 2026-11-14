"use client";

import React, { useState, useEffect, useTransition, useRef, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Package,
  Copy,
  Check,
  Calendar,
  MapPin,
  User,
  Building,
  Plus,
  X,
  AlertTriangle,
  Wrench,
  ExternalLink,
  Tag,
  DollarSign,
  Maximize2,
  Layers,
  Sparkles,
  History,
  Loader2,
  Camera,
  Boxes,
  ShieldAlert,
  Share2,
  Trash2,
  Upload,
  Pencil,
} from "lucide-react";
import AuditLogModal from "@/components/AuditLogModal";
import StorageLocationsModal, { StorageLocation, TeamUser } from "@/components/StorageLocationsModal";
import { formatRelativeTime } from "@/lib/date-format";
import { usePresence } from "@/lib/usePresence";
import {
  formatCurrencyPt,
  eurosToCents,
  centsToEuros,
  applyCurrencyKeyPress,
  parsePastedCurrency,
} from "@/lib/currency";
import {
  updateItemPatchAction,
  updateItemTriageAction,
  markItemAsBoughtAction,
  deleteInventoryItemAction,
  uploadItemPhotoAction,
} from "@/app/actions";

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  totalQuantity: number;
  minStock: number | null;
  warehouseLocation: string | null;
  locationId?: string | null;
  dimensions: string | null;
  unitPrice: number;
  replacementCost: number | null;
  purchaseStatus?: "bought" | "not_bought";
  purchaseCost?: number | null;
  isConsumable?: boolean;
  packageUnits?: number | null;
  imageUrl: string | null;
  damagedQuantity: number | null;
  inMaintenanceQuantity: number | null;
  updatedAt?: Date | string | null;
  lastUpdatedByName?: string | null;
}

interface ItemAllocation {
  id: string;
  quantity: number;
  status: string;
  notes: string | null;
  eventId: string;
  eventName: string;
  eventVenue: string | null;
  eventStartDate: Date;
  eventEndDate: Date | null;
  eventStatus: string;
}

interface InventoryDetailViewProps {
  item: InventoryItem;
  allocations: ItemAllocation[];
  locations?: StorageLocation[];
  users?: TeamUser[];
  currentUser?: { id: string; name: string; email: string; role: string; avatarUrl?: string | null } | null;
}

const PRESET_CATEGORIES = [
  "Mobiliário / Cadeiras",
  "Mobiliário / Mesas",
  "Mobiliário / Lounge & Sofás",
  "Decoração / Iluminação",
  "Copos / Vidro",
  "Louça & Talheres",
  "Têxteis & Toalhas",
  "Estruturas & Tendas",
  "Som & AV",
  "Geral",
];

const PRESET_LOCATIONS = [
  "Armazém A · B3 · P2",
  "Armazém A · C1 · P4",
  "Armazém A · D1 · P3",
  "Armazém B · A2 · P1",
  "Armazém B · Mezanino",
  "Armazém Principal",
];

const PRESET_IMAGE_TEMPLATES = [
  { label: "Cadeira Chiavari", url: "https://images.unsplash.com/photo-1549497538-303791108f95?auto=format&fit=crop&w=600&q=80" },
  { label: "Vela LED / Iluminação", url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80" },
  { label: "Mesa Redonda 180", url: "https://images.unsplash.com/photo-1572883454114-1cf0031ede2a?auto=format&fit=crop&w=600&q=80" },
  { label: "Copo Martini / Vidro", url: "https://images.unsplash.com/photo-1530629013299-6cb10d168419?auto=format&fit=crop&w=600&q=80" },
  { label: "Sofá Lounge Branco", url: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80" },
  { label: "Toalha Linho Natural", url: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80" },
];

export default function InventoryDetailView({
  item: initialItem,
  allocations,
  locations: initialLocations = [],
  users: teamUsers = [],
  currentUser,
}: InventoryDetailViewProps) {
  const [item, setItem] = useState<InventoryItem>(initialItem);
  const [currentUserState, setCurrentUserState] = useState(currentUser);

  // Live Team Presence & Editing Tracker
  const { activeEditors } = usePresence({
    currentUser: currentUserState,
    editing: {
      type: "inventory",
      id: item.id,
      title: item.name,
    },
    pollIntervalMs: 8000,
  });
  const [locationsList, setLocationsList] = useState<StorageLocation[]>(initialLocations);

  useEffect(() => {
    setCurrentUserState(currentUser);
  }, [currentUser]);

  useEffect(() => {
    const handleUserUpdated = (e: CustomEvent<any>) => {
      const updated = e.detail;
      if (!updated || !updated.id) return;
      if (currentUserState && currentUserState.id === updated.id) {
        setCurrentUserState((prev: any) => ({ ...prev, ...updated }));
      }
      setLocationsList((prev) =>
        prev.map((loc) =>
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
  }, [currentUserState]);
  const [showLocationsModal, setShowLocationsModal] = useState(false);
  const [locationsModalMode, setLocationsModalMode] = useState<"list" | "create">("list");
  const [copiedId, setCopiedId] = useState(false);
  const [copiedSku, setCopiedSku] = useState(false);
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showPhotoLightbox, setShowPhotoLightbox] = useState(false);
  const [showSkuConfirmModal, setShowSkuConfirmModal] = useState(false);
  const [pendingSku, setPendingSku] = useState("");
  const [skuError, setSkuError] = useState<string | null>(null);
  const [isUpdatingSku, setIsUpdatingSku] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoCameraInputRef = useRef<HTMLInputElement | null>(null);
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState(item.imageUrl || "");
  const [damageQuantity, setDamageQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();

  const handleConfirmSkuUpdate = async () => {
    const clean = pendingSku.trim().toUpperCase();
    if (!clean) {
      setSkuError("O código do artigo não pode estar vazio.");
      return;
    }
    if (clean === item.sku) {
      setShowSkuConfirmModal(false);
      return;
    }

    setIsUpdatingSku(true);
    setSkuError(null);
    try {
      const res = await updateItemPatchAction(item.id, { sku: clean });
      if (res.success) {
        setItem((prev) => ({ ...prev, sku: clean }));
        setShowSkuConfirmModal(false);
        setPendingSku("");
      } else {
        setSkuError(res.error || "Erro ao atualizar código.");
      }
    } catch (err: any) {
      setSkuError(err?.message || "Erro inesperado ao atualizar código.");
    } finally {
      setIsUpdatingSku(false);
    }
  };

  useEffect(() => {
    if (!showPhotoLightbox) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowPhotoLightbox(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showPhotoLightbox]);

  // Filter upcoming allocations where this item is currently booked
  const upcomingAllocations = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allocations.filter((a) => {
      if (a.eventStatus === "cancelado" || a.eventStatus === "concluido") return false;
      const end = a.eventEndDate ? new Date(a.eventEndDate) : new Date(a.eventStartDate);
      return end >= today;
    });
  }, [allocations]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadItemPhotoAction(fd);
      if (res.success && res.url) {
        setCustomImageUrl(res.url);
        handleFieldChange("imageUrl", res.url, true);
        setShowImagePicker(false);
      } else {
        alert(res.error || "Não foi possível carregar a imagem.");
      }
    } catch (err: any) {
      alert(err?.message || "Erro ao processar fotografia.");
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteInventoryItemAction(item.id);
      if (res.success) {
        window.location.href = "/inventario";
      } else {
        alert(res.error || "Erro ao eliminar artigo.");
        setIsDeleting(false);
      }
    } catch (err: any) {
      alert(err?.message || "Erro ao eliminar artigo.");
      setIsDeleting(false);
    }
  };

  // Find designated location and manager
  const currentLocation = useMemo(() => {
    if (item.locationId) {
      const found = locationsList.find((l) => l.id === item.locationId);
      if (found) return found;
    }
    if (item.warehouseLocation) {
      const locStr = item.warehouseLocation.toLowerCase();
      const found = locationsList.find(
        (l) => locStr.includes(l.name.toLowerCase()) || l.name.toLowerCase().includes(locStr)
      );
      if (found) return found;
    }
    return locationsList[0] || null;
  }, [item.locationId, item.warehouseLocation, locationsList]);

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const damaged = item.damagedQuantity || 0;
  const inMaintenance = item.inMaintenanceQuantity || 0;
  const totalAllocated = allocations.reduce((acc, a) => acc + a.quantity, 0);
  const availableRightNow = Math.max(0, item.totalQuantity - damaged - inMaintenance);
  const isLowStock = availableRightNow < (item.minStock || 0);

  // Auto-save patch function
  const savePatch = async (patch: Partial<InventoryItem>) => {
    setSaveStatus("saving");
    try {
      const res = await updateItemPatchAction(item.id, patch);
      if (res.success) {
        setSaveStatus("saved");
      } else {
        setSaveStatus("error");
      }
    } catch (err) {
      console.error("Auto-save item error:", err);
      setSaveStatus("error");
    }
  };

  const handleFieldChange = (field: keyof InventoryItem, value: any, immediate = false) => {
    // 1. Optimistic local state update
    setItem((prev) => ({ ...prev, [field]: value }));

    // 2. Debounced or immediate persist
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

  // Controlled cent-shift currency state
  const [priceCents, setPriceCents] = useState(() => eurosToCents(item.unitPrice));

  useEffect(() => {
    setPriceCents(eurosToCents(item.unitPrice));
  }, [item.unitPrice]);

  const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (["Tab", "Enter", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      return;
    }
    if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) {
      return;
    }

    const input = e.currentTarget;
    const isAllSelected =
      input.selectionStart !== null &&
      input.selectionEnd !== null &&
      input.selectionStart === 0 &&
      input.selectionEnd === input.value.length;

    const nextCents = applyCurrencyKeyPress(priceCents, e.key, isAllSelected);
    if (nextCents !== null) {
      e.preventDefault();
      setPriceCents(nextCents);
      const euroVal = centsToEuros(nextCents);
      handleFieldChange("unitPrice", euroVal);
      handleFieldChange("replacementCost", euroVal);
    } else {
      e.preventDefault();
    }
  };

  const handlePricePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const nextCents = parsePastedCurrency(pasted);
    setPriceCents(nextCents);
    const euroVal = centsToEuros(nextCents);
    handleFieldChange("unitPrice", euroVal);
    handleFieldChange("replacementCost", euroVal);
  };

  const selectedLocationId = useMemo(() => {
    if (item.locationId && locationsList.some((l) => l.id === item.locationId)) {
      return item.locationId;
    }
    if (item.warehouseLocation) {
      const match = locationsList.find(
        (l) => l.name.toLowerCase() === item.warehouseLocation?.toLowerCase()
      );
      if (match) return match.id;
    }
    return "";
  }, [item.locationId, item.warehouseLocation, locationsList]);

  const handleLocationChange = (newLocationId: string) => {
    const loc = locationsList.find((l) => l.id === newLocationId);
    if (!loc) return;
    setItem((prev) => ({
      ...prev,
      locationId: loc.id,
      warehouseLocation: loc.name,
    }));
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    savePatch({
      locationId: loc.id,
      warehouseLocation: loc.name,
    });
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(item.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopySku = () => {
    navigator.clipboard.writeText(item.sku);
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 2000);
  };

  const handleRepairAll = () => {
    setItem((prev) => ({
      ...prev,
      damagedQuantity: 0,
      inMaintenanceQuantity: 0,
    }));
    setShowTriageModal(false);
    startTransition(async () => {
      await updateItemTriageAction(item.id, "repair_all");
    });
  };

  const handleReportDamage = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Math.max(1, damageQuantity);
    setItem((prev) => ({
      ...prev,
      damagedQuantity: (prev.damagedQuantity || 0) + qty,
    }));
    setShowTriageModal(false);
    startTransition(async () => {
      await updateItemTriageAction(item.id, "report_damage", qty);
    });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#111111] pb-24 font-sans antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-[#ececf0] px-3.5 sm:px-4 py-2.5 sm:py-3">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between gap-2">
          <Link
            href="/inventario"
            prefetch={true}
            className="inline-flex items-center gap-1.5 sm:gap-2 text-xs font-semibold text-[#636366] hover:text-[#111111] transition bg-[#f2f2f5] hover:bg-[#e5e5ea] p-1.5 sm:px-3 sm:py-1.5 rounded-full flex-shrink-0"
            title="Voltar ao Catálogo de Stock"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Voltar ao Catálogo</span>
          </Link>

          {/* Right Header: Active editors, Auto-save status, Last Updated & Audit History */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Active Editors Pulsing Avatar Badge */}
            {activeEditors.map((editor) => (
              <div
                key={editor.userId}
                className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50/90 border border-blue-200/90 text-[#007aff] text-xs font-semibold animate-pulse shadow-2xs flex-shrink-0"
                title={`${editor.userName} está a editar este artigo agora`}
              >
                <div className="relative w-5 h-5 rounded-full overflow-hidden bg-[#007aff] text-white flex items-center justify-center text-[10px] font-bold ring-2 ring-[#007aff] ring-offset-1 flex-shrink-0">
                  {editor.avatarUrl ? (
                    <img src={editor.avatarUrl} alt={editor.userName} className="w-full h-full object-cover" />
                  ) : (
                    editor.userName.charAt(0)
                  )}
                </div>
                <span className="hidden sm:inline text-[11px] font-bold truncate max-w-[120px]">
                  {editor.userName.split(" ")[0]} a editar
                </span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#007aff] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#007aff]" />
                </span>
              </div>
            ))}

            {/* Auto-save Status Badge */}
            {saveStatus === "saving" && (
              <div
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-[#007aff] flex-shrink-0"
                title="A guardar alterações..."
              >
                <Save className="w-3.5 h-3.5 text-[#007aff]" />
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#007aff]" />
                <span className="hidden sm:inline font-semibold text-[11px]">A guardar...</span>
              </div>
            )}
            {saveStatus === "saved" && (
              <div
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex-shrink-0"
                title="Todas as alterações guardadas"
              >
                <Save className="w-3.5 h-3.5 text-emerald-600" />
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                <span className="hidden sm:inline font-semibold text-[11px]">Guardado</span>
              </div>
            )}
            {saveStatus === "error" && (
              <div
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex-shrink-0"
                title="Erro ao guardar"
              >
                <Save className="w-3.5 h-3.5 text-rose-600" />
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden sm:inline font-semibold text-[11px]">Erro</span>
              </div>
            )}

            {/* Audit History */}
            <span className="hidden lg:inline text-[11px] text-[#8e8e93] pl-2 border-l border-[#ececf0]">
              Last updated by <strong className="text-[#3a3a3c] font-semibold">{item.lastUpdatedByName || "Administrador CFM"}</strong> {formatRelativeTime(item.updatedAt, "en")}
            </span>
            <button
              type="button"
              onClick={() => setShowAuditModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#007aff] hover:text-[#005bb5] bg-[#f2f2f5] hover:bg-[#e5e5ea] p-1.5 sm:px-3 sm:py-1.5 rounded-[12px] transition cursor-pointer"
              title="Ver histórico de alterações do artigo"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Histórico</span>
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 p-1.5 sm:px-3 sm:py-1.5 rounded-[12px] transition cursor-pointer"
              title="Eliminar este artigo do inventário"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Eliminar</span>
            </button>

            {currentUserState && (
              <div
                className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-xl bg-white border border-[#ececf0] text-xs font-semibold shadow-2xs flex-shrink-0"
                title={`${currentUserState.name} (${currentUserState.email}) · Acesso ${currentUserState.role}`}
              >
                <div className="w-5 h-5 rounded-full bg-[#111] text-white flex items-center justify-center text-[10px] font-bold overflow-hidden flex-shrink-0">
                  {currentUserState.avatarUrl ? (
                    <img src={currentUserState.avatarUrl} alt={currentUserState.name} className="w-full h-full object-cover" />
                  ) : (
                    currentUserState.name.charAt(0)
                  )}
                </div>
                <span className="text-[#111] hidden sm:inline">{currentUserState.name.split(" ")[0]}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1100px] mx-auto px-4 pt-6 space-y-6">
        {/* ================================================================= */}
        {/* HERO CARD - FULLY INLINE EDITABLE */}
        {/* ================================================================= */}
        <section className="bg-white border border-[#ececf0] rounded-[24px] p-6 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 min-w-0 flex-1">
              {/* Item Thumbnail Image with Click to Enlarge & Dedicated Camera Button */}
              <div className="relative group shrink-0">
                {item.imageUrl ? (
                  <button
                    type="button"
                    onClick={() => setShowPhotoLightbox(true)}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-[18px] overflow-hidden border border-black/5 shadow-2xs cursor-pointer group/img relative bg-black/5 block focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                    title="Clique para ver fotografia ampliada"
                    aria-label="Ver fotografia ampliada"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover/img:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition flex items-center justify-center">
                      <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition drop-shadow-md" />
                    </div>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowImagePicker(true)}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-[18px] bg-[#f2f2f7] hover:bg-[#e5e5ea] flex flex-col items-center justify-center text-[#8e8e93] hover:text-[#111] transition cursor-pointer border border-transparent hover:border-[#d1d1d6]"
                    title="Adicionar foto ao artigo"
                    aria-label="Adicionar foto ao artigo"
                  >
                    <Package className="w-10 h-10 stroke-[1.5]" />
                    <span className="text-[10px] font-semibold mt-1">Sem foto</span>
                  </button>
                )}
                {/* Dedicated Camera Icon Button to Change Photo */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowImagePicker(true);
                  }}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#111] hover:bg-[#333] active:scale-95 text-white shadow-md border-2 border-white flex items-center justify-center cursor-pointer transition transform hover:scale-110 z-10"
                  title="Alterar foto"
                  aria-label="Alterar foto"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              {/* Title & Metadata Inputs */}
              <div className="min-w-0 flex-1 space-y-2.5">
                {/* Top Badges & Category Selector */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Category Dropdown (Immediate auto-save) */}
                  <div className="relative inline-block">
                    <select
                      value={item.category}
                      onChange={(e) => handleFieldChange("category", e.target.value, true)}
                      className="px-3 py-1 rounded-full text-xs font-bold bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[#111] border border-transparent hover:border-[#ececf0] focus:border-[#007aff] focus:bg-white focus:outline-none transition cursor-pointer"
                      title="Clique para alterar a categoria"
                    >
                      {PRESET_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      {!PRESET_CATEGORIES.includes(item.category) && (
                        <option value={item.category}>{item.category}</option>
                      )}
                    </select>
                  </div>

                  {/* Share Link Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        navigator.clipboard.writeText(window.location.href);
                        setCopiedId(true);
                        setTimeout(() => setCopiedId(false), 2000);
                      }
                    }}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#fafafc] hover:bg-[#f2f2f5] text-[#111] border border-[#ececf0] transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Copiar link direto para este artigo"
                  >
                    {copiedId ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Link copiado!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 text-[#8e8e93]" />
                        <span>Partilhar</span>
                      </>
                    )}
                  </button>

                  {/* Protected Item Code Badge with Confirmation Action */}
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#fafafc] border border-[#ececf0] text-xs font-mono shadow-2xs">
                    <span className="text-[#8e8e93] font-bold">Código:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingSku(item.sku);
                        setSkuError(null);
                        setShowSkuConfirmModal(true);
                      }}
                      className="font-bold text-[#111] hover:text-[#007aff] transition cursor-pointer select-all tracking-wide"
                      title="Clique para alterar o código (requer confirmação)"
                    >
                      {item.sku}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopySku}
                      className="text-[#8e8e93] hover:text-[#111] p-0.5 rounded hover:bg-[#ececf0] transition cursor-pointer"
                      title="Copiar código"
                    >
                      {copiedSku ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingSku(item.sku);
                        setSkuError(null);
                        setShowSkuConfirmModal(true);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-sans font-semibold text-[#007aff] hover:text-[#005bb5] bg-[#f0f7ff] hover:bg-[#e0efff] px-2 py-0.5 rounded-full transition cursor-pointer ml-1"
                      title="Alterar código do artigo (requer confirmação para evitar quebra de leituras)"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Alterar</span>
                    </button>
                  </div>
                </div>

                {/* Inline Editable Name */}
                <div>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    placeholder="Nome do artigo..."
                    className="w-full text-2xl md:text-3xl font-extrabold tracking-tight text-[#111] bg-transparent border-b border-transparent hover:border-[#ececf0] focus:border-[#007aff] focus:bg-[#fafafa] px-1 py-0.5 rounded-[8px] focus:outline-none transition"
                    title="Clique para editar o nome do artigo (guarda automaticamente)"
                  />
                </div>

                {/* Inline Location & Manager & Dimensions */}
                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  {/* Warehouse Location Selector Dropdown (Existing locations only) */}
                  <div className="inline-flex items-center gap-1.5 bg-[#f0f7ff] text-[#0066cc] border border-[#d6e7ff] hover:border-[#007aff] px-2.5 py-1 rounded-[10px] transition">
                    <MapPin className="w-3.5 h-3.5 text-[#0066cc] shrink-0 pointer-events-none" />
                    <select
                      value={selectedLocationId}
                      onChange={(e) => handleLocationChange(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-[#0066cc] focus:outline-none cursor-pointer pr-1"
                      title="Selecione um local de armazenamento existente"
                    >
                      {!selectedLocationId && (
                        <option value="" disabled className="text-[#8e8e93]">
                          {item.warehouseLocation || "Selecionar local..."}
                        </option>
                      )}
                      {locationsList.map((loc) => (
                        <option key={loc.id} value={loc.id} className="text-[#111]">
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Manager Display & Quick Manage Button */}
                  {currentLocation && (
                    <div
                      className="inline-flex items-center gap-1.5 bg-[#fafafc] text-[#3a3a3c] border border-[#ececf0] px-2.5 py-1 rounded-[10px]"
                      title={`Pessoa responsável: ${currentLocation.managerName}${currentLocation.managerContact ? ` (${currentLocation.managerContact})` : ""}`}
                    >
                      <User className="w-3.5 h-3.5 text-[#007aff] shrink-0" />
                      <span className="text-[11px]">
                        Gestor: <strong className="font-semibold text-[#111]">{currentLocation.managerName}</strong>
                      </span>
                      {currentLocation.managerContact && (
                        <span className="text-[10px] text-[#8e8e93] font-mono hidden md:inline">
                          · {currentLocation.managerContact}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setLocationsModalMode("list");
                          setShowLocationsModal(true);
                        }}
                        className="text-[10px] text-[#007aff] hover:underline font-semibold ml-1 cursor-pointer"
                        title="Gerir locais de armazenamento e responsáveis"
                      >
                        Gerir
                      </button>
                    </div>
                  )}

                  {/* Button to specify a brand new location */}
                  <button
                    type="button"
                    onClick={() => {
                      setLocationsModalMode("create");
                      setShowLocationsModal(true);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#007aff] hover:text-[#005bb5] bg-[#f0f7ff] hover:bg-[#e0efff] px-2.5 py-1 rounded-[10px] transition cursor-pointer"
                    title="Especificar um novo local para guardar inventário"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Novo Local</span>
                  </button>

                  {/* Dimensions Input */}
                  <div className="inline-flex items-center gap-1.5 bg-[#fafafc] text-[#3a3a3c] border border-[#ececf0] px-2.5 py-1 rounded-[10px]">
                    <Maximize2 className="w-3.5 h-3.5 text-[#8e8e93] shrink-0" />
                    <input
                      type="text"
                      value={item.dimensions || ""}
                      onChange={(e) => handleFieldChange("dimensions", e.target.value)}
                      placeholder="Dimensões (ex: 40 × 45 × 92 cm)..."
                      className="bg-transparent text-xs text-[#3a3a3c] placeholder:text-[#8e8e93] focus:outline-none min-w-[160px]"
                      title="Edite as dimensões do artigo"
                    />
                  </div>

                  {/* Consumable vs Reusable Badge with Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !item.isConsumable;
                      setItem((prev) => ({ ...prev, isConsumable: nextVal }));
                      savePatch({ isConsumable: nextVal });
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] text-xs font-bold transition cursor-pointer border ${
                      item.isConsumable
                        ? "bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100"
                        : "bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100"
                    }`}
                    title="Clique para alternar entre Consumível e Reutilizável"
                  >
                    <span>{item.isConsumable ? "🔥 Consumível" : "📦 Reutilizável"}</span>
                  </button>

                  {item.isConsumable && (
                    <div className="inline-flex items-center gap-1 bg-[#fafafc] border border-[#ececf0] px-2.5 py-1 rounded-[10px] text-xs">
                      <span className="text-[10px] text-[#8e8e93]">Embalagem:</span>
                      <input
                        type="number"
                        min="1"
                        value={item.packageUnits || 1}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value || "1", 10));
                          setItem((prev) => ({ ...prev, packageUnits: val }));
                          savePatch({ packageUnits: val });
                        }}
                        className="w-12 text-center font-bold bg-transparent focus:outline-none"
                        title="Unidades por embalagem / pack"
                      />
                      <span className="text-[10px] text-[#8e8e93]">un/pack</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Price & Action Badge */}
            <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-2.5 pt-3 md:pt-0 border-t md:border-t-0 border-[#ececf0] shrink-0">
              {/* Compact & Intuitive Price Widget */}
              <div
                className="bg-[#fafafc] hover:bg-[#f5f5f7] border border-[#ececf0] focus-within:border-[#007aff] focus-within:ring-2 focus-within:ring-[#007aff]/10 focus-within:bg-white rounded-[14px] px-3 py-1.5 transition text-right shadow-2xs"
                title="Preço de compra do artigo (guarda automaticamente)"
              >
                <div className="flex items-center justify-between md:justify-end gap-2 mb-0.5">
                  <span className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-wider block">
                    Preço de compra
                  </span>
                </div>
                <div className="inline-flex items-center justify-end font-extrabold text-[#111]">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatCurrencyPt(centsToEuros(priceCents))}
                    onKeyDown={handlePriceKeyDown}
                    onPaste={handlePricePaste}
                    onChange={() => {}}
                    className="min-w-[60px] max-w-[110px] w-auto text-right font-extrabold text-base text-[#111] bg-transparent focus:outline-none selection:bg-[#007aff]/20 cursor-text"
                    aria-label="Preço de compra"
                  />
                  <span className="text-base font-extrabold text-[#111] ml-0.5 select-none">€</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowTriageModal(true)}
                className="px-4 py-2 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Reportar danos</span>
              </button>
            </div>
          </div>

          {/* Purchase Status Banner & Actions (Shown only when pending purchase) */}
          {item.purchaseStatus === "not_bought" && (
            <div className="p-4 rounded-[18px] bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-amber-900">Artigo Ainda Não Comprado</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-200 text-amber-900">
                      Pendente de Aquisição
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Este artigo ainda não foi contabilizado nas saídas reais de caixa. O custo de aquisição previsto de{" "}
                    <strong>€{(Number(item.purchaseCost) > 0 ? Number(item.purchaseCost) : (Number(item.replacementCost) || 0) * (Number(item.totalQuantity) || 1)).toFixed(2)}</strong>{" "}
                    está atualmente deduzido do Lucro Projetado em Finanças.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isPending}
                onClick={async () => {
                  const cost = Number(item.purchaseCost) > 0
                    ? Number(item.purchaseCost)
                    : (Number(item.replacementCost) || 0) * (Number(item.totalQuantity) || 1);
                  setItem((prev) => ({ ...prev, purchaseStatus: "bought", purchaseCost: cost }));
                  startTransition(async () => {
                    await markItemAsBoughtAction(item.id, cost);
                  });
                }}
                className="px-3.5 py-2 rounded-[12px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Marcar como Comprado & Lançar Despesa</span>
              </button>
            </div>
          )}

          {/* Quick Metrics Bar with Inline Stock Thresholds */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#ececf0]">
            {/* Stock Total (Inline Editable) */}
            <div className="p-3.5 rounded-[16px] bg-[#fafafc] border border-[#ececf0] space-y-1">
              <div className="flex items-center justify-between text-[11px] font-medium text-[#8e8e93]">
                <span>Stock Físico Total</span>
                <span className="text-[10px] text-[#007aff]">Edição direta</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  value={item.totalQuantity}
                  onChange={(e) =>
                    handleFieldChange("totalQuantity", parseInt(e.target.value || "0", 10))
                  }
                  className="w-20 text-xl font-extrabold text-[#111] bg-white border border-[#ececf0] focus:border-[#007aff] px-2 py-0.5 rounded-[8px] focus:outline-none"
                  title="Altere o total de unidades em inventário"
                />
                <span className="text-xs font-normal text-[#8e8e93]">unid.</span>
              </div>
            </div>

            {/* Allocated to Events */}
            <div className="p-3.5 rounded-[16px] bg-[#f0f7ff] border border-[#d6e7ff]">
              <div className="text-[11px] font-medium text-[#0066cc]">Alocado em Eventos</div>
              <div className="text-xl font-extrabold text-[#0066cc] mt-0.5">
                {totalAllocated} <span className="text-xs font-normal text-[#0066cc]/70">unid.</span>
              </div>
            </div>

            {/* Immediate Available Right Now */}
            <div className="p-3.5 rounded-[16px] bg-[#eaf8ee] border border-[#cbeed4]">
              <div className="flex items-center justify-between text-[11px] font-medium text-[#24793a]">
                <span>Disponível Imediato</span>
                {isLowStock && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                    Abaixo do Mín.
                  </span>
                )}
              </div>
              <div className="text-xl font-extrabold text-[#24793a] mt-0.5">
                {availableRightNow} <span className="text-xs font-normal text-[#24793a]/70">unid.</span>
              </div>
            </div>

            {/* Damaged & Maintenance / Minimum Stock Threshold */}
            <div
              className={`p-3.5 rounded-[16px] border ${
                damaged > 0
                  ? "bg-rose-50 border-rose-200 text-rose-900"
                  : "bg-[#fafafc] border-[#ececf0] text-[#111]"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-medium text-[#8e8e93]">
                <span>Danificados / Triagem</span>
                <button
                  type="button"
                  onClick={() => setShowTriageModal(true)}
                  className="text-[10px] font-semibold text-rose-600 hover:underline cursor-pointer"
                >
                  Triagem →
                </button>
              </div>
              <div
                className={`text-xl font-extrabold mt-0.5 ${
                  damaged > 0 ? "text-rose-700" : "text-[#111]"
                }`}
              >
                {damaged} <span className="text-xs font-normal opacity-70">unid.</span>
              </div>
            </div>
          </div>

          {/* Secondary Details: Minimum Stock Alert Configuration */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs bg-[#fafafc] border border-[#ececf0] p-3 rounded-[14px]">
            <div className="flex items-center gap-2 text-[#3a3a3c]">
              <ShieldAlert className="w-4 h-4 text-[#8e8e93]" />
              <span className="font-semibold">Nível Mínimo para Alerta de Stock Baixo:</span>
              <input
                type="number"
                min="0"
                value={item.minStock || 0}
                onChange={(e) =>
                  handleFieldChange("minStock", parseInt(e.target.value || "0", 10))
                }
                className="w-16 bg-white border border-[#ececf0] px-2 py-1 rounded-[8px] text-xs font-bold text-[#111] text-center focus:outline-none focus:border-[#007aff]"
              />
              <span className="text-[#8e8e93]">unidades</span>
            </div>

            <div className="text-[11px] text-[#8e8e93]">
              {availableRightNow < (item.minStock || 0) ? (
                <span className="text-amber-700 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Alerta ativo: Stock atual está abaixo do limite configurado.
                </span>
              ) : (
                <span className="text-emerald-700 font-medium flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Nível de stock saudável.
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* ALLOCATED EVENTS PIPELINE */}
        {/* ================================================================= */}
        <section className="bg-white border border-[#ececf0] rounded-[24px] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#111]" />
                <h2 className="text-lg font-bold text-[#111]">
                  Eventos com Alocação Deste Artigo
                </h2>
              </div>
              <p className="text-xs text-[#8e8e93] mt-0.5">
                Histórico e reservas programadas para montagem, produção e devolução
              </p>
            </div>

            <span className="text-xs font-bold px-3 py-1 bg-[#fafafc] border border-[#ececf0] rounded-full self-start sm:self-auto text-[#636366]">
              {allocations.length} alocação(ões) registada(s)
            </span>
          </div>

          {allocations.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-[#ececf0] rounded-[18px] bg-[#fafafc]">
              <Package className="w-10 h-10 text-[#8e8e93] mx-auto mb-2 opacity-40" />
              <div className="text-sm font-bold text-[#111]">Nenhuma alocação ativa</div>
              <p className="text-xs text-[#8e8e93] max-w-sm mx-auto mt-1 mb-4">
                Este artigo está totalmente desimpedido no armazém e pronto a ser reservado para novos eventos.
              </p>
              <Link
                href="/eventos"
                className="px-4 py-2 rounded-[12px] bg-[#111] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
              >
                <span>Ver Eventos em Planeamento</span>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#ececf0] border border-[#ececf0] rounded-[16px] overflow-hidden">
              {allocations.map((a) => {
                const subtotal = a.quantity * item.unitPrice;
                return (
                  <div
                    key={a.id}
                    className="p-4 bg-white hover:bg-[#fafafc] transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/eventos/${a.eventId}`}
                          prefetch={false}
                          className="font-bold text-sm text-[#111] hover:text-[#007aff] transition flex items-center gap-1"
                        >
                          <span>{a.eventName}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-50" />
                        </Link>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f2f2f5] text-[#636366] capitalize">
                          {a.eventStatus}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#8e8e93] mt-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatDate(a.eventStartDate)}</span>
                        </div>
                        {a.eventVenue && (
                          <div className="flex items-center gap-1">
                            <span>•</span>
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{a.eventVenue}</span>
                          </div>
                        )}
                        {a.notes && (
                          <div className="italic text-[#636366] bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200/60">
                            Nota: {a.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#ececf0]">
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-[#111]">
                          {a.quantity} <span className="text-xs font-normal text-[#8e8e93]">unid.</span>
                        </div>
                        <div className="text-[11px] text-[#24793a] font-semibold">
                          €{subtotal.toFixed(2)}
                        </div>
                      </div>

                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                          a.status === "despachado"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : a.status === "devolvido"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : a.status === "danificado"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {a.status === "reservado"
                          ? "Reservado"
                          : a.status === "despachado"
                          ? "Despachado"
                          : a.status === "devolvido"
                          ? "Devolvido"
                          : "Danificado"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* ================================================================= */}
      {/* ENLARGED PHOTO LIGHTBOX MODAL */}
      {/* ================================================================= */}
      {showPhotoLightbox && item.imageUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-150"
          onClick={() => setShowPhotoLightbox(false)}
        >
          {/* Modal Card */}
          <div
            className="relative max-w-4xl w-full max-h-[92vh] flex flex-col bg-[#1c1c1e] text-white rounded-[24px] overflow-hidden shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-black/40 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-white/80" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{item.name}</h3>
                  <div className="flex items-center gap-2 text-[11px] text-[#a1a1a6]">
                    <span>Código: {item.sku}</span>
                    <span>·</span>
                    <span>{item.category}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowPhotoLightbox(false);
                    setShowImagePicker(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition cursor-pointer"
                  title="Alterar fotografia"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Alterar foto</span>
                </button>
                <a
                  href={item.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
                  title="Abrir imagem original"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setShowPhotoLightbox(false)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
                  title="Fechar (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Photo Container */}
            <div className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-black/60 min-h-[300px] max-h-[75vh] overflow-hidden">
              <img
                src={item.imageUrl}
                alt={item.name}
                className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-lg"
              />
            </div>

            {/* Footer */}
            <div className="px-5 py-2.5 border-t border-white/10 bg-black/40 text-center text-[11px] text-[#8e8e93]">
              Pressione <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">Esc</kbd> ou clique fora para fechar
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* IMAGE PICKER POPOVER / MODAL */}
      {/* ================================================================= */}
      {showImagePicker && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[22px] w-full max-w-md border border-[#ececf0] shadow-xl overflow-hidden p-6 text-xs space-y-4">
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

            <div className="flex items-center justify-between border-b border-[#ececf0] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#111]">Imagem do Artigo</h3>
                <p className="text-[11px] text-[#8e8e93]">Tire uma foto com a câmara ou escolha um ficheiro</p>
              </div>
              <button
                type="button"
                onClick={() => setShowImagePicker(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Photo Capture / Upload buttons */}
            <div className="space-y-2">
              <label className="block font-bold text-[#3a3a3c]">Fotografia do Dispositivo</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => photoCameraInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="p-3 rounded-xl border border-dashed border-[#c6c6c8] hover:border-[#007aff] bg-[#f9f9fb] hover:bg-white text-[#111] hover:text-[#007aff] flex flex-col items-center justify-center gap-1 text-xs font-semibold transition cursor-pointer"
                >
                  <Camera className="w-5 h-5 text-[#007aff]" />
                  <span>Tirar Foto (Câmara)</span>
                </button>
                <button
                  type="button"
                  onClick={() => photoFileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="p-3 rounded-xl border border-dashed border-[#c6c6c8] hover:border-[#007aff] bg-[#f9f9fb] hover:bg-white text-[#111] hover:text-[#007aff] flex flex-col items-center justify-center gap-1 text-xs font-semibold transition cursor-pointer"
                >
                  <Upload className="w-5 h-5 text-[#636366]" />
                  <span>Carregar da Galeria</span>
                </button>
              </div>
              {isUploadingPhoto && (
                <div className="flex items-center justify-center gap-2 py-1 text-xs text-[#007aff] font-semibold">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>A processar fotografia...</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-[#ececf0]">
              <label className="block font-bold text-[#3a3a3c] mb-1.5">Ou introduza URL da Foto</label>
              <input
                type="url"
                value={customImageUrl}
                onChange={(e) => setCustomImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full px-3.5 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#3a3a3c] mb-2">Exemplos Rápidos:</label>
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                {PRESET_IMAGE_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.label}
                    type="button"
                    onClick={() => {
                      setCustomImageUrl(tmpl.url);
                      handleFieldChange("imageUrl", tmpl.url, true);
                      setShowImagePicker(false);
                    }}
                    className="p-2 rounded-[12px] border border-[#ececf0] hover:border-[#007aff] bg-[#fafafa] flex items-center gap-2 text-left cursor-pointer transition"
                  >
                    <img
                      src={tmpl.url}
                      alt={tmpl.label}
                      className="w-8 h-8 rounded-[8px] object-cover shrink-0"
                    />
                    <span className="text-[11px] font-medium text-[#111] truncate">{tmpl.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-[#ececf0] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowImagePicker(false)}
                className="px-4 py-2 rounded-[10px] bg-[#f2f2f5] text-[#3a3a3c] font-semibold hover:bg-[#e5e5ea] cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleFieldChange("imageUrl", customImageUrl, true);
                  setShowImagePicker(false);
                }}
                className="px-4 py-2 rounded-[10px] bg-[#111] hover:bg-black text-white font-bold cursor-pointer"
              >
                Aplicar Imagem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* DELETE CONFIRMATION MODAL WITH UPCOMING EVENTS CAUTION (SOFT DELETE) */}
      {/* ================================================================= */}
      {showDeleteModal && (
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
                    {item.name} ({item.sku})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Caution if item is being used in upcoming events */}
            {upcomingAllocations.length > 0 ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-xs text-amber-900">
                      Atenção: Este artigo está atualmente alocado a {upcomingAllocations.length} evento(s) futuro(s)!
                    </h4>
                    <p className="text-[11px] text-amber-800 mt-1">
                      O artigo continua programado para a produção dos seguintes eventos:
                    </p>
                  </div>
                </div>

                <div className="bg-white/80 rounded-xl p-2.5 divide-y divide-amber-200/50 max-h-40 overflow-y-auto">
                  {upcomingAllocations.map((alloc) => (
                    <div key={alloc.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-[11px]">
                      <div>
                        <strong className="text-[#111]">{alloc.eventName}</strong>
                        <div className="text-[10px] text-[#636366]">
                          {new Date(alloc.eventStartDate).toLocaleDateString("pt-PT")} {alloc.eventVenue ? `· ${alloc.eventVenue}` : ""}
                        </div>
                      </div>
                      <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full text-[10px]">
                        {alloc.quantity} un.
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
                  Tem a certeza que deseja remover <strong>"{item.name}"</strong> do inventário ativo?
                </p>
                <p className="text-[11px] text-[#8e8e93]">
                  Será aplicado um <strong>soft delete</strong> que preserva o histórico de eventos anteriores onde o artigo foi utilizado.
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-[#ececf0] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-[12px] bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[#3a3a3c] font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-[12px] bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
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

      {/* ================================================================= */}
      {/* TRIAGE MODAL */}
      {/* ================================================================= */}
      {showTriageModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[22px] w-full max-w-sm border border-[#ececf0] shadow-xl overflow-hidden p-6 text-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#111]">Registo de Danos</h3>
                <p className="text-[11px] text-[#8e8e93] font-semibold">{item.name} ({item.sku})</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTriageModal(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-[12px] bg-[#fafafc] border border-[#ececf0] mb-4 space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8e8e93]">Danificados atuais:</span>
                <strong className="text-rose-600">{item.damagedQuantity || 0} un.</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8e8e93]">Stock total:</span>
                <strong>{item.totalQuantity} un.</strong>
              </div>
            </div>

            <div className="space-y-3">
              {damaged > 0 && (
                <button
                  type="button"
                  onClick={handleRepairAll}
                  disabled={isPending}
                  className="w-full py-2.5 rounded-[12px] bg-[#217a3b] hover:bg-[#1b6230] text-white font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Reparar Tudo (Repor {damaged} un. no Stock)</span>
                </button>
              )}

              <form onSubmit={handleReportDamage} className="space-y-2 pt-2 border-t border-[#ececf0]">
                <label className="block font-bold text-[#3a3a3c]">Registar Novo Dano</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={item.totalQuantity}
                    value={damageQuantity}
                    onChange={(e) => setDamageQuantity(parseInt(e.target.value || "1", 10))}
                    className="w-20 px-3 py-2 bg-white border border-[#ececf0] rounded-[10px] text-xs"
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 py-2 rounded-[10px] bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Registar Dano
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SKU / ITEM CODE CONFIRMATION MODAL */}
      {/* ================================================================= */}
      {showSkuConfirmModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] w-full max-w-md border border-[#ececf0] shadow-2xl overflow-hidden p-6 text-xs space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#ececf0] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#111]">Alterar Código do Artigo</h3>
                  <p className="text-[11px] text-[#8e8e93] truncate max-w-[240px]">
                    {item.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSkuConfirmModal(false);
                  setPendingSku("");
                  setSkuError(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Warning Box */}
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Atenção: Impacto em Leituras e Scanners</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                A alteração do código ou código de barras deste artigo pode quebrar qualquer leitura futura por scanner se já existirem etiquetas físicas, autocolantes ou impressões com o código atual.
              </p>
            </div>

            {/* Form Fields */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-[#8e8e93] mb-1">
                  Código Atual
                </label>
                <div className="px-3 py-2 bg-[#f2f2f7] border border-[#ececf0] rounded-[10px] font-mono text-xs font-bold text-[#636366]">
                  {item.sku}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#3a3a3c] mb-1">
                  Novo Código / Barcode *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={pendingSku}
                  onChange={(e) => {
                    setPendingSku(e.target.value.toUpperCase());
                    if (skuError) setSkuError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleConfirmSkuUpdate();
                    }
                  }}
                  placeholder="Ex: SKU-001 ou 5601234567890"
                  className="w-full px-3 py-2 text-xs font-mono font-bold uppercase bg-white border border-[#ececf0] focus:border-[#007aff] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
                {skuError && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1">
                    {skuError}
                  </p>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-[#ececf0] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSkuConfirmModal(false);
                  setPendingSku("");
                  setSkuError(null);
                }}
                disabled={isUpdatingSku}
                className="px-4 py-2 rounded-[12px] bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[#3a3a3c] font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSkuUpdate}
                disabled={isUpdatingSku || !pendingSku.trim() || pendingSku.trim().toUpperCase() === item.sku}
                className="px-4 py-2 rounded-[12px] bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdatingSku ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>A atualizar...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirmar Alteração</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      <AuditLogModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        entityType="inventory"
        entityId={item.id}
        entityTitle={item.name}
      />

      {/* Storage Locations & Facility Managers Modal */}
      {showLocationsModal && (
        <StorageLocationsModal
          isOpen={showLocationsModal}
          onClose={() => setShowLocationsModal(false)}
          locations={locationsList}
          items={[item]}
          users={teamUsers}
          initialMode={locationsModalMode}
          onLocationsChange={(updated) => {
            setLocationsList(updated);
          }}
        />
      )}
    </div>
  );
}
