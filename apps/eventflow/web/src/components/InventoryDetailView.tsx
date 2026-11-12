"use client";

import React, { useState, useTransition, useRef, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
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
} from "lucide-react";
import AuditLogModal from "@/components/AuditLogModal";
import StorageLocationsModal, { StorageLocation, TeamUser } from "@/components/StorageLocationsModal";
import { formatRelativeTime } from "@/lib/date-format";
import { updateItemPatchAction, updateItemTriageAction } from "@/app/actions";

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
}: InventoryDetailViewProps) {
  const [item, setItem] = useState<InventoryItem>(initialItem);
  const [locationsList, setLocationsList] = useState<StorageLocation[]>(initialLocations);
  const [showLocationsModal, setShowLocationsModal] = useState(false);
  const [locationsModalMode, setLocationsModalMode] = useState<"list" | "create">("list");
  const [copiedId, setCopiedId] = useState(false);
  const [copiedSku, setCopiedSku] = useState(false);
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState(item.imageUrl || "");
  const [damageQuantity, setDamageQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();

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
            className="inline-flex items-center gap-1.5 sm:gap-2 text-xs font-semibold text-[#636366] hover:text-[#111111] transition bg-[#f2f2f5] hover:bg-[#e5e5ea] px-2.5 sm:px-3 py-1.5 rounded-full flex-shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar<span className="hidden sm:inline"> ao Catálogo de Stock</span></span>
          </Link>

          {/* Right Header: Auto-save status, Last Updated & Audit History */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Auto-save Status Badge */}
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#8e8e93] bg-[#f2f2f5] px-2.5 py-1 rounded-full animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin text-[#007aff]" />
                <span>A guardar...</span>
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-full">
                <Check className="w-3 h-3 text-emerald-600" />
                <span className="hidden sm:inline">Guardado automaticamente</span>
                <span className="sm:hidden">Guardado</span>
              </span>
            )}
            {saveStatus === "error" && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                <span>Erro ao guardar</span>
              </span>
            )}

            {/* Audit History */}
            <span className="hidden lg:inline text-[11px] text-[#8e8e93] pl-2 border-l border-[#ececf0]">
              Last updated by <strong className="text-[#3a3a3c] font-semibold">{item.lastUpdatedByName || "Administrador CFM"}</strong> {formatRelativeTime(item.updatedAt, "en")}
            </span>
            <button
              type="button"
              onClick={() => setShowAuditModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#007aff] hover:text-[#005bb5] bg-[#f2f2f5] hover:bg-[#e5e5ea] px-3 py-1.5 rounded-[12px] transition cursor-pointer"
              title="Ver histórico de alterações do artigo"
            >
              <History className="w-3.5 h-3.5" />
              <span>Histórico</span>
            </button>
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
              {/* Item Thumbnail Image with Hover Change Option */}
              <div className="relative group shrink-0">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-[18px] object-cover border border-black/5 shadow-2xs"
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[18px] bg-[#f2f2f7] flex items-center justify-center text-[#8e8e93] font-bold text-xl">
                    <Package className="w-10 h-10 stroke-[1.5]" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowImagePicker(true)}
                  className="absolute inset-0 bg-black/40 rounded-[18px] text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition backdrop-blur-2xs cursor-pointer"
                  title="Alterar imagem do artigo"
                >
                  <Camera className="w-5 h-5 mb-0.5" />
                  <span className="text-[10px] font-bold">Alterar foto</span>
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

                  {/* Copyable ID Badge */}
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-[#fafafc] hover:bg-[#f2f2f5] text-[#8e8e93] hover:text-[#111] border border-[#ececf0] transition flex items-center gap-1.5 cursor-pointer"
                    title="Clique para copiar o ID único do artigo"
                  >
                    <span>#{item.id}</span>
                    {copiedId ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>

                  {/* SKU Input */}
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#fafafc] border border-[#ececf0] text-xs font-mono">
                    <span className="text-[#8e8e93] font-bold">SKU:</span>
                    <input
                      type="text"
                      value={item.sku}
                      onChange={(e) => handleFieldChange("sku", e.target.value.toUpperCase())}
                      placeholder="SKU-001"
                      className="w-24 bg-transparent font-bold text-[#111] focus:outline-none uppercase"
                      title="Edite o SKU"
                    />
                    <button
                      type="button"
                      onClick={handleCopySku}
                      className="text-[#8e8e93] hover:text-[#111] ml-0.5 cursor-pointer"
                      title="Copiar SKU"
                    >
                      {copiedSku ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
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
                  {/* Warehouse Location Selector */}
                  <div className="inline-flex items-center gap-1.5 bg-[#f0f7ff] text-[#0066cc] border border-[#d6e7ff] px-2.5 py-1 rounded-[10px]">
                    <MapPin className="w-3.5 h-3.5 text-[#0066cc] shrink-0" />
                    <input
                      type="text"
                      list="locations-datalist"
                      value={item.warehouseLocation || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const matchedLoc = locationsList.find(
                          (l) => l.name.toLowerCase() === val.toLowerCase()
                        );
                        handleFieldChange("warehouseLocation", val);
                        if (matchedLoc) {
                          handleFieldChange("locationId", matchedLoc.id, true);
                        }
                      }}
                      placeholder="Local de armazenamento..."
                      className="bg-transparent text-xs font-semibold text-[#0066cc] placeholder:text-[#0066cc]/50 focus:outline-none min-w-[170px]"
                      title="Edite a localização física no armazém"
                    />
                    <datalist id="locations-datalist">
                      {locationsList.map((loc) => (
                        <option key={loc.id} value={loc.name}>
                          {loc.name} (Gestor: {loc.managerName})
                        </option>
                      ))}
                    </datalist>
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
                </div>
              </div>
            </div>

            {/* Price & Action Badge */}
            <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-[#ececf0] shrink-0">
              <div className="text-left md:text-right">
                <div className="flex items-center md:justify-end gap-1">
                  <span className="text-xl font-bold text-[#111]">€</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unitPrice}
                    onChange={(e) =>
                      handleFieldChange("unitPrice", parseFloat(e.target.value) || 0)
                    }
                    className="text-2xl font-extrabold text-[#111] bg-transparent border-b border-transparent hover:border-[#ececf0] focus:border-[#007aff] focus:bg-[#fafafa] px-1 rounded-[6px] focus:outline-none w-24 text-right"
                    title="Preço unitário por dia (guarda automaticamente)"
                  />
                  <span className="text-xs font-normal text-[#8e8e93]">/dia</span>
                </div>

                <div className="flex items-center md:justify-end gap-1 text-[11px] text-[#8e8e93] mt-0.5">
                  <span>Reposição: €</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.replacementCost || 0}
                    onChange={(e) =>
                      handleFieldChange("replacementCost", parseFloat(e.target.value) || 0)
                    }
                    className="w-16 bg-transparent border-b border-transparent hover:border-[#ececf0] focus:border-[#007aff] focus:bg-[#fafafa] px-1 rounded-[4px] focus:outline-none text-right font-medium text-[#3a3a3c]"
                    title="Custo de reposição em caso de perda ou perda total"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowTriageModal(true)}
                className="px-4 py-2 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Gestão de Triagem</span>
              </button>
            </div>
          </div>

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
                          className="font-bold text-sm text-[#111] hover:text-[#007aff] transition flex items-center gap-1"
                        >
                          <span>{a.eventName}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-50" />
                        </Link>

                        {/* Event Unique ID Badge */}
                        <Link
                          href={`/eventos/${a.eventId}`}
                          className="font-mono text-[10px] text-[#8e8e93] bg-[#fafafc] hover:bg-[#f2f2f5] px-1.5 py-0.5 rounded border border-[#ececf0] transition"
                        >
                          #{a.eventId}
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
      {/* IMAGE PICKER POPOVER / MODAL */}
      {/* ================================================================= */}
      {showImagePicker && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[22px] w-full max-w-md border border-[#ececf0] shadow-xl overflow-hidden p-6 text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#ececf0] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#111]">Imagem do Artigo</h3>
                <p className="text-[11px] text-[#8e8e93]">Insira um link ou escolha uma imagem de exemplo</p>
              </div>
              <button
                type="button"
                onClick={() => setShowImagePicker(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block font-bold text-[#3a3a3c] mb-1.5">URL da Foto</label>
              <input
                type="url"
                value={customImageUrl}
                onChange={(e) => setCustomImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full px-3.5 py-2.5 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#3a3a3c] mb-2">Exemplos Rápidos:</label>
              <div className="grid grid-cols-2 gap-2">
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
      {/* TRIAGE MODAL */}
      {/* ================================================================= */}
      {showTriageModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[22px] w-full max-w-sm border border-[#ececf0] shadow-xl overflow-hidden p-6 text-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#111]">Triagem e Danos</h3>
                <p className="text-[11px] text-[#8e8e93]">Artigo #{item.id}</p>
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
