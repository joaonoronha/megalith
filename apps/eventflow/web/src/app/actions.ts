"use server";

import { db, ensureDbMigrated } from "@/db/client";
import {
  events,
  eventAllocations,
  eventCustomItems,
  eventTasks,
  eventMedia,
  moodboardComments,
  eventMeetings,
  quotes,
  quoteLines,
  clients,
  storageLocations,
  inventoryItems,
  financialMovements,
  quoteTemplates,
  users,
  userPresence,
  alerts,
  appUploads,
} from "@/db/schema";
import { eq, or, sql, isNull, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { generateId, generateReferenceCode, formatCustomId } from "@/lib/id";
import { recordAuditLog, getAuditLogsForEntity, getRecentAuditLogs } from "@/lib/audit";
import fs from "fs/promises";
import path from "path";
import { isMeetingEvent } from "@/lib/events";
import { getCurrentUser } from "@/lib/auth";

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Não tem sessão iniciada ou a sessão expirou.");
  }
  return user;
}

function invalidateAllCaches() {
  try {
    revalidatePath("/");
    revalidatePath("/inventario");
    revalidatePath("/inventory");
    revalidatePath("/financas");
    revalidatePath("/finance");
  } catch {
    // Ignore when executed outside Next request context
  }
}

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Ignore outside Next request context
  }
}

// 1. Create Event
export async function createEventAction(formData: FormData) {
  await requireAuth();
  const name = formData.get("name") as string;
  const clientId = (formData.get("clientId") as string) || null;
  const venue = (formData.get("venue") as string) || "";
  const startDateStr = formData.get("startDate") as string;
  const endDateStr = formData.get("endDate") as string;
  const prepDateStr = formData.get("prepDate") as string;
  const returnDateStr = formData.get("returnDate") as string;
  const status = (formData.get("status") as any) || "planeamento";
  const totalBudget = parseFloat((formData.get("totalBudget") as string) || "0");
  const customerPrice = parseFloat((formData.get("customerPrice") as string) || "0");
  const category = (formData.get("category") as string) || "Geral";
  const theme = (formData.get("theme") as string) || "";
  const vibeColors = (formData.get("vibeColors") as string) || "";
  const specialNeeds = (formData.get("specialNeeds") as string) || "";
  const notes = (formData.get("notes") as string) || "";
  const coverImageUrl = (formData.get("coverImageUrl") as string) || "";
  const rawCustomId = (formData.get("customId") as string) || "";

  if (!name || !startDateStr) {
    return { success: false, error: "Nome do evento e data de início são obrigatórios." };
  }

  // Generate clean, collision-free unique ID
  const id = rawCustomId.trim() ? formatCustomId("evt", rawCustomId) : generateId("evt");
  await db.insert(events).values({
    id,
    name,
    clientId,
    venue,
    startDate: new Date(startDateStr),
    endDate: endDateStr ? new Date(endDateStr) : null,
    prepDate: prepDateStr ? new Date(prepDateStr) : null,
    returnDate: returnDateStr ? new Date(returnDateStr) : null,
    status,
    totalBudget,
    customerPrice,
    category,
    theme: theme || null,
    vibeColors: vibeColors || null,
    specialNeeds: specialNeeds || null,
    notes,
    coverImageUrl: coverImageUrl || "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=600&q=80",
    createdAt: new Date(),
  });

  await recordAuditLog({
    entityType: "event",
    entityId: id,
    action: "criado",
    title: "Evento criado",
    details: `Evento criado com orçamento de €${totalBudget.toLocaleString("pt-PT")} para ${venue || "local a definir"}`,
  });

  invalidateAllCaches();
  return { success: true, id };
}

// 2. Update Event Status
export async function updateEventStatusAction(eventId: string, newStatus: string) {
  await db
    .update(events)
    .set({ status: newStatus as any })
    .where(eq(events.id, eventId));

  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: "alterou_estado",
    title: "Estado alterado",
    details: `Estado alterado para "${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}"`,
  });

  invalidateAllCaches();
  return { success: true };
}

// 3. Create Commercial Quote
export async function createQuoteAction(formData: FormData) {
  const quoteNumber = (formData.get("quoteNumber") as string) || generateReferenceCode("ORC");
  const eventId = (formData.get("eventId") as string)?.trim() || null;
  const clientId = (formData.get("clientId") as string)?.trim() || null;

  if (!eventId) {
    throw new Error("Um orçamento deve ser gerado dentro da configuração de um evento (eventId obrigatório).");
  }

  const targetEvent = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!targetEvent) {
    throw new Error("O evento associado à configuração do orçamento não foi encontrado.");
  }

  if (isMeetingEvent(targetEvent)) {
    throw new Error("Reuniões não têm orçamentos associados. Apenas eventos de produção podem ter orçamentos.");
  }

  const resolvedClientId = clientId || targetEvent.clientId || null;
  const validityDays = parseInt((formData.get("validityDays") as string) || "15", 10);
  const vatRate = 23.0;
  const linesJson = formData.get("lines") as string;

  let parsedLines: Array<{ itemId?: string; description: string; quantity: number; unitPrice: number; total?: number }> = [];
  try {
    parsedLines = JSON.parse(linesJson || "[]");
  } catch {
    parsedLines = [];
  }

  const subtotal = parsedLines.reduce((acc, line) => acc + line.quantity * line.unitPrice, 0);
  const vatAmount = subtotal * (vatRate / 100);
  const total = subtotal + vatAmount;

  const quoteId = generateId("qte");
  const accessToken = `orc-${crypto.randomUUID()}`;

  await db.insert(quotes).values({
    id: quoteId,
    quoteNumber,
    eventId,
    clientId: resolvedClientId,
    accessToken,
    status: "enviado",
    validityDays,
    vatRate,
    subtotal,
    vatAmount,
    total,
    createdAt: new Date(),
  });

  for (let i = 0; i < parsedLines.length; i++) {
    const line = parsedLines[i];
    await db.insert(quoteLines).values({
      id: generateId("ql"),
      quoteId,
      itemId: line.itemId || null,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      total: line.quantity * line.unitPrice,
    });
  }

  await recordAuditLog({
    entityType: "quote",
    entityId: quoteId,
    action: "criado",
    title: "Orçamento emitido",
    details: `Orçamento ${quoteNumber} emitido com ${parsedLines.length} linha(s) de artigos/serviços (Total: €${total.toFixed(2)})`,
  });

  if (eventId) {
    await db
      .update(events)
      .set({
        customerPrice: total,
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));

    await recordAuditLog({
      entityType: "event",
      entityId: eventId,
      action: "orcamento",
      title: "Orçamento associado",
      details: `Associado orçamento ${quoteNumber} com valor global de €${total.toFixed(2)} (PVP do evento atualizado para €${total.toFixed(2)})`,
    });
  }

  invalidateAllCaches();
  return { success: true, id: quoteId, accessToken };
}

// 4. Create Financial Movement (Entrada, Saída, Investimento)
export async function createMovementAction(formData: FormData) {
  await requireAuth();
  const type = formData.get("type") as "entrada" | "saida" | "investimento";
  const category = (formData.get("category") as string) || "Geral";
  const description = formData.get("description") as string;
  const amount = parseFloat((formData.get("amount") as string) || "0");
  const dateStr = formData.get("date") as string;
  const eventId = (formData.get("eventId") as string) || null;
  const clientId = (formData.get("clientId") as string) || null;
  const notes = (formData.get("notes") as string) || "";

  if (!description || !amount) {
    return { success: false, error: "Descrição e valor são obrigatórios." };
  }

  const id = generateId("mov");
  const movement = {
    id,
    type,
    category,
    description,
    amount,
    date: dateStr ? new Date(dateStr) : new Date(),
    eventId,
    clientId,
    notes,
    createdAt: new Date(),
  };
  await db.insert(financialMovements).values(movement);

  invalidateAllCaches();
  return { success: true, id, movement };
}

// 4.1 Delete Financial Movement / Expense
export async function deleteMovementAction(id: string) {
  await requireAuth();
  if (!id) {
    return { success: false, error: "ID do movimento é obrigatório." };
  }

  const existing = await db.query.financialMovements.findFirst({
    where: eq(financialMovements.id, id),
  });

  if (!existing) {
    return { success: false, error: "Movimento financeiro não encontrado." };
  }

  await db.delete(financialMovements).where(eq(financialMovements.id, id));

  await recordAuditLog({
    entityType: "inventory",
    entityId: id,
    action: "removido",
    title: "Movimento financeiro removido",
    details: `Movimento "${existing.description}" (€${existing.amount.toFixed(2)}) removido do registo financeiro.`,
  });

  invalidateAllCaches();
  return { success: true, id };
}

