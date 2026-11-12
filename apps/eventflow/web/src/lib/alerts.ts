import { db } from "@/db/client";
import {
  alerts,
  inventoryItems,
  events,
  eventTasks,
  quotes,
  financialMovements,
} from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { generateId } from "@/lib/id";

export interface AlertCandidate {
  fingerprint: string;
  type: "low_stock" | "damaged_stock" | "event_unprepared" | "payment_due" | "missing_completed_payment";
  entityType: "inventory" | "event" | "quote" | "client";
  entityId: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "urgent" | "critical";
  metadata?: Record<string, any>;
}

export async function evaluateAndSyncAlerts() {
  const now = new Date();

  // 1. Fetch live system entities concurrently
  const [
    items,
    allEvents,
    tasks,
    allQuotes,
    movements,
    existingAlertsList,
  ] = await Promise.all([
    db.query.inventoryItems.findMany(),
    db.query.events.findMany(),
    db.query.eventTasks.findMany(),
    db.query.quotes.findMany(),
    db.query.financialMovements.findMany(),
    db.query.alerts.findMany({
      orderBy: [desc(alerts.lastTriggeredAt)],
    }),
  ]);

  const candidates: AlertCandidate[] = [];

  // -------------------------------------------------------------
  // RULE 1: Reported damages needing fixing
  // -------------------------------------------------------------
  for (const item of items) {
    const damaged = item.damagedQuantity || 0;
    if (damaged > 0) {
      candidates.push({
        fingerprint: `damaged_stock:inventory:${item.id}`,
        type: "damaged_stock",
        entityType: "inventory",
        entityId: item.id,
        title: `${damaged} ${damaged === 1 ? "artigo com dano" : "artigos com danos"}`,
        message: `${item.name} (${item.warehouseLocation || "Armazém"}) · Requer triagem e reparação`,
        severity: "critical",
        metadata: {
          itemId: item.id,
          sku: item.sku,
          damagedQuantity: damaged,
          warehouseLocation: item.warehouseLocation,
        },
      });
    }
  }

  // -------------------------------------------------------------
  // RULE 2: Low stock in inventory
  // -------------------------------------------------------------
  for (const item of items) {
    const total = item.totalQuantity || 0;
    const damaged = item.damagedQuantity || 0;
    const inMaint = item.inMaintenanceQuantity || 0;
    const available = total - damaged - inMaint;
    const min = item.minStock ?? 0;

    if (min > 0 && available <= min) {
      candidates.push({
        fingerprint: `low_stock:inventory:${item.id}`,
        type: "low_stock",
        entityType: "inventory",
        entityId: item.id,
        title: `${item.name} abaixo do mínimo`,
        message: `${available} disponíveis · mínimo definido de ${min} unidades`,
        severity: available <= 0 ? "critical" : "warning",
        metadata: {
          itemId: item.id,
          sku: item.sku,
          available,
          total,
          minStock: min,
        },
      });
    }
  }

  // -------------------------------------------------------------
  // RULE 3: Upcoming event unprepared, tied to prepDate field
  // -------------------------------------------------------------
  const tasksByEventId = tasks.reduce((acc, t) => {
    if (!acc[t.eventId]) acc[t.eventId] = [];
    acc[t.eventId].push(t);
    return acc;
  }, {} as Record<string, typeof tasks>);

  for (const event of allEvents) {
    if (event.status === "cancelado" || event.status === "concluido") continue;

    // Tied directly to prepDate, fallback to startDate if prepDate is omitted
    const targetDate = event.prepDate ? new Date(event.prepDate) : (event.startDate ? new Date(event.startDate) : null);
    if (!targetDate) continue;

    const diffMs = targetDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    // If prep date is overdue or due within 48 hours
    if (diffHours <= 48) {
      const eventTasksList = tasksByEventId[event.id] || [];
      const pendingTasks = eventTasksList.filter((t) => !t.completed);

      // Flag if there are incomplete tasks
      if (pendingTasks.length > 0) {
        const isOverdue = diffHours < 0;
        const formattedPrep = targetDate.toLocaleDateString("pt-PT", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });

        candidates.push({
          fingerprint: `event_unprepared:event:${event.id}`,
          type: "event_unprepared",
          entityType: "event",
          entityId: event.id,
          title: `${event.name} por preparar`,
          message: `${pendingTasks.length} ${
            pendingTasks.length === 1 ? "tarefa pendente" : "tarefas pendentes"
          } · Preparação ${isOverdue ? "estava agendada para" : "agendada para"} ${formattedPrep}`,
          severity: isOverdue ? "critical" : "urgent",
          metadata: {
            eventId: event.id,
            pendingTasksCount: pendingTasks.length,
            prepDate: targetDate.toISOString(),
            isOverdue,
          },
        });
      }
    }
  }

  // -------------------------------------------------------------
  // RULE 4: Due date for event initial payment (accepted quote, 5-day window)
  // -------------------------------------------------------------
  const movementsByEventId = movements.reduce((acc, m) => {
    if (m.type === "entrada" && m.eventId) {
      acc[m.eventId] = (acc[m.eventId] || 0) + m.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  const movementsByClientId = movements.reduce((acc, m) => {
    if (m.type === "entrada" && m.clientId) {
      acc[m.clientId] = (acc[m.clientId] || 0) + m.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  for (const quote of allQuotes) {
    if (quote.status !== "aprovado") continue;

    const approvalDate = quote.signedAt
      ? new Date(quote.signedAt)
      : quote.updatedAt
      ? new Date(quote.updatedAt)
      : new Date(quote.createdAt);

    // Expected payment within 5 days of acceptance
    const dueDate = new Date(approvalDate.getTime() + 5 * 24 * 60 * 60 * 1000);
    const isPastDue = now.getTime() > dueDate.getTime();

    // Standard CFM deposit is 50%
    const expectedDeposit = (quote.total || 0) * 0.5;

    // Check payment received
    const paidForEvent = quote.eventId ? movementsByEventId[quote.eventId] || 0 : 0;
    const paidForClient = quote.clientId ? movementsByClientId[quote.clientId] || 0 : 0;
    const totalPaid = Math.max(paidForEvent, paidForClient);

    if (isPastDue && totalPaid < expectedDeposit - 0.5) {
      const missingDeposit = expectedDeposit - totalPaid;
      candidates.push({
        fingerprint: `payment_due:quote:${quote.id}`,
        type: "payment_due",
        entityType: "quote",
        entityId: quote.id,
        title: `Sinal em atraso (${quote.quoteNumber})`,
        message: `Orçamento aprovado há mais de 5 dias · Falta receber sinal de €${missingDeposit.toFixed(
          2
        )}`,
        severity: "critical",
        metadata: {
          quoteId: quote.id,
          quoteNumber: quote.quoteNumber,
          eventId: quote.eventId,
          clientId: quote.clientId,
          expectedDeposit,
          totalPaid,
          missingDeposit,
          dueDate: dueDate.toISOString(),
        },
      });
    }
  }

  // -------------------------------------------------------------
  // RULE 5: Missing payment of completed event
  // -------------------------------------------------------------
  for (const event of allEvents) {
    if (event.status !== "concluido") continue;

    const customerPrice = event.customerPrice || 0;
    if (customerPrice <= 0) continue;

    const totalPaid = movementsByEventId[event.id] || 0;
    if (totalPaid < customerPrice - 0.5) {
      const missingTotal = customerPrice - totalPaid;
      candidates.push({
        fingerprint: `missing_completed_payment:event:${event.id}`,
        type: "missing_completed_payment",
        entityType: "event",
        entityId: event.id,
        title: `Pagamento em falta: ${event.name}`,
        message: `Evento concluído com €${missingTotal.toFixed(
          2
        )} por liquidar (cobrado €${customerPrice.toFixed(2)})`,
        severity: "critical",
        metadata: {
          eventId: event.id,
          customerPrice,
          totalPaid,
          missingTotal,
        },
      });
    }
  }

  // -------------------------------------------------------------
  // RECONCILIATION WITH DATABASE
  // -------------------------------------------------------------
  const existingMap = new Map(existingAlertsList.map((a) => [a.fingerprint, a]));
  const candidateFingerprints = new Set(candidates.map((c) => c.fingerprint));

  // 1. Process active candidates
  for (const candidate of candidates) {
    const existing = existingMap.get(candidate.fingerprint);

    if (!existing) {
      // BRAND NEW ALERT -> active & acknowledgedAt is null
      await db.insert(alerts).values({
        id: generateId("alt"),
        fingerprint: candidate.fingerprint,
        type: candidate.type,
        entityType: candidate.entityType,
        entityId: candidate.entityId,
        title: candidate.title,
        message: candidate.message,
        severity: candidate.severity,
        status: "active",
        metadata: candidate.metadata ? JSON.stringify(candidate.metadata) : null,
        snoozedUntil: null,
        lastTriggeredAt: now,
        acknowledgedAt: null, // Indicates brand new / unread!
        acknowledgedByUserId: null,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // Check if snoozed has expired
      let nextStatus = existing.status;
      let nextSnoozedUntil = existing.snoozedUntil;

      if (existing.status === "snoozed") {
        if (existing.snoozedUntil && existing.snoozedUntil.getTime() <= now.getTime()) {
          // Snooze expired! Reactivate
          nextStatus = "active";
          nextSnoozedUntil = null;
        }
      } else if (existing.status === "resolved") {
        // Reopened!
        nextStatus = "active";
      }

      await db
        .update(alerts)
        .set({
          title: candidate.title,
          message: candidate.message,
          severity: candidate.severity,
          status: nextStatus,
          metadata: candidate.metadata ? JSON.stringify(candidate.metadata) : null,
          snoozedUntil: nextSnoozedUntil,
          lastTriggeredAt: now,
          updatedAt: now,
        })
        .where(eq(alerts.id, existing.id));
    }
  }

  // 2. Auto-resolve alerts that are no longer triggering
  for (const existing of existingAlertsList) {
    if (
      (existing.status === "active" || existing.status === "snoozed" || existing.status === "acknowledged") &&
      !candidateFingerprints.has(existing.fingerprint)
    ) {
      await db
        .update(alerts)
        .set({
          status: "resolved",
          updatedAt: now,
        })
        .where(eq(alerts.id, existing.id));
    }
  }

  // 3. Return refreshed list of alerts
  const freshAlerts = await db.query.alerts.findMany({
    orderBy: [desc(alerts.lastTriggeredAt)],
  });

  return freshAlerts;
}
