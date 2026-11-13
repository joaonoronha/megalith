"use client";

import React, { useRef, useState, useMemo, useEffect } from "react";
import { Calendar, Wrench, PartyPopper, Truck } from "lucide-react";

export interface TimeWindowSliderProps {
  date: string;
  onDateChange: (newDate: string) => void;
  prepStart: string;
  prepEnd: string;
  eventStart: string;
  eventEnd: string;
  teardownStart: string;
  teardownEnd: string;
  embedded?: boolean;
  className?: string;
  onChange: (ranges: {
    prepStart: string;
    prepEnd: string;
    eventStart: string;
    eventEnd: string;
    teardownStart: string;
    teardownEnd: string;
  }) => void;
}

// Converte "HH:mm" para minutos desde as 00:00 (0..1440)
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return Math.min(1440, Math.max(0, h * 60 + m));
}

// Converte minutos para "HH:mm" com ajuste de 15 minutos
export function minutesToTime(mins: number): string {
  const clamped = Math.min(1440, Math.max(0, Math.round(mins / 15) * 15));
  if (clamped >= 1440) return "24:00";
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDuration(startMin: number, endMin: number): string {
  const diff = Math.max(0, endMin - startMin);
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export default function TimeWindowSlider({
  date,
  onDateChange,
  prepStart,
  prepEnd,
  eventStart,
  eventEnd,
  teardownStart,
  teardownEnd,
  embedded = false,
  className = "",
  onChange,
}: TimeWindowSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Minutos desde a meia-noite
  const pStartMin = timeToMinutes(prepStart || "09:00");
  const eStartMin = timeToMinutes(eventStart || "14:00");
  const eEndMin = timeToMinutes(eventEnd || "20:00");
  const tEndMin = timeToMinutes(teardownEnd || "23:00");

  // Limiar responsivo com espaçamento: pelo menos 1 hora antes e depois, arredondado para a hora inteira
  // para evitar sobreposições e garantir margem confortável de visualização
  const derivedWindowStart = Math.max(0, Math.floor((pStartMin - 60) / 60) * 60);
  const derivedWindowEnd = Math.min(1440, Math.ceil((tEndMin + 60) / 60) * 60);

  // Estado de arrasto
  // Manipulador 1 = Início da Montagem
  // Manipulador 2 = Fronteira entre Montagem & Início do Evento
  // Manipulador 3 = Fronteira entre Fim do Evento & Desmontagem
  // Manipulador 4 = Fim da Desmontagem
  // "range1" | "range2" | "range3" = arrastar o bloco colorido por inteiro
  const [activeDrag, setActiveDrag] = useState<
    1 | 2 | 3 | 4 | "range1" | "range2" | "range3" | null
  >(null);
  const [dragBounds, setDragBounds] = useState<{ start: number; end: number } | null>(null);

  // Limites da janela ativa
  const windowStart = dragBounds ? dragBounds.start : derivedWindowStart;
  const windowEnd = Math.max(windowStart + 60, dragBounds ? dragBounds.end : derivedWindowEnd);
  const windowDuration = windowEnd - windowStart;

  // Conversão de minutos para percentagem relativa à janela visível
  const toPercent = (mins: number) => {
    const clamped = Math.max(windowStart, Math.min(windowEnd, mins));
    return ((clamped - windowStart) / windowDuration) * 100;
  };

  // Coordenadas de referência para arrasto
  const dragContextRef = useRef<{
    startX: number;
    initialPStart: number;
    initialEStart: number;
    initialEEnd: number;
    initialTEnd: number;
    initialWindowStart: number;
    initialWindowEnd: number;
    initialWindowDur: number;
  }>({
    startX: 0,
    initialPStart: pStartMin,
    initialEStart: eStartMin,
    initialEEnd: eEndMin,
    initialTEnd: tEndMin,
    initialWindowStart: derivedWindowStart,
    initialWindowEnd: derivedWindowEnd,
    initialWindowDur: Math.max(60, derivedWindowEnd - derivedWindowStart),
  });

  const getClientX = (e: MouseEvent | TouchEvent): number => {
    if ("touches" in e) {
      return e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0;
    }
    return (e as MouseEvent).clientX;
  };

  const startDrag = (
    handle: 1 | 2 | 3 | 4 | "range1" | "range2" | "range3",
    clientX: number
  ) => {
    setActiveDrag(handle);
    const initStart = derivedWindowStart;
    const initEnd = derivedWindowEnd;
    const initDur = Math.max(60, initEnd - initStart);

    setDragBounds({ start: initStart, end: initEnd });

    dragContextRef.current = {
      startX: clientX,
      initialPStart: pStartMin,
      initialEStart: eStartMin,
      initialEEnd: eEndMin,
      initialTEnd: tEndMin,
      initialWindowStart: initStart,
      initialWindowEnd: initEnd,
      initialWindowDur: initDur,
    };
  };

  const handlePointerDown = (
    handle: 1 | 2 | 3 | 4 | "range1" | "range2" | "range3",
    e: React.MouseEvent | React.TouchEvent
  ) => {
    e.stopPropagation();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    startDrag(handle, clientX);
  };

  // Listeners de arrasto na janela
  useEffect(() => {
    if (!activeDrag) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const currentX = getClientX(e);
      const deltaX = currentX - dragContextRef.current.startX;
      const deltaMinutes =
        Math.round(((deltaX / rect.width) * dragContextRef.current.initialWindowDur) / 15) * 15;

      const {
        initialPStart,
        initialEStart,
        initialEEnd,
        initialTEnd,
        initialWindowStart,
        initialWindowEnd,
      } = dragContextRef.current;

      const MIN_DURATION = 30; // 30 minutos de duração mínima por fase

      let nextPStart = pStartMin;
      let nextEStart = eStartMin;
      let nextEEnd = eEndMin;
      let nextTEnd = tEndMin;

      if (activeDrag === 1) {
        // Manipulador 1: Início da Montagem
        nextPStart = Math.max(0, Math.min(initialEStart - MIN_DURATION, initialPStart + deltaMinutes));
      } else if (activeDrag === 2) {
        // Manipulador 2: Fronteira entre Montagem & Evento
        nextEStart = Math.max(
          initialPStart + MIN_DURATION,
          Math.min(initialEEnd - MIN_DURATION, initialEStart + deltaMinutes)
        );
      } else if (activeDrag === 3) {
        // Manipulador 3: Fronteira entre Evento & Desmontagem
        nextEEnd = Math.max(
          initialEStart + MIN_DURATION,
          Math.min(initialTEnd - MIN_DURATION, initialEEnd + deltaMinutes)
        );
      } else if (activeDrag === 4) {
        // Manipulador 4: Fim da Desmontagem
        nextTEnd = Math.max(
          initialEEnd + MIN_DURATION,
          Math.min(1440, initialTEnd + deltaMinutes)
        );
      } else if (activeDrag === "range1") {
        // Deslocar todo o intervalo de Montagem
        const maxShift = initialEEnd - MIN_DURATION - initialEStart;
        const minShift = -initialPStart;
        const clampedShift = Math.max(minShift, Math.min(maxShift, deltaMinutes));
        nextPStart = initialPStart + clampedShift;
        nextEStart = initialEStart + clampedShift;
      } else if (activeDrag === "range2") {
        // Deslocar todo o intervalo do Evento
        const maxShift = initialTEnd - MIN_DURATION - initialEEnd;
        const minShift = initialPStart + MIN_DURATION - initialEStart;
        const clampedShift = Math.max(minShift, Math.min(maxShift, deltaMinutes));
        nextEStart = initialEStart + clampedShift;
        nextEEnd = initialEEnd + clampedShift;
      } else if (activeDrag === "range3") {
        // Deslocar todo o intervalo de Desmontagem
        const maxShift = 1440 - initialTEnd;
        const minShift = initialEEnd + MIN_DURATION - initialTEnd;
        const clampedShift = Math.max(minShift, Math.min(maxShift, deltaMinutes));
        nextTEnd = initialTEnd + clampedShift;
      }

      // Expande dinamicamente os limites caso o arrasto ultrapasse o limiar inicial
      const curStart = Math.min(
        initialWindowStart,
        Math.max(0, Math.floor((nextPStart - 60) / 60) * 60)
      );
      const curEnd = Math.max(
        initialWindowEnd,
        Math.min(1440, Math.ceil((nextTEnd + 60) / 60) * 60)
      );
      setDragBounds({ start: curStart, end: curEnd });

      onChange({
        prepStart: minutesToTime(nextPStart),
        prepEnd: minutesToTime(nextEStart),
        eventStart: minutesToTime(nextEStart),
        eventEnd: minutesToTime(nextEEnd),
        teardownStart: minutesToTime(nextEEnd),
        teardownEnd: minutesToTime(nextTEnd),
      });
    };

    const onUp = () => {
      setActiveDrag(null);
      setDragBounds(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [activeDrag, onChange, pStartMin, eStartMin, eEndMin, tEndMin]);

  // Posições percentuais dos 3 blocos
  const p1Left = toPercent(pStartMin);
  const p1Width = Math.max(0, toPercent(eStartMin) - p1Left);

  const p2Left = toPercent(eStartMin);
  const p2Width = Math.max(0, toPercent(eEndMin) - p2Left);

  const p3Left = toPercent(eEndMin);
  const p3Width = Math.max(0, toPercent(tEndMin) - p3Left);

  // Geração de marcadores de hora responsivos com passo inteligente e espaçamento uniforme
  const hourTicks = useMemo(() => {
    const ticks: { min: number; label: string }[] = [];
    const durHours = windowDuration / 60;
    const step = durHours > 18 ? 3 : durHours > 8 ? 2 : 1;

    for (let h = Math.floor(windowStart / 60); h <= Math.ceil(windowEnd / 60); h++) {
      const m = h * 60;
      if (m < windowStart || m > windowEnd) continue;

      if (h % step === 0) {
        ticks.push({
          min: m,
          label: `${String(h).padStart(2, "0")}h`,
        });
      }
    }

    // Se por algum motivo o passo não gerou marcadores, garante os limites arredondados
    if (ticks.length === 0) {
      ticks.push({
        min: windowStart,
        label: `${String(Math.floor(windowStart / 60)).padStart(2, "0")}h`,
      });
      if (windowEnd - windowStart >= 60) {
        ticks.push({
          min: windowEnd,
          label: `${String(Math.floor(windowEnd / 60)).padStart(2, "0")}h`,
        });
      }
    }

    return ticks;
  }, [windowStart, windowEnd, windowDuration]);

  const containerClasses = embedded
    ? `border-t border-[#ececf0] p-5 sm:p-6 bg-white space-y-5 ${className}`
    : `bg-white border border-[#ececf0] rounded-[24px] p-5 sm:p-6 shadow-xs space-y-5 ${className}`;

  return (
    <div className={containerClasses.trim()}>
      {/* Cabeçalho: Seletor de Data & Badges dos 3 Intervalos Operacionais */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#ececf0]">
        {/* Seletor de Data */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#f2f2f5] flex items-center justify-center text-[#111] shrink-0">
            <Calendar className="w-5 h-5 text-[#007aff]" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-wider block">
              Data do Evento
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="text-sm font-black text-[#111] bg-transparent outline-none cursor-pointer hover:text-[#007aff] transition"
            />
          </div>
        </div>

        {/* 3 Badges de Cores dos Intervalos */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Montagem */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 font-semibold shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <span className="font-bold">Montagem:</span>
            <span>
              {minutesToTime(pStartMin)} - {minutesToTime(eStartMin)}
            </span>
            <span className="text-[10px] text-amber-700 bg-amber-100/70 px-1.5 py-0.2 rounded-md font-bold">
              {formatDuration(pStartMin, eStartMin)}
            </span>
          </div>

          {/* Horário do Evento */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-950 font-semibold shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-bold">Evento:</span>
            <span>
              {minutesToTime(eStartMin)} - {minutesToTime(eEndMin)}
            </span>
            <span className="text-[10px] text-emerald-800 bg-emerald-100/80 px-1.5 py-0.2 rounded-md font-bold">
              {formatDuration(eStartMin, eEndMin)}
            </span>
          </div>

          {/* Desmontagem */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-950 font-semibold shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />
            <span className="font-bold">Desmontagem:</span>
            <span>
              {minutesToTime(eEndMin)} - {minutesToTime(tEndMin)}
            </span>
            <span className="text-[10px] text-indigo-800 bg-indigo-100/70 px-1.5 py-0.2 rounded-md font-bold">
              {formatDuration(eEndMin, tEndMin)}
            </span>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* PISTA DO SLIDER DE INTERVALO DE TEMPO RESPONSIVO (3 CORES)          */}
      {/* =================================================================== */}
      <div className="space-y-2 select-none">
        {/* Pista do Slider */}
        <div
          ref={trackRef}
          className="relative h-14 sm:h-16 bg-[#f4f4f7] rounded-2xl border border-[#e5e5ea] overflow-hidden shadow-inner cursor-pointer"
        >
          {/* Linhas verticais de orientação alinhadas com as horas */}
          {hourTicks.map((tick) => {
            const leftPct = toPercent(tick.min);
            return (
              <div
                key={tick.min}
                style={{ left: `${leftPct}%` }}
                className="absolute top-0 bottom-0 w-px bg-[#e5e5ea] pointer-events-none"
              />
            );
          })}

          {/* ------------------------------------------------------------- */}
          {/* INTERVALO 1: MONTAGEM (Preparação) - ÂMBAR                   */}
          {/* ------------------------------------------------------------- */}
          <div
            style={{
              left: `${p1Left}%`,
              width: `${p1Width}%`,
            }}
            onMouseDown={(e) => handlePointerDown("range1", e)}
            onTouchStart={(e) => handlePointerDown("range1", e)}
            className={`absolute top-1 bottom-1 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-md flex items-center justify-between px-2 overflow-hidden cursor-grab active:cursor-grabbing border border-amber-300 transition-opacity ${
              activeDrag === "range1" ? "opacity-90 ring-2 ring-amber-400" : "hover:brightness-105"
            }`}
            title="Arrastar período de Montagem (Preparação)"
          >
            <div className="flex items-center gap-1.5 min-w-0 pointer-events-none">
              <Wrench className="w-3.5 h-3.5 shrink-0 text-amber-100 drop-shadow-xs" />
              <div className="min-w-0">
                <span className="text-[11px] font-black block truncate leading-none drop-shadow-xs">
                  Montagem
                </span>
                <span className="text-[10px] font-medium text-amber-100 block truncate leading-tight mt-0.5">
                  {minutesToTime(pStartMin)} - {minutesToTime(eStartMin)}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-amber-600/40 px-1.5 py-0.5 rounded-md pointer-events-none shrink-0 hidden sm:inline-block">
              {formatDuration(pStartMin, eStartMin)}
            </span>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* INTERVALO 2: HORÁRIO DO EVENTO (Festa) - ESMERALDA           */}
          {/* ------------------------------------------------------------- */}
          <div
            style={{
              left: `${p2Left}%`,
              width: `${p2Width}%`,
            }}
            onMouseDown={(e) => handlePointerDown("range2", e)}
            onTouchStart={(e) => handlePointerDown("range2", e)}
            className={`absolute top-1 bottom-1 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md flex items-center justify-between px-2 overflow-hidden cursor-grab active:cursor-grabbing border border-emerald-400 transition-opacity ${
              activeDrag === "range2" ? "opacity-90 ring-2 ring-emerald-400" : "hover:brightness-105"
            }`}
            title="Arrastar período do Evento (Festa)"
          >
            <div className="flex items-center gap-1.5 min-w-0 pointer-events-none">
              <PartyPopper className="w-3.5 h-3.5 shrink-0 text-emerald-100 drop-shadow-xs" />
              <div className="min-w-0">
                <span className="text-[11px] font-black block truncate leading-none drop-shadow-xs">
                  Evento
                </span>
                <span className="text-[10px] font-medium text-emerald-100 block truncate leading-tight mt-0.5">
                  {minutesToTime(eStartMin)} - {minutesToTime(eEndMin)}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-emerald-700/40 px-1.5 py-0.5 rounded-md pointer-events-none shrink-0 hidden sm:inline-block">
              {formatDuration(eStartMin, eEndMin)}
            </span>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* INTERVALO 3: DESMONTAGEM (Recolha) - ÍNDIGO                  */}
          {/* ------------------------------------------------------------- */}
          <div
            style={{
              left: `${p3Left}%`,
              width: `${p3Width}%`,
            }}
            onMouseDown={(e) => handlePointerDown("range3", e)}
            onTouchStart={(e) => handlePointerDown("range3", e)}
            className={`absolute top-1 bottom-1 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md flex items-center justify-between px-2 overflow-hidden cursor-grab active:cursor-grabbing border border-indigo-400 transition-opacity ${
              activeDrag === "range3" ? "opacity-90 ring-2 ring-indigo-400" : "hover:brightness-105"
            }`}
            title="Arrastar período de Desmontagem (Recolha)"
          >
            <div className="flex items-center gap-1.5 min-w-0 pointer-events-none">
              <Truck className="w-3.5 h-3.5 shrink-0 text-indigo-100 drop-shadow-xs" />
              <div className="min-w-0">
                <span className="text-[11px] font-black block truncate leading-none drop-shadow-xs">
                  Desmontagem
                </span>
                <span className="text-[10px] font-medium text-indigo-100 block truncate leading-tight mt-0.5">
                  {minutesToTime(eEndMin)} - {minutesToTime(tEndMin)}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-indigo-700/40 px-1.5 py-0.5 rounded-md pointer-events-none shrink-0 hidden sm:inline-block">
              {formatDuration(eEndMin, tEndMin)}
            </span>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* CONTROLADORES DE ARRASTO (HANDLES)                            */}
          {/* ------------------------------------------------------------- */}
          {/* Manipulador 1: Início da Montagem */}
          <div
            style={{ left: `${p1Left}%` }}
            onMouseDown={(e) => handlePointerDown(1, e)}
            onTouchStart={(e) => handlePointerDown(1, e)}
            className="absolute top-0 bottom-0 -ml-2.5 w-5 flex items-center justify-center cursor-ew-resize z-20 group"
          >
            <div
              className={`w-3.5 h-10 rounded-full bg-white border-2 border-amber-500 shadow-lg flex flex-col items-center justify-center gap-0.5 transition-transform ${
                activeDrag === 1 ? "scale-115 ring-2 ring-amber-400" : "group-hover:scale-110"
              }`}
            >
              <span className="w-1 h-1 rounded-full bg-amber-500" />
              <span className="w-1 h-1 rounded-full bg-amber-500" />
            </div>
            {activeDrag === 1 && (
              <div className="absolute -top-7 px-2 py-0.5 rounded-md bg-[#111] text-white text-[10px] font-bold pointer-events-none shadow-md">
                {minutesToTime(pStartMin)}
              </div>
            )}
          </div>

          {/* Manipulador 2: Fronteira entre Montagem & Início do Evento */}
          <div
            style={{ left: `${p2Left}%` }}
            onMouseDown={(e) => handlePointerDown(2, e)}
            onTouchStart={(e) => handlePointerDown(2, e)}
            className="absolute top-0 bottom-0 -ml-2.5 w-5 flex items-center justify-center cursor-ew-resize z-20 group"
          >
            <div
              className={`w-3.5 h-10 rounded-full bg-white border-2 border-emerald-500 shadow-lg flex flex-col items-center justify-center gap-0.5 transition-transform ${
                activeDrag === 2 ? "scale-115 ring-2 ring-emerald-400" : "group-hover:scale-110"
              }`}
            >
              <span className="w-1 h-1 rounded-full bg-emerald-500" />
              <span className="w-1 h-1 rounded-full bg-emerald-500" />
            </div>
            {activeDrag === 2 && (
              <div className="absolute -top-7 px-2 py-0.5 rounded-md bg-[#111] text-white text-[10px] font-bold pointer-events-none shadow-md">
                {minutesToTime(eStartMin)}
              </div>
            )}
          </div>

          {/* Manipulador 3: Fronteira entre Fim do Evento & Desmontagem */}
          <div
            style={{ left: `${p3Left}%` }}
            onMouseDown={(e) => handlePointerDown(3, e)}
            onTouchStart={(e) => handlePointerDown(3, e)}
            className="absolute top-0 bottom-0 -ml-2.5 w-5 flex items-center justify-center cursor-ew-resize z-20 group"
          >
            <div
              className={`w-3.5 h-10 rounded-full bg-white border-2 border-indigo-600 shadow-lg flex flex-col items-center justify-center gap-0.5 transition-transform ${
                activeDrag === 3 ? "scale-115 ring-2 ring-indigo-400" : "group-hover:scale-110"
              }`}
            >
              <span className="w-1 h-1 rounded-full bg-indigo-600" />
              <span className="w-1 h-1 rounded-full bg-indigo-600" />
            </div>
            {activeDrag === 3 && (
              <div className="absolute -top-7 px-2 py-0.5 rounded-md bg-[#111] text-white text-[10px] font-bold pointer-events-none shadow-md">
                {minutesToTime(eEndMin)}
              </div>
            )}
          </div>

          {/* Manipulador 4: Fim da Desmontagem */}
          <div
            style={{ left: `${toPercent(tEndMin)}%` }}
            onMouseDown={(e) => handlePointerDown(4, e)}
            onTouchStart={(e) => handlePointerDown(4, e)}
            className="absolute top-0 bottom-0 -ml-2.5 w-5 flex items-center justify-center cursor-ew-resize z-20 group"
          >
            <div
              className={`w-3.5 h-10 rounded-full bg-white border-2 border-indigo-600 shadow-lg flex flex-col items-center justify-center gap-0.5 transition-transform ${
                activeDrag === 4 ? "scale-115 ring-2 ring-indigo-400" : "group-hover:scale-110"
              }`}
            >
              <span className="w-1 h-1 rounded-full bg-indigo-600" />
              <span className="w-1 h-1 rounded-full bg-indigo-600" />
            </div>
            {activeDrag === 4 && (
              <div className="absolute -top-7 px-2 py-0.5 rounded-md bg-[#111] text-white text-[10px] font-bold pointer-events-none shadow-md">
                {minutesToTime(tEndMin)}
              </div>
            )}
          </div>
        </div>

        {/* Linha cronológica de horas por baixo da pista */}
        <div className="relative h-4 px-1 text-[10px] font-semibold text-[#8e8e93]">
          {hourTicks.map((tick) => {
            const leftPct = toPercent(tick.min);
            return (
              <span
                key={tick.min}
                style={{
                  left: `${leftPct}%`,
                  transform:
                    leftPct <= 2
                      ? "none"
                      : leftPct >= 98
                      ? "translateX(-100%)"
                      : "translateX(-50%)",
                }}
                className="absolute top-0 whitespace-nowrap"
              >
                {tick.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
