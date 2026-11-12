"use client";

import React, { useState, useTransition } from "react";
import {
  X,
  MapPin,
  User,
  Phone,
  Mail,
  Building,
  Plus,
  Edit2,
  Trash2,
  Check,
  AlertTriangle,
  Package,
  Boxes,
  ExternalLink,
  ShieldCheck,
  Search,
} from "lucide-react";
import {
  createStorageLocationAction,
  updateStorageLocationAction,
  deleteStorageLocationAction,
} from "@/app/actions";

export interface StorageLocation {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  managerUserId: string | null;
  managerName: string;
  managerContact: string | null;
  notes: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface StorageLocationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: StorageLocation[];
  items: Array<{
    id: string;
    name: string;
    warehouseLocation: string | null;
    locationId?: string | null;
    totalQuantity: number;
  }>;
  users: TeamUser[];
  onLocationsChange?: (updatedLocations: StorageLocation[]) => void;
  onSelectLocationForFilter?: (locationName: string) => void;
  initialMode?: "list" | "create";
}

export default function StorageLocationsModal({
  isOpen,
  onClose,
  locations,
  items,
  users,
  onLocationsChange,
  onSelectLocationForFilter,
  initialMode = "list",
}: StorageLocationsModalProps) {
  const [activeTab, setActiveTab] = useState<"list" | "create">(initialMode);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingLocation, setEditingLocation] = useState<StorageLocation | null>(null);

  // New Location Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || "");
  const [managerName, setManagerName] = useState(users[0]?.name || "Administrador CFM");
  const [managerContact, setManagerContact] = useState(users[0]?.email || "");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit Form State
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editUserId, setEditUserId] = useState("");
  const [editManagerName, setEditManagerName] = useState("");
  const [editManagerContact, setEditManagerContact] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleUserSelectChange = (uId: string, isEdit = false) => {
    if (isEdit) {
      setEditUserId(uId);
      if (uId && uId !== "custom") {
        const found = users.find((u) => u.id === uId);
        if (found) {
          setEditManagerName(found.name);
          setEditManagerContact(found.email);
        }
      }
    } else {
      setSelectedUserId(uId);
      if (uId && uId !== "custom") {
        const found = users.find((u) => u.id === uId);
        if (found) {
          setManagerName(found.name);
          setManagerContact(found.email);
        }
      } else if (uId === "custom") {
        setManagerName("");
        setManagerContact("");
      }
    }
  };

  const handleStartEdit = (loc: StorageLocation) => {
    setEditingLocation(loc);
    setEditName(loc.name);
    setEditCode(loc.code || "");
    setEditAddress(loc.address || "");
    setEditUserId(loc.managerUserId || "custom");
    setEditManagerName(loc.managerName);
    setEditManagerContact(loc.managerContact || "");
    setEditNotes(loc.notes || "");
    setError(null);
    setSuccessMsg(null);
  };

  const handleCancelEdit = () => {
    setEditingLocation(null);
    setError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation) return;
    if (!editName.trim() || !editManagerName.trim()) {
      setError("Nome do local e nome do gestor são obrigatórios.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("locationId", editingLocation.id);
      formData.set("name", editName.trim());
      formData.set("code", editCode.trim());
      formData.set("address", editAddress.trim());
      formData.set("managerUserId", editUserId === "custom" ? "" : editUserId);
      formData.set("managerName", editManagerName.trim());
      formData.set("managerContact", editManagerContact.trim());
      formData.set("notes", editNotes.trim());

      const res = await updateStorageLocationAction(formData);
      if (res.success) {
        const updated = locations.map((loc) =>
          loc.id === editingLocation.id
            ? {
                ...loc,
                name: editName.trim(),
                code: editCode.trim() || null,
                address: editAddress.trim() || null,
                managerUserId: editUserId === "custom" ? null : editUserId,
                managerName: editManagerName.trim(),
                managerContact: editManagerContact.trim() || null,
                notes: editNotes.trim() || null,
              }
            : loc
        );
        onLocationsChange?.(updated);
        setEditingLocation(null);
        setSuccessMsg(`Local "${editName}" atualizado com sucesso!`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(res.error || "Erro ao atualizar local.");
      }
    } catch (err: any) {
      setError(err?.message || "Erro inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Por favor indique o nome do local de armazenamento.");
      return;
    }
    if (!managerName.trim()) {
      setError("Por favor indique a pessoa que gere este local.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("name", name.trim());
      formData.set("code", code.trim() || name.trim().slice(0, 8).toUpperCase().replace(/\s+/g, "-"));
      formData.set("address", address.trim());
      formData.set("managerUserId", selectedUserId === "custom" ? "" : selectedUserId);
      formData.set("managerName", managerName.trim());
      formData.set("managerContact", managerContact.trim());
      formData.set("notes", notes.trim());

      const res = await createStorageLocationAction(formData);
      if (res.success && res.location) {
        onLocationsChange?.([...locations, res.location as StorageLocation]);
        setSuccessMsg(`Novo local "${name}" criado com sucesso sob gestão de ${managerName}!`);
        // Reset form
        setName("");
        setCode("");
        setAddress("");
        setNotes("");
        setActiveTab("list");
        setTimeout(() => setSuccessMsg(null), 3500);
      } else {
        setError(res.error || "Erro ao criar local.");
      }
    } catch (err: any) {
      setError(err?.message || "Erro inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLocation = async (location: StorageLocation) => {
    const assignedCount = items.filter(
      (i) => i.locationId === location.id || i.warehouseLocation?.includes(location.name)
    ).length;

    const confirmMsg = assignedCount > 0
      ? `Tem a certeza que deseja eliminar "${location.name}"? Existem ${assignedCount} artigo(s) associados que serão reatribuídos ao Armazém Principal.`
      : `Tem a certeza que deseja eliminar o local "${location.name}"?`;

    if (!confirm(confirmMsg)) return;

    startTransition(async () => {
      const res = await deleteStorageLocationAction(location.id);
      if (res.success) {
        onLocationsChange?.(locations.filter((l) => l.id !== location.id));
        setSuccessMsg(`Local "${location.name}" removido.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    });
  };

  // Helper to count items at a given location
  const getLocationItemMetrics = (loc: StorageLocation) => {
    const matching = items.filter(
      (i) => i.locationId === loc.id || i.warehouseLocation?.toLowerCase().includes(loc.name.toLowerCase())
    );
    const totalQty = matching.reduce((sum, item) => sum + (item.totalQuantity || 0), 0);
    return { count: matching.length, totalQty };
  };

  const filteredLocations = locations.filter((loc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      loc.name.toLowerCase().includes(q) ||
      loc.managerName.toLowerCase().includes(q) ||
      loc.code?.toLowerCase().includes(q) ||
      loc.address?.toLowerCase().includes(q) ||
      loc.managerContact?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-[24px] w-full max-w-3xl border border-[#ececf0] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-xs">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-[#ececf0] flex items-center justify-between bg-white/90 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#f0f7ff] border border-[#d6e7ff] flex items-center justify-center text-[#007aff]">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-[#111111]">
                Locais de Armazenamento & Gestão
              </h2>
              <p className="text-[11px] text-[#8e8e93]">
                Definição de armazéns, polos logísticos e atribuição de gestores responsáveis
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93] hover:text-[#111] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 sm:px-6 pt-3 border-b border-[#ececf0] bg-[#fafafc] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setActiveTab("list");
                setEditingLocation(null);
                setError(null);
              }}
              className={`px-3.5 py-2 font-semibold text-xs rounded-t-[10px] transition cursor-pointer border-b-2 flex items-center gap-1.5 ${
                activeTab === "list"
                  ? "border-[#007aff] text-[#007aff] bg-white"
                  : "border-transparent text-[#636366] hover:text-[#111]"
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Locais Registados ({locations.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("create");
                setEditingLocation(null);
                setError(null);
              }}
              className={`px-3.5 py-2 font-semibold text-xs rounded-t-[10px] transition cursor-pointer border-b-2 flex items-center gap-1.5 ${
                activeTab === "create"
                  ? "border-[#007aff] text-[#007aff] bg-white"
                  : "border-transparent text-[#636366] hover:text-[#111]"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Especificar Novo Local</span>
            </button>
          </div>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="mx-5 sm:mx-6 mt-3 p-3 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 sm:mx-6 mt-3 p-3 rounded-[12px] bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: LIST LOCATIONS */}
          {activeTab === "list" && !editingLocation && (
            <div className="space-y-3.5">
              {/* Search Toolbar */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrar por nome de local, gestor, código ou morada..."
                    className="w-full pl-8 pr-3 py-1.5 bg-[#f2f2f5] border border-transparent focus:border-[#007aff] focus:bg-white rounded-[10px] text-xs focus:outline-none transition"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab("create")}
                  className="px-3 py-1.5 bg-[#111] hover:bg-black text-white rounded-[10px] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Local</span>
                </button>
              </div>

              {/* Locations Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredLocations.map((loc) => {
                  const metrics = getLocationItemMetrics(loc);
                  return (
                    <div
                      key={loc.id}
                      className="p-4 rounded-[18px] border border-[#ececf0] bg-white hover:border-[#007aff]/40 transition shadow-2xs flex flex-col justify-between gap-3 relative group"
                    >
                      {/* Top Row: Name, Code & Action Buttons */}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm text-[#111] truncate">
                                {loc.name}
                              </span>
                              {loc.code && (
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#f2f2f5] text-[#3a3a3c] border border-[#ececf0]">
                                  {loc.code}
                                </span>
                              )}
                            </div>
                            {loc.address && (
                              <div className="text-[11px] text-[#8e8e93] flex items-center gap-1 mt-0.5">
                                <Building className="w-3 h-3 shrink-0" />
                                <span className="truncate">{loc.address}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(loc)}
                              className="p-1.5 rounded-[8px] hover:bg-[#f2f2f5] text-[#8e8e93] hover:text-[#111] transition cursor-pointer"
                              title="Editar local e responsável"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLocation(loc)}
                              className="p-1.5 rounded-[8px] hover:bg-rose-50 text-[#8e8e93] hover:text-rose-600 transition cursor-pointer"
                              title="Remover local"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Manager Badge & Details */}
                        <div className="mt-3 p-2.5 rounded-[12px] bg-[#f9f9fb] border border-[#ececf0]/80 space-y-1">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[#8e8e93] flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-[#007aff]" />
                            <span>Pessoa Responsável / Gestor:</span>
                          </div>

                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-[#eef4ff] text-[#0066cc] flex items-center justify-center font-bold text-[10px]">
                                {loc.managerName.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-xs text-[#111]">
                                {loc.managerName}
                              </span>
                            </div>

                            {loc.managerContact && (
                              <div className="text-[11px] text-[#636366] flex items-center gap-1">
                                {loc.managerContact.includes("@") ? (
                                  <Mail className="w-3 h-3 text-[#8e8e93]" />
                                ) : (
                                  <Phone className="w-3 h-3 text-[#8e8e93]" />
                                )}
                                <span className="font-mono text-[10px]">{loc.managerContact}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {loc.notes && (
                          <div className="text-[11px] text-[#636366] mt-2 italic line-clamp-2">
                            "{loc.notes}"
                          </div>
                        )}
                      </div>

                      {/* Bottom Footer: Stock Counts & Filter Button */}
                      <div className="pt-2 border-t border-[#ececf0]/70 flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-2 text-[#8e8e93]">
                          <span className="flex items-center gap-1">
                            <Package className="w-3 h-3 text-[#8e8e93]" />
                            <strong className="text-[#111]">{metrics.count}</strong> artigos
                          </span>
                          <span>·</span>
                          <span>
                            <strong className="text-[#111]">{metrics.totalQty}</strong> un.
                          </span>
                        </div>

                        {onSelectLocationForFilter && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectLocationForFilter(loc.name);
                              onClose();
                            }}
                            className="text-[#007aff] hover:underline font-semibold text-[11px] cursor-pointer"
                          >
                            Filtrar no Catálogo →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredLocations.length === 0 && (
                <div className="text-center py-10 px-4 border border-dashed border-[#ececf0] rounded-[18px] bg-[#fafafc]">
                  <MapPin className="w-8 h-8 text-[#8e8e93] mx-auto mb-2 opacity-50" />
                  <div className="text-xs font-bold text-[#111]">Nenhum local encontrado</div>
                  <p className="text-[11px] text-[#8e8e93] mt-1">
                    Experimente outra pesquisa ou adicione um novo local de armazenamento.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* EDIT FORM */}
          {editingLocation && (
            <div className="bg-[#fafafc] border border-[#ececf0] rounded-[20px] p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#ececf0]">
                <div>
                  <h3 className="font-bold text-sm text-[#111]">
                    Editar Local: {editingLocation.name}
                  </h3>
                  <p className="text-[11px] text-[#8e8e93]">
                    Atualize os dados do armazém e quem é a pessoa responsável
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-2.5 py-1 text-xs text-[#636366] hover:text-[#111] bg-white border border-[#ececf0] rounded-[8px]"
                >
                  Cancelar
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#3a3a3c] mb-1">
                      Nome do Local de Armazenamento *
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Ex: Armazém A, Pavilhão Sintra..."
                      className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#3a3a3c] mb-1">
                      Código / Abreviatura
                    </label>
                    <input
                      type="text"
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      placeholder="Ex: ARM-A, PAV-SIN"
                      className="w-full px-3 py-2 text-xs font-mono uppercase bg-white border border-[#ececf0] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">
                    Morada / Localização Física
                  </label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="Ex: Pólo Logístico Loures, Pavilhão 4"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>

                {/* Manager Assignment */}
                <div className="p-3.5 rounded-[14px] bg-white border border-[#d6e7ff]/70 space-y-3">
                  <div className="font-bold text-xs text-[#0066cc] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>Pessoa Responsável pela Gestão do Local *</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#3a3a3c] mb-1">
                        Selecionar da Equipa CFM
                      </label>
                      <select
                        value={editUserId}
                        onChange={(e) => handleUserSelectChange(e.target.value, true)}
                        className="w-full px-3 py-2 text-xs bg-[#fafafc] border border-[#ececf0] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                      >
                        <option value="custom">Outro / Gestor Externo</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#3a3a3c] mb-1">
                        Nome do Gestor / Responsável *
                      </label>
                      <input
                        type="text"
                        required
                        value={editManagerName}
                        onChange={(e) => setEditManagerName(e.target.value)}
                        placeholder="Nome completo do gestor"
                        className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#3a3a3c] mb-1">
                      Contacto Direto do Gestor (Email ou Telefone)
                    </label>
                    <input
                      type="text"
                      value={editManagerContact}
                      onChange={(e) => setEditManagerContact(e.target.value)}
                      placeholder="Ex: gestor@cfmeventos.pt ou +351 912 345 678"
                      className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">
                    Notas Operacionais & Descrição
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Instruções de carga/descarga, horários, capacidade..."
                    className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-4 py-2 rounded-[10px] bg-white border border-[#ececf0] text-[#3a3a3c] hover:bg-[#f2f2f5] font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-[10px] bg-[#111] hover:bg-black text-white font-bold transition shadow-xs"
                  >
                    {isSubmitting ? "A guardar..." : "Guardar Alterações"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: CREATE NEW LOCATION */}
          {activeTab === "create" && (
            <div className="bg-[#fafafc] border border-[#ececf0] rounded-[20px] p-5 space-y-4">
              <div>
                <h3 className="font-bold text-sm text-[#111]">
                  Especificar Novo Local de Armazenamento
                </h3>
                <p className="text-[11px] text-[#8e8e93]">
                  Registe um novo local para guardar inventário e quem é a pessoa responsável pela gestão
                </p>
              </div>

              <form onSubmit={handleCreateLocation} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#3a3a3c] mb-1">
                      Nome do Local de Armazenamento *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Armazém C - Som e AV, Pavilhão Sintra..."
                      className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#3a3a3c] mb-1">
                      Código / Abreviatura (Opcional)
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Ex: ARM-C (auto se vazio)"
                      className="w-full px-3 py-2 text-xs font-mono uppercase bg-white border border-[#ececf0] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">
                    Morada / Localização Física
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Ex: Rua da Indústria 12, Loures"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>

                {/* Manager Specification Section */}
                <div className="p-4 rounded-[16px] bg-white border border-[#007aff]/30 space-y-3 shadow-2xs">
                  <div className="font-bold text-xs text-[#0066cc] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>Pessoa Responsável pela Gestão do Local *</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#3a3a3c] mb-1">
                        Atribuir Membro da Equipa CFM
                      </label>
                      <select
                        value={selectedUserId}
                        onChange={(e) => handleUserSelectChange(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#fafafc] border border-[#ececf0] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                      >
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role})
                          </option>
                        ))}
                        <option value="custom">+ Outro / Gestor Externo</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#3a3a3c] mb-1">
                        Nome do Gestor / Responsável *
                      </label>
                      <input
                        type="text"
                        required
                        value={managerName}
                        onChange={(e) => setManagerName(e.target.value)}
                        placeholder="Nome da pessoa responsável"
                        className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#3a3a3c] mb-1">
                      Contacto Direto do Gestor (Email / Telefone)
                    </label>
                    <input
                      type="text"
                      value={managerContact}
                      onChange={(e) => setManagerContact(e.target.value)}
                      placeholder="Ex: gestor@cfmeventos.pt ou +351 912 345 678"
                      className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">
                    Notas Operacionais & Capacidade (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Detalhes adicionais, portão de acesso, restrições..."
                    className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("list")}
                    className="px-4 py-2 rounded-[10px] bg-white border border-[#ececf0] text-[#3a3a3c] hover:bg-[#f2f2f5] font-semibold"
                  >
                    Voltar à Lista
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-[10px] bg-[#111] hover:bg-black text-white font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? "A registar local..." : "Criar Local de Armazenamento"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
