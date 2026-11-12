"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Copy,
  Check,
  Calendar,
  MapPin,
  Edit3,
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
} from "lucide-react";
import AuditLogModal from "@/components/AuditLogModal";
import { formatRelativeTime } from "@/lib/date-format";
import { updateItemAction, updateItemTriageAction } from "@/app/actions";

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
}

export default function InventoryDetailView({
  item: initialItem,
  allocations,
}: InventoryDetailViewProps) {
  const [item, setItem] = useState<InventoryItem>(initialItem);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedSku, setCopiedSku] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [damageQuantity, setDamageQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();

  const damaged = item.damagedQuantity || 0;
  const inMaintenance = item.inMaintenanceQuantity || 0;
  const totalAllocated = allocations.reduce((acc, a) => acc + a.quantity, 0);
  const availableRightNow = Math.max(0, item.totalQuantity - damaged - inMaintenance);
  const isLowStock = availableRightNow < (item.minStock || 0);

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

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <span className="hidden md:inline text-[11px] text-[#8e8e93]">
              Last updated by <strong className="text-[#3a3a3c] font-semibold">{item.lastUpdatedByName || "Administrador CFM"}</strong> {formatRelativeTime(item.updatedAt, "en")}
            </span>
            <button
              onClick={() => setShowAuditModal(true)}
              className="inline-flex items-center gap-1 sm:gap-1.5 text-xs font-semibold text-[#007aff] hover:text-[#005bb5] bg-[#f2f2f5] hover:bg-[#e5e5ea] px-2.5 sm:px-3 py-1.5 rounded-[12px] transition cursor-pointer"
              title="Ver histórico de alterações"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Histórico</span>
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-1 sm:gap-1.5 text-xs font-semibold text-[#111] bg-white border border-[#ececf0] hover:bg-[#f2f2f5] px-2.5 sm:px-3.5 py-1.5 rounded-[12px] shadow-2xs transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar<span className="hidden sm:inline"> Artigo</span></span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1100px] mx-auto px-4 pt-6 space-y-6">
        {/* ================================================================= */}
        {/* HERO CARD */}
        {/* ================================================================= */}
        <section className="bg-white border border-[#ececf0] rounded-[24px] p-6 shadow-xs">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 min-w-0">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-[18px] object-cover border border-black/5 shadow-2xs flex-shrink-0"
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[18px] bg-[#f2f2f7] flex items-center justify-center text-[#8e8e93] font-bold text-xl flex-shrink-0">
                  <Package className="w-10 h-10 stroke-[1.5]" />
                </div>
              )}

              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-[#f2f2f5] text-[#111]">
                    {item.category}
                  </span>

                  {/* Copyable ID Badge */}
                  <button
                    onClick={handleCopyId}
                    className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-[#fafafc] hover:bg-[#f2f2f5] text-[#8e8e93] hover:text-[#111] border border-[#ececf0] transition flex items-center gap-1.5 cursor-pointer"
                    title="Clique para copiar o ID único do artigo"
                  >
                    <span>#{item.id}</span>
                    {copiedId ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>

                  {/* Copyable SKU */}
                  <button
                    onClick={handleCopySku}
                    className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#fafafc] hover:bg-[#f2f2f5] text-[#111] border border-[#ececf0] transition flex items-center gap-1.5 cursor-pointer"
                    title="Clique para copiar o SKU"
                  >
                    <span>SKU: {item.sku}</span>
                    {copiedSku ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-[#8e8e93]" />
                    )}
                  </button>
                </div>

                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#111]">
                  {item.name}
                </h1>

                <div className="flex flex-wrap items-center gap-3 text-xs text-[#8e8e93]">
                  {item.warehouseLocation && (
                    <div className="flex items-center gap-1 text-[#007aff] font-medium">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{item.warehouseLocation}</span>
                    </div>
                  )}
                  {item.dimensions && (
                    <div className="flex items-center gap-1">
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>{item.dimensions}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Price & Action Badge */}
            <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-[#ececf0]">
              <div className="text-left md:text-right">
                <div className="text-2xl font-extrabold text-[#111]">
                  €{item.unitPrice.toFixed(2)}
                  <span className="text-xs font-normal text-[#8e8e93] ml-1">/unid. dia</span>
                </div>
                {item.replacementCost && item.replacementCost > 0 && (
                  <div className="text-[11px] text-[#8e8e93] mt-0.5">
                    Valor de reposição: €{item.replacementCost.toFixed(2)}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowTriageModal(true)}
                className="px-4 py-2 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Gestão de Triagem</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-[#ececf0]">
            <div className="p-3.5 rounded-[16px] bg-[#fafafc] border border-[#ececf0]">
              <div className="text-[11px] font-medium text-[#8e8e93]">Stock Total</div>
              <div className="text-xl font-extrabold text-[#111] mt-0.5">
                {item.totalQuantity} <span className="text-xs font-normal text-[#8e8e93]">unid.</span>
              </div>
            </div>

            <div className="p-3.5 rounded-[16px] bg-[#f0f7ff] border border-[#d6e7ff]">
              <div className="text-[11px] font-medium text-[#0066cc]">Alocado em Eventos</div>
              <div className="text-xl font-extrabold text-[#0066cc] mt-0.5">
                {totalAllocated} <span className="text-xs font-normal text-[#0066cc]/70">unid.</span>
              </div>
            </div>

            <div className="p-3.5 rounded-[16px] bg-[#eaf8ee] border border-[#cbeed4]">
              <div className="text-[11px] font-medium text-[#24793a]">Disponível Imediato</div>
              <div className="text-xl font-extrabold text-[#24793a] mt-0.5">
                {availableRightNow} <span className="text-xs font-normal text-[#24793a]/70">unid.</span>
              </div>
            </div>

            <div className={`p-3.5 rounded-[16px] border ${
              damaged > 0
                ? "bg-rose-50 border-rose-200 text-rose-900"
                : "bg-[#fafafc] border-[#ececf0] text-[#111]"
            }`}>
              <div className="text-[11px] font-medium text-[#8e8e93]">Danificados / Manutenção</div>
              <div className={`text-xl font-extrabold mt-0.5 ${damaged > 0 ? "text-rose-700" : "text-[#111]"}`}>
                {damaged} <span className="text-xs font-normal opacity-70">unid.</span>
              </div>
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
      {/* EDIT ITEM MODAL */}
      {/* ================================================================= */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[22px] w-full max-w-lg border border-[#ececf0] shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-[#ececf0] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#111]">Editar Artigo de Stock</h3>
                <p className="text-[11px] text-[#8e8e93]">Atualize as especificações e quantidades</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              action={async (formData) => {
                await updateItemAction(formData);
                setShowEditModal(false);
                window.location.reload();
              }}
              className="p-6 overflow-y-auto flex-1 space-y-3.5 text-xs"
            >
              <input type="hidden" name="itemId" value={item.id} />

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">ID Único do Artigo</label>
                <input
                  type="text"
                  value={item.id}
                  disabled
                  className="w-full px-3 py-2 bg-[#f2f2f7] text-[#8e8e93] font-mono border border-[#ececf0] rounded-[10px] cursor-not-allowed select-all text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">SKU</label>
                  <input
                    type="text"
                    value={item.sku}
                    disabled
                    className="w-full px-3 py-2 bg-[#f2f2f7] text-[#8e8e93] font-mono border border-[#ececf0] rounded-[10px] cursor-not-allowed text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">Categoria *</label>
                  <select
                    name="category"
                    defaultValue={item.category}
                    className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px] text-xs"
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
                  name="name"
                  defaultValue={item.name}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px] text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">Localização no Armazém</label>
                  <input
                    type="text"
                    name="warehouseLocation"
                    defaultValue={item.warehouseLocation || ""}
                    placeholder="Ex: Armazém A · B2"
                    className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px] text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">Dimensões</label>
                  <input
                    type="text"
                    name="dimensions"
                    defaultValue={item.dimensions || ""}
                    placeholder="Ex: 40 × 45 × 92 cm"
                    className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px] text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">Qtd. Total *</label>
                  <input
                    type="number"
                    name="totalQuantity"
                    defaultValue={item.totalQuantity}
                    required
                    min={1}
                    className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px] text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">Preço/Dia (€) *</label>
                  <input
                    type="number"
                    name="unitPrice"
                    step="0.01"
                    defaultValue={item.unitPrice}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px] text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">Reposição (€)</label>
                  <input
                    type="number"
                    name="replacementCost"
                    step="0.01"
                    defaultValue={item.replacementCost || 0}
                    className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px] text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">URL da Imagem</label>
                <input
                  type="url"
                  name="imageUrl"
                  defaultValue={item.imageUrl || ""}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px] text-xs"
                />
              </div>

              <div className="pt-3 border-t border-[#ececf0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-[10px] bg-[#f2f2f5] text-[#3a3a3c] font-semibold hover:bg-[#e5e5ea]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[10px] bg-[#111] hover:bg-black text-white font-bold"
                >
                  Guardar Alterações
                </button>
              </div>
            </form>
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
                onClick={() => setShowTriageModal(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93]"
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
    </div>
  );
}
