"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  History,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  FileText,
  Package,
  Calendar,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { getAuditLogsAction } from "@/app/actions";
import { formatRelativeTime, formatAuditDate } from "@/lib/date-format";

export interface AuditLogItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  title: string;
  details: string | null;
  userId: string | null;
  userName: string;
  userEmail: string | null;
  userRole: string | null;
  changes: string | null;
  createdAt: Date | string | number;
}

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: "event" | "inventory" | "quote";
  entityId: string;
  entityTitle: string;
  initialLogs?: AuditLogItem[];
}

export default function AuditLogModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityTitle,
  initialLogs,
}: AuditLogModalProps) {
  const [logs, setLogs] = useState<AuditLogItem[]>(initialLogs || []);
  const [isLoading, setIsLoading] = useState(!initialLogs || initialLogs.length === 0);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await getAuditLogsAction(entityType, entityId);
      setLogs((data as AuditLogItem[]) || []);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, entityType, entityId]);

  if (!isOpen) return null;

  const entityTypeLabels: Record<string, string> = {
    event: "Evento",
    inventory: "Artigo de Stock",
    quote: "Orçamento",
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "criado":
        return { bg: "bg-[#eaf8ee]", text: "text-[#24793a]", label: "Criação" };
      case "alterou_estado":
      case "aprovado":
        return { bg: "bg-[#ebf5fb]", text: "text-[#007aff]", label: "Estado" };
      case "triagem":
        return { bg: "bg-[#fff4df]", text: "text-[#b06000]", label: "Triagem" };
      case "alocou_material":
      case "removeu_material":
        return { bg: "bg-[#f3e8ff]", text: "text-[#7e22ce]", label: "Logística" };
      case "tarefa":
        return { bg: "bg-[#fef3c7]", text: "text-[#92400e]", label: "Checklist" };
      default:
        return { bg: "bg-[#f2f2f5]", text: "text-[#48484a]", label: "Alteração" };
    }
  };

  const getUserInitials = (name: string) => {
    if (!name) return "CFM";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 antialiased animate-in fade-in duration-200">
      <div className="bg-white rounded-[24px] w-full max-w-xl border border-[#ececf0] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#ececf0] flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-[#f5f5f7] border border-black/5 flex items-center justify-center text-[#111111]">
              <History className="w-5 h-5 text-[#007aff]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#007aff] uppercase tracking-wider">
                  Auditing Log · {entityTypeLabels[entityType] || entityType}
                </span>
                <span className="font-mono text-[10px] text-[#8e8e93] bg-[#f5f5f7] px-1.5 py-0.5 rounded border border-[#ececf0]">
                  #{entityId}
                </span>
              </div>
              <h2 className="text-[17px] font-bold text-[#111111] truncate max-w-sm sm:max-w-md">
                {entityTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchLogs}
              disabled={isLoading}
              className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93] hover:text-[#111] transition cursor-pointer"
              title="Atualizar histórico"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93] hover:text-[#111] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {isLoading && logs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[#8e8e93]">
              <div className="w-6 h-6 border-2 border-[#007aff] border-t-transparent rounded-full animate-spin"></div>
              <span>A carregar histórico de alterações...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#8e8e93]">
              <Clock className="w-8 h-8 mx-auto text-[#c7c7cc] mb-2" />
              <div className="font-semibold text-sm text-[#111111]">Ainda sem histórico registado</div>
              <p className="mt-1 text-[#8e8e93]">
                As alterações efetuadas a este item serão registadas automaticamente com a hora exata e o autor.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-[#8e8e93] pb-1">
                <span>Todas as alterações anteriores ({logs.length})</span>
                <span>Hora & Autor</span>
              </div>

              <div className="relative pl-6 space-y-5 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[#ececf0]">
                {logs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const dateObj = new Date(log.createdAt);

                  return (
                    <div key={log.id} className="relative group">
                      {/* Timeline dot */}
                      <span className="absolute -left-[29px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-[#007aff] shadow-2xs" />

                      <div className="bg-[#f9f9fb] hover:bg-white border border-[#ececf0] rounded-[16px] p-4 transition shadow-2xs group-hover:border-[#d2d2d7]">
                        {/* Top row: Title + Relative time */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[14px] text-[#111111]">
                              {log.title}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}
                            >
                              {badge.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-[#8e8e93] font-medium">
                            <Clock className="w-3.5 h-3.5 text-[#8e8e93]" />
                            <span className="text-[#111111] font-semibold">
                              {formatAuditDate(dateObj)}
                            </span>
                            <span className="text-[#8e8e93]">
                              ({formatRelativeTime(dateObj, "en")})
                            </span>
                          </div>
                        </div>

                        {/* Details */}
                        {log.details && (
                          <div className="text-xs text-[#3a3a3c] mb-3 leading-relaxed">
                            {log.details}
                          </div>
                        )}

                        {/* Author info footer */}
                        <div className="flex items-center justify-between pt-2.5 border-t border-[#ececf0]/70 text-[11px]">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold text-[10px]">
                              {getUserInitials(log.userName)}
                            </div>
                            <span className="font-semibold text-[#111111]">
                              {log.userName}
                            </span>
                            {log.userRole && (
                              <span className="text-[10px] text-[#8e8e93] bg-[#f0f0f3] px-1.5 py-0.5 rounded uppercase">
                                {log.userRole}
                              </span>
                            )}
                          </div>

                          <span className="text-[10px] text-[#8e8e93] font-mono">
                            #{log.id.slice(-6)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#ececf0] bg-[#fafafc] flex items-center justify-between text-xs text-[#8e8e93]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Auditing ativo com registo imutável</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-[12px] bg-[#111111] hover:bg-black text-white text-xs font-bold transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
