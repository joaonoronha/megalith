"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Camera,
  CameraOff,
  RefreshCw,
  Plus,
  Minus,
  Check,
  AlertTriangle,
  Package,
  Layers,
  MapPin,
  Sparkles,
  Search,
  ScanLine,
  ArrowRight,
  ChevronRight,
  Info,
} from "lucide-react";
import { searchBarcodeAction, addBarcodeStockAction, createItemAction } from "@/app/actions";
import type { BarcodeSearchResult } from "@/app/actions";
import { readBarcodes } from "zxing-wasm/reader";

interface StorageLocation {
  id: string;
  name: string;
}

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  storageLocations?: StorageLocation[];
  onItemAddedOrUpdated?: () => void;
}

// Emite um bip áudio agradável via Web Audio API para acessibilidade
function playScanBeep() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // Tom A5
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Silencioso caso áudio esteja desativado ou bloqueado
  }
}

// Vibração tátil no telemóvel para acessibilidade
function triggerScanVibrate() {
  try {
    if (typeof window !== "undefined" && "vibrate" in navigator && typeof navigator.vibrate === "function") {
      navigator.vibrate([100, 50, 100]);
    }
  } catch {
    // Silencioso se não suportado
  }
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  storageLocations = [],
  onItemAddedOrUpdated,
}: BarcodeScannerModalProps) {
  const [isSaving, setIsSaving] = useState(false);

  // Estados do Scanner
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [manualCodeInput, setManualCodeInput] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  // Estado do Resultado da Leitura
  const [activeBarcode, setActiveBarcode] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<BarcodeSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Estado para Adicionar Stock a Item Existente
  const [stockToAdd, setStockToAdd] = useState<number>(1);
  const [stockSuccessMsg, setStockSuccessMsg] = useState<string | null>(null);

  // Estado para Criação de Novo Item (Simplificado)
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Material / Consumíveis");
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemLocationId, setNewItemLocationId] = useState(storageLocations[0]?.id || "");
  const [newItemIsConsumable, setNewItemIsConsumable] = useState(false);
  const [newItemPrice, setNewItemPrice] = useState<string>("0");
  const [newItemImageUrl, setNewItemImageUrl] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isScanningLockedRef = useRef(false);
  const scanLoopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Iniciar Leitura da Câmara com zxing-wasm
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    isScanningLockedRef.current = false;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function scanFrame() {
      if (!isMounted || isScanningLockedRef.current) return;
      const video = videoRef.current;

      if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        try {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // zxing-wasm: Decodificação em WebAssembly de alto desempenho
            const barcodes = await readBarcodes(imageData, {
              formats: ["EAN-13", "UPC-A", "EAN-8", "UPC-E", "Code 128", "Code 39", "QR Code"],
              tryHarder: true,
              tryRotate: true,
              maxNumberOfSymbols: 1,
            });

            if (barcodes && barcodes.length > 0 && barcodes[0].text && !isScanningLockedRef.current) {
              const detected = barcodes[0].text.trim();
              if (detected) {
                handleBarcodeFound(detected);
                return;
              }
            }
          }
        } catch {
          // Erro no frame atual, prossegue para o próximo ciclo
        }
      }

      if (isMounted && !isScanningLockedRef.current) {
        scanLoopTimeoutRef.current = setTimeout(scanFrame, 140);
      }
    }

    async function startCameraScanner() {
      setCameraError(null);
      setIsCameraActive(true);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // Iniciar loop de leitura WASM
        scanFrame();
      } catch (err: unknown) {
        if (!isMounted) return;
        const e = err as { name?: string; message?: string };
        console.error("Camera access error:", e);
        setIsCameraActive(false);
        if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
          setCameraError("Permissão de câmara não concedida. Por favor permite o acesso à câmara nas definições.");
        } else {
          setCameraError("Não foi possível aceder à câmara do dispositivo.");
        }
      }
    }

    startCameraScanner();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen, facingMode]);

  function stopCamera() {
    if (scanLoopTimeoutRef.current) {
      clearTimeout(scanLoopTimeoutRef.current);
      scanLoopTimeoutRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }

  // Manipular deteção de código
  async function handleBarcodeFound(barcode: string) {
    if (isScanningLockedRef.current) return;
    isScanningLockedRef.current = true;

    // Acessibilidade: Bip sonoro + Vibração do telemóvel
    playScanBeep();
    triggerScanVibrate();

    // Parar transmissão de câmara para poupar bateria e focar no resultado
    stopCamera();

    setActiveBarcode(barcode);
    setIsSearching(true);
    setStockSuccessMsg(null);
    setCreateError(null);

    try {
      const res = await searchBarcodeAction(barcode);
      setSearchResult(res);

      if (res.found && res.item) {
        setStockToAdd(1);
      } else {
        // Preencher formulário simplificado com os dados obtidos (Open Facts ou padrão)
        const suggested = res.suggestedItem;
        setNewItemName(suggested?.name || "");
        setNewItemCategory(suggested?.category || "Material / Consumíveis");
        setNewItemQuantity(1);
        setNewItemIsConsumable(suggested?.isConsumable || false);
        setNewItemImageUrl(suggested?.imageUrl || null);
        setNewItemPrice("0");
        setNewItemLocationId((storageLocations && storageLocations[0]?.id) || "");
      }
    } catch (e: unknown) {
      console.error("searchBarcodeAction error:", e);
      setSearchResult({
        success: false,
        found: false,
        source: "none",
        barcode,
        error: "Ocorreu uma falha ao pesquisar o artigo.",
      });
    } finally {
      setIsSearching(false);
    }
  }

  // Confirmar adição de stock a artigo já existente
  async function handleAddStock() {
    if (!searchResult?.item?.id || stockToAdd <= 0 || isSaving) return;

    setIsSaving(true);
    try {
      const res = await addBarcodeStockAction(searchResult.item.id, stockToAdd);
      if (res.success) {
        setStockSuccessMsg(`+${stockToAdd} unidades adicionadas com sucesso! Novo total: ${res.newTotal} un.`);
        if (onItemAddedOrUpdated) onItemAddedOrUpdated();
      } else {
        alert(res.error || "Erro ao adicionar stock.");
      }
    } catch (e: any) {
      alert(e?.message || "Erro ao adicionar stock.");
    } finally {
      setIsSaving(false);
    }
  }

  // Guardar novo artigo detetado (Formulário simplificado sem expor detalhes técnicos)
  async function handleCreateNewItem(e?: React.FormEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isSaving) return;

    const trimmedName = newItemName.trim();
    if (!trimmedName) {
      setCreateError("Por favor insere o nome do artigo.");
      return;
    }

    setIsSaving(true);
    setCreateError(null);

    try {
      const fd = new FormData();
      fd.append("name", trimmedName);
      fd.append("category", newItemCategory || "Material / Consumíveis");
      fd.append("totalQuantity", String(Math.max(1, newItemQuantity || 1)));
      if (newItemLocationId) {
        fd.append("locationId", newItemLocationId);
      }
      fd.append("isConsumable", newItemIsConsumable ? "true" : "false");
      fd.append("unitPrice", newItemPrice || "0");
      if (newItemImageUrl) {
        fd.append("imageUrl", newItemImageUrl);
      }
      if (activeBarcode) {
        fd.append("barcode", activeBarcode);
      }

      const res = await createItemAction(fd);
      if (res && res.success) {
        setStockSuccessMsg(`Artigo "${trimmedName}" registado com sucesso no inventário!`);
        if (onItemAddedOrUpdated) onItemAddedOrUpdated();
      } else {
        setCreateError(res?.error || "Erro ao registar o artigo.");
      }
    } catch (err: any) {
      console.error("createItemAction error:", err);
      setCreateError(err?.message || "Ocorreu um erro ao registar o artigo.");
    } finally {
      setIsSaving(false);
    }
  }

  // Reiniciar para nova leitura
  function resetForNextScan() {
    setActiveBarcode(null);
    setSearchResult(null);
    setStockSuccessMsg(null);
    setCreateError(null);
    isScanningLockedRef.current = false;
    setIsCameraActive(true);
    setManualCodeInput("");
    setShowManualInput(false);
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-scanner-title"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-[28px] border border-[#ececf0] shadow-2xl max-w-md w-full overflow-hidden my-auto flex flex-col">
        {/* Cabeçalho */}
        <div className="p-4 sm:p-5 border-b border-[#ececf0] flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#f2f2f7] flex items-center justify-center text-[#111]">
              <ScanLine className="w-5 h-5 text-[#007aff]" />
            </div>
            <div>
              <h2
                id="barcode-scanner-title"
                className="text-[17px] font-bold text-[#111] leading-tight"
              >
                Leitor de Código de Barras
              </h2>
              <p className="text-xs text-[#8e8e93]">
                {activeBarcode
                  ? "Resultado da leitura"
                  : "Aponta a câmara para o código do produto"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f2f2f7] hover:bg-[#e5e5ea] text-[#8e8e93] hover:text-[#111] flex items-center justify-center transition cursor-pointer"
            aria-label="Fechar leitor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo do Leitor */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* ============================================================= */}
          {/* ESTADO 1: CÂMARA EM TEMPO REAL                                 */}
          {/* ============================================================= */}
          {!activeBarcode && !isSearching && (
            <div className="space-y-4">
              {/* Visor da Câmara com Miras de Leitura */}
              <div className="relative aspect-4/3 sm:aspect-square w-full rounded-2xl bg-black overflow-hidden flex items-center justify-center shadow-inner">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Retículo e Guia Visual */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-64 h-40 sm:w-72 sm:h-44 rounded-2xl border-2 border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                    {/* Cantos destacados estilo Apple Scanner */}
                    <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-[#007aff] rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-[#007aff] rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-[#007aff] rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-[#007aff] rounded-br-lg" />

                    {/* Linha vermelha laser animada */}
                    <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
                  </div>
                </div>

                {/* Alternar Câmara Frontal / Traseira */}
                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))
                  }
                  className="absolute bottom-3 right-3 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition shadow-md"
                  title="Alternar câmara"
                  aria-label="Alternar câmara"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>

                {/* Feedback de estado se a câmara falhar */}
                {cameraError && (
                  <div className="absolute inset-0 bg-black/90 p-5 flex flex-col items-center justify-center text-center text-white space-y-3">
                    <CameraOff className="w-10 h-10 text-rose-400" />
                    <p className="text-xs text-white/90 max-w-xs">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => setShowManualInput(true)}
                      className="text-xs font-semibold px-4 py-2 bg-white text-black rounded-xl hover:bg-neutral-200"
                    >
                      Introduzir Código Manualmente
                    </button>
                  </div>
                )}
              </div>

              {/* Dica amigável */}
              <div className="flex items-center gap-2 text-xs text-[#8e8e93] bg-[#f9f9fb] p-3 rounded-xl border border-[#ececf0]">
                <Info className="w-4 h-4 shrink-0 text-[#007aff]" />
                <span>
                  Centra o código de barras no visor. O leitor emite um som e vibra assim que detetar o artigo.
                </span>
              </div>

              {/* Botão para entrada manual em caso de falha física */}
              <div className="pt-1">
                {!showManualInput ? (
                  <button
                    type="button"
                    onClick={() => setShowManualInput(true)}
                    className="w-full text-center text-xs font-semibold text-[#007aff] hover:underline cursor-pointer"
                  >
                    Dificuldades na leitura? Introduzir código manualmente
                  </button>
                ) : (
                  <div className="bg-[#f9f9fb] border border-[#ececf0] p-3 rounded-2xl space-y-2">
                    <label className="text-[11px] font-bold text-[#636366] block">
                      Código do Artigo:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={manualCodeInput}
                        onChange={(e) => setManualCodeInput(e.target.value)}
                        placeholder="Ex: 5601234567890"
                        className="flex-1 px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (manualCodeInput.trim()) {
                            handleBarcodeFound(manualCodeInput.trim());
                          }
                        }}
                        disabled={!manualCodeInput.trim()}
                        className="px-4 py-2 bg-[#111] hover:bg-black text-white text-xs font-bold rounded-xl transition disabled:opacity-40 cursor-pointer"
                      >
                        Pesquisar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* ESTADO 2: PESQUISANDO (DB -> Open Food Facts -> Open Products) */}
          {/* ============================================================= */}
          {isSearching && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full border-3 border-[#ececf0] border-t-[#007aff] animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-[#111]">A identificar artigo...</p>
                <p className="text-xs text-[#8e8e93]">
                  A consultar o inventário e a base de produtos
                </p>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* ESTADO 3: SUCESSO APÓS AÇÃO REALIZADA                         */}
          {/* ============================================================= */}
          {stockSuccessMsg && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-sm">Operação Concluída</p>
                  <p className="mt-0.5 text-emerald-800">{stockSuccessMsg}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForNextScan}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#111] hover:bg-black text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <ScanLine className="w-4 h-4" />
                  <span>Digitalizar Outro Artigo</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3 px-4 rounded-xl bg-[#f2f2f7] hover:bg-[#e5e5ea] text-[#111] text-xs font-semibold transition cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* ESTADO 4: ARTIGO EXISTE NA BD -> ADICIONAR X QUANTIDADE       */}
          {/* ============================================================= */}
          {!isSearching && !stockSuccessMsg && searchResult?.found && searchResult.item && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-white border border-emerald-200 overflow-hidden flex items-center justify-center shrink-0">
                  {searchResult.item.imageUrl ? (
                    <img
                      src={searchResult.item.imageUrl}
                      alt={searchResult.item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-emerald-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    <Check className="w-3 h-3" />
                    Artigo Encontrado no Catálogo
                  </div>
                  <h3 className="text-sm font-bold text-[#111] truncate mt-1">
                    {searchResult.item.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-[#636366] mt-0.5">
                    <span>{searchResult.item.category}</span>
                    <span>•</span>
                    <span className="font-semibold text-emerald-700">
                      Stock atual: {searchResult.item.totalQuantity} un.
                    </span>
                  </div>
                </div>
              </div>

              {/* Seletor de Quantidade a Adicionar */}
              <div className="p-4 rounded-2xl bg-[#f9f9fb] border border-[#ececf0] space-y-3">
                <span className="text-xs font-bold text-[#111] block">
                  Quantas unidades pretendes adicionar ao stock?
                </span>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStockToAdd((prev) => Math.max(1, prev - 1))}
                    className="w-10 h-10 rounded-xl bg-white border border-[#ececf0] hover:bg-[#f2f2f7] flex items-center justify-center text-[#111] font-bold transition shadow-2xs cursor-pointer"
                    aria-label="Diminuir quantidade"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <div className="text-center px-4">
                    <input
                      type="number"
                      min={1}
                      value={stockToAdd}
                      onChange={(e) =>
                        setStockToAdd(Math.max(1, parseInt(e.target.value || "1", 10)))
                      }
                      className="w-20 text-center text-2xl font-black text-[#111] bg-white border border-[#ececf0] rounded-xl py-1.5 focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                    />
                    <span className="text-[10px] font-bold text-[#8e8e93] block mt-1 uppercase">
                      unidades
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStockToAdd((prev) => prev + 1)}
                    className="w-10 h-10 rounded-xl bg-white border border-[#ececf0] hover:bg-[#f2f2f7] flex items-center justify-center text-[#111] font-bold transition shadow-2xs cursor-pointer"
                    aria-label="Aumentar quantidade"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Botões Rápidos */}
                <div className="flex items-center justify-center gap-2 pt-1">
                  {[1, 5, 10, 20, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setStockToAdd(preset)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                        stockToAdd === preset
                          ? "bg-[#007aff] text-white"
                          : "bg-white border border-[#ececf0] text-[#636366] hover:bg-[#f2f2f7]"
                      }`}
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleAddStock}
                  disabled={isSaving}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>A adicionar...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Adicionar ao Stock (+{stockToAdd})</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetForNextScan}
                  className="py-3 px-3.5 rounded-xl bg-[#f2f2f7] hover:bg-[#e5e5ea] text-[#111] text-xs font-semibold transition cursor-pointer"
                >
                  Voltar
                </button>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* ESTADO 5: NOVO ARTIGO (Auto-completado via Open Facts ou Manual) */}
          {/* ============================================================= */}
          {!isSearching && !stockSuccessMsg && searchResult && !searchResult.found && (
            <form onSubmit={handleCreateNewItem} className="space-y-4">
              {/* Notificação Amigável (Sem expor o número técnico do código de barras) */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-sm">Novo Artigo Detetado</p>
                  <p className="mt-0.5 text-amber-900 leading-relaxed">
                    {searchResult.source === "openfoodfacts" ||
                    searchResult.source === "openproductsfacts"
                      ? "Os dados do artigo foram detetados automaticamente. Revê e confirma para guardar no catálogo."
                      : "Este artigo ainda não está registado. Preenche os dados essenciais para o adicionar ao inventário."}
                  </p>
                </div>
              </div>

              {createError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {createError}
                </div>
              )}

              {/* Pré-visualização da Imagem se existente */}
              {newItemImageUrl && (
                <div className="flex items-center gap-3 p-3 bg-[#f9f9fb] border border-[#ececf0] rounded-2xl">
                  <img
                    src={newItemImageUrl}
                    alt="Artigo"
                    className="w-14 h-14 rounded-xl object-cover bg-white border border-[#ececf0]"
                  />
                  <div className="text-xs min-w-0">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 block">
                      Fotografia Detetada
                    </span>
                    <p className="font-medium text-[#111] truncate">{newItemName}</p>
                  </div>
                </div>
              )}

              {/* Campos Essenciais do Formulário */}
              <div className="space-y-3">
                {/* Nome do Artigo */}
                <div>
                  <label className="text-[11px] font-bold text-[#636366] block mb-1">
                    Nome do Artigo *
                  </label>
                  <input
                    type="text"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Ex: Água das Pedras 25cl, Fita Adesiva, Cadeira..."
                    className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>

                {/* Categoria & Quantidade Inicial */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-[#636366] block mb-1">
                      Categoria
                    </label>
                    <select
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-white border border-[#ececf0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                    >
                      <option value="Material / Consumíveis">Material / Consumíveis</option>
                      <option value="Alimentação & Bebidas">Alimentação & Bebidas</option>
                      <option value="Mobiliário">Mobiliário</option>
                      <option value="Decoração">Decoração</option>
                      <option value="Iluminação & Som">Iluminação & Som</option>
                      <option value="Têxteis & Louça">Têxteis & Louça</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#636366] block mb-1">
                      Quantidade Inicial
                    </label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        min={1}
                        value={newItemQuantity}
                        onChange={(e) =>
                          setNewItemQuantity(Math.max(1, parseInt(e.target.value || "1", 10)))
                        }
                        className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff] font-bold text-[#111]"
                      />
                    </div>
                  </div>
                </div>

                {/* Localização / Armazém */}
                {storageLocations.length > 0 && (
                  <div>
                    <label className="text-[11px] font-bold text-[#636366] block mb-1">
                      Local de Armazenamento
                    </label>
                    <select
                      value={newItemLocationId}
                      onChange={(e) => setNewItemLocationId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                    >
                      {storageLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#111] hover:bg-black active:scale-[0.98] text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>A guardar...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Guardar no Inventário</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetForNextScan}
                  className="py-3 px-3.5 rounded-xl bg-[#f2f2f7] hover:bg-[#e5e5ea] text-[#111] text-xs font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
