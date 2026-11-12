import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { inventoryItems, eventAllocations, events } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import InventoryDetailView from "@/components/InventoryDetailView";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InventoryItemPage({ params }: PageProps) {
  const { id } = await params;

  const item = await db.query.inventoryItems.findFirst({
    where: eq(inventoryItems.id, id),
  });

  if (!item) {
    notFound();
  }

  // Get all event allocations for this item
  const allocations = await db
    .select({
      id: eventAllocations.id,
      quantity: eventAllocations.quantity,
      status: eventAllocations.status,
      notes: eventAllocations.notes,
      eventId: events.id,
      eventName: events.name,
      eventVenue: events.venue,
      eventStartDate: events.startDate,
      eventEndDate: events.endDate,
      eventStatus: events.status,
    })
    .from(eventAllocations)
    .innerJoin(events, eq(eventAllocations.eventId, events.id))
    .where(eq(eventAllocations.itemId, id))
    .orderBy(desc(events.startDate));

  return <InventoryDetailView item={item} allocations={allocations} />;
}