// 4.9 Storage Locations Management
export async function createStorageLocationAction(formData: FormData) {
  await requireAuth();
  const name = (formData.get("name") as string)?.trim();
  const code = (formData.get("code") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;
  const managerUserId = (formData.get("managerUserId") as string)?.trim() || null;
  const managerName = (formData.get("managerName") as string)?.trim();
  const managerContact = (formData.get("managerContact") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const rawCustomId = (formData.get("customId") as string)?.trim() || "";

  if (!name) {
    return { success: false, error: "O nome do local de armazenamento é obrigatório." };
  }
  if (!managerName) {
    return { success: false, error: "A pessoa responsável pelo local é obrigatória." };
  }

  const id = rawCustomId ? formatCustomId("loc", rawCustomId) : generateId("loc");

  const location = {
    id,
    name,
    code,
    address,
    managerUserId,
    managerName,
    managerContact,
    notes,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(storageLocations).values(location);

  await recordAuditLog({
    entityType: "inventory",
    entityId: id,
    action: "criado",
    title: "Local de armazenamento criado",
    details: `Novo local "${name}" criado. Responsável: ${managerName}${managerContact ? ` (${managerContact})` : ""}`,
  });

  invalidateAllCaches();
  return { success: true, id, location };
}

export async function updateStorageLocationAction(formData: FormData) {
  await requireAuth();
  const locationId = (formData.get("locationId") as string)?.trim();
  if (!locationId) return { success: false, error: "ID do local é obrigatório." };

  const name = (formData.get("name") as string)?.trim();
  const code = (formData.get("code") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;
  const managerUserId = (formData.get("managerUserId") as string)?.trim() || null;
  const managerName = (formData.get("managerName") as string)?.trim();
  const managerContact = (formData.get("managerContact") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!name || !managerName) {
    return { success: false, error: "Nome do local e responsável são obrigatórios." };
  }

  await db
    .update(storageLocations)
    .set({
      name,
      code,
      address,
      managerUserId,
      managerName,
      managerContact,
      notes,
      updatedAt: new Date(),
    })
    .where(eq(storageLocations.id, locationId));

  await recordAuditLog({
    entityType: "inventory",
    entityId: locationId,
    action: "atualizado",
    title: "Local de armazenamento atualizado",
    details: `Local "${name}" atualizado. Responsável: ${managerName}`,
  });

  invalidateAllCaches();
  return { success: true };
}

export async function deleteStorageLocationAction(locationId: string) {
  await requireAuth();
  if (!locationId) return { success: false, error: "ID do local é obrigatório." };

  // Reassign items from this location to Armazém Principal if exists
  const fallback = await db.query.storageLocations.findFirst({
    where: eq(storageLocations.name, "Armazém Principal"),
  });

  if (fallback && fallback.id !== locationId) {
    await db
      .update(inventoryItems)
      .set({ locationId: fallback.id, warehouseLocation: fallback.name })
      .where(eq(inventoryItems.locationId, locationId));
  } else {
    await db
      .update(inventoryItems)
      .set({ locationId: null })
      .where(eq(inventoryItems.locationId, locationId));
  }

  await db.delete(storageLocations).where(eq(storageLocations.id, locationId));

  await recordAuditLog({
    entityType: "inventory",
    entityId: locationId,
    action: "atualizado",
    title: "Local de armazenamento removido",
    details: `Local de armazenamento ID ${locationId} removido`,
  });

  invalidateAllCaches();
  return { success: true };
}

// 5. Create Inventory Item
export async function createItemAction(formData: FormData) {
  await requireAuth();
  try {
    let sku = ((formData.get("sku") as string) || "").trim();
    const name = ((formData.get("name") as string) || "").trim();
    const category = ((formData.get("category") as string) || "").trim();
    const totalQuantity = parseInt((formData.get("totalQuantity") as string) || "1", 10);
    const minStock = parseInt((formData.get("minStock") as string) || "0", 10);
    let warehouseLocation = formData.get("warehouseLocation") as string;
    let locationId = (formData.get("locationId") as string)?.trim() || null;
    const dimensions = formData.get("dimensions") as string;
    const rawUnitPrice = parseFloat((formData.get("unitPrice") as string) || "0");
    const rawReplacementCost = parseFloat((formData.get("replacementCost") as string) || "0");
    const rawPurchasePrice = parseFloat((formData.get("purchasePrice") as string) || "0");
    const price = rawPurchasePrice || rawReplacementCost || rawUnitPrice || 0;
    const unitPrice = price;
    const replacementCost = price;
    const imageUrl = formData.get("imageUrl") as string;

    // Auto-generate slug SKU if not supplied
    if (!sku && name) {
      const baseSlug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toUpperCase();
      sku = baseSlug || `ART-${Date.now()}`;
    }

    if (sku) {
      const existingSku = await db
        .select({ id: inventoryItems.id })
        .from(inventoryItems)
        .where(eq(inventoryItems.sku, sku))
        .limit(1);
      if (existingSku.length > 0) {
        sku = `${sku}-${Date.now().toString().slice(-4)}`;
      }
    }

  // Check if a new location was specified directly on item creation
  const newLocationName = (formData.get("newLocationName") as string)?.trim();
  const newLocationManagerName = (formData.get("newLocationManagerName") as string)?.trim();
  const newLocationManagerContact = (formData.get("newLocationManagerContact") as string)?.trim();
  const newLocationManagerUserId = (formData.get("newLocationManagerUserId") as string)?.trim() || null;

  if (newLocationName && newLocationManagerName) {
    const newLocId = generateId("loc");
    await db.insert(storageLocations).values({
      id: newLocId,
      name: newLocationName,
      code: newLocationName.slice(0, 8).toUpperCase().replace(/\s+/g, "-"),
      managerUserId: newLocationManagerUserId,
      managerName: newLocationManagerName,
      managerContact: newLocationManagerContact || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    locationId = newLocId;
    if (!warehouseLocation || warehouseLocation === "Armazém Principal") {
      warehouseLocation = newLocationName;
    }
    await recordAuditLog({
      entityType: "inventory",
      entityId: newLocId,
      action: "criado",
      title: "Local de armazenamento criado",
      details: `Novo local "${newLocationName}" criado. Responsável: ${newLocationManagerName}`,
    });
  }

  if (!sku || !name || !category) {
    return { success: false, error: "Nome e categoria são obrigatórios." };
  }

  // Acquisition cost / purchase status calculation:
  // Items default to "bought" (accounted for in finance)
  const rawPurchaseStatus = formData.get("purchaseStatus") as string;
  const purchaseStatus: "bought" | "not_bought" =
    rawPurchaseStatus === "not_bought" ? "not_bought" : "bought";

  const isConsumable = formData.get("isConsumable") === "true" || formData.get("isConsumable") === "1" || formData.get("isConsumable") === "on";
  const packageUnits = parseInt((formData.get("packageUnits") as string) || "1", 10) || 1;

  const rawTotalPurchasePrice = formData.get("totalPurchasePrice") as string;
  let totalCost = 0;
  if (rawTotalPurchasePrice && !isNaN(parseFloat(rawTotalPurchasePrice)) && parseFloat(rawTotalPurchasePrice) > 0) {
    totalCost = parseFloat(rawTotalPurchasePrice);
  } else if (rawPurchasePrice > 0) {
    totalCost = rawPurchasePrice * totalQuantity;
  } else if (price > 0 && formData.get("skipAutoExpense") !== "true") {
    totalCost = price * totalQuantity;
  }

  const rawCustomId = (formData.get("customId") as string) || "";
  const id = rawCustomId.trim() ? formatCustomId("itm", rawCustomId) : generateId("itm");
  const item = {
    id,
    sku: sku.toUpperCase().trim(),
    name,
    category,
    totalQuantity,
    minStock,
    warehouseLocation: warehouseLocation || "Armazém Principal",
    locationId,
    dimensions,
    unitPrice,
    replacementCost,
    purchaseStatus,
    purchaseCost: totalCost,
    isConsumable,
    packageUnits,
    imageUrl: imageUrl || "https://images.unsplash.com/photo-1549497538-303791108f95?auto=format&fit=crop&w=400&q=80",
    barcode: ((formData.get("barcode") as string) || "").trim() || null,
    damagedQuantity: 0,
    inMaintenanceQuantity: 0,
  };
  await db.insert(inventoryItems).values(item);

  // Auto-create expense ONLY for items that are marked as "bought"
  let createdMovement: any = null;
  if (purchaseStatus === "bought" && totalCost > 0) {
    const movId = generateId("mov");
    createdMovement = {
      id: movId,
      type: "saida" as const,
      category: "Material / Stock",
      description: `Aquisição de Stock: ${name} (${totalQuantity} un.)`,
      amount: totalCost,
      date: new Date(),
      eventId: null,
      clientId: null,
      notes: `Despesa gerada automaticamente na compra/criação do artigo ${sku.toUpperCase().trim()} (${id})`,
      createdAt: new Date(),
    };
    await db.insert(financialMovements).values(createdMovement);
  }

  const auditDetails =
    purchaseStatus === "bought"
      ? `${name} (${sku}) adicionado ao inventário como "Comprado" (${totalQuantity} un., €${unitPrice}/evento, local: ${warehouseLocation || "Armazém Principal"})${totalCost > 0 ? ` · Despesa automática de €${totalCost.toFixed(2)} registada em Finanças.` : ""}`
      : `${name} (${sku}) adicionado ao inventário como "Ainda Não Comprado" (${totalQuantity} un., €${unitPrice}/evento, local: ${warehouseLocation || "Armazém Principal"})${totalCost > 0 ? ` · Custo de aquisição previsto de €${totalCost.toFixed(2)} deduzido do Lucro Projetado.` : ""}`;

  await recordAuditLog({
    entityType: "inventory",
    entityId: id,
    action: "criado",
    title: "Artigo criado",
    details: auditDetails,
  });

  invalidateAllCaches();
  return { success: true, id, item, movement: createdMovement };
  } catch (err: any) {
    console.error("createItemAction error:", err);
    return {
      success: false,
      error: err?.message || "Ocorreu um erro ao registar o artigo no inventário.",
    };
  }
}

// 6. Update Stock Triage (Damaged / Repaired)
export async function updateItemTriageAction(itemId: string, action: "repair_all" | "report_damage", quantity: number = 1) {
  if (action === "repair_all") {
    await db
      .update(inventoryItems)
      .set({ damagedQuantity: 0, inMaintenanceQuantity: 0 })
      .where(eq(inventoryItems.id, itemId));
  } else if (action === "report_damage") {
    await db
      .update(inventoryItems)
      .set({
        damagedQuantity: sql`${inventoryItems.damagedQuantity} + ${quantity}`,
      })
      .where(eq(inventoryItems.id, itemId));
  }

  const triageDetails =
    action === "repair_all"
      ? "Todas as unidades danificadas foram reparadas e repostas no stock disponível"
      : `Registado dano em ${quantity} unidade(s)`;

  await recordAuditLog({
    entityType: "inventory",
    entityId: itemId,
    action: "triagem",
    title: action === "repair_all" ? "Reparação concluída" : "Dano registado",
    details: triageDetails,
  });

  invalidateAllCaches();
  revalidatePath(`/inventario/${itemId}`);
  revalidatePath(`/artigos/${itemId}`);
  return { success: true };
}

// 6.1 Update Inventory Item Details
export async function updateItemAction(formData: FormData) {
  const itemId = formData.get("itemId") as string;
  if (!itemId) return { success: false, error: "ID do artigo é obrigatório." };

  const name = formData.get("name") as string;
  const category = formData.get("category") as string;
  const totalQuantity = parseInt((formData.get("totalQuantity") as string) || "1", 10);
  const minStock = parseInt((formData.get("minStock") as string) || "0", 10);
  const warehouseLocation = formData.get("warehouseLocation") as string;
  const locationId = (formData.get("locationId") as string)?.trim() || null;
  const dimensions = formData.get("dimensions") as string;
  const rawUnitPrice = parseFloat((formData.get("unitPrice") as string) || "0");
  const rawReplacementCost = parseFloat((formData.get("replacementCost") as string) || "0");
  const rawPurchasePrice = parseFloat((formData.get("purchasePrice") as string) || "0");
  const price = rawPurchasePrice || rawReplacementCost || rawUnitPrice || 0;
  const unitPrice = price;
  const replacementCost = price;
  const imageUrl = formData.get("imageUrl") as string;

  if (!name || !category) {
    return { success: false, error: "Nome e categoria são obrigatórios." };
  }

  await db
    .update(inventoryItems)
    .set({
      name,
      category,
      totalQuantity,
      minStock,
      warehouseLocation: warehouseLocation || "Armazém Principal",
      locationId: locationId || null,
      dimensions: dimensions || null,
      unitPrice,
      replacementCost,
      imageUrl: imageUrl || null,
    })
    .where(eq(inventoryItems.id, itemId));

  await recordAuditLog({
    entityType: "inventory",
    entityId: itemId,
    action: "atualizado",
    title: "Artigo atualizado",
    details: `Dados atualizados: ${name} (${totalQuantity} un., €${unitPrice.toFixed(2)}, local: ${warehouseLocation || "Armazém Principal"})`,
  });

  invalidateAllCaches();
  revalidatePath(`/inventario/${itemId}`);
  revalidatePath(`/artigos/${itemId}`);
  return { success: true };
}

// 6.2 Partial Inline Patch for Inventory Item (Auto-Save)
export async function updateItemPatchAction(
  itemId: string,
  patch: {
    name?: string;
    sku?: string;
    category?: string;
    totalQuantity?: number;
    minStock?: number | null;
    warehouseLocation?: string | null;
    locationId?: string | null;
    dimensions?: string | null;
    unitPrice?: number;
    replacementCost?: number | null;
    purchaseStatus?: "bought" | "not_bought" | null;
    purchaseCost?: number | null;
    isConsumable?: boolean | null;
    packageUnits?: number | null;
    imageUrl?: string | null;
    barcode?: string | null;
    damagedQuantity?: number | null;
    inMaintenanceQuantity?: number | null;
  }
) {
  if (!itemId) return { success: false, error: "ID do artigo é obrigatório." };

  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (patch.name !== undefined) updateData.name = patch.name;
  if (patch.sku !== undefined) updateData.sku = patch.sku;
  if (patch.category !== undefined) updateData.category = patch.category;
  if (patch.totalQuantity !== undefined) updateData.totalQuantity = Math.max(0, patch.totalQuantity);
  if (patch.minStock !== undefined) updateData.minStock = patch.minStock === null ? null : Math.max(0, patch.minStock);
  if (patch.warehouseLocation !== undefined) updateData.warehouseLocation = patch.warehouseLocation || "Armazém Principal";
  if (patch.locationId !== undefined) updateData.locationId = patch.locationId || null;
  if (patch.dimensions !== undefined) updateData.dimensions = patch.dimensions || null;
  if (patch.unitPrice !== undefined) updateData.unitPrice = Math.max(0, patch.unitPrice);
  if (patch.replacementCost !== undefined) updateData.replacementCost = patch.replacementCost === null ? null : Math.max(0, patch.replacementCost);
  if (patch.purchaseStatus !== undefined) updateData.purchaseStatus = patch.purchaseStatus;
  if (patch.purchaseCost !== undefined) updateData.purchaseCost = patch.purchaseCost === null ? 0 : Math.max(0, patch.purchaseCost);
  if (patch.isConsumable !== undefined) updateData.isConsumable = Boolean(patch.isConsumable);
  if (patch.packageUnits !== undefined) updateData.packageUnits = patch.packageUnits === null ? 1 : Math.max(1, patch.packageUnits);
  if (patch.imageUrl !== undefined) updateData.imageUrl = patch.imageUrl || null;
  if (patch.barcode !== undefined) updateData.barcode = patch.barcode?.trim() || null;
  if (patch.damagedQuantity !== undefined) updateData.damagedQuantity = patch.damagedQuantity === null ? 0 : Math.max(0, patch.damagedQuantity);
  if (patch.inMaintenanceQuantity !== undefined) updateData.inMaintenanceQuantity = patch.inMaintenanceQuantity === null ? 0 : Math.max(0, patch.inMaintenanceQuantity);

  const { getCurrentUser } = await import("@/lib/auth");
  const user = await getCurrentUser();
  if (user) {
    updateData.lastUpdatedByUserId = user.id;
    updateData.lastUpdatedByName = user.name;
  }

  await db.update(inventoryItems).set(updateData).where(eq(inventoryItems.id, itemId));

  const changedKeys = Object.keys(updateData).filter(
    (k) => k !== "updatedAt" && k !== "lastUpdatedByUserId" && k !== "lastUpdatedByName"
  );
  let summary = "Campos alterados";
  if (patch.name !== undefined) summary = `Nome alterado para "${patch.name}"`;
  else if (patch.purchaseStatus !== undefined) summary = `Estado de compra alterado para "${patch.purchaseStatus === "bought" ? "Comprado" : "Não Comprado"}"`;
  else if (patch.unitPrice !== undefined) summary = `Preço diário ajustado para €${patch.unitPrice.toFixed(2)}`;
  else if (patch.totalQuantity !== undefined) summary = `Stock total alterado para ${patch.totalQuantity} un.`;
  else if (patch.warehouseLocation !== undefined) summary = `Localização alterada para "${patch.warehouseLocation}"`;
  else if (patch.category !== undefined) summary = `Categoria alterada para "${patch.category}"`;
  else if (changedKeys.length > 0) summary = `Campos atualizados: ${changedKeys.join(", ")}`;

  await recordAuditLog({
    entityType: "inventory",
    entityId: itemId,
    action: "atualizado",
    title: "Alteração de artigo",
    details: summary,
  });

  invalidateAllCaches();
  revalidatePath(`/inventario/${itemId}`);
  revalidatePath(`/inventory/${itemId}`);
  revalidatePath(`/artigos/${itemId}`);
  return { success: true };
}

// 6.3 Mark Item as Bought and Automatically Create Financial Expense
export async function markItemAsBoughtAction(
  itemId: string,
  customPurchaseCost?: number
) {
  if (!itemId) return { success: false, error: "ID do artigo é obrigatório." };

  const item = await db.query.inventoryItems.findFirst({
    where: eq(inventoryItems.id, itemId),
  });

  if (!item) {
    return { success: false, error: "Artigo não encontrado." };
  }

  const cost =
    customPurchaseCost !== undefined && customPurchaseCost > 0
      ? customPurchaseCost
      : item.purchaseCost && item.purchaseCost > 0
      ? item.purchaseCost
      : (item.replacementCost || 0) * (item.totalQuantity || 1);

  // Update item to bought
  await db
    .update(inventoryItems)
    .set({
      purchaseStatus: "bought",
      purchaseCost: cost,
      updatedAt: new Date(),
    })
    .where(eq(inventoryItems.id, itemId));

  let createdMovement: any = null;
  if (cost > 0) {
    const movId = generateId("mov");
    createdMovement = {
      id: movId,
      type: "saida" as const,
      category: "Material / Stock",
      description: `Aquisição de Stock: ${item.name} (${item.totalQuantity} un.)`,
      amount: cost,
      date: new Date(),
      eventId: null,
      clientId: null,
      notes: `Despesa gerada automaticamente ao marcar como comprado o artigo ${item.sku} (${item.id})`,
      createdAt: new Date(),
    };
    await db.insert(financialMovements).values(createdMovement);
  }

  await recordAuditLog({
    entityType: "inventory",
    entityId: itemId,
    action: "atualizado",
    title: "Artigo marcado como Comprado",
    details: `${item.name} (${item.sku}) passou a Comprado.${cost > 0 ? ` Despesa de €${cost.toFixed(2)} lançada em Finanças.` : ""}`,
  });

  invalidateAllCaches();
  revalidatePath(`/inventario/${itemId}`);
  revalidatePath(`/inventory/${itemId}`);
  revalidatePath(`/artigos/${itemId}`);
  revalidatePath("/inventario");
  revalidatePath("/financas");
  revalidatePath("/");

  return {
    success: true,
    item: { ...item, purchaseStatus: "bought" as const, purchaseCost: cost },
    movement: createdMovement,
  };
}

// 6.4 Check if item is used in upcoming events before deletion
export async function checkItemUpcomingEventsAction(itemId: string) {
  if (!itemId) return { success: false, upcomingAllocations: [], hasUpcomingEvents: false };

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allocations = await db
      .select({
        allocationId: eventAllocations.id,
        quantity: eventAllocations.quantity,
        status: eventAllocations.status,
        eventId: events.id,
        eventName: events.name,
        eventVenue: events.venue,
        eventStartDate: events.startDate,
        eventEndDate: events.endDate,
        eventStatus: events.status,
      })
      .from(eventAllocations)
      .innerJoin(events, eq(eventAllocations.eventId, events.id))
      .where(eq(eventAllocations.itemId, itemId));

    const upcomingAllocations = allocations.filter((a) => {
      if (a.eventStatus === "cancelado" || a.eventStatus === "concluido") return false;
      const end = a.eventEndDate ? new Date(a.eventEndDate) : new Date(a.eventStartDate);
      return end >= today;
    });

    return {
      success: true,
      totalAllocations: allocations.length,
      upcomingAllocations,
      hasUpcomingEvents: upcomingAllocations.length > 0,
    };
  } catch (err: any) {
    console.error("checkItemUpcomingEventsAction error:", err);
    return { success: false, upcomingAllocations: [], hasUpcomingEvents: false, error: err?.message };
  }
}

// 6.5 Soft-delete item from inventory (preserves event history and past allocations)
export async function deleteInventoryItemAction(itemId: string) {
  await requireAuth();
  if (!itemId) return { success: false, error: "ID do artigo é obrigatório." };

  try {
    const item = await db.query.inventoryItems.findFirst({
      where: eq(inventoryItems.id, itemId),
    });

    if (!item) {
      return { success: false, error: "Artigo não encontrado." };
    }

    // Soft delete: sets deletedAt timestamp so active inventory ignores it
    // but all past events, historical allocations, and quotes preserve the item record!
    await db
      .update(inventoryItems)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, itemId));

    // Record audit log
    await recordAuditLog({
      entityType: "inventory",
      entityId: itemId,
      action: "eliminado",
      title: "Artigo removido (Soft Delete)",
      details: `Artigo "${item.name}" (${item.sku}) foi removido do inventário ativo. O histórico em eventos anteriores foi preservado.`,
    });

    invalidateAllCaches();
    revalidatePath("/inventario");
    revalidatePath("/inventory");
    revalidatePath(`/inventario/${itemId}`);
    revalidatePath(`/inventory/${itemId}`);
    revalidatePath("/");

    return { success: true };
  } catch (err: any) {
    console.error("deleteInventoryItemAction error:", err);
    return { success: false, error: err?.message || "Erro ao eliminar artigo." };
  }
}

// 6.6 Upload item photo from camera capture or file picker
export async function uploadItemPhotoAction(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) {
      return { success: false, error: "Ficheiro inválido ou vazio." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawExt = path.extname(file.name || "").toLowerCase() || ".jpg";
    const sanitizedBase = path.basename(file.name || "artigo", rawExt).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
    const uniqueName = `item-${Date.now()}-${generateId("f")}-${sanitizedBase}${rawExt}`;
    const mime = file.type || (rawExt === ".png" ? "image/png" : rawExt === ".webp" ? "image/webp" : "image/jpeg");

    try {
      await db.insert(appUploads).values({
        id: generateId("upl"),
        filename: uniqueName,
        mimeType: mime,
        dataBase64: buffer.toString("base64"),
        size: buffer.length,
        createdAt: new Date(),
      }).onConflictDoNothing();
    } catch (dbErr) {
      console.error("Erro ao gravar foto do artigo na DB:", dbErr);
    }

    try {
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });
      await fs.writeFile(path.join(uploadsDir, uniqueName), buffer);
    } catch {
      // Best effort disk cache
    }

    const url = `/api/uploads/${uniqueName}`;
    return { success: true, url };
  } catch (err: any) {
    console.error("uploadItemPhotoAction error:", err);
    return { success: false, error: err?.message || "Erro ao processar fotografia." };
  }
}

// 6.7 Upload User Profile Picture
export async function uploadUserProfilePictureAction(formData: FormData) {
  try {
    await ensureDbMigrated();
    const { getCurrentUser } = await import("@/lib/auth");
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Não tem sessão iniciada." };
    }

    const targetUserId = (formData.get("userId") as string) || currentUser.id;
    const isSelf = targetUserId === currentUser.id;
    const isOwner = currentUser.role === "owner";
    if (!isSelf && !isOwner) {
      return { success: false, error: "Apenas o Programador (Owner) pode alterar a fotografia de outros membros." };
    }

    const file = formData.get("file") as File;
    if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) {
      return { success: false, error: "Ficheiro inválido ou vazio." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawExt = path.extname(file.name || "").toLowerCase() || ".jpg";
    const uniqueName = `avatar-${targetUserId}-${Date.now()}${rawExt}`;
    const mime = file.type || (rawExt === ".png" ? "image/png" : rawExt === ".webp" ? "image/webp" : "image/jpeg");

    try {
      await db.insert(appUploads).values({
        id: generateId("upl"),
        filename: uniqueName,
        mimeType: mime,
        dataBase64: buffer.toString("base64"),
        size: buffer.length,
        createdAt: new Date(),
      }).onConflictDoNothing();
    } catch (dbErr) {
      console.error("Erro ao gravar foto de perfil na DB:", dbErr);
    }

    try {
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });
      await fs.writeFile(path.join(uploadsDir, uniqueName), buffer);
    } catch {
      // Best effort disk cache
    }

    const avatarUrl = `/api/uploads/${uniqueName}`;

    await db.update(users).set({ avatarUrl }).where(eq(users.id, targetUserId));

    try {
      await db.update(userPresence).set({ avatarUrl }).where(eq(userPresence.userId, targetUserId));
    } catch {
      // Best effort
    }

    if (currentUser.id === targetUserId) {
      const { signSessionToken, SESSION_COOKIE_NAME } = await import("@/lib/session");
      const { cookies } = await import("next/headers");
      const expiresAt = Date.now() + 14 * 24 * 60 * 60 * 1000;
      const token = await signSessionToken({
        userId: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        role: currentUser.role,
        avatarUrl,
        expiresAt,
      });
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: new Date(expiresAt),
      });
    }

    await recordAuditLog({
      action: "update",
      entityType: "user",
      entityId: targetUserId,
      title: "Atualização de Fotografia de Perfil",
      details: `Fotografia de perfil atualizada por ${currentUser.name}`,
    });

    invalidateAllCaches();
    safeRevalidate(`/utilizadores/${targetUserId}`);
    safeRevalidate(`/users/${targetUserId}`);

    return { success: true, avatarUrl };
  } catch (err: any) {
    console.error("uploadUserProfilePictureAction error:", err);
    return { success: false, error: err?.message || "Erro ao processar fotografia de perfil." };
  }
}

