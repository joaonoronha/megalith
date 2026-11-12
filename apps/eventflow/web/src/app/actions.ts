"use server";

import { db } from "@/db/client";
import {
  events,
  eventAllocations,
  eventTasks,
  quotes,
  quoteLines,
  clients,
  inventoryItems,
  financialMovements,
  quoteTemplates,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

  if (!name || !startDateStr) {
    throw new Error("Nome do evento e data de início são obrigatórios.");
  }

  const id = `evt-${Date.now()}`;
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

  revalidatePath("/");
  return { success: true, id };
}

// 2. Update Event Status
export async function updateEventStatusAction(eventId: string, newStatus: string) {
  await db
    .update(events)
    .set({ status: newStatus as any })
    .where(eq(events.id, eventId));

  revalidatePath("/");
  return { success: true };
}

// 3. Create Commercial Quote
export async function createQuoteAction(formData: FormData) {
  const quoteNumber = (formData.get("quoteNumber") as string) || `ORC-2026-${Math.floor(100 + Math.random() * 900)}`;
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

  const quoteId = `qte-${Date.now()}`;
  const accessToken = `orc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

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
      id: `ql-${Date.now()}-${i}`,
      quoteId,
      itemId: line.itemId || null,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      total: line.quantity * line.unitPrice,
    });
  }

  revalidatePath("/");
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

  const id = `mov-${Date.now()}`;
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

  revalidatePath("/");
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

  const id = `itm-${Date.now()}`;
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

  revalidatePath("/");
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

  revalidatePath("/");
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

  const id = `cli-${Date.now()}`;
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

  revalidatePath("/");
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
    revalidatePath("/");
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

  if (!name || !email || !password) {
    return { success: false, error: "Nome, email e palavra-passe são obrigatórios." };
  }

  const result = await createTeamUser({ name, email, password, role });
  revalidatePath("/");
  return result;
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

  revalidatePath("/");
  revalidatePath(`/eventos/${eventId}`);
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

  revalidatePath("/");
  revalidatePath(`/eventos/${eventId}`);
  return { success: true };
}

// 11. Update Customer Price
export async function updateCustomerPriceAction(eventId: string, customerPrice: number) {
  await db
    .update(events)
    .set({ customerPrice })
    .where(eq(events.id, eventId));

  revalidatePath("/");
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

  const id = `alc-${Date.now()}`;
  await db.insert(eventAllocations).values({
    id,
    eventId,
    itemId,
    quantity,
    status,
    notes: notes || null,
  });

  revalidatePath("/");
  revalidatePath(`/eventos/${eventId}`);
  return { success: true, id };
}

// 13. Update Inventory Allocation Status
export async function updateAllocationStatusAction(allocationId: string, status: "reservado" | "despachado" | "devolvido" | "danificado", eventId: string) {
  await db
    .update(eventAllocations)
    .set({ status })
    .where(eq(eventAllocations.id, allocationId));

  revalidatePath("/");
  revalidatePath(`/eventos/${eventId}`);
  return { success: true };
}

// 14. Delete Inventory Allocation
export async function deleteAllocationAction(allocationId: string, eventId: string) {
  await db
    .delete(eventAllocations)
    .where(eq(eventAllocations.id, allocationId));

  revalidatePath("/");
  revalidatePath(`/eventos/${eventId}`);
  return { success: true };
}

// 15. Add Event Action Item (Task)
export async function addEventTaskAction(eventId: string, title: string, priority: "baixa" | "media" | "alta" | "urgente" = "media", dueDateStr?: string) {
  if (!eventId || !title.trim()) {
    return { success: false, error: "Título da tarefa é obrigatório." };
  }

  const id = `tsk-${Date.now()}`;
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

  revalidatePath("/");
  revalidatePath(`/eventos/${eventId}`);
  return { success: true, id };
}

// 16. Toggle Event Task Completion
export async function toggleEventTaskAction(taskId: string, completed: boolean, eventId: string) {
  await db
    .update(eventTasks)
    .set({ completed })
    .where(eq(eventTasks.id, taskId));

  revalidatePath("/");
  revalidatePath(`/eventos/${eventId}`);
  return { success: true };
}

// 17. Delete Event Task
export async function deleteEventTaskAction(taskId: string, eventId: string) {
  await db
    .delete(eventTasks)
    .where(eq(eventTasks.id, taskId));

  revalidatePath("/");
  revalidatePath(`/eventos/${eventId}`);
  return { success: true };
}

