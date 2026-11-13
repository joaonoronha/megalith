import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { users, eventTasks, events, storageLocations } from "@/db/schema";
import { eq, or, desc, asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import UserDetailView from "@/components/UserDetailView";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UserPage({ params }: PageProps) {
  const { id } = await params;

  const [user, currentUser] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, id),
    }),
    getCurrentUser(),
  ]);

  if (!user) {
    notFound();
  }

  // Get tasks assigned to this user and storage locations managed by this user
  const [tasks, managedLocs] = await Promise.all([
    db
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
      .orderBy(asc(eventTasks.completed), desc(events.startDate)),
    db.query.storageLocations.findMany({
      where: or(eq(storageLocations.managerUserId, id), eq(storageLocations.managerName, user.name)),
      orderBy: [asc(storageLocations.name)],
    }),
  ]);

  return (
    <UserDetailView
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      }}
      currentUser={currentUser}
      assignedTasks={tasks}
      managedLocations={managedLocs}
      canEdit={currentUser?.role === "owner" || currentUser?.id === user.id}
    />
  );
}
