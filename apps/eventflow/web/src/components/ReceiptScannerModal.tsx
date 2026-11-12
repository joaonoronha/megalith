"use client";

import React, { useState, useTransition, useRef } from "react";
import {
  X,
  Sparkles,
  Upload,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Check,
  AlertTriangle,
  ArrowRight,
  Plus,
  RefreshCw,
  Building,
  Calendar,
  Euro,
  Hash,
  Package,
  Layers,
  MapPin,
  Trash2,
  HelpCircle,
} from "lucide-react";
import { parseReceiptAction, commitReceiptInventoryAction } from "@/app/actions";
import type { ReconciledReceiptItem, ExtractedReceipt } from "@/lib/gemini-receipt";

interface StorageLocation {
  id: string;
  name: string;
}

interface InventoryItemSummary {
  id: string;
  name: string;
  sku: string;
  category: string;
  totalQuantity: number;
  unitPrice: number;
  replacementCost?: number | null;
  locationId?: string | null;
}

interface ReceiptScannerModalProps {
  onClose: () => void;
  onSuccess: (summary: { updatedCount: number; createdCount: number }) => void;
  inventoryItems: InventoryItemSummary[];
  storageLocations: StorageLocation[];
}

const SAMPLE_RECEIPT_TEXT = `IKEA Portugal - Alfragide
Fatura Simplificada FS 2026/89412
Data: 2026-11-12  Hora: 14:32
NIF: 504123891

Artigos:
12x Cadeira Dobrável Branca (Ref: 402.177.95) - Unit: €15.00  Total: €180.00
4x Mesa Retangular Dobrável 180cm - Unit: €48.00  Total: €192.00
6x Toalha de Mesa Branca 240x140cm - Unit: €14.50  Total: €87.00
20x Foco LED Branco Quente 10W - Unit: €8.90  Total: €178.00

Subtotal: €517.89
IVA (23%): €119.11
TOTAL: €637.00`;

