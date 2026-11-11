"use server";

import { db } from "@/db/client";
import { events, quotes, quoteLines, clients, eventAllocations } from "@/db/schema";
import { revalidatePath } from "next/cache";

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
    notes,
    coverImageUrl: coverImageUrl || "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=600&q=80",
    createdAt: new Date(),
  });

  revalidatePath("/");
  return { success: true, id };
}

export async function createQuoteAction(formData: FormData) {
  const quoteNumber = (formData.get("quoteNumber") as string) || `ORC-2026-${Math.floor(100 + Math.random() * 900)}`;
  const eventId = (formData.get("eventId") as string) || null;
  const clientId = (formData.get("clientId") as string) || null;
  const validityDays = parseInt((formData.get("validityDays") as string) || "15", 10);
  const vatRate = 23.0;
  const linesJson = formData.get("lines") as string;

  let parsedLines: Array<{ itemId?: string; description: string; quantity: number; unitPrice: number; total: number }> = [];
  try {
    parsedLines = JSON.parse(linesJson || "[]");
  } catch (e) {
    parsedLines = [];
  }

  const subtotal = parsedLines.reduce((acc, line) => acc + (line.quantity * line.unitPrice), 0);
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
  revalidatePath("/");
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

