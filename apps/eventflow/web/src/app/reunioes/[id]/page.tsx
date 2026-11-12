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

  // 2. Client
  const client = meeting.clientId
    ? await db.query.clients.findFirst({
        where: eq(clients.id, meeting.clientId),
      })
    : null;

  // 3. Team Users
  const teamUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users);

  // 4. Current user
  const currentUser = await getCurrentUser();

  // 5. Linked Production Event (if any)
  const linkedEventId = meeting.eventId;
  const linkedEvent = linkedEventId
    ? await db.query.events.findFirst({
        where: eq(events.id, linkedEventId),
      })
    : null;

  // 6. Production Events list (to allow linking this meeting to a production)
  const allEvents = await db.query.events.findMany({
    orderBy: [desc(events.startDate)],
  });
  const allProductionEvents = allEvents.filter((e) => !isMeetingEvent(e));

  // 7. Action items / tasks for this meeting
  const actionItems = await db.query.eventTasks.findMany({
    where: eq(eventTasks.meetingId, id),
    orderBy: [asc(eventTasks.orderIndex), asc(eventTasks.createdAt)],
  });

  // If no action items found under meetingId, also check legacy eventId
  let finalActionItems = actionItems;
  if (finalActionItems.length === 0) {
    finalActionItems = await db.query.eventTasks.findMany({
      where: eq(eventTasks.eventId, id),
      orderBy: [asc(eventTasks.orderIndex), asc(eventTasks.createdAt)],
    });
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
