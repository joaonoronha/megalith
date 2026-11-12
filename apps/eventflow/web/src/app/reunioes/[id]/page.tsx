import { notFound, redirect } from "next/navigation";
import { db, ensureDbMigrated } from "@/db/client";
import {
  eventMeetings,
  events,
  clients,
  eventTasks,
  users,
} from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import MeetingDetailView from "@/components/MeetingDetailView";
import { isMeetingEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReuniaoDetailPage({ params }: PageProps) {
  await ensureDbMigrated().catch(() => {});
  const { id } = await params;

  // 1. Look up meeting in eventMeetings
  let meeting = await db.query.eventMeetings.findFirst({
    where: eq(eventMeetings.id, id),
  });

  // If not found in eventMeetings, check if it's a legacy row in events
  if (!meeting) {
    const legacyEvent = await db.query.events.findFirst({
      where: eq(events.id, id),
    });

    if (legacyEvent && isMeetingEvent(legacyEvent)) {
      meeting = {
        id: legacyEvent.id,
        title: legacyEvent.name,
        eventId: legacyEvent.linkedEventId || null,
        clientId: legacyEvent.clientId || null,
        location: legacyEvent.venue || "Google Meet",
        meetUrl: legacyEvent.venue?.includes("meet.google.com")
          ? legacyEvent.venue
          : `https://meet.google.com/cfm-${legacyEvent.id.slice(-6)}`,
        type: "google_meet",
        status: (legacyEvent.status === "cancelado" ? "cancelada" : "agendada") as any,
        startDate: legacyEvent.startDate,
        endDate: legacyEvent.endDate,
        notes: legacyEvent.notes,
        meetingSummary: legacyEvent.meetingSummary,
        meetingParticipants: legacyEvent.meetingParticipants,
        source: "calendly",
        calendlyUri: legacyEvent.calendlyEventUri,
        createdAt: legacyEvent.createdAt,
        updatedAt: legacyEvent.updatedAt,
      } as any;
    }
  }

  if (!meeting) {
    notFound();
  }

  // 2. Auxiliary queries in parallel
  const linkedEventId = meeting.eventId;
  const clientId = meeting.clientId;

  const [client, teamUsers, currentUser, linkedEvent, allEvents, actionItems] = await Promise.all([
    clientId ? db.query.clients.findFirst({ where: eq(clients.id, clientId) }).catch(() => null) : Promise.resolve(null),
    db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).catch(() => []),
    getCurrentUser().catch(() => null),
    linkedEventId ? db.query.events.findFirst({ where: eq(events.id, linkedEventId) }).catch(() => null) : Promise.resolve(null),
    db.query.events.findMany({ orderBy: [desc(events.startDate)] }).catch(() => []),
    db.query.eventTasks.findMany({
      where: eq(eventTasks.meetingId, id),
      orderBy: [asc(eventTasks.orderIndex), asc(eventTasks.createdAt)],
    }).catch(() => []),
  ]);

  const allProductionEvents = (allEvents || []).filter((e: any) => !isMeetingEvent(e));

  let finalActionItems = actionItems || [];
  if (finalActionItems.length === 0) {
    try {
      finalActionItems = await db.query.eventTasks.findMany({
        where: eq(eventTasks.eventId, id),
        orderBy: [asc(eventTasks.orderIndex), asc(eventTasks.createdAt)],
      });
    } catch {
      finalActionItems = [];
    }
  }

  return (
    <MeetingDetailView
      meeting={meeting as any}
      client={client || null}
      linkedEvent={linkedEvent as any || null}
      allProductionEvents={allProductionEvents as any}
      actionItems={finalActionItems as any}
      teamUsers={teamUsers}
      currentUser={currentUser}
    />
  );
}
