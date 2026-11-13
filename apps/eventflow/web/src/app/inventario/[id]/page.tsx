import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { inventoryItems, eventAllocations, events, storageLocations, users } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
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

  // Get all event allocations, storage locations, users and currentUser
  const [allocations, locations, allUsers, currentUser] = await Promise.all([
    db
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
      .orderBy(desc(events.startDate)),
    db.query.storageLocations.findMany({
      orderBy: [asc(storageLocations.name)],
    }),
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        avatarUrl: users.avatarUrl,
      })
      .from(users),
    getCurrentUser(),
  ]);

  return (
    <InventoryDetailView
      item={item}
      allocations={allocations}
      locations={locations}
      users={allUsers}
      currentUser={currentUser}
    />
  );
}
