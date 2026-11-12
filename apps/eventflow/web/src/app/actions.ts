"use server";

import { db } from "@/db/client";
import {
  events,
  eventAllocations,
  eventTasks,
  eventMedia,
  quotes,
  quoteLines,
  clients,
  inventoryItems,
  financialMovements,
  quoteTemplates,
  users,
  alerts,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { generateId, generateReferenceCode, formatCustomId } from "@/lib/id";
import { recordAuditLog, getAuditLogsForEntity, getRecentAuditLogs } from "@/lib/audit";

function invalidateAllCaches() {
  revalidatePath("/");
}

// 1. Create Event
export async function createEventAction(formData: FormData) {
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
    throw new Error("Nome do evento e data de início são obrigatórios.");
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
  const eventId = (formData.get("eventId") as string) || null;
  const clientId = (formData.get("clientId") as string) || null;
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
    clientId,
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
    await recordAuditLog({
      entityType: "event",
      entityId: eventId,
      action: "orcamento",
      title: "Orçamento associado",
      details: `Associado orçamento ${quoteNumber} com valor global de €${total.toFixed(2)}`,
    });
  }

  invalidateAllCaches();
  return { success: true, id: quoteId, accessToken };
}

// 4. Create Financial Movement (Entrada, Saída, Investimento)
export async function createMovementAction(formData: FormData) {
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

// 5. Create Inventory Item
export async function createItemAction(formData: FormData) {
  const sku = formData.get("sku") as string;
  const name = formData.get("name") as string;
  const category = formData.get("category") as string;
  const totalQuantity = parseInt((formData.get("totalQuantity") as string) || "1", 10);
  const minStock = parseInt((formData.get("minStock") as string) || "0", 10);
  const warehouseLocation = formData.get("warehouseLocation") as string;
  const dimensions = formData.get("dimensions") as string;
  const unitPrice = parseFloat((formData.get("unitPrice") as string) || "0");
  const replacementCost = parseFloat((formData.get("replacementCost") as string) || "0");
  const imageUrl = formData.get("imageUrl") as string;

  if (!sku || !name || !category) {
    return { success: false, error: "SKU, nome e categoria são obrigatórios." };
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
    dimensions,
    unitPrice,
    replacementCost,
    imageUrl: imageUrl || "https://images.unsplash.com/photo-1549497538-303791108f95?auto=format&fit=crop&w=400&q=80",
    damagedQuantity: 0,
    inMaintenanceQuantity: 0,
  };
  await db.insert(inventoryItems).values(item);

  await recordAuditLog({
    entityType: "inventory",
    entityId: id,
    action: "criado",
    title: "Artigo criado",
    details: `${name} (${sku}) adicionado ao inventário (${totalQuantity} un., €${unitPrice}/dia)`,
  });

  invalidateAllCaches();
  return { success: true, id, item };
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
  const dimensions = formData.get("dimensions") as string;
  const unitPrice = parseFloat((formData.get("unitPrice") as string) || "0");
  const replacementCost = parseFloat((formData.get("replacementCost") as string) || "0");
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
    details: `Dados atualizados: ${name} (${totalQuantity} un., €${unitPrice}/dia, local: ${warehouseLocation || "Armazém Principal"})`,
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
    dimensions?: string | null;
    unitPrice?: number;
    replacementCost?: number | null;
    imageUrl?: string | null;
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
  if (patch.dimensions !== undefined) updateData.dimensions = patch.dimensions || null;
  if (patch.unitPrice !== undefined) updateData.unitPrice = Math.max(0, patch.unitPrice);
  if (patch.replacementCost !== undefined) updateData.replacementCost = patch.replacementCost === null ? null : Math.max(0, patch.replacementCost);
  if (patch.imageUrl !== undefined) updateData.imageUrl = patch.imageUrl || null;
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
  redirect("/login");
}

export async function createUserAction(formData: FormData) {
  const { createTeamUser } = await import("@/lib/auth");
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = (formData.get("role") as any) || "admin";
  const customId = (formData.get("customId") as string) || undefined;

  if (!name || !email || !password) {
    return { success: false, error: "Nome, email e palavra-passe são obrigatórios." };
  }

  const result = await createTeamUser({ name, email, password, role, customId });
  invalidateAllCaches();
  return result;
}

// 8.1 Update User Action
export async function updateUserAction(formData: FormData) {
  const userId = formData.get("userId") as string;
  const name = formData.get("name") as string;
  const role = formData.get("role") as "admin" | "producer" | "warehouse";

  if (!userId || !name) {
    return { success: false, error: "ID e Nome são obrigatórios." };
  }

  await db
    .update(users)
    .set({ name, role: role || "admin" })
    .where(eq(users.id, userId));

  invalidateAllCaches();
  revalidatePath(`/utilizadores/${userId}`);
  revalidatePath(`/users/${userId}`);
  return { success: true };
}

// 9. Update Event Details (Category, Dates, Theme, Vibe, Customer Price, Notes, Special Needs)
export async function updateEventDetailsAction(formData: FormData) {
  const eventId = formData.get("eventId") as string;
  if (!eventId) throw new Error("Event ID is required");

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
  const eventId = formData.get("eventId") as string;
  const itemId = formData.get("itemId") as string;
  const quantity = parseInt((formData.get("quantity") as string) || "1", 10);
  const status = (formData.get("status") as any) || "reservado";
  const notes = (formData.get("notes") as string) || "";

  if (!eventId || !itemId || quantity <= 0) {
    return { success: false, error: "Dados de alocação inválidos." };
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
  return { success: true, id };
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

// 15. Add Event Action Item (Task)
export async function addEventTaskAction(eventId: string, title: string, priority: "baixa" | "media" | "alta" | "urgente" = "media", dueDateStr?: string) {
  if (!eventId || !title.trim()) {
    return { success: false, error: "Título da tarefa é obrigatório." };
  }

  const id = generateId("tsk");
  await db.insert(eventTasks).values({
    id,
    eventId,
    title: title.trim(),
    completed: false,
    priority,
    dueDate: dueDateStr ? new Date(dueDateStr) : null,
    orderIndex: Date.now(),
    createdAt: new Date(),
  });

  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: "tarefa",
    title: "Tarefa adicionada",
    details: `Nova tarefa: "${title.trim()}" (prioridade: ${priority})`,
  });

  invalidateAllCaches();
  revalidatePath(`/eventos/${eventId}`);
  return { success: true, id };
}

// 16. Toggle Event Task Completion
export async function toggleEventTaskAction(taskId: string, completed: boolean, eventId: string) {
  await db
    .update(eventTasks)
    .set({ completed })
    .where(eq(eventTasks.id, taskId));

  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: "tarefa",
    title: completed ? "Tarefa concluída" : "Tarefa reaberta",
    details: `Tarefa #${taskId} marcada como ${completed ? "concluída" : "pendente"}`,
  });

  invalidateAllCaches();
  revalidatePath(`/eventos/${eventId}`);
  return { success: true };
}

// 17. Delete Event Task
export async function deleteEventTaskAction(taskId: string, eventId: string) {
  await db
    .delete(eventTasks)
    .where(eq(eventTasks.id, taskId));

  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: "tarefa",
    title: "Tarefa eliminada",
    details: `Tarefa #${taskId} removida da checklist do evento`,
  });

  invalidateAllCaches();
  revalidatePath(`/eventos/${eventId}`);
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
    throw new Error("ID do evento e URL da imagem são obrigatórios.");
  }

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
    uploadedByName: "Administrador CFM",
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

export async function deleteEventMediaAction(mediaId: string, eventId: string) {
  await db.delete(eventMedia).where(eq(eventMedia.id, mediaId));

  await recordAuditLog({
    entityType: "event",
    entityId: eventId,
    action: "removeu_media",
    title: "Imagem removida da galeria",
    details: `Imagem #${mediaId} eliminada do evento`,
  });

  invalidateAllCaches();
  revalidatePath(`/eventos/${eventId}`);
  revalidatePath(`/events/${eventId}`);
  return { success: true };
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


