"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  User,
  Users,
  CheckSquare,
  Plus,
  Trash2,
  ArrowLeft,
  ExternalLink,
  Share2,
  Check,
  AlertCircle,
  Link as LinkIcon,
  Unlink,
  Sparkles,
  FileText,
  CheckCircle2,
  ChevronRight,
  Edit3,
  Save,
  Phone,
  Mail,
  Copy,
  Info,
  Loader2,
  ListTodo,
  Tag,
} from "lucide-react";
import {
  updateMeetingStatusAction,
  updateMeetingDetailsAction,
  addEventTaskAction,
  toggleEventTaskAction,
  deleteEventTaskAction,
  updateMeetingConversationAction,
  updateMeetingParticipantsAction,
  linkMeetingDirectAction,
  unlinkMeetingFromEventAction,
} from "@/app/actions";
import { formatRelativeTime } from "@/lib/date-format";

interface Client {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  nif: string | null;
  address: string | null;
  notes: string | null;
}

interface Task {
  id: string;
  title: string;
  completed: boolean;
  dueDate: Date | null;
  priority: string | null;
  assignedTo: string | null;
  orderIndex: number | null;
}

interface EventData {
  id: string;
  name: string;
  clientId: string | null;
  venue: string | null;
  startDate: Date;
  endDate: Date | null;
  status: string;
  category?: string | null;
  theme?: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt?: Date | null;
  lastUpdatedByName?: string | null;
}

export interface MeetingData {
  id: string;
  title: string;
  name?: string; // fallback alias
  eventId?: string | null;
  linkedEventId?: string | null; // fallback alias
  clientId: string | null;
  venue?: string | null;
  location?: string | null;
  meetUrl?: string | null;
  type?: "google_meet" | "presencial" | "outro" | string;
  startDate: Date;
  endDate: Date | null;
  status: string;
  notes: string | null;
  meetingSummary?: string | null;
  meetingParticipants?: string | null;
  source?: string;
  calendlyUri?: string | null;
  calendlyEventUri?: string | null;
  clientContactName?: string | null;
  clientContactEmail?: string | null;
  clientContactPhone?: string | null;
  createdAt: Date;
  updatedAt?: Date | null;
  lastUpdatedByName?: string | null;
}

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Participant {
  name: string;
  role: string;
  email?: string;
  type: "team" | "client";
}

interface MeetingDetailViewProps {
  meeting: MeetingData;
  client: Client | null;
  linkedEvent: EventData | null;
  allProductionEvents: EventData[];
  actionItems: Task[];
  teamUsers: TeamUser[];
  currentUser: any;
}