export default function ReceiptScannerModal({
  onClose,
  onSuccess,
  inventoryItems,
  storageLocations,
}: ReceiptScannerModalProps) {
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [isPending, startTransition] = useTransition();
  const [isCommitPending, startCommitTransition] = useTransition();

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Review state
  const [receiptMeta, setReceiptMeta] = useState<{
    merchantName: string;
    invoiceNumber: string;
    date: string;
    totalAmount: number;
    createExpenseMovement: boolean;
  }>({
    merchantName: "",
    invoiceNumber: "",
    date: new Date().toISOString().split("T")[0],
    totalAmount: 0,
    createExpenseMovement: true,
  });

  const [reviewItems, setReviewItems] = useState<ReconciledReceiptItem[]>([]);

  // Drag and drop
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setErrorMsg(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMsg(null);
    }
  };

  const runAnalysis = (customText?: string) => {
    setErrorMsg(null);
    const textToUse = customText !== undefined ? customText : (pasteMode ? pastedText : "");

    if (!selectedFile && !textToUse.trim()) {
      setErrorMsg("Selecione um ficheiro ou introduza o texto da fatura.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        if (selectedFile) {
          formData.append("file", selectedFile);
        }
        if (textToUse.trim()) {
          formData.append("text", textToUse.trim());
        }

        const res = await parseReceiptAction(formData);

        if (!res.success) {
          setErrorMsg((res as any).error || "Não foi possível extrair dados da fatura.");
          return;
        }

        const rcpt = res.receipt;
        setReceiptMeta({
          merchantName: rcpt.merchantName || "Fornecedor",
          invoiceNumber: rcpt.invoiceNumber || "",
          date: rcpt.date || new Date().toISOString().split("T")[0],
          totalAmount: rcpt.totalAmount || 0,
          createExpenseMovement: true,
        });

        setReviewItems(res.items);
        setStep("review");
      } catch (err: any) {
        setErrorMsg(err?.message || "Erro inesperado ao contactar a API do Gemini.");
      }
    });
  };

  const handleItemFieldChange = (
    id: string,
    field: keyof ReconciledReceiptItem,
    value: any
  ) => {
    setReviewItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;

        const updated = { ...it, [field]: value };

        // If user manually selects a matched item, update SKU and category
        if (field === "matchedItemId" && value) {
          const matched = inventoryItems.find((inv) => inv.id === value);
          if (matched) {
            updated.matchedItemName = matched.name;
            updated.matchedItemSku = matched.sku;
            updated.currentStock = matched.totalQuantity;
            updated.category = matched.category;
            updated.sku = matched.sku;
            if (matched.unitPrice > 0) {
              updated.unitRentalPrice = matched.unitPrice;
            }
          }
        }

        return updated;
      })
    );
  };

  const handleCommit = () => {
    setErrorMsg(null);

    const activeItems = reviewItems.filter((i) => i.action !== "ignore");
    if (activeItems.length === 0) {
      setErrorMsg("Selecione pelo menos um artigo para importar para o inventário.");
      return;
    }

    startCommitTransition(async () => {
      try {
        const payload = {
          merchantName: receiptMeta.merchantName,
          invoiceNumber: receiptMeta.invoiceNumber || undefined,
          date: receiptMeta.date || undefined,
          totalAmount: Number(receiptMeta.totalAmount) || 0,
          createExpenseMovement: receiptMeta.createExpenseMovement,
          items: reviewItems.map((i) => ({
            action: i.action,
            matchedItemId: i.matchedItemId,
            name: i.name,
            sku: i.sku,
            category: i.category,
            quantityToAdd: Number(i.quantityToAdd) || 1,
            unitPurchasePrice: Number(i.unitPurchasePrice) || 0,
            unitRentalPrice: Number(i.unitRentalPrice) || 0,
            locationId: i.locationId,
            dimensions: i.dimensions,
          })),
        };

        const res = await commitReceiptInventoryAction(payload);
        if (!res.success) {
          setErrorMsg(res.error || "Erro ao gravar dados no inventário.");
          return;
        }

        onSuccess({
          updatedCount: res.updatedCount || 0,
          createdCount: res.createdCount || 0,
        });
        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || "Erro inesperado ao gravar no inventário.");
      }
    });
  };

  const activeCount = reviewItems.filter((i) => i.action !== "ignore").length;
  const existingCount = reviewItems.filter((i) => i.action === "add_to_existing").length;
  const newCount = reviewItems.filter((i) => i.action === "create_new").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-[24px] shadow-2xl flex flex-col overflow-hidden border border-[#e5e5ea]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#ececf0] flex items-center justify-between bg-gradient-to-r from-blue-50/60 to-indigo-50/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#1c1c1e]">Leitor Inteligente de Faturas & Recibos</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 rounded-full border border-blue-200/60">
                  Gemini AI
                </span>
              </div>
              <p className="text-xs text-[#8e8e93]">
                {step === "upload"
                  ? "Carregue faturas (PDF, foto ou texto) para extrair artigos e atualizar o stock automaticamente."
                  : "Verifique os artigos reconciliados com o inventário antes de confirmar."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-black/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {errorMsg && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-[14px] flex items-start gap-2.5 text-sm text-red-700">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Atenção</p>
                <p className="text-xs opacity-90">{errorMsg}</p>
              </div>
            </div>
          )}

          {step === "upload" ? (
            <div className="space-y-6">
              {/* Dropzone */}
              {!pasteMode ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-[20px] p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                    isDragging
                      ? "border-blue-500 bg-blue-50/50 scale-[0.99]"
                      : selectedFile
                      ? "border-emerald-400 bg-emerald-50/30"
                      : "border-[#d1d1d6] hover:border-blue-400 hover:bg-slate-50/60"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp,.txt,.csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
                        {selectedFile.type.includes("pdf") ? (
                          <FileText className="w-7 h-7" />
                        ) : selectedFile.type.includes("image") ? (
                          <ImageIcon className="w-7 h-7" />
                        ) : (
                          <FileSpreadsheet className="w-7 h-7" />
                        )}
                      </div>
                      <div>
                        <p className="text-base font-bold text-[#1c1c1e]">{selectedFile.name}</p>
                        <p className="text-xs text-[#8e8e93]">
                          {(selectedFile.size / 1024).toFixed(1)} KB · Clique ou arraste outro ficheiro para substituir
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                        <Upload className="w-7 h-7" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-[#1c1c1e]">
                          Arraste o ficheiro da fatura ou clique para selecionar
                        </p>
                        <p className="text-xs text-[#8e8e93] mt-1">
                          Formatos suportados: <strong>PDF</strong>, imagens (<strong>PNG, JPG, WebP</strong>) ou texto (<strong>TXT, CSV</strong>)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-[#3a3a3c] mb-1.5 uppercase tracking-wider">
                    Texto / Dados da Fatura
                  </label>
                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Cole aqui o texto da fatura ou os itens com quantidades e preços..."
                    className="w-full p-4 text-sm font-mono bg-white border border-[#ececf0] rounded-[16px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Mode switch & Quick Demo sample */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPasteMode(!pasteMode);
                    setErrorMsg(null);
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                >
                  {pasteMode ? "← Voltar ao carregamento de ficheiro" : "Prefere colar o texto diretamente?"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPasteMode(true);
                    setPastedText(SAMPLE_RECEIPT_TEXT);
                    runAnalysis(SAMPLE_RECEIPT_TEXT);
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/80 rounded-[10px] transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Testar com Fatura Exemplo (IKEA)</span>
                </button>
              </div>

              {/* Action Button */}
              <div className="pt-4 flex justify-end gap-3 border-t border-[#ececf0]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-medium text-[#48484a] hover:bg-black/5 rounded-[14px] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isPending || (!selectedFile && !pastedText.trim())}
                  onClick={() => runAnalysis()}
                  className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-[14px] shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>A analisar com Gemini AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Processar Documento</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: REVIEW & RECONCILIATION */
            <div className="space-y-6">
              {/* Receipt Summary Ribbon */}
              <div className="p-4 bg-slate-50 border border-[#e5e5ea] rounded-[18px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5" />
                    Fornecedor
                  </label>
                  <input
                    type="text"
                    value={receiptMeta.merchantName}
                    onChange={(e) =>
                      setReceiptMeta((prev) => ({ ...prev, merchantName: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 text-sm font-semibold text-[#1c1c1e] bg-white border border-[#d1d1d6] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5" />
                    N.º Fatura / Recibo
                  </label>
                  <input
                    type="text"
                    value={receiptMeta.invoiceNumber}
                    placeholder="ex: FT 2026/01"
                    onChange={(e) =>
                      setReceiptMeta((prev) => ({ ...prev, invoiceNumber: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 text-sm text-[#1c1c1e] bg-white border border-[#d1d1d6] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Data da Fatura
                  </label>
                  <input
                    type="date"
                    value={receiptMeta.date}
                    onChange={(e) =>
                      setReceiptMeta((prev) => ({ ...prev, date: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 text-sm text-[#1c1c1e] bg-white border border-[#d1d1d6] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Euro className="w-3.5 h-3.5" />
                    Total da Fatura (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={receiptMeta.totalAmount}
                    onChange={(e) =>
                      setReceiptMeta((prev) => ({
                        ...prev,
                        totalAmount: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-1.5 text-sm font-bold text-[#1c1c1e] bg-white border border-[#d1d1d6] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Items Counter Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#1c1c1e]">
                    Artigos Extraídos ({reviewItems.length})
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
                      {existingCount} a repor stock
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                      {newCount} novos artigos
                    </span>
                  </div>
                </div>

                <div className="text-xs text-[#8e8e93]">
                  Pode alterar as quantidades, preços e vincular a outro artigo existente.
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {reviewItems.map((item, index) => {
                  const isExisting = item.action === "add_to_existing";
                  const isIgnored = item.action === "ignore";

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-[18px] border transition-all ${
                        isIgnored
                          ? "bg-slate-100/60 border-slate-200 opacity-60"
                          : isExisting
                          ? "bg-blue-50/30 border-blue-200 shadow-sm"
                          : "bg-emerald-50/20 border-emerald-200 shadow-sm"
                      }`}
                    >
                      {/* Top row: Action selector + Status badge */}
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-2.5 border-b border-black/5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-black/5 text-[#8e8e93] text-xs font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-xs font-bold text-[#1c1c1e] truncate max-w-[260px] sm:max-w-md">
                            {item.rawDescription}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Action Selector */}
                          <select
                            value={item.action}
                            onChange={(e) =>
                              handleItemFieldChange(item.id, "action", e.target.value)
                            }
                            className={`px-2.5 py-1 text-xs font-bold rounded-[10px] border focus:outline-none ${
                              item.action === "add_to_existing"
                                ? "bg-blue-600 text-white border-blue-700"
                                : item.action === "create_new"
                                ? "bg-emerald-600 text-white border-emerald-700"
                                : "bg-slate-200 text-slate-700 border-slate-300"
                            }`}
                          >
                            <option value="add_to_existing">Adicionar a Stock Existente</option>
                            <option value="create_new">Criar Novo Artigo</option>
                            <option value="ignore">Ignorar (Não Importar)</option>
                          </select>

                          {/* Quick delete button */}
                          <button
                            type="button"
                            onClick={() =>
                              handleItemFieldChange(
                                item.id,
                                "action",
                                item.action === "ignore" ? "create_new" : "ignore"
                              )
                            }
                            title={isIgnored ? "Restaurar artigo" : "Ignorar artigo"}
                            className="p-1 text-[#8e8e93] hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Content Form Row */}
                      {!isIgnored && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 text-xs">
                          {/* If add_to_existing, select which item to match */}
                          {isExisting ? (
                            <div className="sm:col-span-2 lg:col-span-4">
                              <label className="block text-[10px] font-bold text-[#8e8e93] uppercase mb-1">
                                Artigo Existente a Repor
                              </label>
                              <select
                                value={item.matchedItemId || ""}
                                onChange={(e) =>
                                  handleItemFieldChange(item.id, "matchedItemId", e.target.value)
                                }
                                className="w-full px-2.5 py-1.5 bg-white border border-[#d1d1d6] rounded-[8px] font-semibold text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">(Selecione o artigo correspondente)</option>
                                {inventoryItems.map((inv) => (
                                  <option key={inv.id} value={inv.id}>
                                    {inv.sku} - {inv.name} (Atual: {inv.totalQuantity} un.)
                                  </option>
                                ))}
                              </select>
                              {item.currentStock !== undefined && (
                                <p className="text-[10px] text-blue-700 font-medium mt-1">
                                  Stock atual: {item.currentStock} un. → Novo total:{" "}
                                  <strong>{item.currentStock + (Number(item.quantityToAdd) || 0)} un.</strong>
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="sm:col-span-2 lg:col-span-4">
                              <label className="block text-[10px] font-bold text-[#8e8e93] uppercase mb-1">
                                Nome do Novo Artigo
                              </label>
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) =>
                                  handleItemFieldChange(item.id, "name", e.target.value)
                                }
                                className="w-full px-2.5 py-1.5 bg-white border border-[#d1d1d6] rounded-[8px] font-semibold text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <p className="text-[10px] text-emerald-700 font-medium mt-1">
                                SKU Proposto: <strong>{item.sku}</strong>
                              </p>
                            </div>
                          )}

                          {/* Category */}
                          <div className="lg:col-span-2">
                            <label className="block text-[10px] font-bold text-[#8e8e93] uppercase mb-1">
                              Categoria
                            </label>
                            <select
                              value={item.category}
                              onChange={(e) =>
                                handleItemFieldChange(item.id, "category", e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 bg-white border border-[#d1d1d6] rounded-[8px] text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="Mobiliário">Mobiliário</option>
                              <option value="Decoração">Decoração</option>
                              <option value="Iluminação">Iluminação</option>
                              <option value="Têxteis">Têxteis</option>
                              <option value="Loiça & Catering">Loiça & Catering</option>
                              <option value="Som & AV">Som & AV</option>
                              <option value="Outro">Outro</option>
                            </select>
                          </div>

                          {/* Quantity */}
                          <div className="lg:col-span-2">
                            <label className="block text-[10px] font-bold text-[#8e8e93] uppercase mb-1">
                              Qtd. a Adicionar
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={item.quantityToAdd}
                              onChange={(e) =>
                                handleItemFieldChange(
                                  item.id,
                                  "quantityToAdd",
                                  parseInt(e.target.value) || 1
                                )
                              }
                              className="w-full px-2.5 py-1.5 bg-white border border-[#d1d1d6] rounded-[8px] font-bold text-center text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          {/* Unit Purchase Price */}
                          <div className="lg:col-span-2">
                            <label className="block text-[10px] font-bold text-[#8e8e93] uppercase mb-1">
                              Custo Compra (€)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              value={item.unitPurchasePrice}
                              onChange={(e) =>
                                handleItemFieldChange(
                                  item.id,
                                  "unitPurchasePrice",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full px-2.5 py-1.5 bg-white border border-[#d1d1d6] rounded-[8px] text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          {/* Rental Price */}
                          <div className="lg:col-span-2">
                            <label className="block text-[10px] font-bold text-[#8e8e93] uppercase mb-1">
                              Aluguer / Evento (€)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              value={item.unitRentalPrice}
                              onChange={(e) =>
                                handleItemFieldChange(
                                  item.id,
                                  "unitRentalPrice",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full px-2.5 py-1.5 bg-white border border-[#d1d1d6] rounded-[8px] text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Expense Option & Commit Bar */}
              <div className="pt-4 border-t border-[#ececf0] space-y-4">
                <div className="flex items-center gap-2.5 bg-amber-50/70 border border-amber-200/80 p-3 rounded-[14px]">
                  <input
                    type="checkbox"
                    id="createExpenseCheckbox"
                    checked={receiptMeta.createExpenseMovement}
                    onChange={(e) =>
                      setReceiptMeta((prev) => ({
                        ...prev,
                        createExpenseMovement: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <label
                    htmlFor="createExpenseCheckbox"
                    className="text-xs font-semibold text-amber-900 cursor-pointer flex-1"
                  >
                    Registar despesa financeira em <strong>"Material / Stock"</strong> no valor de{" "}
                    <strong>€{Number(receiptMeta.totalAmount || 0).toFixed(2)}</strong> referente a esta compra
                  </label>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep("upload")}
                    className="px-4 py-2 text-xs font-semibold text-[#8e8e93] hover:text-[#1c1c1e] transition-colors cursor-pointer"
                  >
                    ← Carregar outra fatura
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-5 py-2.5 text-sm font-medium text-[#48484a] hover:bg-black/5 rounded-[14px] transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={isCommitPending || activeCount === 0}
                      onClick={handleCommit}
                      className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-[14px] shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      {isCommitPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>A atualizar inventário...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Confirmar e Importar ({activeCount}) Artigo(s)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
