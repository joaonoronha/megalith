import { db } from "../db/client";
import { inventoryItems, eventAllocations, events } from "../db/schema";
import { eq, and, lte, gte, sql } from "drizzle-orm";

export interface StockCheckResult {
  itemId: string;
  itemName: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedInPeriod: number;
  damagedOrMaintenance: number;
  hasConflict: boolean;
  conflictingEvents: Array<{
    eventId: string;
    eventName: string;
    reservedQuantity: number;
    startDate: Date;
    endDate: Date;
  }>;
}

/**
 * Checks temporal stock availability for a specific item over a date range.
 * Overlap condition:
 * Event overlaps if (Event.prepDate OR Event.startDate) <= requestedEndDate
 * AND (Event.returnDate OR Event.endDate) >= requestedStartDate
 */
export async function checkItemAvailability(
  itemId: string,
  requestedQuantity: number,
  startDate: Date,
  endDate: Date,
  excludeEventId?: string
): Promise<StockCheckResult> {
  const item = await db.query.inventoryItems.findFirst({
    where: eq(inventoryItems.id, itemId),
  });

  if (!item) {
    throw new Error(`Item ${itemId} not found`);
  }

  // Get active allocations in the overlapping period
  const activeAllocations = await db
    .select({
      allocationId: eventAllocations.id,
      quantity: eventAllocations.quantity,
      eventId: events.id,
      eventName: events.name,
      eventStart: events.startDate,
      eventEnd: events.endDate,
      prepDate: events.prepDate,
      returnDate: events.returnDate,
      status: events.status,
    })
    .from(eventAllocations)
    .innerJoin(events, eq(eventAllocations.eventId, events.id))
    .where(
      and(
        eq(eventAllocations.itemId, itemId),
        sql`${events.status} != 'cancelado'`,
        excludeEventId ? sql`${events.id} != ${excludeEventId}` : sql`1 = 1`,
        // Overlap logic: Event overlaps if start <= requestedEndDate AND end >= requestedStartDate
        sql`COALESCE(${events.prepDate}, ${events.startDate}) <= ${Math.floor(endDate.getTime() / 1000)}`,
        sql`COALESCE(${events.returnDate}, ${events.endDate}, ${events.startDate}) >= ${Math.floor(startDate.getTime() / 1000)}`
      )
    );

  const reservedInPeriod = activeAllocations.reduce((sum, a) => sum + a.quantity, 0);
  const damagedOrMaintenance = (item.damagedQuantity || 0) + (item.inMaintenanceQuantity || 0);
  const usableTotal = Math.max(0, item.totalQuantity - damagedOrMaintenance);
  const availableQuantity = Math.max(0, usableTotal - reservedInPeriod);

  return {
    itemId: item.id,
    itemName: item.name,
    totalQuantity: item.totalQuantity,
    availableQuantity,
    reservedInPeriod,
    damagedOrMaintenance,
    hasConflict: availableQuantity < requestedQuantity,
    conflictingEvents: activeAllocations.map((a) => ({
      eventId: a.eventId,
      eventName: a.eventName,
      reservedQuantity: a.quantity,
      startDate: new Date(a.eventStart),
      endDate: new Date(a.eventEnd || a.eventStart),
    })),
  };
}