// 6.8 Remove User Profile Picture
export async function removeUserProfilePictureAction(userId?: string) {
  try {
    await ensureDbMigrated();
    const { getCurrentUser } = await import("@/lib/auth");
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Não tem sessão iniciada." };
    }

    const targetUserId = userId || currentUser.id;
    const isSelf = targetUserId === currentUser.id;
    const isOwner = currentUser.role === "owner";
    if (!isSelf && !isOwner) {
      return { success: false, error: "Apenas o Programador (Owner) pode remover a fotografia de outros membros." };
    }

    await db.update(users).set({ avatarUrl: null }).where(eq(users.id, targetUserId));

    try {
      await db.update(userPresence).set({ avatarUrl: null }).where(eq(userPresence.userId, targetUserId));
    } catch {
      // Best effort
    }

    if (currentUser.id === targetUserId) {
      const { signSessionToken, SESSION_COOKIE_NAME } = await import("@/lib/session");
      const { cookies } = await import("next/headers");
      const expiresAt = Date.now() + 14 * 24 * 60 * 60 * 1000;
      const token = await signSessionToken({
        userId: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        role: currentUser.role,
        avatarUrl: null,
        expiresAt,
      });
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: new Date(expiresAt),
      });
    }

    await recordAuditLog({
      action: "update",
      entityType: "user",
      entityId: targetUserId,
      title: "Remoção de Fotografia de Perfil",
      details: `Fotografia de perfil removida por ${currentUser.name}`,
    });

    invalidateAllCaches();
    safeRevalidate(`/utilizadores/${targetUserId}`);
    safeRevalidate(`/users/${targetUserId}`);

    return { success: true };
  } catch (err: any) {
    console.error("removeUserProfilePictureAction error:", err);
    return { success: false, error: err?.message || "Erro ao remover fotografia de perfil." };
  }
}

// 7. Create Client CRM
export async function createClientAction(formData: FormData) {
  const name = formData.get("name") as string;
  const contactName = formData.get("contactName") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const nif = formData.get("nif") as string;
  const address = formData.get("address") as string;
  const notes = formData.get("notes") as string;

  if (!name) {
    return { success: false, error: "Nome do cliente é obrigatório." };
  }

  const rawCustomId = (formData.get("customId") as string) || "";
  const id = rawCustomId.trim() ? formatCustomId("cli", rawCustomId) : generateId("cli");
  const client = {
    id,
    name,
    contactName,
    email: email ? email.toLowerCase().trim() : null,
    phone,
    nif,
    address,
    notes,
    source: "manual",
    createdAt: new Date(),
  };
  await db.insert(clients).values(client);

  invalidateAllCaches();
  return { success: true, id, client };
}

// 8. Auth Actions
export async function loginAction(formData: FormData) {
  const { loginUser } = await import("@/lib/auth");
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { success: false, error: "Preenche o email e a palavra-passe." };
  }

  const result = await loginUser(email, password);
  if (result.success) {
    invalidateAllCaches();
  }
  return result;
}

export async function logoutAction() {
  const { logoutUser } = await import("@/lib/auth");
  await logoutUser();
  return { success: true };
}

export async function createUserAction(formData: FormData) {
  const { getCurrentUser, createTeamUser } = await import("@/lib/auth");
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "owner") {
    return { success: false, error: "Apenas o Programador (Owner) pode criar novas contas de equipa." };
  }

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = (formData.get("role") as any) || "producer";
  const customId = (formData.get("customId") as string) || undefined;

  if (!name || !email || !password) {
    return { success: false, error: "Nome, email e palavra-passe são obrigatórios." };
  }

  const result = await createTeamUser({ name, email, password, role, customId });
  if (result.success && "id" in result) {
    await recordAuditLog({
      entityType: "user",
      entityId: result.id as string,
      action: "criado",
      title: "Utilizador criado",
      details: `Conta ${name} (${role}) criada por ${currentUser.name}`,
    });
  }
  invalidateAllCaches();
  return result;
}

// 8.1 Update User Action
export async function updateUserAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth");
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Não tem sessão iniciada." };
  }

  const userId = formData.get("userId") as string;
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;
  const requestedRole = formData.get("role") as "owner" | "admin" | "producer" | "warehouse";

  if (!userId || !name) {
    return { success: false, error: "ID e Nome são obrigatórios." };
  }

  const isSelf = currentUser.id === userId;
  const isOwner = currentUser.role === "owner";

  // Admins can only edit themselves and cannot edit other users' information
  if (!isOwner && !isSelf) {
    return { success: false, error: "Apenas o Programador (Owner) pode editar informações de outros utilizadores." };
  }

  const oldUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!oldUser) {
    return { success: false, error: "Utilizador não encontrado." };
  }

  const oldName = oldUser.name;

  // Role permissions:
  // Only the Owner can change permissions/roles (including assigning or removing admin/owner permissions).
  // Non-owners (admins, producers, warehouse) editing their own profile cannot change their role.
  let finalRole = oldUser.role;
  if (isOwner && requestedRole) {
    finalRole = requestedRole;
  }

  const updatePayload: Record<string, any> = {
    name,
    role: finalRole,
  };

  if (email) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing && existing.id !== userId) {
      return { success: false, error: "Este email já está registado noutra conta." };
    }
    updatePayload.email = email;
  }

  if (password && password.trim().length > 0) {
    const bcrypt = (await import("bcryptjs")).default;
    updatePayload.passwordHash = await bcrypt.hash(password.trim(), 10);
  }

  await db
    .update(users)
    .set(updatePayload)
    .where(eq(users.id, userId));

  // If the user's name was changed, synchronize related records where the name is stored
  if (name !== oldName) {
    await db
      .update(storageLocations)
      .set({ managerName: name })
      .where(or(eq(storageLocations.managerUserId, userId), eq(storageLocations.managerName, oldName)));

    await db
      .update(eventTasks)
      .set({ assignedTo: name })
      .where(eq(eventTasks.assignedTo, oldName));
  }

  // If the updated user is the currently logged in user, refresh the session cookie with the new name
  const isCurrentUser = currentUser.id === userId;
  if (isCurrentUser) {
    const { signSessionToken, SESSION_COOKIE_NAME } = await import("@/lib/session");
    const { cookies } = await import("next/headers");
    const expiresAt = Date.now() + 14 * 24 * 60 * 60 * 1000;
    const token = await signSessionToken({
      userId,
      email: updatePayload.email || oldUser.email,
      name,
      role: (updatePayload.role || oldUser.role) as any,
      avatarUrl: oldUser.avatarUrl || null,
      expiresAt,
    });
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(expiresAt),
    });
  }

  await recordAuditLog({
    entityType: "user",
    entityId: userId,
    action: "editado",
    title: "Utilizador atualizado",
    details: `Conta ${name} (${updatePayload.role || oldUser.role}) atualizada por ${currentUser.name}`,
  });

  invalidateAllCaches();
  try {
    revalidatePath("/", "layout");
    revalidatePath(`/utilizadores/${userId}`);
    revalidatePath(`/users/${userId}`);
    revalidatePath("/mais");
    revalidatePath("/more");
    revalidatePath("/eventos");
    revalidatePath("/events");
    revalidatePath("/inventario");
    revalidatePath("/inventory");
    revalidatePath("/financas");
    revalidatePath("/finance");
    revalidatePath("/calendario");
    revalidatePath("/calendar");
  } catch {}

  return {
    success: true,
    user: {
      id: userId,
      name,
      email: updatePayload.email || oldUser.email,
      role: (updatePayload.role || oldUser.role) as any,
      avatarUrl: oldUser.avatarUrl || null,
    },
    isCurrentUser,
  };
}

// 9. Update Event Details (Category, Dates, Theme, Vibe, Customer Price, Notes, Special Needs)
export async function updateEventDetailsAction(formData: FormData) {
  const eventId = formData.get("eventId") as string;
  if (!eventId) return { success: false, error: "ID do evento é obrigatório." };

  const name = formData.get("name") as string;
  const clientId = (formData.get("clientId") as string) || null;
  const venue = (formData.get("venue") as string) || "";
  const startDateStr = formData.get("startDate") as string;
  const endDateStr = formData.get("endDate") as string;
  const prepDateStr = formData.get("prepDate") as string;
  const returnDateStr = formData.get("returnDate") as string;
  const status = formData.get("status") as any;
  const category = (formData.get("category") as string) || "Geral";
  const theme = (formData.get("theme") as string) || "";
  const vibeColors = (formData.get("vibeColors") as string) || "";
  const customerPrice = parseFloat((formData.get("customerPrice") as string) || "0");
  const totalBudget = parseFloat((formData.get("totalBudget") as string) || "0");
  const specialNeeds = (formData.get("specialNeeds") as string) || "";
  const notes = (formData.get("notes") as string) || "";
  const coverImageUrl = (formData.get("coverImageUrl") as string) || "";

  await db
    .update(events)
    .set({
      ...(name && { name }),
      clientId,
      venue,
      ...(startDateStr && { startDate: new Date(startDateStr) }),
      endDate: endDateStr ? new Date(endDateStr) : null,
      prepDate: prepDateStr ? new Date(prepDateStr) : null,
      returnDate: returnDateStr ? new Date(returnDateStr) : null,
      ...(status && { status }),
      category,
      theme: theme || null,
      vibeColors: vibeColors || null,
      customerPrice,
      totalBudget,
      specialNeeds: specialNeeds || null,
      notes,
      ...(coverImageUrl && { coverImageUrl }),
    })
    .where(eq(events.id, eventId));

  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: "atualizado",
    title: "Detalhes do evento atualizados",
    details: `Atualização geral: ${name || "Evento"} · Local: ${venue || "N/A"} · Categoria: ${category}`,
  });

  invalidateAllCaches();
  revalidatePath(`/eventos/${eventId}`);
  return { success: true };
}

