import { notFound } from "next/navigation";
import { db } from "@/db/client";
import {
  events,
  clients,
  inventoryItems,
  eventAllocations,
  eventTasks,
  eventMedia,
  quotes,
} from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import EventDetailView from "@/components/EventDetailView";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventPage({ params }: PageProps) {
  const { id } = await params;

  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
  });

  if (!event) {
    notFound();
  }

  // 1. Client
  const client = event.clientId
    ? await db.query.clients.findFirst({
        where: eq(clients.id, event.clientId),
      })
    : null;

  // 2. All Clients
  const allClients = await db.query.clients.findMany({
    orderBy: [clients.name],
  });

  // 3. All Inventory Items
  const allItems = await db.query.inventoryItems.findMany({
    orderBy: [inventoryItems.name],
  });

  // 4. Allocations for this event joined with inventory items
  const rawAllocations = await db
    .select({
      id: eventAllocations.id,
      eventId: eventAllocations.eventId,
      itemId: eventAllocations.itemId,
      quantity: eventAllocations.quantity,
      status: eventAllocations.status,
      notes: eventAllocations.notes,
      itemName: inventoryItems.name,
      itemSku: inventoryItems.sku,
      itemCategory: inventoryItems.category,
      itemUnitPrice: inventoryItems.unitPrice,
      itemReplacementCost: inventoryItems.replacementCost,
      itemWarehouseLocation: inventoryItems.warehouseLocation,
      itemImageUrl: inventoryItems.imageUrl,
      itemTotalQuantity: inventoryItems.totalQuantity,
    })
    .from(eventAllocations)
    .innerJoin(inventoryItems, eq(eventAllocations.itemId, inventoryItems.id))
    .where(eq(eventAllocations.eventId, id));

  // 5. Tasks / Action items checklist
  const tasks = await db.query.eventTasks.findMany({
    where: eq(eventTasks.eventId, id),
    orderBy: [asc(eventTasks.orderIndex), asc(eventTasks.createdAt)],
  });

  // 6. Commercial quotes for this event
  const eventQuotes = await db.query.quotes.findMany({
    where: eq(quotes.eventId, id),
    orderBy: [desc(quotes.createdAt)],
  });

  // 7. Event Media: Idea Boards & Final Outcomes
  const media = await db
    .select()
    .from(eventMedia)
    .where(eq(eventMedia.eventId, id))
    .orderBy(asc(eventMedia.orderIndex), asc(eventMedia.createdAt));

  // 8. Auth User
  const currentUser = await getCurrentUser();

  return (
    <EventDetailView
      event={event}
      client={client || null}
      allClients={allClients}
      allItems={allItems}
      initialAllocations={rawAllocations}
      initialTasks={tasks}
      initialMedia={media}
      quotes={eventQuotes}
      currentUser={currentUser}
    />
  );
}
