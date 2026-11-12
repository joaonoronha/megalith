"use client";

import React, { useState } from "react";
import {
  X,
  Bell,
  Clock,
  Check,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Wrench,
  DollarSign,
  Package,
  Calendar,
  CheckCheck,
} from "lucide-react";

interface AlertItem {
  id: string;
  fingerprint: string;
  type: "low_stock" | "damaged_stock" | "event_unprepared" | "payment_due" | "missing_completed_payment";
  entityType: "inventory" | "event" | "quote" | "client";
  entityId: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "urgent" | "critical";
  status: "active" | "snoozed" | "acknowledged" | "resolved";
  metadata?: string | null;
  snoozedUntil?: Date | string | null;
  lastTriggeredAt: Date | string;
  acknowledgedAt?: Date | string | null;
  createdAt: Date | string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  alerts: AlertItem[];
  onSnooze: (alertId: string, hours: number) => void;
  onAcknowledge: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
  onMarkAllAsRead: () => void;
  onActionClick: (alert: AlertItem) => void;
}

export default function AlertsDrawerModal({
  isOpen,
  onClose,
  alerts,
  onSnooze,
  onAcknowledge,
  onDismiss,
  onMarkAllAsRead,
  onActionClick,
}: Props) {
  const [filter, setFilter] = useState<"all" | "new" | "snoozed">("all");
  const [openSnoozeMenuId, setOpenSnoozeMenuId] = useState<string | null>(null);

  if (!isOpen) return null;

  const nowTime = Date.now();

  const activeAlerts = alerts.filter((a) => {
    if (a.status === "resolved") return false;
    if (a.status === "snoozed") {
      if (a.snoozedUntil && new Date(a.snoozedUntil).getTime() > nowTime) {
        return false;
      }
    }
    return true;
  });

  const snoozedAlerts = alerts.filter((a) => {
    return (
      a.status === "snoozed" &&
      a.snoozedUntil &&
      new Date(a.snoozedUntil).getTime() > nowTime
    );
  });

  const newAlerts = activeAlerts.filter((a) => !a.acknowledgedAt);

  let displayedList: AlertItem[] = [];
  if (filter === "all") displayedList = activeAlerts;
  else if (filter === "new") displayedList = newAlerts;
  else if (filter === "snoozed") displayedList = snoozedAlerts;

  const getTypeIcon = (type: AlertItem["type"]) => {
    switch (type) {
      case "damaged_stock":
        return <Wrench className="w-4 h-4 text-[#ff3b30]" />;
      case "low_stock":
        return <Package className="w-4 h-4 text-[#ff9f0a]" />;
      case "event_unprepared":
        return <Calendar className="w-4 h-4 text-[#ff9f0a]" />;
      case "payment_due":
      case "missing_completed_payment":
        return <DollarSign className="w-4 h-4 text-[#ff3b30]" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-[#ff9f0a]" />;
    }
  };

  const getTypeLabel = (type: AlertItem["type"]) => {
    switch (type) {
      case "damaged_stock":
        return { label: "Dano", color: "bg-[#ff3b30]/10 text-[#a62a24]" };
      case "low_stock":
        return { label: "Stock", color: "bg-[#ff9f0a]/15 text-[#845000]" };
      case "event_unprepared":
        return { label: "Preparação", color: "bg-[#ff9f0a]/15 text-[#845000]" };
      case "payment_due":
        return { label: "Sinal 5 Dias", color: "bg-[#ff3b30]/10 text-[#a62a24]" };
      case "missing_completed_payment":
        return { label: "Cobrança", color: "bg-[#ff3b30]/10 text-[#a62a24]" };
      default:
        return { label: "Alerta", color: "bg-black/5 text-[#555]" };
    }
  };

  const getActionLabel = (type: AlertItem["type"]) => {
    switch (type) {
      case "damaged_stock":
        return "Fazer triagem";
      case "low_stock":
        return "Ver artigo";
      case "event_unprepared":
        return "Ver tarefas";
      case "payment_due":
      case "missing_completed_payment":
        return "Registar recebimento";
      default:
        return "Ver detalhes";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer content */}
      <div className="relative w-full sm:max-w-[500px] max-h-[92vh] sm:max-h-none h-[92vh] sm:h-full bg-[#f5f5f7] rounded-t-[28px] sm:rounded-t-none border-t sm:border-t-0 sm:border-l border-[#ececf0] shadow-2xl flex flex-col z-10 animate-in slide-in-from-bottom sm:slide-in-from-right duration-200 overflow-hidden">
        {/* iOS Mobile Drag Handle */}
        <div className="w-full pt-2.5 pb-1 flex justify-center sm:hidden flex-shrink-0 bg-white">
          <div className="w-12 h-1.5 bg-[#d1d1d6] rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 bg-white border-b border-[#ececf0] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#ff3b30]/10 flex items-center justify-center text-[#ff3b30] flex-shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#111]">Centro de Alertas</h3>
              <p className="text-[11px] sm:text-xs text-[#8e8e93]">
                {activeAlerts.length} ativos · {newAlerts.length} novos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl text-[#8e8e93] hover:text-[#111] hover:bg-[#f2f2f5] active:bg-[#e5e5ea] transition cursor-pointer flex items-center justify-center touch-manipulation"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters and Batch Actions Bar */}
        <div className="px-4 sm:px-5 py-2.5 bg-white/80 backdrop-blur-xs border-b border-[#ececf0] flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
            <button
              onClick={() => setFilter("all")}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer touch-manipulation ${
                filter === "all"
                  ? "bg-[#111] text-white shadow-xs"
                  : "bg-white text-[#636366] hover:bg-[#ececf0] border border-[#ececf0]"
              }`}
            >
              Ativos ({activeAlerts.length})
            </button>
            <button
              onClick={() => setFilter("new")}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 touch-manipulation ${
                filter === "new"
                  ? "bg-[#007aff] text-white shadow-xs"
                  : "bg-white text-[#636366] hover:bg-[#ececf0] border border-[#ececf0]"
              }`}
            >
              <span>Novos</span>
              {newAlerts.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    filter === "new" ? "bg-white text-[#007aff]" : "bg-[#007aff] text-white"
                  }`}
                >
                  {newAlerts.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilter("snoozed")}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer touch-manipulation ${
                filter === "snoozed"
                  ? "bg-[#111] text-white shadow-xs"
                  : "bg-white text-[#636366] hover:bg-[#ececf0] border border-[#ececf0]"
              }`}
            >
              Adiados ({snoozedAlerts.length})
            </button>
          </div>

          {newAlerts.length > 0 && filter !== "snoozed" && (
            <button
              onClick={onMarkAllAsRead}
              className="flex-shrink-0 text-xs font-semibold text-[#007aff] hover:underline flex items-center gap-1 cursor-pointer py-1 touch-manipulation"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Marcar lidos</span>
            </button>
          )}
        </div>

        {/* Alert Items List */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 pb-[max(2.5rem,calc(1.5rem+env(safe-area-inset-bottom)))] overscroll-contain">
          {displayedList.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-[#8e8e93]">
              <div className="w-12 h-12 rounded-2xl bg-white border border-[#ececf0] flex items-center justify-center mb-3 text-emerald-600 shadow-xs">
                <Check className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-[#111]">Tudo operacional</p>
              <p className="text-xs text-[#8e8e93] mt-1">
                {filter === "snoozed"
                  ? "Não tem alertas adiados neste momento."
                  : filter === "new"
                  ? "Não tem alertas por ler. Todos os itens ativos foram revistos."
                  : "Não existem alertas ou pendências operacionais."}
              </p>
            </div>
          ) : (
            displayedList.map((alert) => {
              const isNew = !alert.acknowledgedAt;
              const typeMeta = getTypeLabel(alert.type);
              const isSnoozeMenuOpen = openSnoozeMenuId === alert.id;

              return (
                <div
                  key={alert.id}
                  className={`bg-white rounded-2xl p-4 border transition shadow-xs relative ${
                    isNew
                      ? "border-[#007aff]/30 ring-1 ring-[#007aff]/20"
                      : "border-[#ececf0]"
                  }`}
                >
                  {/* Top line: Category, Status, Snooze menu */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${typeMeta.color}`}
                      >
                        {typeMeta.label}
                      </span>
                      {isNew && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#007aff] text-white">
                          Novo
                        </span>
                      )}
                      {alert.status === "snoozed" && alert.snoozedUntil && (
                        <span className="text-[11px] font-medium text-[#8e8e93] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#ff9f0a]" />
                          Adiado até{" "}
                          {new Date(alert.snoozedUntil).toLocaleDateString("pt-PT", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>

                    {/* Snooze & Actions Dropdown Button (Touch-Friendly Target) */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setOpenSnoozeMenuId(isSnoozeMenuOpen ? null : alert.id)
                        }
                        className="w-8 h-8 rounded-lg text-[#8e8e93] hover:text-[#111] hover:bg-[#f2f2f5] active:bg-[#e5e5ea] transition cursor-pointer flex items-center justify-center touch-manipulation"
                        title="Opções de adiamento"
                        aria-label="Adiar alerta"
                      >
                        <Clock className="w-4 h-4" />
                      </button>

                      {isSnoozeMenuOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-[#ececf0] rounded-2xl shadow-xl p-1.5 z-30 animate-in fade-in zoom-in-95 duration-150">
                          <div className="text-[10px] font-bold text-[#8e8e93] uppercase px-2.5 py-1.5">
                            Adiar alerta
                          </div>
                          <button
                            onClick={() => {
                              onSnooze(alert.id, 4);
                              setOpenSnoozeMenuId(null);
                            }}
                            className="w-full text-left px-2.5 py-2 text-xs sm:text-sm text-[#111] hover:bg-[#f2f2f5] active:bg-[#e5e5ea] rounded-xl transition cursor-pointer"
                          >
                            🕒 Adiar por 4 horas
                          </button>
                          <button
                            onClick={() => {
                              onSnooze(alert.id, 24);
                              setOpenSnoozeMenuId(null);
                            }}
                            className="w-full text-left px-2.5 py-2 text-xs sm:text-sm text-[#111] hover:bg-[#f2f2f5] active:bg-[#e5e5ea] rounded-xl transition cursor-pointer"
                          >
                            🕒 Adiar por 1 dia
                          </button>
                          <button
                            onClick={() => {
                              onSnooze(alert.id, 72);
                              setOpenSnoozeMenuId(null);
                            }}
                            className="w-full text-left px-2.5 py-2 text-xs sm:text-sm text-[#111] hover:bg-[#f2f2f5] active:bg-[#e5e5ea] rounded-xl transition cursor-pointer"
                          >
                            🕒 Adiar por 3 dias
                          </button>
                          <button
                            onClick={() => {
                              onSnooze(alert.id, 168);
                              setOpenSnoozeMenuId(null);
                            }}
                            className="w-full text-left px-2.5 py-2 text-xs sm:text-sm text-[#111] hover:bg-[#f2f2f5] active:bg-[#e5e5ea] rounded-xl transition cursor-pointer"
                          >
                            🕒 Adiar por 1 semana
                          </button>
                          <div className="border-t border-[#ececf0] my-1" />
                          <button
                            onClick={() => {
                              onDismiss(alert.id);
                              setOpenSnoozeMenuId(null);
                            }}
                            className="w-full text-left px-2.5 py-2 text-xs sm:text-sm text-rose-600 hover:bg-rose-50 active:bg-rose-100 rounded-xl transition cursor-pointer font-medium"
                          >
                            Dispensar alerta
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Message */}
                  <div className="space-y-1">
                    <h4 className="text-[14px] sm:text-[15px] font-bold text-[#111] leading-snug">
                      {alert.title}
                    </h4>
                    <p className="text-[12px] sm:text-[13px] text-[#636366] leading-relaxed">
                      {alert.message}
                    </p>
                  </div>

                  {/* Actions footer (Touch-friendly buttons on mobile) */}
                  <div className="mt-3 pt-3 border-t border-[#f2f2f5] flex items-center justify-between gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        onActionClick(alert);
                        onAcknowledge(alert.id);
                      }}
                      className="flex-1 sm:flex-initial min-h-[40px] px-3.5 py-2 rounded-xl bg-[#111] active:bg-black hover:bg-black text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs touch-manipulation"
                    >
                      <span>{getActionLabel(alert.type)}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1.5">
                      {isNew && (
                        <button
                          onClick={() => onAcknowledge(alert.id)}
                          className="min-h-[40px] px-3 py-2 rounded-xl bg-[#f2f2f5] active:bg-[#e5e5ea] hover:bg-[#ececf0] text-[#636366] text-xs font-medium transition cursor-pointer touch-manipulation"
                          title="Marcar como lido"
                        >
                          Marcar lido
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