// 9.1 Update Event Patch (Instantaneous Auto-save for any field)
export async function updateEventPatchAction(
  eventId: string,
  patch: {
    name?: string;
    clientId?: string | null;
    venue?: string | null;
    startDate?: string | Date;
    endDate?: string | Date | null;
    prepDate?: string | Date | null;
    returnDate?: string | Date | null;
    status?: any;
    category?: string;
    theme?: string | null;
    vibeColors?: string | null;
    customerPrice?: number;
    totalBudget?: number;
    specialNeeds?: string | null;
    notes?: string | null;
    coverImageUrl?: string | null;
  }
) {
  if (!eventId) return { success: false, error: "Event ID is required" };

  const updateData: Record<string, any> = {};
  if (patch.name !== undefined) updateData.name = patch.name;
  if (patch.clientId !== undefined) updateData.clientId = patch.clientId || null;
  if (patch.venue !== undefined) updateData.venue = patch.venue || "";
  if (patch.startDate !== undefined) {
    updateData.startDate = patch.startDate ? new Date(patch.startDate) : new Date();
  }
  if (patch.endDate !== undefined) {
    updateData.endDate = patch.endDate ? new Date(patch.endDate) : null;
  }
  if (patch.prepDate !== undefined) {
    updateData.prepDate = patch.prepDate ? new Date(patch.prepDate) : null;
  }
  if (patch.returnDate !== undefined) {
    updateData.returnDate = patch.returnDate ? new Date(patch.returnDate) : null;
  }
  if (patch.status !== undefined) updateData.status = patch.status;
  if (patch.category !== undefined) updateData.category = patch.category;
  if (patch.theme !== undefined) updateData.theme = patch.theme || null;
  if (patch.vibeColors !== undefined) updateData.vibeColors = patch.vibeColors || null;
  if (patch.customerPrice !== undefined) updateData.customerPrice = patch.customerPrice;
  if (patch.totalBudget !== undefined) updateData.totalBudget = patch.totalBudget;
  if (patch.specialNeeds !== undefined) updateData.specialNeeds = patch.specialNeeds || null;
  if (patch.notes !== undefined) updateData.notes = patch.notes || "";
  if (patch.coverImageUrl !== undefined) updateData.coverImageUrl = patch.coverImageUrl || "";

  await db.update(events).set(updateData).where(eq(events.id, eventId));

  const changedKeys = Object.keys(updateData);
  let summary = "Campos alterados";
  if (patch.status !== undefined) summary = `Estado alterado para ${patch.status}`;
  else if (patch.customerPrice !== undefined) summary = `Preço cliente ajustado para €${patch.customerPrice}`;
  else if (patch.theme !== undefined) summary = `Tema alterado para "${patch.theme}"`;
  else if (patch.venue !== undefined) summary = `Local alterado para "${patch.venue}"`;
  else if (changedKeys.length > 0) summary = `Campos atualizados: ${changedKeys.join(", ")}`;

  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: patch.status !== undefined ? "alterou_estado" : "atualizado",
    title: patch.status !== undefined ? "Estado alterado" : "Alteração de campo",
    details: summary,
  });

  invalidateAllCaches();
  revalidatePath(`/eventos/${eventId}`);
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

// 10. Update Event Theme & Vibe Colors
export async function updateEventVibeAction(eventId: string, theme: string, vibeColors: string[]) {
  await db
    .update(events)
    .set({
      theme: theme || null,
      vibeColors: JSON.stringify(vibeColors),
    })
    .where(eq(events.id, eventId));

  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: "atualizado",
    title: "Tema & Cores atualizados",
    details: `Tema definido para "${theme || "Geral"}" com ${vibeColors.length} cores selecionadas`,
  });

  invalidateAllCaches();
  revalidatePath(`/eventos/${eventId}`);
  return { success: true };
}

// 11. Update Customer Price
export async function updateCustomerPriceAction(eventId: string, customerPrice: number) {
  await db
    .update(events)
    .set({ customerPrice })
    .where(eq(events.id, eventId));

  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: "atualizado",
    title: "Preço ao cliente atualizado",
    details: `Valor final a cobrar ao cliente atualizado para €${customerPrice.toFixed(2)}`,
  });

  invalidateAllCaches();
  revalidatePath(`/eventos/${eventId}`);
  return { success: true };
}

// 11.1 Update Allocation Quantity
export async function updateAllocationQuantityAction(allocationId: string, quantity: number, eventId: string) {
  await db
    .update(eventAllocations)
    .set({ quantity: Math.max(1, quantity) })
    .where(eq(eventAllocations.id, allocationId));

  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: "atualizado",
    title: "Quantidade de material ajustada",
    details: `Quantidade alocada ajustada para ${Math.max(1, quantity)} un.`,
  });

  invalidateAllCaches();
  revalidatePath(`/eventos/${eventId}`);
  return { success: true };
}

// 12. Add Inventory Allocation to Event
export async function addEventAllocationAction(formData: FormData) {
  await requireAuth();
  const eventId = formData.get("eventId") as string;
  const itemId = formData.get("itemId") as string;
  const quantity = parseInt((formData.get("quantity") as string) || "1", 10);
  const status = (formData.get("status") as any) || "reservado";
  const notes = (formData.get("notes") as string) || "";

  if (!eventId || !itemId || quantity <= 0) {
    return { success: false, error: "Dados de alocação inválidos." };
  }

  // Check temporal stock conflict
  let conflictWarning: string | null = null;
  try {
    const targetEvt = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    });
    if (targetEvt && targetEvt.startDate) {
      const { checkItemAvailability } = await import("@/lib/conflicts");
      const start = targetEvt.prepDate ? new Date(targetEvt.prepDate) : new Date(targetEvt.startDate);
      const end = targetEvt.returnDate ? new Date(targetEvt.returnDate) : targetEvt.endDate ? new Date(targetEvt.endDate) : new Date(targetEvt.startDate);
      const stockCheck = await checkItemAvailability(itemId, quantity, start, end, eventId);
      if (stockCheck.hasConflict) {
        conflictWarning = `Atenção: Apenas ${stockCheck.availableQuantity} un. disponíveis neste período (${stockCheck.reservedInPeriod} un. já reservadas noutros eventos).`;
      }
    }
  } catch (err) {
    console.warn("Stock availability check notice:", err);
  }

  const id = generateId("alc");
  await db.insert(eventAllocations).values({
    id,
    eventId,
    itemId,
    quantity,
    status,
    notes: notes || null,
  });

  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: "alocou_material",
    title: "Material alocado ao evento",
    details: `Alocadas ${quantity} unidades do artigo #${itemId}`,
  });

  await recordAuditLog({
    entityType: "inventory",
    entityId: itemId,
    action: "alocou_material",
    title: "Material reservado",
    details: `Reservadas ${quantity} unidades para o evento #${eventId}`,
  });

  invalidateAllCaches();
  revalidatePath(`/eventos/${eventId}`);
  return { success: true, id, warning: conflictWarning };
}

// 13. Update Inventory Allocation Status
export async function updateAllocationStatusAction(allocationId: string, status: "reservado" | "despachado" | "devolvido" | "danificado", eventId: string) {
  await db
    .update(eventAllocations)
    .set({ status })
    .where(eq(eventAllocations.id, allocationId));

  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: "atualizado",
    title: "Estado de material alterado",
    details: `Alocação de material #${allocationId} alterada para estado "${status}"`,
  });

  invalidateAllCaches();
  revalidatePath(`/eventos/${eventId}`);
  return { success: true };
}

// 14. Delete Inventory Allocation
export async function deleteAllocationAction(allocationId: string, eventId: string) {
  await db
    .delete(eventAllocations)
    .where(eq(eventAllocations.id, allocationId));

  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: "removeu_material",
    title: "Material removido do evento",
    details: `Removida alocação de material #${allocationId}`,
  });

  invalidateAllCaches();
  revalidatePath(`/eventos/${eventId}`);
  return { success: true };
}

// 14.1 Add Custom Item Specific to 1 Event (with direct quota addition)
export async function addEventCustomItemAction(params: {
  eventId: string;
  name: string;
  category?: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  supplier?: string;
  notes?: string;
  isConsumable?: boolean;
  addToQuota?: boolean;
}) {
  await ensureDbMigrated().catch(() => {});
  const {
    eventId,
    name,
    category = "Personalizado",
    quantity = 1,
    unitCost = 0,
    unitPrice = 0,
    supplier,
    notes,
    isConsumable = false,
    addToQuota = true,
  } = params;

  if (!eventId || !name?.trim()) {
    return { success: false, error: "Nome do artigo e ID do evento são obrigatórios." };
  }

  const cleanQty = Math.max(1, Number(quantity) || 1);
  const cleanUnitCost = Math.max(0, Number(unitCost) || 0);
  const cleanUnitPrice = Math.max(0, Number(unitPrice) || 0);
  const totalCost = cleanQty * cleanUnitCost;
  const totalPrice = cleanQty * cleanUnitPrice;

  const id = generateId("eci");
  const now = new Date();

  await db.insert(eventCustomItems).values({
    id,
    eventId,
    name: name.trim(),
    category: category.trim() || "Personalizado",
    quantity: cleanQty,
    unitCost: cleanUnitCost,
    unitPrice: cleanUnitPrice,
    supplier: supplier?.trim() || null,
    notes: notes?.trim() || null,
    isConsumable: Boolean(isConsumable),
    boughtStatus: "pending",
    createdAt: now,
    updatedAt: now,
  });

  // If addToQuota is enabled, directly add costs & prices to the event quota/budget
  if (addToQuota) {
    const targetEvt = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    });
    if (targetEvt) {
      const currentPrice = Number(targetEvt.customerPrice) || 0;
      const currentBudget = Number(targetEvt.totalBudget) || 0;
      await db
        .update(events)
        .set({
          customerPrice: Math.round((currentPrice + totalPrice) * 100) / 100,
          totalBudget: Math.round((currentBudget + totalCost) * 100) / 100,
          updatedAt: now,
        })
        .where(eq(events.id, eventId));
    }
  }

  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: "atualizado",
    title: "Artigo personalizado adicionado",
    details: `Adicionado artigo exclusivo "${name.trim()}" (Qtd: ${cleanQty}, Custo: €${cleanUnitCost.toFixed(2)}, Quota: €${cleanUnitPrice.toFixed(2)}${
      addToQuota ? ` · +€${totalPrice.toFixed(2)} adicionado à quota` : ""
    }${isConsumable ? " · Classificado como consumível" : ""})`,
  });

  invalidateAllCaches();
  revalidatePath(`/eventos/${eventId}`);
  return {
    success: true,
    item: {
      id,
      eventId,
      name: name.trim(),
      category: category.trim() || "Personalizado",
      quantity: cleanQty,
      unitCost: cleanUnitCost,
      unitPrice: cleanUnitPrice,
      supplier: supplier?.trim() || null,
      notes: notes?.trim() || null,
      isConsumable: Boolean(isConsumable),
      boughtStatus: "pending" as const,
      createdAt: now,
      updatedAt: now,
    },
  };
}

// 14.2 Update Custom Item Specific to Event (with quota delta sync)
export async function updateEventCustomItemAction(params: {
  id: string;
  eventId: string;
  name: string;
  category?: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  supplier?: string;
  notes?: string;
  isConsumable?: boolean;
  syncQuotaDifference?: boolean;
}) {
  await ensureDbMigrated().catch(() => {});
  const {
    id,
    eventId,
    name,
    category = "Personalizado",
    quantity = 1,
    unitCost = 0,
    unitPrice = 0,
    supplier,
    notes,
    isConsumable,
    syncQuotaDifference = true,
  } = params;

  if (!id || !eventId || !name?.trim()) {
    return { success: false, error: "Dados inválidos para atualizar artigo personalizado." };
  }

  const existing = await db.query.eventCustomItems.findFirst({
    where: eq(eventCustomItems.id, id),
  });

  if (!existing) {
    return { success: false, error: "Artigo personalizado não encontrado." };
  }

  const cleanQty = Math.max(1, Number(quantity) || 1);
  const cleanUnitCost = Math.max(0, Number(unitCost) || 0);
  const cleanUnitPrice = Math.max(0, Number(unitPrice) || 0);

  const oldTotalPrice = (existing.quantity || 1) * (existing.unitPrice || 0);
  const oldTotalCost = (existing.quantity || 1) * (existing.unitCost || 0);

  const newTotalPrice = cleanQty * cleanUnitPrice;
  const newTotalCost = cleanQty * cleanUnitCost;

  const diffPrice = newTotalPrice - oldTotalPrice;
  const diffCost = newTotalCost - oldTotalCost;

  const now = new Date();

  const updateFields: Record<string, any> = {
    name: name.trim(),
    category: category.trim() || "Personalizado",
    quantity: cleanQty,
    unitCost: cleanUnitCost,
    unitPrice: cleanUnitPrice,
    supplier: supplier?.trim() || null,
    notes: notes?.trim() || null,
    updatedAt: now,
  };

  if (isConsumable !== undefined) {
    updateFields.isConsumable = Boolean(isConsumable);
  }

  await db
    .update(eventCustomItems)
    .set(updateFields)
    .where(eq(eventCustomItems.id, id));

  if (syncQuotaDifference && (diffPrice !== 0 || diffCost !== 0)) {
    const targetEvt = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    });
    if (targetEvt) {
      const currentPrice = Number(targetEvt.customerPrice) || 0;
      const currentBudget = Number(targetEvt.totalBudget) || 0;
      await db
        .update(events)
        .set({
          customerPrice: Math.max(0, Math.round((currentPrice + diffPrice) * 100) / 100),
          totalBudget: Math.max(0, Math.round((currentBudget + diffCost) * 100) / 100),
          updatedAt: now,
        })
        .where(eq(events.id, eventId));
    }
  }

  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: "atualizado",
    title: "Artigo personalizado atualizado",
    details: `Artigo exclusivo "${name.trim()}" atualizado (Qtd: ${cleanQty}, Custo: €${cleanUnitCost.toFixed(2)}, Quota: €${cleanUnitPrice.toFixed(2)})`,
  });

  invalidateAllCaches();
  revalidatePath(`/eventos/${eventId}`);
  return { success: true };
}


