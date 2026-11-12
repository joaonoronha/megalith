import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { users, eventTasks, events } from "@/db/schema";
import { eq, or, desc, asc } from "drizzle-orm";
import UserDetailView from "@/components/UserDetailView";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UserPage({ params }: PageProps) {
  const { id } = await params;

  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
  });

  if (!user) {
    notFound();
  }

  // Get tasks assigned to this user (by ID or by name)
  const tasks = await db
    .select({
      id: eventTasks.id,
      title: eventTasks.title,
      completed: eventTasks.completed,
      priority: eventTasks.priority,
      dueDate: eventTasks.dueDate,
      eventId: events.id,
      eventName: events.name,
      eventVenue: events.venue,
      eventStartDate: events.startDate,
    })
    .from(eventTasks)
    .innerJoin(events, eq(eventTasks.eventId, events.id))
    .where(or(eq(eventTasks.assignedTo, id), eq(eventTasks.assignedTo, user.name)))
    .orderBy(asc(eventTasks.completed), desc(events.startDate));

  return (
    <UserDetailView
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      }}
      assignedTasks={tasks}
    />
  );
}
