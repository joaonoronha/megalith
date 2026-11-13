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
import { eq, ne, desc, asc } from "drizzle-orm";
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

  const clientId = event.clientId;

  // Run all auxiliary queries concurrently in a single batch
  const [
    client,
    teamUsers,
    currentUser,
    allClients,
    allItems,
    rawAllocations,
    otherEventAllocations,
    tasks,
    eventQuotes,
    rawMedia,
    mediaComments,
    meetings,
    otherMeetings,
    calMeetings,
    customItems,
  ] = await Promise.all([
    clientId
      ? db.query.clients.findFirst({ where: eq(clients.id, clientId) }).catch(() => null)
      : Promise.resolve(null),
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .catch(() => []),
    getCurrentUser().catch(() => null),
    db.query.clients.findMany({ orderBy: [clients.name] }).catch(() => []),
    db.query.inventoryItems.findMany({ orderBy: [inventoryItems.name] }).catch(() => []),
    db
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
        itemIsConsumable: inventoryItems.isConsumable,
        itemPackageUnits: inventoryItems.packageUnits,
      })
      .from(eventAllocations)
      .innerJoin(inventoryItems, eq(eventAllocations.itemId, inventoryItems.id))
      .where(eq(eventAllocations.eventId, id))
      .catch(() => []),
    db
      .select({
        id: eventAllocations.id,
        eventId: eventAllocations.eventId,
        eventName: events.name,
        eventStartDate: events.startDate,
        eventStatus: events.status,
        itemId: eventAllocations.itemId,
        quantity: eventAllocations.quantity,
      })
      .from(eventAllocations)
      .innerJoin(events, eq(eventAllocations.eventId, events.id))
      .where(ne(eventAllocations.eventId, id))
      .catch(() => []),
    db.query.eventTasks.findMany({
      where: eq(eventTasks.eventId, id),
      orderBy: [asc(eventTasks.orderIndex), asc(eventTasks.createdAt)],
    }).catch(() => []),
    db.query.quotes.findMany({
      where: eq(quotes.eventId, id),
      orderBy: [desc(quotes.createdAt)],
    }).catch(() => []),
    db
      .select()
      .from(eventMedia)
      .where(eq(eventMedia.eventId, id))
      .orderBy(asc(eventMedia.orderIndex), asc(eventMedia.createdAt))
      .catch(() => []),
    db
      .select()
      .from(moodboardComments)
      .where(eq(moodboardComments.eventId, id))
      .orderBy(asc(moodboardComments.createdAt))
      .catch(() => []),
    db.query.eventMeetings.findMany({
      where: eq(eventMeetings.eventId, id),
      orderBy: [asc(eventMeetings.startDate)],
    }).catch(() => []),
    db.query.eventMeetings.findMany({
      where: clientId ? eq(eventMeetings.clientId, clientId) : undefined,
      orderBy: [desc(eventMeetings.startDate)],
    }).catch(() => []),
    db.query.events.findMany({
      where: clientId ? eq(events.clientId, clientId) : undefined,
      orderBy: [desc(events.startDate)],
    }).catch(() => []),
    db.query.eventCustomItems.findMany({
      where: eq(eventCustomItems.eventId, id),
      orderBy: [asc(eventCustomItems.createdAt)],
    }).catch(() => []),
  ]);

  const media = (rawMedia || []).map((m: any) => {
    const tableComments = (mediaComments || []).filter((c: any) => c.mediaId === m.id);
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

  const alreadyLinkedIds = new Set((meetings || []).map((m: any) => m.id));
  const alreadyLinkedEventIds = new Set(
    (meetings || []).map((m: any) => m.linkedEventRowId).filter(Boolean)
  );

  const linkableOther = (otherMeetings || []).filter(
    (m: any) => m.eventId !== id && !alreadyLinkedIds.has(m.id)
  );

  const linkableCal = (calMeetings || [])
    .filter(
      (e: any) =>
        e.id !== id &&
        (e.category === "Reunião Calendly" || Boolean(e.calendlyEventUri) || e.name.toLowerCase().startsWith("reunião")) &&
        !alreadyLinkedEventIds.has(e.id) &&
        e.linkedEventId !== id
    )
    .map((e: any) => ({
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

  const availableMeetingsToLink = [
    ...linkableOther.map((m: any) => ({
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

  return (
    <EventDetailView
      event={event}
      client={client || null}
      allClients={allClients || []}
      allItems={allItems || []}
      initialAllocations={rawAllocations || []}
      otherEventAllocations={otherEventAllocations || []}
      initialCustomItems={customItems || []}
      initialTasks={tasks || []}
      initialMedia={media || []}
      initialMeetings={meetings || []}
      availableMeetingsToLink={availableMeetingsToLink}
      teamUsers={teamUsers || []}
      quotes={eventQuotes || []}
      currentUser={currentUser}
    />
  );
}