// 14.3 Delete Custom Item Specific to Event (deduct from quota)
export async function deleteEventCustomItemAction(params: {
  id: string;
  eventId: string;
  removeFromQuota?: boolean;
}) {
  await ensureDbMigrated().catch(() => {});
  const { id, eventId, removeFromQuota = true } = params;

  if (!id || !eventId) {
    return { success: false, error: "ID do artigo e ID do evento são obrigatórios." };
  }

  const existing = await db.query.eventCustomItems.findFirst({
    where: eq(eventCustomItems.id, id),
  });

  if (existing && removeFromQuota) {
    const totalPrice = (existing.quantity || 1) * (existing.unitPrice || 0);
    const totalCost = (existing.quantity || 1) * (existing.unitCost || 0);
    const targetEvt = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    });
    if (targetEvt) {
      const currentPrice = Number(targetEvt.customerPrice) || 0;
      const currentBudget = Number(targetEvt.totalBudget) || 0;
      await db
        .update(events)
        .set({
          customerPrice: Math.max(0, Math.round((currentPrice - totalPrice) * 100) / 100),
          totalBudget: Math.max(0, Math.round((currentBudget - totalCost) * 100) / 100),
          updatedAt: new Date(),
        })
        .where(eq(events.id, eventId));
    }
  }

  await db.delete(eventCustomItems).where(eq(eventCustomItems.id, id));

  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: "removeu_material",
    title: "Artigo personalizado removido",
    details: `Artigo exclusivo "${existing?.name || id}" removido do evento${
      removeFromQuota ? " e deduzido da quota" : ""
    }`,
  });

  invalidateAllCaches();
  revalidatePath(`/eventos/${eventId}`);
  return { success: true };
}

// 15. Add Event or Meeting Action Item (Task)
export async function addEventTaskAction(
  targetId: string,
  title: string,
  priority: "baixa" | "media" | "alta" | "urgente" = "media",
  dueDateStr?: string,
  assignedTo?: string
) {
  if (!targetId || !title.trim()) {
    return { success: false, error: "Título da tarefa é obrigatório." };
  }

  const isMeeting = targetId.startsWith("mtg-");
  const id = generateId("tsk");
  await db.insert(eventTasks).values({
    id,
    eventId: isMeeting ? null : targetId,
    meetingId: isMeeting ? targetId : null,
    title: title.trim(),
    completed: false,
    priority,
    dueDate: dueDateStr ? new Date(dueDateStr) : null,
    assignedTo: assignedTo?.trim() || null,
    orderIndex: Date.now(),
    createdAt: new Date(),
  });

  await recordAuditLog({
    entityType: "event",
    entityId: targetId,
    action: "tarefa",
    title: "Tarefa adicionada",
    details: `Nova tarefa: "${title.trim()}" (prioridade: ${priority})`,
  });

  invalidateAllCaches();
  if (isMeeting) {
    safeRevalidate(`/reunioes/${targetId}`);
    safeRevalidate(`/meetings/${targetId}`);
  } else {
    safeRevalidate(`/eventos/${targetId}`);
    safeRevalidate(`/events/${targetId}`);
  }
  return { success: true, id };
}

// 16. Toggle Event or Meeting Task Completion
export async function toggleEventTaskAction(taskId: string, completed: boolean, targetId: string) {
  await db
    .update(eventTasks)
    .set({ completed })
    .where(eq(eventTasks.id, taskId));

  await recordAuditLog({
    entityType: "event",
    entityId: targetId,
    action: "tarefa",
    title: completed ? "Tarefa concluída" : "Tarefa reaberta",
    details: `Tarefa #${taskId} marcada como ${completed ? "concluída" : "pendente"}`,
  });

  invalidateAllCaches();
  safeRevalidate(`/eventos/${targetId}`);
  safeRevalidate(`/reunioes/${targetId}`);
  return { success: true };
}

// 17. Delete Event or Meeting Task
export async function deleteEventTaskAction(taskId: string, targetId: string) {
  await db
    .delete(eventTasks)
    .where(eq(eventTasks.id, taskId));

  await recordAuditLog({
    entityType: "event",
    entityId: targetId,
    action: "tarefa",
    title: "Tarefa eliminada",
    details: `Tarefa #${taskId} removida`,
  });

  invalidateAllCaches();
  safeRevalidate(`/eventos/${targetId}`);
  safeRevalidate(`/reunioes/${targetId}`);
  return { success: true };
}

// 18. Audit Log Queries
export async function getAuditLogsAction(entityType: "event" | "inventory" | "quote", entityId: string) {
  return await getAuditLogsForEntity(entityType, entityId);
}

// 19. Event Media: Idea Boards & Final Outcomes
export async function addEventMediaAction(formData: FormData) {
  const eventId = formData.get("eventId") as string;
  const type = (formData.get("type") as "idea_board" | "final_outcome") || "idea_board";
  const title = (formData.get("title") as string)?.trim() || (type === "idea_board" ? "Nova Ideia / Conceito" : "Foto Real do Evento");
  const description = (formData.get("description") as string)?.trim() || "";
  const imageUrl = (formData.get("imageUrl") as string)?.trim();
  const tag = (formData.get("tag") as string)?.trim() || "Geral";

  if (!eventId || !imageUrl) {
    return { success: false, error: "ID do evento e URL da imagem são obrigatórios." };
  }

  const { getCurrentUser } = await import("@/lib/auth");
  const user = await getCurrentUser();
  const authorName = user?.name || "Administrador CFM";

  const id = generateId("med");
  const newMedia = {
    id,
    eventId,
    type,
    title,
    description: description || null,
    imageUrl,
    tag: tag || null,
    orderIndex: Date.now(),
    uploadedByName: authorName,
    createdAt: new Date(),
  };

  await db.insert(eventMedia).values(newMedia);

  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: type === "idea_board" ? "painel_ideias" : "resultado_final",
    title: type === "idea_board" ? "Imagem adicionada ao Moodboard" : "Foto real adicionada ao resultado",
    details: `${title} (${tag})`,
  });

  invalidateAllCaches();
  revalidatePath(`/eventos/${eventId}`);
  revalidatePath(`/events/${eventId}`);
  return { success: true, media: newMedia };
}

export async function addBatchEventMediaAction(formData: FormData) {
  try {
    await ensureDbMigrated();
    const eventId = formData.get("eventId") as string;
    const type = (formData.get("type") as "idea_board" | "final_outcome") || "idea_board";
    const boardTitle = (formData.get("boardTitle") as string)?.trim();
    const defaultTag = (formData.get("tag") as string)?.trim() || "Geral";
    const defaultDescription = (formData.get("description") as string)?.trim() || "";
    const targetMediaId = (formData.get("targetMediaId") as string)?.trim() || "";

    if (!eventId) {
      return { success: false, error: "ID do evento é obrigatório." };
    }

    const { getCurrentUser } = await import("@/lib/auth");
    const user = await getCurrentUser();
    const authorName = user?.name || "Administrador CFM";

    const collectedImages: Array<{
      id: string;
      url: string;
      title: string;
      tag: string;
    }> = [];

    // 1. Process local file uploads (multiple files)
    const files = formData.getAll("files") as File[];
    const fileTitles = formData.getAll("fileTitles") as string[];
    const fileTags = formData.getAll("fileTags") as string[];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file && typeof file.arrayBuffer === "function" && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const rawExt = path.extname(file.name || "").toLowerCase() || ".jpg";
        const sanitizedBase = path.basename(file.name || "imagem", rawExt).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
        const uniqueName = `${Date.now()}-${generateId("f")}-${sanitizedBase}${rawExt}`;
        const mime = file.type || (rawExt === ".png" ? "image/png" : rawExt === ".webp" ? "image/webp" : "image/jpeg");

        // 1. Persist to Turso DB so it works seamlessly on serverless / Vercel
        try {
          await db.insert(appUploads).values({
            id: generateId("upl"),
            filename: uniqueName,
            mimeType: mime,
            dataBase64: buffer.toString("base64"),
            size: buffer.length,
            createdAt: new Date(),
          }).onConflictDoNothing();
        } catch (dbUploadErr) {
          console.error("Erro ao gravar upload na base de dados:", dbUploadErr);
        }

        // 2. Best-effort cache to local disk if directory is writable (works in local dev)
        try {
          const uploadsDir = path.join(process.cwd(), "public", "uploads");
          await fs.mkdir(uploadsDir, { recursive: true });
          await fs.writeFile(path.join(uploadsDir, uniqueName), buffer);
        } catch {
          // Read-only filesystem in Vercel serverless environment - safely handled by appUploads DB!
        }

        const imageUrl = `/api/uploads/${uniqueName}`;
        const imgId = generateId("img");
        const title = fileTitles[i]?.trim() || file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ") || (type === "idea_board" ? `Imagem ${i + 1}` : `Fotografia ${i + 1}`);
        const tag = fileTags[i]?.trim() || defaultTag;

        collectedImages.push({
          id: imgId,
          url: imageUrl,
          title,
          tag,
        });
      }
    }

    // 2. Process web URLs (multiple URLs or presets)
    const urls = formData.getAll("urls") as string[];
    const urlTitles = formData.getAll("urlTitles") as string[];
    const urlTags = formData.getAll("urlTags") as string[];

    for (let j = 0; j < urls.length; j++) {
      const rawUrl = urls[j]?.trim();
      if (rawUrl) {
        const imgId = generateId("img");
        const title = urlTitles[j]?.trim() || (type === "idea_board" ? `Referência Visual ${j + 1}` : `Fotografia Real ${j + 1}`);
        const tag = urlTags[j]?.trim() || defaultTag;

        collectedImages.push({
          id: imgId,
          url: rawUrl,
          title,
          tag,
        });
      }
    }

    if (collectedImages.length === 0) {
      return { success: false, error: "Nenhuma imagem foi adicionada." };
    }

    // 3. CASE A: Appending images to an existing moodboard / outcome board
    if (targetMediaId) {
      const [existingBoard] = await db.select().from(eventMedia).where(eq(eventMedia.id, targetMediaId));
      if (existingBoard) {
        let existingImages: Array<{ id: string; url: string; title: string; tag: string }> = [];
        if (existingBoard.images) {
          try {
            const parsed = JSON.parse(existingBoard.images);
            if (Array.isArray(parsed)) existingImages = parsed;
          } catch {
            existingImages = [];
          }
        }
        if (existingImages.length === 0 && existingBoard.imageUrl) {
          existingImages.push({
            id: existingBoard.id,
            url: existingBoard.imageUrl,
            title: existingBoard.title,
            tag: existingBoard.tag || defaultTag,
          });
        }

        const mergedImages = [...existingImages, ...collectedImages];

        await db
          .update(eventMedia)
          .set({
            images: JSON.stringify(mergedImages),
            imageUrl: mergedImages[0]?.url || existingBoard.imageUrl,
          })
          .where(eq(eventMedia.id, targetMediaId));

        await recordAuditLog({
          entityType: "event",
          entityId: eventId,
          action: "adicionou_media",
          title: `${collectedImages.length} imagem(ns) adicionada(s) ao Moodboard`,
          details: `Moodboard "${existingBoard.title}" tem agora ${mergedImages.length} imagens`,
        });

        invalidateAllCaches();
        safeRevalidate(`/eventos/${eventId}`);
        safeRevalidate(`/events/${eventId}`);

        const updatedRecord = {
          ...existingBoard,
          images: JSON.stringify(mergedImages),
          imageUrl: mergedImages[0]?.url || existingBoard.imageUrl,
        };

        return {
          success: true,
          mode: "appended",
          media: updatedRecord,
          mediaList: [updatedRecord],
        };
      }
    }

    // 4. CASE B: Creating ONE single Moodboard with ALL uploaded pictures
    const mediaId = generateId("med");
    const coverUrl = collectedImages[0]?.url || "";
    const finalTitle = boardTitle || (type === "idea_board" ? "Painel de Ideias / Moodboard" : "Resultados Finais do Evento");

    const mediaRecord = {
      id: mediaId,
      eventId,
      type,
      title: finalTitle,
      description: defaultDescription || null,
      imageUrl: coverUrl,
      images: JSON.stringify(collectedImages),
      tag: defaultTag,
      orderIndex: Date.now(),
      uploadedByName: authorName,
      createdAt: new Date(),
    };

    await db.insert(eventMedia).values(mediaRecord);

    // 5. Record Audit Log for the single board created
    const actionLabel = type === "idea_board" ? "painel_ideias" : "resultado_final";
    const titleLabel = type === "idea_board"
      ? `Moodboard criado com ${collectedImages.length} imagens`
      : `Resultado Real registado com ${collectedImages.length} fotos`;

    await recordAuditLog({
      entityType: "event",
      entityId: eventId,
      action: actionLabel,
      title: titleLabel,
      details: `"${finalTitle}" com ${files.length} ficheiros locais e ${urls.length} links web`,
    });

    invalidateAllCaches();
    safeRevalidate(`/eventos/${eventId}`);
    safeRevalidate(`/events/${eventId}`);

    return {
      success: true,
      mode: "created",
      media: mediaRecord,
      mediaList: [mediaRecord],
    };
  } catch (err: any) {
    console.error("Erro em addBatchEventMediaAction:", err);
    return {
      success: false,
      error: err?.message || "Ocorreu um erro ao guardar o moodboard. Por favor tente novamente.",
    };
  }
}

export async function deleteMediaImageAction(mediaId: string, imageId: string, eventId: string) {
  const [board] = await db.select().from(eventMedia).where(eq(eventMedia.id, mediaId));
  if (!board) return { success: false, error: "Registo não encontrado." };

  let currentImages: Array<{ id: string; url: string; title?: string; tag?: string }> = [];
  if (board.images) {
    try {
      const parsed = JSON.parse(board.images);
      if (Array.isArray(parsed)) currentImages = parsed;
    } catch {
      currentImages = [];
    }
  }
  if (currentImages.length === 0 && board.imageUrl) {
    currentImages.push({
      id: board.id,
      url: board.imageUrl,
      title: board.title,
      tag: board.tag || undefined,
    });
  }

  const remainingImages = currentImages.filter((img) => img.id !== imageId && img.url !== imageId);

  if (remainingImages.length === 0) {
    // If no images left in the moodboard, delete the moodboard itself
    await db.delete(eventMedia).where(eq(eventMedia.id, mediaId));
    invalidateAllCaches();
    safeRevalidate(`/eventos/${eventId}`);
    safeRevalidate(`/events/${eventId}`);
    return { success: true, boardDeleted: true };
  } else {
    const newCover = remainingImages[0]?.url || board.imageUrl;
    await db
      .update(eventMedia)
      .set({
        images: JSON.stringify(remainingImages),
        imageUrl: newCover,
      })
      .where(eq(eventMedia.id, mediaId));

    invalidateAllCaches();
    safeRevalidate(`/eventos/${eventId}`);
    safeRevalidate(`/events/${eventId}`);
    return {
      success: true,
      boardDeleted: false,
      remainingCount: remainingImages.length,
      updatedImages: remainingImages,
      newCoverUrl: newCover,
    };
  }
}

