import { notFound, redirect } from "next/navigation";
import { db, ensureDbMigrated } from "@/db/client";
import {
  events,
  clients,
  inventoryItems,
  eventAllocations,
  eventCustomItems,
  eventTasks,
  eventMedia,
  moodboardComments,
  eventMeetings,
  quotes,
  users,
} from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import EventDetailView from "@/components/EventDetailView";
import { isMeetingEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventPage({ params }: PageProps) {
  await ensureDbMigrated().catch(() => {});
  const { id } = await params;

  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
  });

  // If someone accesses a meeting id through /eventos/[id], redirect to dedicated /reunioes/[id] endpoint
  if (!event) {
    const meeting = await db.query.eventMeetings.findFirst({
      where: eq(eventMeetings.id, id),
    });
    if (meeting) {
      redirect(`/reunioes/${id}`);
    }
    notFound();
  }

  // If a legacy row in events is flagged as a meeting, redirect to /reunioes
  if (isMeetingEvent(event)) {
    redirect(`/reunioes/${event.id}`);
  }

  // 1. Client
  const client = event.clientId
    ? await db.query.clients.findFirst({
        where: eq(clients.id, event.clientId),
      })
    : null;

  // Team users
  const teamUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users);

  // Auth User
  const currentUser = await getCurrentUser();

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

  // 7. Event Media: Idea Boards & Final Outcomes (with collaborative comments)
  const rawMedia = await db
    .select()
    .from(eventMedia)
    .where(eq(eventMedia.eventId, id))
    .orderBy(asc(eventMedia.orderIndex), asc(eventMedia.createdAt));

  let mediaComments: any[] = [];
  try {
    mediaComments = await db
      .select()
      .from(moodboardComments)
      .where(eq(moodboardComments.eventId, id))
      .orderBy(asc(moodboardComments.createdAt));
  } catch (err) {
    console.error("Error loading moodboard comments:", err);
  }

  const media = rawMedia.map((m) => {
    const tableComments = mediaComments.filter((c) => c.mediaId === m.id);
    let inlineComments: any[] = [];
    if (m.comments) {
      try {
        const parsed = JSON.parse(m.comments);
        if (Array.isArray(parsed)) inlineComments = parsed;
      } catch {}
    }

    const commentMap = new Map();
    inlineComments.forEach((c) => commentMap.set(c.id, c));
    tableComments.forEach((c) =>
      commentMap.set(c.id, {
        ...c,
        createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      })
    );

    return {
      ...m,
      comments: Array.from(commentMap.values()),
    };
  });

  // 8. Event Meetings (Google Meet & In Person)
  const meetings = await db.query.eventMeetings.findMany({
    where: eq(eventMeetings.eventId, id),
    orderBy: [asc(eventMeetings.startDate)],
  });

  // 9. Available meetings to link to this event (e.g. from the same client or unlinked Calendly events)
  let availableMeetingsToLink: any[] = [];
  try {
    const otherMeetings = await db.query.eventMeetings.findMany({
      where: event.clientId ? eq(eventMeetings.clientId, event.clientId) : undefined,
      orderBy: [desc(eventMeetings.startDate)],
    });

    const calMeetings = await db.query.events.findMany({
      where: event.clientId ? eq(events.clientId, event.clientId) : undefined,
      orderBy: [desc(events.startDate)],
    });

    const alreadyLinkedIds = new Set(meetings.map((m) => m.id));
    const alreadyLinkedEventIds = new Set(
      meetings.map((m) => m.linkedEventRowId).filter(Boolean)
    );

    const linkableOther = otherMeetings.filter(
      (m) => m.eventId !== id && !alreadyLinkedIds.has(m.id)
    );

    const linkableCal = calMeetings
      .filter(
        (e) =>
          e.id !== id &&
          (e.category === "Reunião Calendly" || Boolean(e.calendlyEventUri) || e.name.toLowerCase().startsWith("reunião")) &&
          !alreadyLinkedEventIds.has(e.id) &&
          e.linkedEventId !== id
      )
      .map((e) => ({
        id: `cal-evt-${e.id}`,
        existingEventId: e.id,
        title: e.name,
        type: (e.venue?.toLowerCase().includes("meet") ? "google_meet" : "presencial") as "google_meet" | "presencial",
        startDate: e.startDate,
        endDate: e.endDate,
        location: e.venue,
        meetUrl: e.venue?.includes("meet.google.com") ? e.venue : null,
        notes: e.notes,
        source: "calendly",
        clientName: client?.name || "Cliente",
      }));

    availableMeetingsToLink = [
      ...linkableOther.map((m) => ({
        id: m.id,
        meetingId: m.id,
        title: m.title,
        type: m.type,
        startDate: m.startDate,
        endDate: m.endDate,
        location: m.location,
        meetUrl: m.meetUrl,
        notes: m.notes,
        source: m.source,
        clientName: client?.name || "Cliente",
      })),
      ...linkableCal,
    ];
  } catch (err) {
    console.error("Error fetching linkable meetings:", err);
  }

  // 10. Event Custom Items (Bespoke items specific only to this event, added directly to quota)
  let customItems: any[] = [];
  try {
    customItems = await db.query.eventCustomItems.findMany({
      where: eq(eventCustomItems.eventId, id),
      orderBy: [asc(eventCustomItems.createdAt)],
    });
  } catch (err) {
    console.error("Error fetching custom items:", err);
  }

  return (
    <EventDetailView
      event={event}
      client={client || null}
      allClients={allClients}
      allItems={allItems}
      initialAllocations={rawAllocations}
      initialCustomItems={customItems}
      initialTasks={tasks}
      initialMedia={media}
      initialMeetings={meetings}
      availableMeetingsToLink={availableMeetingsToLink}
      teamUsers={teamUsers}
      quotes={eventQuotes}
      currentUser={currentUser}
    />
  );
}
