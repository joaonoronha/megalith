"use client";

import React, { useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Check,
  Share2,
  Copy,
  ExternalLink,
  Package,
  FileText,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { createQuoteAction } from "@/app/actions";
import { generateReferenceCode } from "@/lib/id";

interface AllocationItem {
  id: string;
  itemId: string;
  itemName: string;
  itemSku?: string | null;
  itemUnitPrice?: number | null;
  quantity: number;
}

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  unitPrice: number;
  totalQuantity: number;
}

interface ClientData {
  id: string;
  name: string;
  email?: string | null;
  nif?: string | null;
  phone?: string | null;
}

interface EventData {
  id: string;
  name: string;
  clientId: string | null;
}

interface LineItem {
  itemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface CustomQuoteItem {
  id: string;
  name: string;
  category?: string | null;
  quantity: number;
  unitPrice: number;
  unitCost?: number;
}

interface EventQuoteModalProps {
  event: EventData;
  client: ClientData | null;
  allocations: AllocationItem[];
  customItems?: CustomQuoteItem[];
  allItems: InventoryItem[];
  onClose: () => void;
  onCreated: (newQuote: any) => void;
}

export default function EventQuoteModal({
  event,
  client,
  allocations,
  customItems = [],
  allItems,
  onClose,
  onCreated,
}: EventQuoteModalProps) {
  // Pre-fill lines: If event already has material allocations or custom event items, import them as initial quote lines
  const initialLines: LineItem[] = [];

  if (allocations && allocations.length > 0) {
    allocations.forEach((a) => {
      initialLines.push({
        itemId: a.itemId,
        description: a.itemName,
        quantity: a.quantity || 1,
        unitPrice: a.itemUnitPrice || 0,
      });
    });
  }

  if (customItems && customItems.length > 0) {
    customItems.forEach((c) => {
      initialLines.push({
        description: `${c.name}${c.category && c.category !== "Personalizado" ? ` (${c.category})` : " (Personalizado)"}`,
        quantity: c.quantity || 1,
        unitPrice: c.unitPrice || 0,
      });
    });
  }

  if (initialLines.length === 0) {
    initialLines.push(
      {
        itemId: allItems[0]?.id,
        description: allItems[0]?.name || "Cadeiras Chiavari Douradas",
        quantity: 50,
        unitPrice: allItems[0]?.unitPrice || 6.0,
      },
      {
        description: "Produção de Evento & Montagem Técnica CFM",
        quantity: 1,
        unitPrice: 650.0,
      }
    );
  }

  const [lines, setLines] = useState<LineItem[]>(initialLines);
  const [validityDays, setValidityDays] = useState("15");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<{
    id: string;
    quoteNumber: string;
    accessToken: string;
    subtotal: number;
    vatAmount: number;
    total: number;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const subtotal = lines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
    0
  );
  const vatAmount = subtotal * 0.23;
  const total = subtotal + vatAmount;

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        itemId: allItems[0]?.id,
        description: allItems[0]?.name || "Artigo / Serviço",
        quantity: 1,
        unitPrice: allItems[0]?.unitPrice || 10.0,
      },
    ]);
  };

  const handleImportAllocations = () => {
    const importedLines: LineItem[] = [];

    if (allocations.length > 0) {
      allocations.forEach((a) => {
        importedLines.push({
          itemId: a.itemId,
          description: a.itemName,
          quantity: a.quantity || 1,
          unitPrice: a.itemUnitPrice || 0,
        });
      });
    }

    if (customItems.length > 0) {
      customItems.forEach((c) => {
        importedLines.push({
          description: `${c.name}${c.category && c.category !== "Personalizado" ? ` (${c.category})` : " (Personalizado)"}`,
          quantity: c.quantity || 1,
          unitPrice: c.unitPrice || 0,
        });
      });
    }

    if (importedLines.length > 0) {
      setLines(importedLines);
    }
  };

  const handleRemoveLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateLine = (idx: number, field: keyof LineItem, val: any) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        if (field === "itemId") {
          const selectedItem = allItems.find((it) => it.id === val);
          return {
            ...l,
            itemId: val,
            description: selectedItem ? selectedItem.name : l.description,
            unitPrice: selectedItem ? selectedItem.unitPrice : l.unitPrice,
          };
        }
        return { ...l, [field]: val };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) {
      setErrorMessage("Adicione pelo menos uma linha de artigo ou serviço ao orçamento.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const quoteNumber = generateReferenceCode("ORC");
      const formData = new FormData();
      formData.set("quoteNumber", quoteNumber);
      formData.set("eventId", event.id);
      if (client?.id || event.clientId) {
        formData.set("clientId", (client?.id || event.clientId) as string);
      }
      formData.set("validityDays", validityDays);
      formData.set("lines", JSON.stringify(lines));

      const res = await createQuoteAction(formData);

      const newQuoteData = {
        id: res.id,
        quoteNumber,
        eventId: event.id,
        clientId: client?.id || event.clientId,
        accessToken: res.accessToken,
        status: "enviado",
        subtotal,
        vatAmount,
        total,
        createdAt: new Date(),
      };

      setCreatedResult({
        id: res.id,
        quoteNumber,
        accessToken: res.accessToken,
        subtotal,
        vatAmount,
        total,
      });

      onCreated(newQuoteData);
    } catch (err: any) {
      console.error("Erro ao gerar orçamento:", err);
      setErrorMessage(err?.message || "Não foi possível gerar o orçamento. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!createdResult) return;
    const url = `${window.location.origin}/proposta/${createdResult.accessToken}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-[24px] w-full max-w-2xl border border-[#ececf0] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#ececf0] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-[#007aff] border border-blue-100">
                Configuração do Evento · Proposta Comercial
              </span>
            </div>
            <h2 className="text-[17px] font-bold text-[#111111] mt-1">
              Gerar Orçamento: {event.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success View */}
        {createdResult ? (
          <div className="p-6 overflow-y-auto flex-1 space-y-5">
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <Check className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#111111]">
                  Orçamento Gerado com Sucesso!
                </h3>
                <p className="text-xs text-[#8e8e93] mt-1">
                  Referência: <strong className="text-[#111]">{createdResult.quoteNumber}</strong> associada a este evento.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-[16px] bg-[#fafafc] border border-[#ececf0] space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#8e8e93]">Subtotal:</span>
                <span className="font-semibold text-[#111]">€{createdResult.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#8e8e93]">IVA (23%):</span>
                <span className="font-semibold text-[#111]">€{createdResult.vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold pt-2 border-t border-[#ececf0]">
                <span>Total com IVA:</span>
                <span className="text-[#137333]">€{createdResult.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#111]">Link Público da Proposta</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== "undefined" ? `${window.location.origin}/proposta/${createdResult.accessToken}` : ""}
                  className="w-full text-xs font-mono bg-[#f8f8fa] border border-[#ececf0] rounded-[10px] px-3 py-2 text-[#48484a]"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 rounded-[10px] bg-[#111] hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-[#ececf0] flex items-center justify-end gap-2.5">
              <a
                href={`/proposta/${createdResult.accessToken}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-[12px] bg-[#f2f2f5] hover:bg-[#e5e5ea] text-xs font-semibold text-[#111] flex items-center gap-1.5 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir Proposta</span>
              </a>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold transition cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
            {errorMessage && (
              <div className="p-3 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Event & Client Context */}
            <div className="p-3.5 rounded-[16px] bg-[#fafafc] border border-[#ececf0] flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[11px] text-[#8e8e93] block">Evento Destinatário</span>
                <span className="text-xs font-bold text-[#111]">{event.name}</span>
              </div>
              <div>
                <span className="text-[11px] text-[#8e8e93] block">Cliente</span>
                <span className="text-xs font-bold text-[#111]">
                  {client ? client.name : "Cliente associado ao evento"}
                  {client?.nif ? ` (NIF ${client.nif})` : ""}
                </span>
              </div>
              <div className="w-full sm:w-auto">
                <label className="text-[11px] text-[#8e8e93] block mb-1">Validade (dias)</label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value)}
                  className="w-20 px-2 py-1 bg-white border border-[#ececf0] rounded-lg text-xs font-semibold text-center"
                />
              </div>
            </div>

            {/* Lines Header & Allocation Import */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#111111]">
                  Linhas de Artigos & Serviços ({lines.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {(allocations.length > 0 || customItems.length > 0) && (
                  <button
                    type="button"
                    onClick={handleImportAllocations}
                    className="px-2.5 py-1 rounded-[8px] bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[11px] font-semibold text-[#111] flex items-center gap-1 transition cursor-pointer"
                    title="Preencher com os artigos reservados e artigos personalizados deste evento"
                  >
                    <Package className="w-3 h-3 text-[#007aff]" />
                    <span>
                      Importar Artigos ({allocations.length + customItems.length}
                      {customItems.length > 0 ? ` · ${customItems.length} exclus.` : ""})
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="px-2.5 py-1 rounded-[8px] bg-[#007aff] hover:bg-[#0066d6] text-white text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3 h-3" />
                  <span>Adicionar Linha</span>
                </button>
              </div>
            </div>

            {/* Line Items List */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#f8f8fa] border border-[#ececf0] rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-2"
                >
                  {/* Select or type description */}
                  <div className="flex-1 w-full sm:w-auto space-y-1">
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => handleUpdateLine(idx, "description", e.target.value)}
                      placeholder="Descrição do artigo ou serviço"
                      className="w-full px-2.5 py-1.5 bg-white border border-[#ececf0] rounded-lg text-xs font-medium"
                    />
                    {allItems.length > 0 && (
                      <select
                        value={line.itemId || ""}
                        onChange={(e) => handleUpdateLine(idx, "itemId", e.target.value || undefined)}
                        className="w-full text-[11px] text-[#8e8e93] bg-white border border-[#ececf0] rounded-md px-2 py-0.5"
                      >
                        <option value="">Artigo personalizado / serviço técnico...</option>
                        {allItems.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.sku}) — €{it.unitPrice.toFixed(2)}/un
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Quantity */}
                  <div className="w-24 shrink-0">
                    <label className="text-[10px] text-[#8e8e93] block sm:hidden">Qtd</label>
                    <input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) =>
                        handleUpdateLine(idx, "quantity", parseInt(e.target.value || "1", 10))
                      }
                      className="w-full px-2 py-1.5 bg-white border border-[#ececf0] rounded-lg text-xs font-semibold text-center"
                      title="Quantidade"
                    />
                  </div>

                  {/* Unit Price */}
                  <div className="w-28 shrink-0">
                    <label className="text-[10px] text-[#8e8e93] block sm:hidden">Preço Unit. (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.unitPrice}
                      onChange={(e) =>
                        handleUpdateLine(idx, "unitPrice", parseFloat(e.target.value || "0"))
                      }
                      className="w-full px-2 py-1.5 bg-white border border-[#ececf0] rounded-lg text-xs font-semibold text-right"
                      title="Preço unitário em Euros"
                    />
                  </div>

                  {/* Subtotal */}
                  <div className="w-24 text-right shrink-0">
                    <span className="text-xs font-bold text-[#111]">
                      €{((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)).toFixed(2)}
                    </span>
                  </div>

                  {/* Delete Line */}
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    className="p-1.5 text-[#8e8e93] hover:text-rose-600 rounded-md hover:bg-rose-50 transition cursor-pointer self-end sm:self-center"
                    title="Remover linha"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="p-4 bg-[#f8f8fa] border border-[#ececf0] rounded-[16px] space-y-2">
              <div className="flex justify-between text-xs text-[#8e8e93]">
                <span>Subtotal (Artigos & Serviços)</span>
                <span className="font-semibold text-[#111]">€{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#8e8e93]">
                <span>IVA (23% Portugal)</span>
                <span className="font-semibold text-[#111]">€{vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-[#ececf0] text-[#111111]">
                <span>Total da Proposta</span>
                <span className="text-[#137333]">€{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-[#ececf0] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-[12px] bg-[#f2f2f5] hover:bg-[#e5e5ea] text-xs font-semibold text-[#111] transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>A emitir orçamento...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5" />
                    <span>Emitir & Gerar Proposta Digital</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