export async function deleteEventMediaAction(mediaId: string, eventId: string) {
  await db.delete(eventMedia).where(eq(eventMedia.id, mediaId));

  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: "removeu_media",
    title: "Moodboard / Imagem removida da galeria",
    details: `Registo #${mediaId} eliminado do evento`,
  });

  invalidateAllCaches();
  safeRevalidate(`/eventos/${eventId}`);
  safeRevalidate(`/events/${eventId}`);
  return { success: true };
}

// 20.1 Add Moodboard Comment & Collaborative Feedback
export async function addMoodboardCommentAction(formData: FormData) {
  const mediaId = (formData.get("mediaId") as string)?.trim();
  const eventId = (formData.get("eventId") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const photoId = (formData.get("photoId") as string)?.trim() || null;
  const photoIndexStr = formData.get("photoIndex") as string;
  const photoIndex =
    photoIndexStr !== null && photoIndexStr !== undefined && photoIndexStr !== ""
      ? parseInt(photoIndexStr, 10)
      : null;
  const photoLabel = (formData.get("photoLabel") as string)?.trim() || null;
  const photoUrl = (formData.get("photoUrl") as string)?.trim() || null;
  let imageUrl = (formData.get("imageUrl") as string)?.trim() || null;

  if (!mediaId || !eventId) {
    return { success: false, error: "ID do moodboard e ID do evento são obrigatórios." };
  }

  if (!content) {
    return { success: false, error: "O comentário não pode estar vazio." };
  }

  const { getCurrentUser } = await import("@/lib/auth");
  const user = await getCurrentUser();
  const authorName = user?.name || "Administrador CFM";
  const userId = user?.id || null;

  // Handle uploaded comment attachment file if present
  const imageFile = formData.get("imageFile") as File | null;
  if (imageFile && typeof imageFile.arrayBuffer === "function" && imageFile.size > 0) {
    try {
      await ensureDbMigrated();
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const rawExt = path.extname(imageFile.name || "").toLowerCase() || ".jpg";
      const sanitizedBase = path
        .basename(imageFile.name || "comentario", rawExt)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 30);
      const uniqueName = `cmt-${Date.now()}-${generateId("f")}-${sanitizedBase}${rawExt}`;
      const mime = imageFile.type || (rawExt === ".png" ? "image/png" : rawExt === ".webp" ? "image/webp" : "image/jpeg");

      // 1. Persist to Turso DB so it works in serverless
      try {
        await db.insert(appUploads).values({
          id: generateId("upl"),
          filename: uniqueName,
          mimeType: mime,
          dataBase64: buffer.toString("base64"),
          size: buffer.length,
          createdAt: new Date(),
        }).onConflictDoNothing();
      } catch (dbErr) {
        console.error("Erro ao gravar anexo na base de dados:", dbErr);
      }

      // 2. Best-effort write to local filesystem
      try {
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        await fs.mkdir(uploadsDir, { recursive: true });
        await fs.writeFile(path.join(uploadsDir, uniqueName), buffer);
      } catch {
        // Ignored on read-only serverless
      }

      imageUrl = `/api/uploads/${uniqueName}`;
    } catch (uploadErr) {
      console.error("Erro ao processar anexo de comentário:", uploadErr);
    }
  }

  const commentId = generateId("cmt");
  const now = new Date();

  const newCommentRecord = {
    id: commentId,
    mediaId,
    eventId,
    userId,
    authorName,
    content,
    photoId,
    photoIndex,
    photoLabel,
    photoUrl,
    imageUrl,
    createdAt: now,
  };

  // 1. Insert into moodboard_comments table
  await db.insert(moodboardComments).values(newCommentRecord);

  // 2. Also keep eventMedia.comments JSON array updated for instant access
  const [board] = await db.select().from(eventMedia).where(eq(eventMedia.id, mediaId));
  if (board) {
    let existingComments: any[] = [];
    if (board.comments) {
      try {
        const parsed = JSON.parse(board.comments);
        if (Array.isArray(parsed)) existingComments = parsed;
      } catch {}
    }

    const updatedComments = [
      ...existingComments,
      {
        ...newCommentRecord,
        createdAt: now.toISOString(),
      },
    ];

    await db
      .update(eventMedia)
      .set({
        comments: JSON.stringify(updatedComments),
      })
      .where(eq(eventMedia.id, mediaId));
  }

  // 3. Record Audit Log
  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: "comentario_moodboard",
    title: `Novo comentário no Moodboard "${board?.title || "Moodboard"}"`,
    details: `${authorName}: "${content.slice(0, 50)}${content.length > 50 ? "..." : ""}" ${photoLabel ? `(${photoLabel})` : ""}`,
  });

  invalidateAllCaches();
  safeRevalidate(`/eventos/${eventId}`);
  safeRevalidate(`/events/${eventId}`);

  return {
    success: true,
    comment: {
      ...newCommentRecord,
      createdAt: now.toISOString(),
    },
  };
}

// 20.2 Delete Moodboard Comment
export async function deleteMoodboardCommentAction(commentId: string, mediaId: string, eventId: string) {
  // Delete from relational table
  await db.delete(moodboardComments).where(eq(moodboardComments.id, commentId));

  // Sync eventMedia.comments JSON
  const [board] = await db.select().from(eventMedia).where(eq(eventMedia.id, mediaId));
  if (board && board.comments) {
    try {
      const parsed = JSON.parse(board.comments);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((c: any) => c.id !== commentId);
        await db
          .update(eventMedia)
          .set({
            comments: JSON.stringify(filtered),
          })
          .where(eq(eventMedia.id, mediaId));
      }
    } catch {}
  }

  invalidateAllCaches();
  safeRevalidate(`/eventos/${eventId}`);
  safeRevalidate(`/events/${eventId}`);

  return { success: true, commentId };
}

// 21. Alert Actions (Snooze, Acknowledge, Dismiss, Sync)
export async function snoozeAlertAction(alertId: string, hours: number) {
  const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
  await db
    .update(alerts)
    .set({
      status: "snoozed",
      snoozedUntil,
      updatedAt: new Date(),
    })
    .where(eq(alerts.id, alertId));

  invalidateAllCaches();
  return { success: true, snoozedUntil };
}

