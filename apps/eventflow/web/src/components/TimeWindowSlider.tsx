"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  Calendar,
  Wrench,
  PartyPopper,
  Truck,
  Clock,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
} from "lucide-react";

export interface TimeWindowSliderProps {
  date: string;
  onDateChange: (newDate: string) => void;
  prepStart: string;
  prepEnd: string;
  eventStart: string;
  eventEnd: string;
  teardownStart: string;
  teardownEnd: string;
  onChange: (ranges: {
    prepStart: string;
    prepEnd: string;
    eventStart: string;
    eventEnd: string;
    teardownStart: string;
    teardownEnd: string;
  }) => void;
}

// Convert "HH:mm" to minutes from 00:00 (0..1440)
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return Math.min(1440, Math.max(0, h * 60 + m));
}

// Convert minutes to "HH:mm" (snapped to 15m)
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
  onChange,
}: TimeWindowSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Minutes from midnight
  const pStartMin = timeToMinutes(prepStart || "09:00");
  const eStartMin = timeToMinutes(eventStart || "14:00");
  const eEndMin = timeToMinutes(eventEnd || "20:00");
  const tEndMin = timeToMinutes(teardownEnd || "23:00");

  // Dragging state
  // Handle 1 = Setting up Start
  // Handle 2 = Setting up End / Event Start boundary
  // Handle 3 = Event End / Tearing down Start boundary
  // Handle 4 = Tearing down End
  // "range1" | "range2" | "range3" = dragging entire colored block
  const [activeDrag, setActiveDrag] = useState<
    1 | 2 | 3 | 4 | "range1" | "range2" | "range3" | null
  >(null);
  const [hoveredRange, setHoveredRange] = useState<1 | 2 | 3 | null>(null);

  // Drag reference coordinates
  const dragContextRef = useRef<{
    startX: number;
    initialPStart: number;
    initialEStart: number;
    initialEEnd: number;
    initialTEnd: number;
  }>({
    startX: 0,
    initialPStart: pStartMin,
    initialEStart: eStartMin,
    initialEEnd: eEndMin,
    initialTEnd: tEndMin,
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
    dragContextRef.current = {
      startX: clientX,
      initialPStart: pStartMin,
      initialEStart: eStartMin,
      initialEEnd: eEndMin,
      initialTEnd: tEndMin,
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

  // Window drag listeners
  useEffect(() => {
    if (!activeDrag) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const currentX = getClientX(e);
      const deltaX = currentX - dragContextRef.current.startX;
      const deltaMinutes = Math.round(((deltaX / rect.width) * 1440) / 15) * 15;

      const {
        initialPStart,
        initialEStart,
        initialEEnd,
        initialTEnd,
      } = dragContextRef.current;

      const MIN_DURATION = 30; // 30 minutes minimum per phase

      let nextPStart = pStartMin;
      let nextEStart = eStartMin;
      let nextEEnd = eEndMin;
      let nextTEnd = tEndMin;

      if (activeDrag === 1) {
        // Handle 1: Setting up Start
        nextPStart = Math.max(0, Math.min(initialEStart - MIN_DURATION, initialPStart + deltaMinutes));
      } else if (activeDrag === 2) {
        // Handle 2: Boundary between Setting up & Event
        nextEStart = Math.max(
          initialPStart + MIN_DURATION,
          Math.min(initialEEnd - MIN_DURATION, initialEStart + deltaMinutes)
        );
      } else if (activeDrag === 3) {
        // Handle 3: Boundary between Event & Tearing down
        nextEEnd = Math.max(
          initialEStart + MIN_DURATION,
          Math.min(initialTEnd - MIN_DURATION, initialEEnd + deltaMinutes)
        );
      } else if (activeDrag === 4) {
        // Handle 4: Tearing down End
        nextTEnd = Math.max(
          initialEEnd + MIN_DURATION,
          Math.min(1440, initialTEnd + deltaMinutes)
        );
      } else if (activeDrag === "range1") {
        // Slide Setting up window
        const dur = initialEStart - initialPStart;
        const maxShift = initialEEnd - MIN_DURATION - initialEStart;
        const minShift = -initialPStart;
        const clampedShift = Math.max(minShift, Math.min(maxShift, deltaMinutes));
        nextPStart = initialPStart + clampedShift;
        nextEStart = initialEStart + clampedShift;
      } else if (activeDrag === "range2") {
        // Slide Event time range window
        const dur = initialEEnd - initialEStart;
        const maxShift = initialTEnd - MIN_DURATION - initialEEnd;
        const minShift = initialPStart + MIN_DURATION - initialEStart;
        const clampedShift = Math.max(minShift, Math.min(maxShift, deltaMinutes));
        nextEStart = initialEStart + clampedShift;
        nextEEnd = initialEEnd + clampedShift;
      } else if (activeDrag === "range3") {
        // Slide Tearing down window
        const dur = initialTEnd - initialEEnd;
        const maxShift = 1440 - initialTEnd;
        const minShift = initialEEnd + MIN_DURATION - initialTEnd;
        const clampedShift = Math.max(minShift, Math.min(maxShift, deltaMinutes));
        nextTEnd = initialTEnd + clampedShift;
      }

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

  // Nudge helpers
  const nudge = (field: "pStart" | "eStart" | "eEnd" | "tEnd", delta: number) => {
    let nextP = pStartMin;
    let nextES = eStartMin;
    let nextEE = eEndMin;
    let nextTE = tEndMin;

    const MIN_DURATION = 30;

    if (field === "pStart") {
      nextP = Math.max(0, Math.min(eStartMin - MIN_DURATION, pStartMin + delta));
    } else if (field === "eStart") {
      nextES = Math.max(pStartMin + MIN_DURATION, Math.min(eEndMin - MIN_DURATION, eStartMin + delta));
    } else if (field === "eEnd") {
      nextEE = Math.max(eStartMin + MIN_DURATION, Math.min(tEndMin - MIN_DURATION, eEndMin + delta));
    } else if (field === "tEnd") {
      nextTE = Math.max(eEndMin + MIN_DURATION, Math.min(1440, tEndMin + delta));
    }

    onChange({
      prepStart: minutesToTime(nextP),
      prepEnd: minutesToTime(nextES),
      eventStart: minutesToTime(nextES),
      eventEnd: minutesToTime(nextEE),
      teardownStart: minutesToTime(nextEE),
      teardownEnd: minutesToTime(nextTE),
    });
  };

  // Convert to percent of 1440
  const p1Left = (pStartMin / 1440) * 100;
  const p1Width = ((eStartMin - pStartMin) / 1440) * 100;

  const p2Left = (eStartMin / 1440) * 100;
  const p2Width = ((eEndMin - eStartMin) / 1440) * 100;

  const p3Left = (eEndMin / 1440) * 100;
  const p3Width = ((tEndMin - eEndMin) / 1440) * 100;

  // Major Hour Tick marks (00, 04, 08, 12, 16, 20, 24)
  const hourTicks = [
    { hour: 0, label: "00h" },
    { hour: 4, label: "04h" },
    { hour: 8, label: "08h" },
    { hour: 12, label: "12h" },
    { hour: 16, label: "16h" },
    { hour: 20, label: "20h" },
    { hour: 24, label: "24h" },
  ];

  return (
    <section className="bg-white border border-[#ececf0] rounded-[24px] p-5 sm:p-6 shadow-xs space-y-5">
      {/* Top Header: Date Picker & Visual Range Legend */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#ececf0]">
        {/* Date Selector */}
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

        {/* 3 Color Badges Header */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Setting up */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 font-semibold shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <span className="font-bold">Setting up:</span>
            <span>{minutesToTime(pStartMin)} - {minutesToTime(eStartMin)}</span>
            <span className="text-[10px] text-amber-700 bg-amber-100/70 px-1.5 py-0.2 rounded-md font-bold">
              {formatDuration(pStartMin, eStartMin)}
            </span>
          </div>

          {/* Event time range */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-950 font-semibold shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-bold">Event time:</span>
            <span>{minutesToTime(eStartMin)} - {minutesToTime(eEndMin)}</span>
            <span className="text-[10px] text-emerald-800 bg-emerald-100/80 px-1.5 py-0.2 rounded-md font-bold">
              {formatDuration(eStartMin, eEndMin)}
            </span>
          </div>

          {/* Tearing down */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-950 font-semibold shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />
            <span className="font-bold">Tearing down:</span>
            <span>{minutesToTime(eEndMin)} - {minutesToTime(tEndMin)}</span>
            <span className="text-[10px] text-indigo-800 bg-indigo-100/70 px-1.5 py-0.2 rounded-md font-bold">
              {formatDuration(eEndMin, tEndMin)}
            </span>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* THE 3-RANGE COLORED TIME WINDOW SLIDER TRACK                         */}
      {/* =================================================================== */}
      <div className="space-y-2 select-none">
        {/* Track */}
        <div
          ref={trackRef}
          className="relative h-14 sm:h-16 bg-[#f4f4f7] rounded-2xl border border-[#e5e5ea] overflow-hidden shadow-inner cursor-pointer"
        >
          {/* Subtle vertical hour guide lines across the background */}
          {hourTicks.map((tick) => {
            const leftPct = (tick.hour / 24) * 100;
            return (
              <div
                key={tick.hour}
                style={{ left: `${leftPct}%` }}
                className="absolute top-0 bottom-0 w-px bg-[#e5e5ea] pointer-events-none"
              />
            );
          })}

          {/* ------------------------------------------------------------- */}
          {/* RANGE 1: SETTING UP (Montagem) - AMBER                        */}
          {/* ------------------------------------------------------------- */}
          <div
            style={{
              left: `${p1Left}%`,
              width: `${p1Width}%`,
            }}
            onMouseEnter={() => setHoveredRange(1)}
            onMouseLeave={() => setHoveredRange(null)}
            onMouseDown={(e) => handlePointerDown("range1", e)}
            onTouchStart={(e) => handlePointerDown("range1", e)}
            className={`absolute top-1 bottom-1 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-md flex items-center justify-between px-2 overflow-hidden cursor-grab active:cursor-grabbing border border-amber-300 transition-opacity ${
              activeDrag === "range1" ? "opacity-90 ring-2 ring-amber-400" : "hover:brightness-105"
            }`}
            title="Arrastar período de Setting up (Montagem)"
          >
            <div className="flex items-center gap-1.5 min-w-0 pointer-events-none">
              <Wrench className="w-3.5 h-3.5 shrink-0 text-amber-100 drop-shadow-xs" />
              <div className="min-w-0">
                <span className="text-[11px] font-black block truncate leading-none drop-shadow-xs">
                  Setting up
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
          {/* RANGE 2: EVENT TIME RANGE (Festa / Evento) - EMERALD         */}
          {/* ------------------------------------------------------------- */}
          <div
            style={{
              left: `${p2Left}%`,
              width: `${p2Width}%`,
            }}
            onMouseEnter={() => setHoveredRange(2)}
            onMouseLeave={() => setHoveredRange(null)}
            onMouseDown={(e) => handlePointerDown("range2", e)}
            onTouchStart={(e) => handlePointerDown("range2", e)}
            className={`absolute top-1 bottom-1 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md flex items-center justify-between px-2 overflow-hidden cursor-grab active:cursor-grabbing border border-emerald-400 transition-opacity ${
              activeDrag === "range2" ? "opacity-90 ring-2 ring-emerald-400" : "hover:brightness-105"
            }`}
            title="Arrastar período de Event time range (Festa)"
          >
            <div className="flex items-center gap-1.5 min-w-0 pointer-events-none">
              <PartyPopper className="w-3.5 h-3.5 shrink-0 text-emerald-100 drop-shadow-xs" />
              <div className="min-w-0">
                <span className="text-[11px] font-black block truncate leading-none drop-shadow-xs">
                  Event time
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
          {/* RANGE 3: TEARING DOWN (Desmontagem) - INDIGO                 */}
          {/* ------------------------------------------------------------- */}
          <div
            style={{
              left: `${p3Left}%`,
              width: `${p3Width}%`,
            }}
            onMouseEnter={() => setHoveredRange(3)}
            onMouseLeave={() => setHoveredRange(null)}
            onMouseDown={(e) => handlePointerDown("range3", e)}
            onTouchStart={(e) => handlePointerDown("range3", e)}
            className={`absolute top-1 bottom-1 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md flex items-center justify-between px-2 overflow-hidden cursor-grab active:cursor-grabbing border border-indigo-400 transition-opacity ${
              activeDrag === "range3" ? "opacity-90 ring-2 ring-indigo-400" : "hover:brightness-105"
            }`}
            title="Arrastar período de Tearing down (Desmontagem)"
          >
            <div className="flex items-center gap-1.5 min-w-0 pointer-events-none">
              <Truck className="w-3.5 h-3.5 shrink-0 text-indigo-100 drop-shadow-xs" />
              <div className="min-w-0">
                <span className="text-[11px] font-black block truncate leading-none drop-shadow-xs">
                  Tearing down
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
          {/* DRAGGABLE THUMBS / HANDLES                                   */}
          {/* ------------------------------------------------------------- */}
          {/* Handle 1: Setting up Start */}
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

          {/* Handle 2: Boundary between Setting up & Event */}
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

          {/* Handle 3: Boundary between Event & Tearing down */}
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

          {/* Handle 4: Tearing down End */}
          <div
            style={{ left: `${(tEndMin / 1440) * 100}%` }}
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

        {/* Hour markers timeline scale below track */}
        <div className="relative h-4 px-1 text-[10px] font-semibold text-[#8e8e93]">
          {hourTicks.map((tick) => {
            const leftPct = (tick.hour / 24) * 100;
            return (
              <span
                key={tick.hour}
                style={{
                  left: `${leftPct}%`,
                  transform: tick.hour === 0 ? "none" : tick.hour === 24 ? "translateX(-100%)" : "translateX(-50%)",
                }}
                className="absolute top-0"
              >
                {tick.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3 RANGE CARDS WITH QUICK NUDGE CONTROLS                            */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        {/* Card 1: Setting up */}
        <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <span>Setting up</span>
              <span className="text-[10px] font-medium text-amber-700">(Montagem)</span>
            </div>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900">
              {formatDuration(pStartMin, eStartMin)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-1 text-xs">
            <div className="flex items-center gap-1 bg-white border border-amber-200 rounded-xl px-2 py-1 shadow-2xs">
              <button
                type="button"
                onClick={() => nudge("pStart", -15)}
                className="p-0.5 text-amber-800 hover:text-amber-950 cursor-pointer"
                title="Antecipar 15 min"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-bold text-[#111] min-w-[38px] text-center">
                {minutesToTime(pStartMin)}
              </span>
              <button
                type="button"
                onClick={() => nudge("pStart", 15)}
                className="p-0.5 text-amber-800 hover:text-amber-950 cursor-pointer"
                title="Adiar 15 min"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <span className="text-amber-700 text-xs font-medium">às</span>

            <div className="flex items-center gap-1 bg-white border border-amber-200 rounded-xl px-2 py-1 shadow-2xs">
              <button
                type="button"
                onClick={() => nudge("eStart", -15)}
                className="p-0.5 text-amber-800 hover:text-amber-950 cursor-pointer"
                title="Antecipar 15 min"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-bold text-[#111] min-w-[38px] text-center">
                {minutesToTime(eStartMin)}
              </span>
              <button
                type="button"
                onClick={() => nudge("eStart", 15)}
                className="p-0.5 text-amber-800 hover:text-amber-950 cursor-pointer"
                title="Adiar 15 min"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Event time range */}
        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Event time range</span>
              <span className="text-[10px] font-medium text-emerald-700">(Festa)</span>
            </div>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-950">
              {formatDuration(eStartMin, eEndMin)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-1 text-xs">
            <div className="flex items-center gap-1 bg-white border border-emerald-200 rounded-xl px-2 py-1 shadow-2xs">
              <button
                type="button"
                onClick={() => nudge("eStart", -15)}
                className="p-0.5 text-emerald-800 hover:text-emerald-950 cursor-pointer"
                title="Antecipar início do evento 15 min"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-bold text-emerald-950 min-w-[38px] text-center">
                {minutesToTime(eStartMin)}
              </span>
              <button
                type="button"
                onClick={() => nudge("eStart", 15)}
                className="p-0.5 text-emerald-800 hover:text-emerald-950 cursor-pointer"
                title="Adiar início do evento 15 min"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <span className="text-emerald-800 text-xs font-medium">às</span>

            <div className="flex items-center gap-1 bg-white border border-emerald-200 rounded-xl px-2 py-1 shadow-2xs">
              <button
                type="button"
                onClick={() => nudge("eEnd", -15)}
                className="p-0.5 text-emerald-800 hover:text-emerald-950 cursor-pointer"
                title="Antecipar fim do evento 15 min"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-bold text-emerald-950 min-w-[38px] text-center">
                {minutesToTime(eEndMin)}
              </span>
              <button
                type="button"
                onClick={() => nudge("eEnd", 15)}
                className="p-0.5 text-emerald-800 hover:text-emerald-950 cursor-pointer"
                title="Adiar fim do evento 15 min"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Card 3: Tearing down */}
        <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />
              <span>Tearing down</span>
              <span className="text-[10px] font-medium text-indigo-700">(Desmontagem)</span>
            </div>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-200/80 text-indigo-950">
              {formatDuration(eEndMin, tEndMin)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-1 text-xs">
            <div className="flex items-center gap-1 bg-white border border-indigo-200 rounded-xl px-2 py-1 shadow-2xs">
              <button
                type="button"
                onClick={() => nudge("eEnd", -15)}
                className="p-0.5 text-indigo-800 hover:text-indigo-950 cursor-pointer"
                title="Antecipar início da desmontagem 15 min"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-bold text-[#111] min-w-[38px] text-center">
                {minutesToTime(eEndMin)}
              </span>
              <button
                type="button"
                onClick={() => nudge("eEnd", 15)}
                className="p-0.5 text-indigo-800 hover:text-indigo-950 cursor-pointer"
                title="Adiar início da desmontagem 15 min"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <span className="text-indigo-700 text-xs font-medium">às</span>

            <div className="flex items-center gap-1 bg-white border border-indigo-200 rounded-xl px-2 py-1 shadow-2xs">
              <button
                type="button"
                onClick={() => nudge("tEnd", -15)}
                className="p-0.5 text-indigo-800 hover:text-indigo-950 cursor-pointer"
                title="Antecipar fim da desmontagem 15 min"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-bold text-[#111] min-w-[38px] text-center">
                {minutesToTime(tEndMin)}
              </span>
              <button
                type="button"
                onClick={() => nudge("tEnd", 15)}
                className="p-0.5 text-indigo-800 hover:text-indigo-950 cursor-pointer"
                title="Adiar fim da desmontagem 15 min"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