export default function MeetingDetailView({
  meeting: initialMeeting,
  client,
  linkedEvent: initialLinkedEvent,
  allProductionEvents,
  actionItems: initialActionItems,
  teamUsers,
  currentUser,
}: MeetingDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [meeting, setMeeting] = useState(initialMeeting);
  const [linkedEvent, setLinkedEvent] = useState(initialLinkedEvent);
  const [actionItems, setActionItems] = useState<Task[]>(initialActionItems);

  // Status state
  const [status, setStatus] = useState(meeting.status || "agendada");

  // Summary of the conversation
  const [conversationSummary, setConversationSummary] = useState(
    meeting.meetingSummary || meeting.notes || ""
  );
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [summarySavedNotice, setSummarySavedNotice] = useState(false);

  // Participants parsing
  const getInitialParticipants = (): Participant[] => {
    if (meeting.meetingParticipants) {
      try {
        const parsed = JSON.parse(meeting.meetingParticipants);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    const defaultParticipants: Participant[] = [];
    if (client) {
      defaultParticipants.push({
        name: client.name,
        role: "Cliente",
        email: client.email || undefined,
        type: "client",
      });
    }
    if (teamUsers.length > 0) {
      defaultParticipants.push({
        name: teamUsers[0].name,
        role: teamUsers[0].role === "admin" ? "Gestor CFM" : "Equipa CFM",
        email: teamUsers[0].email,
        type: "team",
      });
    }
    return defaultParticipants;
  };

  const [participants, setParticipants] = useState<Participant[]>(getInitialParticipants());
  const [newParticipantName, setNewParticipantName] = useState("");
  const [newParticipantRole, setNewParticipantRole] = useState("Equipa CFM");
  const [newParticipantType, setNewParticipantType] = useState<"team" | "client">("team");
  const [showAddParticipant, setShowAddParticipant] = useState(false);

  // Action Items / Next Steps inline form
  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionAssignee, setNewActionAssignee] = useState(teamUsers[0]?.name || "Madalena Rosa");
  const [newActionDueDate, setNewActionDueDate] = useState("");
  const [newActionPriority, setNewActionPriority] = useState<"baixa" | "media" | "alta" | "urgente">("media");
  const [isAddingAction, setIsAddingAction] = useState(false);

  // Event Linking state
  const [selectedEventIdToLink, setSelectedEventIdToLink] = useState(
    allProductionEvents[0]?.id || ""
  );
  const [isLinkingEvent, setIsLinkingEvent] = useState(false);
  const [isUnlinkingEvent, setIsUnlinkingEvent] = useState(false);
  const [linkingError, setLinkingError] = useState<string | null>(null);

  // Time & Location editing
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editStartDate, setEditStartDate] = useState(
    new Date(meeting.startDate).toISOString().slice(0, 16)
  );
  const [editEndDate, setEditEndDate] = useState(
    meeting.endDate
      ? new Date(meeting.endDate).toISOString().slice(0, 16)
      : new Date(new Date(meeting.startDate).getTime() + 45 * 60 * 1000).toISOString().slice(0, 16)
  );
  const initialVenue = meeting.location || meeting.venue || "Google Meet (Online)";
  const [editVenue, setEditVenue] = useState(initialVenue);
  const [copiedId, setCopiedId] = useState(false);

  // Check if online meet
  const isMeet = Boolean(
    meeting.type === "google_meet" ||
    meeting.meetUrl ||
    initialVenue.toLowerCase().includes("meet") ||
    meeting.notes?.toLowerCase().includes("meet") ||
    meeting.calendlyUri ||
    meeting.calendlyEventUri
  );
  const meetUrl =
    meeting.meetUrl ||
    (isMeet
      ? initialVenue.includes("meet.google.com")
        ? initialVenue
        : `https://meet.google.com/cfm-${meeting.id.slice(-6)}`
      : null);

  // Format dates
  const startDate = new Date(meeting.startDate);
  const endDate = meeting.endDate ? new Date(meeting.endDate) : null;
  const durationMinutes = endDate
    ? Math.round((endDate.getTime() - startDate.getTime()) / 60000)
    : 45;

  const dateStr = startDate.toLocaleDateString("pt-PT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = `${String(startDate.getHours()).padStart(2, "0")}:${String(
    startDate.getMinutes()
  ).padStart(2, "0")}${
    endDate
      ? ` – ${String(endDate.getHours()).padStart(2, "0")}:${String(
          endDate.getMinutes()
        ).padStart(2, "0")}`
      : ""
  }`;

  // 1. Save Conversation Summary
  const handleSaveSummary = async () => {
    setIsSavingSummary(true);
    try {
      await updateMeetingConversationAction({
        meetingId: meeting.id,
        summary: conversationSummary,
      });
      setSummarySavedNotice(true);
      setTimeout(() => setSummarySavedNotice(false), 2500);
    } catch (err) {
      console.error("Erro ao guardar resumo:", err);
    } finally {
      setIsSavingSummary(false);
    }
  };

  // 2. Add Participant
  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParticipantName.trim()) return;

    const updated = [
      ...participants,
      {
        name: newParticipantName.trim(),
        role: newParticipantRole.trim() || "Participante",
        type: newParticipantType,
      },
    ];
    setParticipants(updated);
    setNewParticipantName("");
    setShowAddParticipant(false);

    try {
      await updateMeetingParticipantsAction({
        meetingId: meeting.id,
        participantsJson: JSON.stringify(updated),
      });
    } catch (err) {
      console.error("Erro ao guardar participantes:", err);
    }
  };

  const handleRemoveParticipant = async (index: number) => {
    const updated = participants.filter((_, i) => i !== index);
    setParticipants(updated);
    try {
      await updateMeetingParticipantsAction({
        meetingId: meeting.id,
        participantsJson: JSON.stringify(updated),
      });
    } catch (err) {
      console.error("Erro ao remover participante:", err);
    }
  };

  // 3. Action Items Handlers
  const handleAddActionItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionTitle.trim()) return;

    setIsAddingAction(true);
    try {
      const res = await addEventTaskAction(
        meeting.id,
        newActionTitle.trim(),
        newActionPriority,
        newActionDueDate || undefined,
        newActionAssignee
      );
      if (res.success && res.id) {
        const newTask: Task = {
          id: res.id,
          title: newActionTitle.trim(),
          completed: false,
          priority: newActionPriority,
          assignedTo: newActionAssignee,
          dueDate: newActionDueDate ? new Date(newActionDueDate) : null,
          orderIndex: Date.now(),
        };
        setActionItems((prev) => [newTask, ...prev]);
        setNewActionTitle("");
        setNewActionDueDate("");
      }
    } catch (err) {
      console.error("Erro ao criar ação:", err);
    } finally {
      setIsAddingAction(false);
    }
  };

  const handleToggleAction = async (taskId: string, currentCompleted: boolean) => {
    setActionItems((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !currentCompleted } : t))
    );
    try {
      await toggleEventTaskAction(taskId, !currentCompleted, meeting.id);
    } catch (err) {
      console.error("Erro ao alternar ação:", err);
      // rollback
      setActionItems((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, completed: currentCompleted } : t))
      );
    }
  };

  const handleDeleteAction = async (taskId: string) => {
    setActionItems((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await deleteEventTaskAction(taskId, meeting.id);
    } catch (err) {
      console.error("Erro ao apagar ação:", err);
    }
  };

  // 4. Link / Unlink Event
  const handleLinkToEvent = async () => {
    if (!selectedEventIdToLink) return;
    setIsLinkingEvent(true);
    setLinkingError(null);
    try {
      await linkMeetingDirectAction(meeting.id, selectedEventIdToLink);
      const target = allProductionEvents.find((e) => e.id === selectedEventIdToLink) || null;
      setLinkedEvent(target);
      setMeeting((prev) => ({ ...prev, linkedEventId: selectedEventIdToLink }));
    } catch (err: any) {
      console.error("Erro ao vincular evento:", err);
      setLinkingError(err?.message || "Não foi possível vincular o evento.");
    } finally {
      setIsLinkingEvent(false);
    }
  };

  const handleUnlinkEvent = async () => {
    setIsUnlinkingEvent(true);
    try {
      await unlinkMeetingFromEventAction(meeting.id);
      setLinkedEvent(null);
      setMeeting((prev) => ({ ...prev, linkedEventId: null }));
    } catch (err) {
      console.error("Erro ao desvincular:", err);
    } finally {
      setIsUnlinkingEvent(false);
    }
  };

  // 5. Update Status
  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus);
    setMeeting((prev) => ({ ...prev, status: newStatus }));
    try {
      await updateMeetingStatusAction(meeting.id, newStatus as any);
    } catch (err) {
      console.error("Erro ao mudar estado:", err);
    }
  };

  // 6. Save Time & Venue
  const handleSaveTimeVenue = async () => {
    try {
      await updateMeetingDetailsAction(meeting.id, {
        startDate: editStartDate,
        endDate: editEndDate,
        location: editVenue,
      });
      setMeeting((prev) => ({
        ...prev,
        startDate: new Date(editStartDate),
        endDate: new Date(editEndDate),
        venue: editVenue,
        location: editVenue,
      }));
      setIsEditingTime(false);
    } catch (err) {
      console.error("Erro ao guardar horário:", err);
    }
  };

  const completedActionsCount = actionItems.filter((a) => a.completed).length;

  return (
    <div className="min-h-screen bg-[#f8f8fa] text-[#111111]">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#ececf0] px-4 sm:px-8 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/calendario"
              className="p-2 rounded-[12px] bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[#111] transition flex items-center gap-1.5 text-xs font-semibold"
              title="Voltar à Agenda"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Agenda & Reuniões</span>
            </Link>

            <div className="h-5 w-[1px] bg-[#e5e5ea]" />

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#6366f1] to-[#4338ca] text-white flex items-center gap-1 shadow-2xs">
                <Video className="w-3 h-3" />
                <span>Reunião & Briefing</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Status Selector */}
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border outline-none cursor-pointer transition ${
                status === "realizada"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : status === "cancelada"
                  ? "bg-rose-50 text-rose-800 border-rose-200"
                  : "bg-indigo-50 text-indigo-800 border-indigo-200"
              }`}
            >
              <option value="agendada">● Agendada</option>
              <option value="realizada">✔ Realizada</option>
              <option value="cancelada">✕ Cancelada</option>
            </select>

            {meetUrl && (
              <a
                href={meetUrl}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 sm:px-3.5 py-1.5 rounded-[10px] bg-[#4338ca] hover:bg-[#3730a3] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition"
                title="Entrar no Google Meet"
              >
                <Video className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Entrar no Meet</span>
                <ExternalLink className="w-3 h-3 opacity-80 hidden sm:inline" />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Title & Quick Info */}
        <div className="bg-white border border-[#ececf0] rounded-[24px] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#6366f1] mb-1">
                <span>Consulta / Alinhamento CFM</span>
                {meeting.calendlyEventUri && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-[#4338ca] border border-indigo-100">
                    Sincronizado via Calendly
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111111] tracking-tight">
                {meeting.title || meeting.name}
              </h1>
            </div>

            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  navigator.clipboard.writeText(window.location.href);
                  setCopiedId(true);
                  setTimeout(() => setCopiedId(false), 2000);
                }
              }}
              className="self-start sm:self-auto px-3 py-1.5 rounded-full text-xs font-semibold bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[#111] transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Copiar link direto para esta reunião"
            >
              {copiedId ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Link copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-[#8e8e93]" />
                  <span>Partilhar</span>
                </>
              )}
            </button>
          </div>

          {/* Time & Venue Banner */}
          <div className="p-4 rounded-[18px] bg-gradient-to-r from-indigo-50/60 via-[#faf9ff] to-white border border-indigo-100/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-11 h-11 rounded-[14px] bg-white border border-indigo-200 text-[#4338ca] flex items-center justify-center shrink-0 shadow-2xs">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#6366f1] uppercase tracking-wider block">
                  Horário & Realização
                </span>
                <div className="text-sm font-bold text-[#111] capitalize">
                  {dateStr}
                </div>
                <div className="text-xs text-[#48484a] flex items-center gap-2 mt-0.5">
                  <span className="font-semibold">{timeStr}</span>
                  <span className="text-[11px] px-1.5 py-0.2 rounded bg-indigo-100/70 text-[#4338ca] font-medium">
                    {durationMinutes} min
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-indigo-100 pt-3 md:pt-0 md:pl-5">
              <div className="text-xs">
                <span className="text-[10px] uppercase font-bold text-[#8e8e93] block">
                  Formato / Local
                </span>
                <div className="flex items-center gap-1.5 font-bold text-[#111]">
                  {isMeet ? (
                    <>
                      <Video className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="truncate">Google Meet</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">{meeting.location || meeting.venue || "Presencial"}</span>
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditingTime(!isEditingTime)}
                className="px-2.5 py-1.5 rounded-[10px] bg-white border border-[#ececf0] hover:bg-[#f2f2f5] text-xs font-semibold text-[#111] transition flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#8e8e93]" />
                <span>{isEditingTime ? "Fechar" : "Editar"}</span>
              </button>
            </div>
          </div>

          {/* Time & Location Inline Editor */}
          {isEditingTime && (
            <div className="p-4 rounded-[16px] bg-[#fafafc] border border-[#ececf0] space-y-3 animate-in fade-in">
              <span className="text-xs font-bold text-[#111] block">
                Alterar Data, Horário e Local
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-[#8e8e93] block mb-1">Início</label>
                  <input
                    type="datetime-local"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#ececf0] rounded-lg font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#8e8e93] block mb-1">Fim</label>
                  <input
                    type="datetime-local"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#ececf0] rounded-lg font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#8e8e93] block mb-1">Local / Link</label>
                  <input
                    type="text"
                    value={editVenue}
                    onChange={(e) => setEditVenue(e.target.value)}
                    placeholder="Google Meet ou Morada..."
                    className="w-full px-2.5 py-1.5 bg-white border border-[#ececf0] rounded-lg font-semibold"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingTime(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#f2f2f5] text-xs font-semibold text-[#636366]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveTimeVenue}
                  className="px-4 py-1.5 rounded-lg bg-[#111] hover:bg-black text-white text-xs font-bold shadow-2xs"
                >
                  Guardar Horário
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* EVENT ASSOCIATION (If not yet associated, link it!) */}
        {/* ------------------------------------------------------------- */}
        <section className="bg-white border border-[#ececf0] rounded-[24px] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#007aff] flex items-center justify-center">
                <LinkIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#111]">Evento Associado</h2>
                <p className="text-xs text-[#8e8e93]">
                  Ligação entre esta conversa de briefing e o evento de produção
                </p>
              </div>
            </div>

            {linkedEvent && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#eaf8ee] text-[#24793a] border border-[#24793a]/20 flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>Vinculada</span>
              </span>
            )}
          </div>

          {linkingError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{linkingError}</span>
            </div>
          )}

          {linkedEvent ? (
            <div className="p-4 rounded-[18px] bg-[#fafafc] border border-[#ececf0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#111] text-[15px]">
                    {linkedEvent.name}
                  </span>
                  {linkedEvent.category && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#f2f2f5] text-[#48484a]">
                      {linkedEvent.category}
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#8e8e93] flex flex-wrap items-center gap-3">
                  <span>
                    Data do Evento: {new Date(linkedEvent.startDate).toLocaleDateString("pt-PT")}
                  </span>
                  {linkedEvent.venue && <span>Local: {linkedEvent.venue}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/eventos/${linkedEvent.id}`}
                  className="px-3.5 py-2 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                >
                  <span>Abrir Ficha do Evento</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>

                <button
                  type="button"
                  onClick={handleUnlinkEvent}
                  disabled={isUnlinkingEvent}
                  className="px-3 py-2 rounded-[12px] bg-white border border-[#ececf0] hover:bg-rose-50 hover:text-rose-600 text-xs font-semibold text-[#8e8e93] transition cursor-pointer"
                  title="Desvincular deste evento"
                >
                  <Unlink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-[18px] bg-amber-50/70 border border-amber-200/80 space-y-3">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900">
                    Ainda não associada a um evento de produção
                  </h4>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Esta reunião encontra-se independente. Pode vinculá-la a um evento existente para que as decisões e ações fiquem centralizadas na produção.
                  </p>
                </div>
              </div>

              {allProductionEvents.length > 0 ? (
                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select
                    value={selectedEventIdToLink}
                    onChange={(e) => setSelectedEventIdToLink(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-amber-200 rounded-[12px] text-xs font-semibold text-[#111] outline-none"
                  >
                    {allProductionEvents.map((evt) => (
                      <option key={evt.id} value={evt.id}>
                        {evt.name} ({new Date(evt.startDate).toLocaleDateString("pt-PT")}) — {evt.category || "Geral"}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleLinkToEvent}
                    disabled={isLinkingEvent}
                    className="px-4 py-2 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs"
                  >
                    {isLinkingEvent ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>A vincular...</span>
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>Vincular a este Evento</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-amber-900 italic">
                  Não foram encontrados eventos de produção criados para vincular.
                </p>
              )}
            </div>
          )}
        </section>

        {/* ------------------------------------------------------------- */}
        {/* MEMBERS WHO PARTICIPATED */}
        {/* ------------------------------------------------------------- */}
        <section className="bg-white border border-[#ececf0] rounded-[24px] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#111]">Membros Participantes</h2>
                <p className="text-xs text-[#8e8e93]">
                  Pessoas que participaram na conversa (Equipa CFM & Cliente)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAddParticipant(!showAddParticipant)}
              className="px-3 py-1.5 rounded-[10px] bg-[#f2f2f5] hover:bg-[#e5e5ea] text-xs font-semibold text-[#111] flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Participante</span>
            </button>
          </div>

          {/* Add Participant Form */}
          {showAddParticipant && (
            <form
              onSubmit={handleAddParticipant}
              className="p-4 rounded-[16px] bg-[#fafafc] border border-[#ececf0] space-y-3 animate-in fade-in text-xs"
            >
              <span className="font-bold text-[#111] block">Novo Participante na Reunião</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  placeholder="Nome do participante..."
                  value={newParticipantName}
                  onChange={(e) => setNewParticipantName(e.target.value)}
                  className="px-3 py-2 bg-white border border-[#ececf0] rounded-lg font-medium"
                />
                <input
                  type="text"
                  placeholder="Cargo / Papel (ex: Produtora, Noivo, Decorador)..."
                  value={newParticipantRole}
                  onChange={(e) => setNewParticipantRole(e.target.value)}
                  className="px-3 py-2 bg-white border border-[#ececf0] rounded-lg font-medium"
                />
                <select
                  value={newParticipantType}
                  onChange={(e) => setNewParticipantType(e.target.value as any)}
                  className="px-3 py-2 bg-white border border-[#ececf0] rounded-lg font-semibold"
                >
                  <option value="team">Equipa CFM</option>
                  <option value="client">Cliente / Convidado</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddParticipant(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#f2f2f5] font-semibold text-[#636366]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#111] hover:bg-black text-white font-bold"
                >
                  Confirmar
                </button>
              </div>
            </form>
          )}

          {/* Participants Badges / Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {participants.map((p, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-[16px] border flex items-center justify-between gap-2.5 transition ${
                  p.type === "team"
                    ? "bg-[#faf9ff] border-indigo-100"
                    : "bg-[#fcfcff] border-[#ececf0]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      p.type === "team"
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "bg-[#111] text-white"
                    }`}
                  >
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#111] truncate">{p.name}</div>
                    <div className="text-[11px] text-[#8e8e93] flex items-center gap-1 truncate">
                      <span className="font-medium text-[#48484a]">{p.role}</span>
                      <span>·</span>
                      <span className="capitalize">{p.type === "team" ? "CFM" : "Cliente"}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveParticipant(idx)}
                  className="p-1 rounded-md text-[#8e8e93] hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  title="Remover participante"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Client Details Section */}
          {client && (
            <div className="p-3.5 rounded-[16px] bg-[#fafafc] border border-[#ececf0] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#8e8e93]" />
                <span className="font-semibold text-[#111]">{client.name}</span>
                {client.nif && (
                  <span className="text-[10px] bg-white border border-[#ececf0] px-1.5 py-0.5 rounded font-mono text-[#8e8e93]">
                    NIF: {client.nif}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {client.email && (
                  <a
                    href={`mailto:${client.email}`}
                    className="text-[#007aff] hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <Mail className="w-3 h-3" />
                    <span>{client.email}</span>
                  </a>
                )}
                {client.phone && (
                  <a
                    href={`tel:${client.phone}`}
                    className="text-[#007aff] hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{client.phone}</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ------------------------------------------------------------- */}
        {/* SUMMARY OF THE CONVERSATION */}
        {/* ------------------------------------------------------------- */}
        <section className="bg-white border border-[#ececf0] rounded-[24px] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-[#6366f1] flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#111]">
                  Resumo da Conversa & Notas da Reunião
                </h2>
                <p className="text-xs text-[#8e8e93]">
                  Ata dos pontos discutidos, desejos do cliente e decisões tomadas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {summarySavedNotice && (
                <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1 animate-in fade-in">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Resumo guardado!</span>
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveSummary}
                disabled={isSavingSummary}
                className="px-4 py-2 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSavingSummary ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>A guardar...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar Resumo</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick template helpers */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
            <span className="text-[#8e8e93]">Inserir tópico rápido:</span>
            <button
              type="button"
              onClick={() =>
                setConversationSummary(
                  (prev) => prev + (prev ? "\n\n" : "") + "• Desejos de Decoração & Estilo: "
                )
              }
              className="px-2.5 py-1 rounded-full bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[#48484a] font-medium transition cursor-pointer"
            >
              + Estilo & Decoração
            </button>
            <button
              type="button"
              onClick={() =>
                setConversationSummary(
                  (prev) => prev + (prev ? "\n\n" : "") + "• Materiais & Mobiliário Sugerido: "
                )
              }
              className="px-2.5 py-1 rounded-full bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[#48484a] font-medium transition cursor-pointer"
            >
              + Mobiliário
            </button>
            <button
              type="button"
              onClick={() =>
                setConversationSummary(
                  (prev) => prev + (prev ? "\n\n" : "") + "• Decisões Tomadas: "
                )
              }
              className="px-2.5 py-1 rounded-full bg-[#f2f2f5] hover:bg-[#e5e5ea] text-[#48484a] font-medium transition cursor-pointer"
            >
              + Decisões Tomadas
            </button>
          </div>

          <textarea
            value={conversationSummary}
            onChange={(e) => setConversationSummary(e.target.value)}
            rows={8}
            placeholder="Escreva aqui a ata e os apontamentos da conversa com o cliente: o que foi abordado, preferências estéticas, restrições do espaço, orçamento pretendido e decisões de alinhamento..."
            className="w-full p-4 rounded-[16px] bg-[#fafafc] border border-[#ececf0] text-sm text-[#111] leading-relaxed outline-none focus:bg-white focus:ring-2 focus:ring-[#6366f1] transition font-sans"
          />
        </section>

        {/* ------------------------------------------------------------- */}
        {/* ACTION ITEMS NEEDED TO TAKE FROM IT */}
        {/* ------------------------------------------------------------- */}
        <section className="bg-white border border-[#ececf0] rounded-[24px] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-[#6366f1] flex items-center justify-center">
                <ListTodo className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#111]">
                  Ações a Realizar / Próximos Passos
                </h2>
                <p className="text-xs text-[#8e8e93]">
                  Tarefas e compromissos acordados para dar seguimento à reunião
                </p>
              </div>
            </div>

            {actionItems.length > 0 && (
              <span className="text-xs font-bold text-[#48484a] bg-[#f2f2f5] px-3 py-1 rounded-full self-start sm:self-auto">
                {completedActionsCount} de {actionItems.length} concluídas
              </span>
            )}
          </div>

          {/* New Action Item Form */}
          <form
            onSubmit={handleAddActionItem}
            className="p-4 rounded-[16px] bg-[#fafafc] border border-[#ececf0] space-y-3 text-xs"
          >
            <span className="font-bold text-[#111] block">Adicionar Nova Ação</span>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-6">
                <input
                  type="text"
                  placeholder="Ex: Enviar proposta de centros de mesa com paleta terracotta..."
                  value={newActionTitle}
                  onChange={(e) => setNewActionTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#ececf0] rounded-lg font-medium"
                />
              </div>

              <div className="sm:col-span-3">
                <select
                  value={newActionAssignee}
                  onChange={(e) => setNewActionAssignee(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-[#ececf0] rounded-lg font-medium"
                >
                  {teamUsers.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <input
                  type="date"
                  value={newActionDueDate}
                  onChange={(e) => setNewActionDueDate(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-[#ececf0] rounded-lg font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#8e8e93]">Prioridade:</span>
                <div className="flex items-center gap-1">
                  {(["baixa", "media", "alta", "urgente"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewActionPriority(p)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize transition ${
                        newActionPriority === p
                          ? "bg-[#111] text-white"
                          : "bg-white border border-[#ececf0] text-[#636366] hover:bg-[#f2f2f5]"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isAddingAction || !newActionTitle.trim()}
                className="px-4 py-2 rounded-[10px] bg-[#111] hover:bg-black text-white font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Ação</span>
              </button>
            </div>
          </form>

          {/* Action Items List */}
          {actionItems.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-[#ececf0] rounded-[16px] text-xs text-[#8e8e93]">
              Nenhuma ação registada ainda. Adicione os passos seguintes da conversa acima.
            </div>
          ) : (
            <div className="space-y-2">
              {actionItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-[16px] border flex items-center justify-between gap-3 text-xs transition ${
                    item.completed
                      ? "bg-[#f8f8fa] border-[#ececf0] opacity-70"
                      : "bg-white border-[#ececf0] hover:border-[#d2d2d7]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleAction(item.id, item.completed)}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition cursor-pointer shrink-0 ${
                        item.completed
                          ? "bg-emerald-600 text-white"
                          : "border-2 border-[#d2d2d7] hover:border-[#111]"
                      }`}
                    >
                      {item.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>

                    <div className="min-w-0">
                      <span
                        className={`font-semibold block ${
                          item.completed ? "line-through text-[#8e8e93]" : "text-[#111]"
                        }`}
                      >
                        {item.title}
                      </span>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#8e8e93] mt-0.5">
                        {item.assignedTo && (
                          <span className="flex items-center gap-1 font-medium text-[#48484a]">
                            <User className="w-3 h-3 text-[#6366f1]" />
                            <span>{item.assignedTo}</span>
                          </span>
                        )}
                        {item.dueDate && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Até {new Date(item.dueDate).toLocaleDateString("pt-PT")}</span>
                          </span>
                        )}
                        {item.priority && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                              item.priority === "urgente"
                                ? "bg-rose-100 text-rose-800"
                                : item.priority === "alta"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {item.priority}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteAction(item.id)}
                    className="p-1.5 rounded-md text-[#8e8e93] hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    title="Remover ação"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