export async function acknowledgeAlertAction(alertId: string) {
  await db
    .update(alerts)
    .set({
      acknowledgedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(alerts.id, alertId));

  invalidateAllCaches();
  return { success: true };
}

export async function dismissAlertAction(alertId: string) {
  await db
    .update(alerts)
    .set({
      status: "resolved",
      updatedAt: new Date(),
    })
    .where(eq(alerts.id, alertId));

  invalidateAllCaches();
  return { success: true };
}

export async function refreshAlertsAction() {
  const { evaluateAndSyncAlerts } = await import("@/lib/alerts");
  const result = await evaluateAndSyncAlerts();
  invalidateAllCaches();
  return { success: true, alerts: result };
}

// 18. Calendly Meetings Sync Action
export async function syncCalendlyMeetingsAction(providedToken?: string) {
  const { pullCalendlyMeetings } = await import("@/lib/calendly-sync");
  const result = await pullCalendlyMeetings(providedToken);
  invalidateAllCaches();
  try {
    revalidatePath("/");
    revalidatePath("/calendario");
    revalidatePath("/calendar");
    revalidatePath("/eventos");
    revalidatePath("/events");
    revalidatePath("/reunioes");
    revalidatePath("/meetings");
  } catch {}

  const { db } = await import("@/db/client");
  const { events, clients, eventMeetings } = await import("@/db/schema");
  const { desc, asc } = await import("drizzle-orm");

  const [allEvents, allClients, allMeetings] = await Promise.all([
    db.query.events.findMany({
      orderBy: [desc(events.startDate)],
    }).catch(() => []),
    db.query.clients.findMany().catch(() => []),
    db.query.eventMeetings.findMany({
      orderBy: [asc(eventMeetings.startDate)],
    }).catch(() => []),
  ]);

  return {
    ...result,
    events: allEvents.filter((e) => e.category !== "Reunião Calendly" && !e.calendlyEventUri),
    clients: allClients,
    meetings: allMeetings,
  };
}

export async function getCalendlyIntegrationStatusAction() {
  const { db } = await import("@/db/client");
  const { integrations } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  const integration = await db.query.integrations.findFirst({
    where: eq(integrations.id, "calendly"),
  });

  return {
    isConnected: Boolean(integration?.accessToken || process.env.CALENDLY_ACCESS_TOKEN),
    ownerName: integration?.ownerName || null,
    ownerEmail: integration?.ownerEmail || null,
    lastSyncedAt: integration?.lastSyncedAt ? integration.lastSyncedAt.toISOString() : null,
    syncStatus: integration?.syncStatus || "idle",
    syncError: integration?.syncError || null,
  };
}

// ============================================================================
// 14. Event Meetings Management (Google Meet & In Person)
// ============================================================================

export async function createEventMeetingAction(data: {
  eventId: string;
  title: string;
  type?: "google_meet" | "presencial" | "outro";
  startDate: string;
  endDate?: string;
  location?: string;
  meetUrl?: string;
  notes?: string;
  hostName?: string;
  hostUserId?: string;
  clientContactName?: string;
  clientContactEmail?: string;
  clientContactPhone?: string;
}) {
  const event = await db.query.events.findFirst({
    where: eq(events.id, data.eventId),
  });
  if (!event) {
    throw new Error("Evento não encontrado");
  }

  const meetingType = data.type || "google_meet";
  let meetUrl = data.meetUrl?.trim() || null;
  let location = data.location?.trim() || null;

  if (meetingType === "google_meet" && !meetUrl) {
    const codeA = crypto.randomBytes(2).toString("hex").slice(0, 3);
    const codeB = crypto.randomBytes(2).toString("hex").slice(0, 4);
    meetUrl = `https://meet.google.com/cfm-${codeA}-${codeB}`;
  }

  if (meetingType === "presencial" && !location) {
    location = event.venue || "Atelier CFM Loures";
  }

  const meetingId = generateId("mtg");
  const start = new Date(data.startDate);
  const end = data.endDate ? new Date(data.endDate) : new Date(start.getTime() + 45 * 60 * 1000);

  let clientContactName = data.clientContactName?.trim();
  let clientContactEmail = data.clientContactEmail?.trim();
  let clientContactPhone = data.clientContactPhone?.trim();

  if (event.clientId && (!clientContactName || !clientContactEmail || !clientContactPhone)) {
    const client = await db.query.clients.findFirst({
      where: eq(clients.id, event.clientId),
    });
    if (client) {
      clientContactName = clientContactName || client.contactName || client.name;
      clientContactEmail = clientContactEmail || client.email || undefined;
      clientContactPhone = clientContactPhone || client.phone || undefined;
    }
  }

  const newMeeting = {
    id: meetingId,
    eventId: data.eventId,
    clientId: event.clientId,
    title: data.title.trim(),
    type: meetingType,
    status: "agendada" as const,
    startDate: start,
    endDate: end,
    location,
    meetUrl,
    notes: data.notes?.trim() || null,
    hostUserId: data.hostUserId || null,
    hostName: data.hostName?.trim() || "Equipa CFM",
    clientContactName: clientContactName || null,
    clientContactEmail: clientContactEmail || null,
    clientContactPhone: clientContactPhone || null,
    source: "manual" as const,
    calendlyUri: null,
    linkedEventRowId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(eventMeetings).values(newMeeting);

  await recordAuditLog({
    entityType: "event",
    entityId: data.eventId,
    action: "criado",
    title: "Reunião Agendada",
    details: `Reunião "${data.title.trim()}" (${meetingType === "google_meet" ? "Google Meet" : "Presencial"}) agendada para ${start.toLocaleDateString("pt-PT")} às ${start.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}.`,
  });

  safeRevalidate(`/eventos/${data.eventId}`);
  safeRevalidate(`/events/${data.eventId}`);
  safeRevalidate("/calendario");
  safeRevalidate("/calendar");
  safeRevalidate("/");

  return { success: true, meeting: newMeeting };
}

export async function linkMeetingToEventAction(data: {
  eventId: string;
  meetingId?: string;
  existingEventId?: string;
  externalMeetUrl?: string;
  title?: string;
  startDate?: string;
  notes?: string;
  type?: "google_meet" | "presencial" | "outro";
}) {
  const event = await db.query.events.findFirst({
    where: eq(events.id, data.eventId),
  });
  if (!event) throw new Error("Evento não encontrado");

  // Case 1: Linking an existing meeting row
  if (data.meetingId) {
    await db
      .update(eventMeetings)
      .set({
        eventId: data.eventId,
        updatedAt: new Date(),
      })
      .where(eq(eventMeetings.id, data.meetingId));

    const linkedMeeting = await db.query.eventMeetings.findFirst({
      where: eq(eventMeetings.id, data.meetingId),
    });

    await recordAuditLog({
      entityType: "event",
      entityId: data.eventId,
      action: "atualizado",
      title: "Reunião Vinculada",
      details: `Reunião "${linkedMeeting?.title || data.meetingId}" vinculada a este evento.`,
    });

    safeRevalidate(`/eventos/${data.eventId}`);
    safeRevalidate(`/events/${data.eventId}`);
    safeRevalidate("/calendario");
    safeRevalidate("/calendar");
    return { success: true, meeting: linkedMeeting };
  }

  // Case 2: Linking an existing event row from events table (e.g. imported from Calendly)
  if (data.existingEventId) {
    const existingEvt = await db.query.events.findFirst({
      where: eq(events.id, data.existingEventId),
    });
    if (!existingEvt) throw new Error("Reunião existente não encontrada");

    await db
      .update(events)
      .set({
        linkedEventId: data.eventId,
        updatedAt: new Date(),
      })
      .where(eq(events.id, data.existingEventId));

    const isMeet = Boolean(
      existingEvt.venue?.toLowerCase().includes("meet") ||
      existingEvt.notes?.toLowerCase().includes("meet") ||
      existingEvt.calendlyEventUri
    );

    const meetUrl = isMeet
      ? existingEvt.venue?.includes("meet.google.com")
        ? existingEvt.venue
        : `https://meet.google.com/cfm-${crypto.randomBytes(2).toString("hex").slice(0, 3)}-${crypto.randomBytes(2).toString("hex").slice(0, 4)}`
      : null;

    const meetingId = generateId("mtg");
    const newMeeting = {
      id: meetingId,
      eventId: data.eventId,
      clientId: event.clientId || existingEvt.clientId,
      title: existingEvt.name,
      type: (isMeet ? "google_meet" : "presencial") as "google_meet" | "presencial",
      status: "agendada" as const,
      startDate: existingEvt.startDate,
      endDate: existingEvt.endDate || new Date(existingEvt.startDate.getTime() + 45 * 60 * 1000),
      location: existingEvt.venue,
      meetUrl,
      notes: existingEvt.notes,
      hostName: "Equipa CFM",
      source: "calendly" as const,
      calendlyUri: existingEvt.calendlyEventUri,
      linkedEventRowId: existingEvt.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(eventMeetings).values(newMeeting);

    await recordAuditLog({
      entityType: "event",
      entityId: data.eventId,
      action: "atualizado",
      title: "Reunião Calendly Vinculada",
      details: `Reunião importada "${existingEvt.name}" vinculada a este evento.`,
    });

    safeRevalidate(`/eventos/${data.eventId}`);
    safeRevalidate(`/events/${data.eventId}`);
    safeRevalidate("/calendario");
    safeRevalidate("/calendar");
    return { success: true, meeting: newMeeting };
  }

  // Case 3: Link an external meeting URL / custom meeting
  if (data.externalMeetUrl || data.title) {
    const isMeet = Boolean(data.externalMeetUrl) || data.type === "google_meet";
    const meetingId = generateId("mtg");
    const start = data.startDate ? new Date(data.startDate) : new Date(Date.now() + 24 * 3600 * 1000);
    const newMeeting = {
      id: meetingId,
      eventId: data.eventId,
      clientId: event.clientId,
      title: data.title || "Reunião Vinculada",
      type: (isMeet ? "google_meet" : "presencial") as "google_meet" | "presencial",
      status: "agendada" as const,
      startDate: start,
      endDate: new Date(start.getTime() + 45 * 60 * 1000),
      location: isMeet ? "Google Meet (Online)" : (event.venue || "Atelier CFM"),
      meetUrl: data.externalMeetUrl || (isMeet ? `https://meet.google.com/cfm-${crypto.randomBytes(3).toString("hex")}` : null),
      notes: data.notes || null,
      hostName: "Equipa CFM",
      source: "linked" as const,
      calendlyUri: null,
      linkedEventRowId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(eventMeetings).values(newMeeting);

    await recordAuditLog({
      entityType: "event",
      entityId: data.eventId,
      action: "criado",
      title: "Reunião Externa Vinculada",
      details: `Reunião "${newMeeting.title}" vinculada ao evento.`,
    });

    safeRevalidate(`/eventos/${data.eventId}`);
    safeRevalidate(`/events/${data.eventId}`);
    safeRevalidate("/calendario");
    safeRevalidate("/calendar");
    return { success: true, meeting: newMeeting };
  }

  throw new Error("Parâmetros insuficientes para vincular reunião");
}

export async function updateEventMeetingAction(data: {
  meetingId: string;
  eventId: string;
  title?: string;
  type?: "google_meet" | "presencial" | "outro";
  status?: "agendada" | "realizada" | "cancelada";
  startDate?: string;
  endDate?: string;
  location?: string;
  meetUrl?: string;
  notes?: string;
  hostName?: string;
}) {
  const updateData: any = { updatedAt: new Date() };
  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.type !== undefined) updateData.type = data.type;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
  if (data.location !== undefined) updateData.location = data.location.trim();
  if (data.meetUrl !== undefined) updateData.meetUrl = data.meetUrl.trim();
  if (data.notes !== undefined) updateData.notes = data.notes.trim();
  if (data.hostName !== undefined) updateData.hostName = data.hostName.trim();

  await db
    .update(eventMeetings)
    .set(updateData)
    .where(eq(eventMeetings.id, data.meetingId));

  if (data.status) {
    await recordAuditLog({
      entityType: "event",
      entityId: data.eventId,
      action: "atualizado",
      title: `Reunião ${data.status === "realizada" ? "Concluída" : data.status === "cancelada" ? "Cancelada" : "Atualizada"}`,
      details: `Estado da reunião atualizado para "${data.status}".`,
    });
  }

  safeRevalidate(`/eventos/${data.eventId}`);
  safeRevalidate(`/events/${data.eventId}`);
  safeRevalidate("/calendario");
  safeRevalidate("/calendar");
  return { success: true };
}

export async function unlinkEventMeetingAction(meetingId: string, eventId: string) {
  const meeting = await db.query.eventMeetings.findFirst({
    where: eq(eventMeetings.id, meetingId),
  });
  if (meeting?.linkedEventRowId) {
    await db
      .update(events)
      .set({ linkedEventId: null })
      .where(eq(events.id, meeting.linkedEventRowId));
  }

  await db.delete(eventMeetings).where(eq(eventMeetings.id, meetingId));

  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: "atualizado",
    title: "Reunião Desvinculada",
    details: `Reunião "${meeting?.title || meetingId}" desvinculada deste evento.`,
  });

  safeRevalidate(`/eventos/${eventId}`);
  safeRevalidate(`/events/${eventId}`);
  safeRevalidate("/calendario");
  safeRevalidate("/calendar");
  return { success: true };
}

export async function deleteEventMeetingAction(meetingId: string, eventId: string) {
  return unlinkEventMeetingAction(meetingId, eventId);
}

// -------------------------------------------------------------
// MEETING CONCEPT ACTIONS (Conversation summary, action items, participants & event linking)
// -------------------------------------------------------------

export async function updateMeetingConversationAction(data: {
  meetingId: string;
  summary: string;
}) {
  await ensureDbMigrated().catch(() => {});
  const meeting = await db.query.eventMeetings.findFirst({
    where: eq(eventMeetings.id, data.meetingId),
  });
  if (!meeting) throw new Error("Reunião não encontrada.");

  await db
    .update(eventMeetings)
    .set({
      meetingSummary: data.summary,
      notes: data.summary,
      updatedAt: new Date(),
    })
    .where(eq(eventMeetings.id, data.meetingId));

  await recordAuditLog({
    entityType: "event",
    entityId: data.meetingId,
    action: "atualizado",
    title: "Resumo da Reunião Atualizado",
    details: `Resumo e ata da conversa atualizados para a reunião "${meeting.title}".`,
  });

  safeRevalidate(`/reunioes/${data.meetingId}`);
  safeRevalidate(`/meetings/${data.meetingId}`);
  if (meeting.eventId) {
    safeRevalidate(`/eventos/${meeting.eventId}`);
    safeRevalidate(`/events/${meeting.eventId}`);
  }
  return { success: true };
}

export async function updateMeetingParticipantsAction(data: {
  meetingId: string;
  participantsJson: string;
}) {
  await ensureDbMigrated().catch(() => {});
  const meeting = await db.query.eventMeetings.findFirst({
    where: eq(eventMeetings.id, data.meetingId),
  });
  if (!meeting) throw new Error("Reunião não encontrada.");

  await db
    .update(eventMeetings)
    .set({
      meetingParticipants: data.participantsJson,
      updatedAt: new Date(),
    })
    .where(eq(eventMeetings.id, data.meetingId));

  safeRevalidate(`/reunioes/${data.meetingId}`);
  safeRevalidate(`/meetings/${data.meetingId}`);
  return { success: true };
}

export async function linkMeetingDirectAction(meetingId: string, targetEventId: string) {
  await ensureDbMigrated().catch(() => {});
  const meeting = await db.query.eventMeetings.findFirst({
    where: eq(eventMeetings.id, meetingId),
  });
  if (!meeting) throw new Error("Reunião não encontrada.");

  const targetEvent = await db.query.events.findFirst({
    where: eq(events.id, targetEventId),
  });
  if (!targetEvent) throw new Error("Evento não encontrado.");

  await db
    .update(eventMeetings)
    .set({
      eventId: targetEventId,
      clientId: meeting.clientId || targetEvent.clientId,
      updatedAt: new Date(),
    })
    .where(eq(eventMeetings.id, meetingId));

  await recordAuditLog({
    entityType: "event",
    entityId: targetEventId,
    action: "atualizado",
    title: "Reunião Vinculada",
    details: `Reunião "${meeting.title}" vinculada ao evento "${targetEvent.name}".`,
  });

  safeRevalidate(`/reunioes/${meetingId}`);
  safeRevalidate(`/meetings/${meetingId}`);
  safeRevalidate(`/eventos/${targetEventId}`);
  safeRevalidate(`/events/${targetEventId}`);
  safeRevalidate("/calendario");
  safeRevalidate("/calendar");
  return { success: true };
}

export async function unlinkMeetingFromEventAction(meetingId: string) {
  await ensureDbMigrated().catch(() => {});
  const meeting = await db.query.eventMeetings.findFirst({
    where: eq(eventMeetings.id, meetingId),
  });
  if (!meeting) throw new Error("Reunião não encontrada.");

  const previousEventId = meeting.eventId;

  await db
    .update(eventMeetings)
    .set({
      eventId: null,
      updatedAt: new Date(),
    })
    .where(eq(eventMeetings.id, meetingId));

  if (previousEventId) {
    await recordAuditLog({
      entityType: "event",
      entityId: previousEventId,
      action: "atualizado",
      title: "Reunião Desvinculada",
      details: `Reunião "${meeting.title}" desvinculada do evento.`,
    });
    safeRevalidate(`/eventos/${previousEventId}`);
    safeRevalidate(`/events/${previousEventId}`);
  }

  safeRevalidate(`/reunioes/${meetingId}`);
  safeRevalidate(`/meetings/${meetingId}`);
  safeRevalidate("/calendario");
  safeRevalidate("/calendar");
  return { success: true };
}

export async function updateMeetingStatusAction(
  meetingId: string,
  newStatus: "agendada" | "realizada" | "cancelada"
) {
  await ensureDbMigrated().catch(() => {});
  const meeting = await db.query.eventMeetings.findFirst({
    where: eq(eventMeetings.id, meetingId),
  });
  if (!meeting) throw new Error("Reunião não encontrada.");

  await db
    .update(eventMeetings)
    .set({
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(eventMeetings.id, meetingId));

  await recordAuditLog({
    entityType: "event",
    entityId: meetingId,
    action: "alterou_estado",
    title: "Estado da Reunião Alterado",
    details: `Reunião "${meeting.title}" alterada para "${newStatus}".`,
  });

  safeRevalidate(`/reunioes/${meetingId}`);
  safeRevalidate(`/meetings/${meetingId}`);
  safeRevalidate("/reunioes");
  safeRevalidate("/meetings");
  safeRevalidate("/calendario");
  safeRevalidate("/calendar");
  return { success: true };
}

export async function updateMeetingDetailsAction(
  meetingId: string,
  patch: {
    title?: string;
    startDate?: string;
    endDate?: string | null;
    location?: string | null;
    meetUrl?: string | null;
    notes?: string | null;
    type?: "google_meet" | "presencial" | "outro";
    status?: "agendada" | "realizada" | "cancelada";
    clientContactName?: string | null;
    clientContactEmail?: string | null;
    clientContactPhone?: string | null;
  }
) {
  await ensureDbMigrated().catch(() => {});
  const meeting = await db.query.eventMeetings.findFirst({
    where: eq(eventMeetings.id, meetingId),
  });
  if (!meeting) throw new Error("Reunião não encontrada.");

  const updateData: any = { updatedAt: new Date() };
  if (patch.title !== undefined) updateData.title = patch.title.trim();
  if (patch.startDate !== undefined) updateData.startDate = new Date(patch.startDate);
  if (patch.endDate !== undefined) updateData.endDate = patch.endDate ? new Date(patch.endDate) : null;
  if (patch.location !== undefined) updateData.location = patch.location;
  if (patch.meetUrl !== undefined) updateData.meetUrl = patch.meetUrl;
  if (patch.notes !== undefined) updateData.notes = patch.notes;
  if (patch.type !== undefined) updateData.type = patch.type;
  if (patch.status !== undefined) updateData.status = patch.status;
  if (patch.clientContactName !== undefined) updateData.clientContactName = patch.clientContactName;
  if (patch.clientContactEmail !== undefined) updateData.clientContactEmail = patch.clientContactEmail;
  if (patch.clientContactPhone !== undefined) updateData.clientContactPhone = patch.clientContactPhone;

  await db
    .update(eventMeetings)
    .set(updateData)
    .where(eq(eventMeetings.id, meetingId));

  await recordAuditLog({
    entityType: "event",
    entityId: meetingId,
    action: "atualizado",
    title: "Detalhes da Reunião Atualizados",
    details: `Reunião #${meetingId} atualizada.`,
  });

  safeRevalidate(`/reunioes/${meetingId}`);
  safeRevalidate(`/meetings/${meetingId}`);
  safeRevalidate("/reunioes");
  safeRevalidate("/meetings");
  safeRevalidate("/calendario");
  safeRevalidate("/calendar");
  return { success: true };
}

export async function createMeetingAction(data: {
  title: string;
  clientId?: string | null;
  eventId?: string | null;
  type?: "google_meet" | "presencial" | "outro";
  status?: "agendada" | "realizada" | "cancelada";
  startDate: string;
  endDate?: string | null;
  location?: string | null;
  meetUrl?: string | null;
  notes?: string | null;
  hostName?: string | null;
  clientContactName?: string | null;
  clientContactEmail?: string | null;
  clientContactPhone?: string | null;
}) {
  await ensureDbMigrated().catch(() => {});
  if (!data.title?.trim()) {
    return { success: false, error: "Título da reunião é obrigatório." };
  }
  if (!data.startDate) {
    return { success: false, error: "Data da reunião é obrigatória." };
  }

  const id = generateId("mtg");
  const type = data.type || "google_meet";
  const meetUrl =
    data.meetUrl ||
    (type === "google_meet"
      ? `https://meet.google.com/cfm-${id.slice(-6)}`
      : null);

  await db.insert(eventMeetings).values({
    id,
    eventId: data.eventId || null,
    clientId: data.clientId || null,
    title: data.title.trim(),
    type,
    status: data.status || "agendada",
    startDate: new Date(data.startDate),
    endDate: data.endDate ? new Date(data.endDate) : null,
    location: data.location || (type === "google_meet" ? "Google Meet" : "Presencial"),
    meetUrl,
    notes: data.notes || null,
    hostName: data.hostName || "Equipa CFM",
    clientContactName: data.clientContactName || null,
    clientContactEmail: data.clientContactEmail || null,
    clientContactPhone: data.clientContactPhone || null,
    source: "manual",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await recordAuditLog({
    entityType: "event",
    entityId: id,
    action: "criado",
    title: "Nova Reunião Criada",
    details: `Reunião "${data.title.trim()}" agendada para ${new Date(data.startDate).toLocaleDateString("pt-PT")}.`,
  });

  safeRevalidate("/reunioes");
  safeRevalidate("/meetings");
  safeRevalidate("/calendario");
  safeRevalidate("/calendar");
  return { success: true, id };
}

export async function deleteMeetingAction(meetingId: string) {
  await ensureDbMigrated().catch(() => {});
  const meeting = await db.query.eventMeetings.findFirst({
    where: eq(eventMeetings.id, meetingId),
  });
  if (!meeting) return { success: false, error: "Reunião não encontrada." };

  await db.delete(eventTasks).where(eq(eventTasks.meetingId, meetingId));
  await db.delete(eventMeetings).where(eq(eventMeetings.id, meetingId));

  await recordAuditLog({
    entityType: "event",
    entityId: meetingId,
    action: "removido",
    title: "Reunião Eliminada",
    details: `Reunião "${meeting.title}" foi removida do sistema.`,
  });

  safeRevalidate("/reunioes");
  safeRevalidate("/meetings");
  safeRevalidate("/calendario");
  safeRevalidate("/calendar");
  return { success: true };
}

// ---------------------------------------------------------------------------
// 14. Gemini Receipt Reader & Smart Inventory Ingestion
// ---------------------------------------------------------------------------

export async function parseReceiptAction(formData: FormData) {
  try {
    await ensureDbMigrated().catch(() => {});
    const file = formData.get("file") as File | null;
    const textContent = (formData.get("text") as string)?.trim() || "";

    if (!file && !textContent) {
      return { success: false as const, error: "Nenhum ficheiro ou texto de fatura foi fornecido." };
    }

    let buffer: Buffer | undefined;
    let mimeType: string | undefined;

    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      buffer = Buffer.from(bytes);
      mimeType = file.type;

      // Handle common extensions if browser sent generic octet-stream
      const fileNameLower = file.name.toLowerCase();
      if (!mimeType || mimeType === "application/octet-stream") {
        if (fileNameLower.endsWith(".pdf")) mimeType = "application/pdf";
        else if (fileNameLower.endsWith(".png")) mimeType = "image/png";
        else if (fileNameLower.endsWith(".jpg") || fileNameLower.endsWith(".jpeg")) mimeType = "image/jpeg";
        else if (fileNameLower.endsWith(".webp")) mimeType = "image/webp";
        else if (fileNameLower.endsWith(".txt") || fileNameLower.endsWith(".csv")) mimeType = "text/plain";
      }

      // If it's a plain text file, also extract textContent
      if (mimeType?.startsWith("text/")) {
        const textFromBuf = buffer.toString("utf-8");
        buffer = undefined;
        mimeType = undefined;
        return await parseTextContent(textFromBuf);
      }
    }

    const { parseReceiptWithGemini, reconcileReceiptWithInventory } = await import("@/lib/gemini-receipt");
    const extracted = await parseReceiptWithGemini({ buffer, mimeType, textContent });
    const reconciled = await reconcileReceiptWithInventory(extracted);

    return {
      success: true as const,
      receipt: reconciled.receipt,
      items: reconciled.items,
    };
  } catch (err: any) {
    console.error("parseReceiptAction error:", err);
    return {
      success: false as const,
      error: err?.message || "Ocorreu um erro ao processar a fatura com Gemini AI.",
    };
  }
}

async function parseTextContent(text: string) {
  const { parseReceiptWithGemini, reconcileReceiptWithInventory } = await import("@/lib/gemini-receipt");
  const extracted = await parseReceiptWithGemini({ textContent: text });
  const reconciled = await reconcileReceiptWithInventory(extracted);
  return {
    success: true as const,
    receipt: reconciled.receipt,
    items: reconciled.items,
  };
}

export async function commitReceiptInventoryAction(payload: {
  merchantName: string;
  invoiceNumber?: string;
  date?: string;
  totalAmount: number;
  createExpenseMovement: boolean;
  items: Array<{
    action: "add_to_existing" | "create_new" | "ignore";
    matchedItemId?: string;
    name: string;
    sku: string;
    category: string;
    quantityToAdd: number;
    unitPurchasePrice: number;
    unitRentalPrice: number;
    locationId?: string;
    dimensions?: string;
  }>;
}) {
  try {
    await ensureDbMigrated().catch(() => {});
    const {
      merchantName,
      invoiceNumber,
      date,
      totalAmount,
      createExpenseMovement,
      items,
    } = payload;

    const validItems = (items || []).filter((i) => i.action !== "ignore" && i.quantityToAdd > 0);
    if (validItems.length === 0) {
      return { success: false, error: "Nenhum artigo válido selecionado para importação." };
    }

    const locations = await db.query.storageLocations.findMany();
    const locationMap = new Map(locations.map((loc) => [loc.id, loc.name]));

    let updatedCount = 0;
    let createdCount = 0;

    for (const item of validItems) {
      if (item.action === "add_to_existing" && item.matchedItemId) {
        const existing = await db.query.inventoryItems.findFirst({
          where: eq(inventoryItems.id, item.matchedItemId),
        });

        if (existing) {
          const newQty = existing.totalQuantity + item.quantityToAdd;
          const patchObj: any = {
            totalQuantity: newQty,
            updatedAt: new Date(),
          };

          if (item.unitPurchasePrice > 0) {
            patchObj.replacementCost = item.unitPurchasePrice;
          }
          if (item.unitRentalPrice > 0) {
            patchObj.unitPrice = item.unitRentalPrice;
          }
          if (item.locationId) {
            patchObj.locationId = item.locationId;
            patchObj.warehouseLocation = locationMap.get(item.locationId) || existing.warehouseLocation;
          }

          await db
            .update(inventoryItems)
            .set(patchObj)
            .where(eq(inventoryItems.id, existing.id));

          await recordAuditLog({
            entityType: "inventory",
            entityId: existing.id,
            action: "atualizado",
            title: "Stock reposto via fatura",
            details: `Adicionadas +${item.quantityToAdd} un. a "${existing.name}" (Stock total: ${newQty} un.) da compra em ${merchantName}${invoiceNumber ? ` (Doc: ${invoiceNumber})` : ""}`,
          });

          updatedCount++;
          continue;
        }
      }

      // Create new inventory item
      const newId = generateId("itm");
      const warehouseLoc = (item.locationId && locationMap.get(item.locationId)) || "Armazém Principal";

      await db.insert(inventoryItems).values({
        id: newId,
        sku: item.sku.trim().toUpperCase() || generateReferenceCode("ITM"),
        name: item.name.trim(),
        category: item.category || "Decoração",
        totalQuantity: item.quantityToAdd,
        minStock: 0,
        warehouseLocation: warehouseLoc,
        locationId: item.locationId || null,
        dimensions: item.dimensions || null,
        unitPrice: item.unitRentalPrice || Math.max(1, Math.round(item.unitPurchasePrice * 0.25 * 10) / 10),
        replacementCost: item.unitPurchasePrice || 0,
        imageUrl: "https://images.unsplash.com/photo-1549497538-303791108f95?auto=format&fit=crop&w=400&q=80",
        damagedQuantity: 0,
        inMaintenanceQuantity: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await recordAuditLog({
        entityType: "inventory",
        entityId: newId,
        action: "criado",
        title: "Novo artigo criado via fatura",
        details: `Criado artigo "${item.name}" (${item.quantityToAdd} un., custo: €${item.unitPurchasePrice}) a partir da fatura de ${merchantName}`,
      });

      createdCount++;
    }

    // Auto-create financial expense movement if requested
    if (createExpenseMovement && totalAmount > 0) {
      const movId = generateId("mov");
      const parsedDate = date ? new Date(date) : new Date();
      const safeDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

      await db.insert(financialMovements).values({
        id: movId,
        type: "saida",
        category: "Material / Stock",
        description: `Aquisição de Stock: ${merchantName}${invoiceNumber ? ` (${invoiceNumber})` : ""}`,
        amount: totalAmount,
        date: safeDate,
        eventId: null,
        clientId: null,
        notes: `Despesa gerada automaticamente via Leitor de Faturas Gemini. Importados ${validItems.length} artigo(s) (${updatedCount} repostos, ${createdCount} novos).`,
        createdAt: new Date(),
      });

      await recordAuditLog({
        entityType: "inventory",
        entityId: movId,
        action: "criado",
        title: "Despesa de Stock Registada",
        details: `Despesa de €${totalAmount.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} registada em "Material / Stock" referente à fatura de ${merchantName}`,
      });
    }

    invalidateAllCaches();
    safeRevalidate("/inventario");
    safeRevalidate("/inventory");
    safeRevalidate("/financas");
    safeRevalidate("/finance");

    return {
      success: true,
      updatedCount,
      createdCount,
      totalProcessed: validItems.length,
    };
  } catch (err: any) {
    console.error("commitReceiptInventoryAction error:", err);
    return {
      success: false,
      error: err?.message || "Ocorreu um erro ao registar os artigos no inventário.",
    };
  }
}

// 35. Search Barcode Action (DB first -> Open Food Facts -> Open Products Facts)
export interface BarcodeSearchResult {
  success: boolean;
  found: boolean;
  source: "database" | "openfoodfacts" | "openproductsfacts" | "none";
  barcode: string;
  item?: {
    id: string;
    sku: string;
    name: string;
    category: string;
    totalQuantity: number;
    unitPrice: number;
    warehouseLocation: string | null;
    imageUrl: string | null;
    isConsumable: boolean;
  };
  suggestedItem?: {
    name: string;
    category: string;
    imageUrl: string | null;
    isConsumable: boolean;
  } | null;
  error?: string;
}

export async function searchBarcodeAction(rawBarcode: string): Promise<BarcodeSearchResult> {
  const barcode = (rawBarcode || "").trim();
  if (!barcode) {
    return { success: false, found: false, source: "none", barcode: "", error: "Código inválido." };
  }

  try {
    await ensureDbMigrated();

    // 1. Check in our Database (barcode, sku, or id)
    const existing = await db
      .select()
      .from(inventoryItems)
      .where(
        and(
          isNull(inventoryItems.deletedAt),
          or(
            eq(inventoryItems.barcode, barcode),
            eq(inventoryItems.sku, barcode),
            eq(inventoryItems.id, barcode)
          )
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const match = existing[0];
      return {
        success: true,
        found: true,
        source: "database",
        barcode,
        item: {
          id: match.id,
          sku: match.sku,
          name: match.name,
          category: match.category,
          totalQuantity: match.totalQuantity,
          unitPrice: match.unitPrice,
          warehouseLocation: match.warehouseLocation,
          imageUrl: match.imageUrl,
          isConsumable: Boolean(match.isConsumable),
        },
      };
    }

    // 2. Query Open Food Facts API
    try {
      const offController = new AbortController();
      const offTimeout = setTimeout(() => offController.abort(), 4000);
      const offRes = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
        {
          headers: {
            "User-Agent": "EventFlowCFM/1.0 (info@cfmeventos.pt)",
          },
          signal: offController.signal,
        }
      );
      clearTimeout(offTimeout);

      if (offRes.ok) {
        const offData = await offRes.json();
        if (offData && offData.status === 1 && offData.product) {
          const p = offData.product;
          const name = (
            p.product_name_pt ||
            p.product_name ||
            p.generic_name_pt ||
            p.generic_name ||
            p.brands ||
            ""
          ).trim();

          if (name) {
            const rawCat = p.categories ? p.categories.split(",")[0].trim() : "Alimentação & Bebidas";
            return {
              success: true,
              found: false,
              source: "openfoodfacts",
              barcode,
              suggestedItem: {
                name,
                category: rawCat || "Alimentação & Bebidas",
                imageUrl: p.image_front_url || p.image_url || null,
                isConsumable: true,
              },
            };
          }
        }
      }
    } catch {
      // Continue to Open Products Facts
    }

    // 3. Query Open Products Facts API
    try {
      const opfController = new AbortController();
      const opfTimeout = setTimeout(() => opfController.abort(), 4000);
      const opfRes = await fetch(
        `https://world.openproductsfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
        {
          headers: {
            "User-Agent": "EventFlowCFM/1.0 (info@cfmeventos.pt)",
          },
          signal: opfController.signal,
        }
      );
      clearTimeout(opfTimeout);

      if (opfRes.ok) {
        const opfData = await opfRes.json();
        if (opfData && opfData.status === 1 && opfData.product) {
          const p = opfData.product;
          const name = (p.product_name_pt || p.product_name || p.brands || "").trim();
          if (name) {
            const rawCat = p.categories ? p.categories.split(",")[0].trim() : "Material / Consumíveis";
            return {
              success: true,
              found: false,
              source: "openproductsfacts",
              barcode,
              suggestedItem: {
                name,
                category: rawCat || "Material / Consumíveis",
                imageUrl: p.image_front_url || p.image_url || null,
                isConsumable: false,
              },
            };
          }
        }
      }
    } catch {
      // Continue to none
    }

    // 4. Not found anywhere -> prompt user with simplified form
    return {
      success: true,
      found: false,
      source: "none",
      barcode,
      suggestedItem: null,
    };
  } catch (err: any) {
    console.error("searchBarcodeAction error:", err);
    return {
      success: false,
      found: false,
      source: "none",
      barcode,
      error: "Erro ao consultar o artigo.",
    };
  }
}

// 36. Add stock to an existing item from barcode scan
export async function addBarcodeStockAction(itemId: string, addQuantity: number) {
  await requireAuth();
  if (!itemId) return { success: false, error: "ID do artigo é obrigatório." };
  if (!addQuantity || addQuantity <= 0) {
    return { success: false, error: "Quantidade deve ser superior a zero." };
  }

  try {
    await ensureDbMigrated();
    const existing = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, itemId))
      .limit(1);

    if (existing.length === 0) {
      return { success: false, error: "Artigo não encontrado." };
    }

    const item = existing[0];
    const newTotal = (item.totalQuantity || 0) + addQuantity;

    await db
      .update(inventoryItems)
      .set({
        totalQuantity: newTotal,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, itemId));

    await recordAuditLog({
      entityType: "inventory",
      entityId: itemId,
      action: "atualizado",
      title: "Stock incrementado",
      details: `Entrada rápida de +${addQuantity} un. no artigo "${item.name}" (total atual: ${newTotal} un.).`,
    });

    invalidateAllCaches();
    safeRevalidate("/inventario");
    safeRevalidate("/inventory");
    safeRevalidate(`/inventario/${itemId}`);
    safeRevalidate(`/artigos/${itemId}`);

    return {
      success: true,
      newTotal,
      itemName: item.name,
    };
  } catch (err: any) {
    console.error("addBarcodeStockAction error:", err);
    return { success: false, error: "Erro ao adicionar stock ao artigo." };
  }
}




