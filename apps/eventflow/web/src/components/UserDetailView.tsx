"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Mail,
  Shield,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  Check,
  Edit3,
  X,
  ExternalLink,
  Briefcase,
} from "lucide-react";
import { updateUserAction } from "@/app/actions";

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "producer" | "warehouse";
  createdAt: Date;
}

interface AssignedTask {
  id: string;
  title: string;
  completed: boolean;
  priority: string | null;
  dueDate: Date | null;
  eventId: string;
  eventName: string;
  eventVenue: string | null;
  eventStartDate: Date;
}

interface UserDetailViewProps {
  user: TeamUser;
  assignedTasks: AssignedTask[];
}

export default function UserDetailView({
  user: initialUser,
  assignedTasks,
}: UserDetailViewProps) {
  const [user, setUser] = useState<TeamUser>(initialUser);
  const [copiedId, setCopiedId] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return {
          label: "Administrador (Total)",
          bg: "bg-[#eaf8ee] text-[#24793a] border-[#cbeed4]",
        };
      case "producer":
        return {
          label: "Gestor / Produtor de Eventos",
          bg: "bg-[#f0f7ff] text-[#0066cc] border-[#d6e7ff]",
        };
      case "warehouse":
        return {
          label: "Armazém & Logística",
          bg: "bg-[#fef7e0] text-[#b06000] border-[#feefc3]",
        };
      default:
        return {
          label: role,
          bg: "bg-[#f2f2f5] text-[#48484a] border-[#ececf0]",
        };
    }
  };

  const roleStyle = getRoleBadge(user.role);
  const completedTasks = assignedTasks.filter((t) => t.completed).length;
  const pendingTasks = assignedTasks.length - completedTasks;

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
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-[#ececf0] px-4 py-3">
        <div className="max-w-[1000px] mx-auto flex items-center justify-between">
          <Link
            href="/mais"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#636366] hover:text-[#111111] transition bg-[#f2f2f5] hover:bg-[#e5e5ea] px-3 py-1.5 rounded-full"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar à Gestão de Equipa</span>
          </Link>

          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111] bg-white border border-[#ececf0] hover:bg-[#f2f2f5] px-3.5 py-1.5 rounded-[12px] shadow-2xs transition cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editar Conta</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1000px] mx-auto px-4 pt-6 space-y-6">
        {/* ================================================================= */}
        {/* HERO CARD */}
        {/* ================================================================= */}
        <section className="bg-white border border-[#ececf0] rounded-[24px] p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-[20px] bg-[#111111] text-white flex items-center justify-center font-bold text-xl shadow-xs flex-shrink-0">
                {user.name.slice(0, 2).toUpperCase()}
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-[#111]">
                    {user.name}
                  </h1>

                  {/* Copyable ID Badge */}
                  <button
                    onClick={handleCopyId}
                    className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-[#fafafc] hover:bg-[#f2f2f5] text-[#8e8e93] hover:text-[#111] border border-[#ececf0] transition flex items-center gap-1.5 cursor-pointer"
                    title="Clique para copiar o ID do utilizador"
                  >
                    <span>#{user.id}</span>
                    {copiedId ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>

                <div className="text-xs text-[#8e8e93] flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{user.email}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Membro desde {formatDate(user.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <span
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 ${roleStyle.bg}`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{roleStyle.label}</span>
              </span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-[#ececf0]">
            <div className="p-3.5 rounded-[16px] bg-[#fafafc] border border-[#ececf0]">
              <div className="text-[11px] font-medium text-[#8e8e93]">Tarefas Atribuídas</div>
              <div className="text-xl font-extrabold text-[#111] mt-0.5">
                {assignedTasks.length} <span className="text-xs font-normal text-[#8e8e93]">ações</span>
              </div>
            </div>

            <div className="p-3.5 rounded-[16px] bg-[#f0f7ff] border border-[#d6e7ff]">
              <div className="text-[11px] font-medium text-[#0066cc]">Ações Pendentes</div>
              <div className="text-xl font-extrabold text-[#0066cc] mt-0.5">
                {pendingTasks} <span className="text-xs font-normal text-[#0066cc]/70">por concluir</span>
              </div>
            </div>

            <div className="p-3.5 rounded-[16px] bg-[#eaf8ee] border border-[#cbeed4]">
              <div className="text-[11px] font-medium text-[#24793a]">Ações Concluídas</div>
              <div className="text-xl font-extrabold text-[#24793a] mt-0.5">
                {completedTasks} <span className="text-xs font-normal text-[#24793a]/70">feitas</span>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* ASSIGNED TASKS & EVENT RESPONSIBILITIES */}
        {/* ================================================================= */}
        <section className="bg-white border border-[#ececf0] rounded-[24px] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#111]" />
                <h2 className="text-lg font-bold text-[#111]">
                  Responsabilidades & Ações nos Eventos
                </h2>
              </div>
              <p className="text-xs text-[#8e8e93] mt-0.5">
                Checklist e tarefas operacionais atribuídas a este membro da equipa
              </p>
            </div>

            <span className="text-xs font-bold px-3 py-1 bg-[#fafafc] border border-[#ececf0] rounded-full self-start sm:self-auto text-[#636366]">
              {assignedTasks.length} tarefa(s)
            </span>
          </div>

          {assignedTasks.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-[#ececf0] rounded-[18px] bg-[#fafafc]">
              <CheckCircle2 className="w-10 h-10 text-[#8e8e93] mx-auto mb-2 opacity-40" />
              <div className="text-sm font-bold text-[#111]">Sem tarefas pendentes</div>
              <p className="text-xs text-[#8e8e93] max-w-sm mx-auto mt-1 mb-4">
                Não existem tarefas operacionais atribuídas a este utilizador no momento.
              </p>
              <Link
                href="/eventos"
                className="px-4 py-2 rounded-[12px] bg-[#111] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
              >
                <span>Ver Eventos em Curso</span>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#ececf0] border border-[#ececf0] rounded-[16px] overflow-hidden">
              {assignedTasks.map((t) => (
                <div
                  key={t.id}
                  className={`p-4 bg-white hover:bg-[#fafafc] transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    t.completed ? "opacity-75" : ""
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 mt-0.5 sm:mt-0">
                      {t.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Circle className="w-5 h-5 text-[#8e8e93]" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm font-bold ${
                            t.completed ? "line-through text-[#8e8e93]" : "text-[#111]"
                          }`}
                        >
                          {t.title}
                        </span>
                        <span className="font-mono text-[10px] text-[#8e8e93] bg-[#fafafc] px-1.5 py-0.5 rounded border border-[#ececf0]">
                          #{t.id}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#8e8e93] mt-1">
                        <span>No evento:</span>
                        <Link
                          href={`/eventos/${t.eventId}`}
                          className="font-semibold text-[#111] hover:text-[#007aff] transition flex items-center gap-1"
                        >
                          <span>{t.eventName}</span>
                          <ExternalLink className="w-3 h-3 opacity-50" />
                        </Link>
                        <span className="font-mono text-[10px]">#{t.eventId}</span>
                        {t.eventVenue && <span>• {t.eventVenue}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                    {t.priority && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          t.priority === "urgente"
                            ? "bg-red-100 text-red-700"
                            : t.priority === "alta"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        {t.priority}
                      </span>
                    )}

                    {t.dueDate && (
                      <span className="text-[11px] text-[#8e8e93] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(t.dueDate)}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ================================================================= */}
      {/* EDIT USER MODAL */}
      {/* ================================================================= */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[22px] w-full max-w-sm border border-[#ececf0] shadow-xl overflow-hidden p-6 text-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#111]">Editar Conta de Equipa</h3>
                <p className="text-[11px] text-[#8e8e93]">#{user.id}</p>
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
                await updateUserAction(formData);
                setShowEditModal(false);
                window.location.reload();
              }}
              className="space-y-3.5"
            >
              <input type="hidden" name="userId" value={user.id} />

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">ID do Utilizador</label>
                <input
                  type="text"
                  value={user.id}
                  disabled
                  className="w-full px-3 py-2 bg-[#f2f2f7] text-[#8e8e93] font-mono border border-[#ececf0] rounded-[10px] cursor-not-allowed select-all"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Nome Completo *</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={user.name}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px] text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Email</label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full px-3 py-2 bg-[#f2f2f7] text-[#8e8e93] border border-[#ececf0] rounded-[10px] cursor-not-allowed text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Nível de Acesso *</label>
                <select
                  name="role"
                  defaultValue={user.role}
                  className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-[10px] text-xs"
                >
                  <option value="admin">Administrador (Total)</option>
                  <option value="producer">Gestor / Produtor de Eventos</option>
                  <option value="warehouse">Armazém / Logística</option>
                </select>
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
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
