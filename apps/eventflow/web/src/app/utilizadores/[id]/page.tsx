import Link from "next/link";
import { db, ensureDbMigrated } from "@/db/client";
import { users, eventTasks, events, storageLocations } from "@/db/schema";
import { eq, or, desc, asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import UserDetailView from "@/components/UserDetailView";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UserPage({ params }: PageProps) {
  // Ensure database schema & columns (like avatar_url) are migrated on cold start
  await ensureDbMigrated().catch(() => {});

  const { id } = await params;
  const rawId = decodeURIComponent(id || "").trim();

  let user: any = null;
  let currentUser: any = null;

  try {
    const [fetchedUser, fetchedCurrentUser] = await Promise.all([
      db.query.users
        .findFirst({
          where: or(
            eq(users.id, rawId),
            eq(users.id, id),
            eq(users.email, rawId),
            eq(users.name, rawId)
          ),
        })
        .catch((e) => {
          console.error("UserPage: error fetching user", e);
          return null;
        }),
      getCurrentUser().catch((e) => {
        console.error("UserPage: error fetching currentUser", e);
        return null;
      }),
    ]);

    user = fetchedUser;
    currentUser = fetchedCurrentUser;
  } catch (err) {
    console.error("UserPage: error loading user profile", err);
  }

  // Graceful fallback if user not found without breaking or hanging in loading screen
  if (!user) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6 text-center antialiased">
        <div className="bg-white rounded-[24px] p-8 max-w-sm w-full border border-[#ececf0] shadow-sm space-y-4">
          <div className="w-14 h-14 rounded-full bg-neutral-100 text-[#111] flex items-center justify-center mx-auto text-xl font-bold">
            👤
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#111]">Conta não encontrada</h2>
            <p className="text-xs text-[#8e8e93]">
              Não foi possível localizar o perfil de utilizador solicitado.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/mais"
              className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold transition shadow-xs"
            >
              <span>← Voltar à Gestão de Equipa</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Get tasks assigned to this user and storage locations managed by this user
  let tasks: any[] = [];
  let managedLocs: any[] = [];

  try {
    const [fetchedTasks, fetchedLocs] = await Promise.all([
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
        .leftJoin(events, eq(eventTasks.eventId, events.id))
        .where(
          or(
            eq(eventTasks.assignedTo, user.id),
            eq(eventTasks.assignedTo, rawId),
            eq(eventTasks.assignedTo, user.name)
          )
        )
        .orderBy(asc(eventTasks.completed), desc(events.startDate))
        .catch((e) => {
          console.error("UserPage: error fetching tasks", e);
          return [];
        }),
      db.query.storageLocations
        .findMany({
          where: or(
            eq(storageLocations.managerUserId, user.id),
            eq(storageLocations.managerUserId, rawId),
            eq(storageLocations.managerName, user.name)
          ),
          orderBy: [asc(storageLocations.name)],
        })
        .catch((e) => {
          console.error("UserPage: error fetching locations", e);
          return [];
        }),
    ]);

    tasks = fetchedTasks || [];
    managedLocs = fetchedLocs || [];
  } catch (err) {
    console.error("UserPage: error fetching secondary relations", err);
  }

  const createdAt = user.createdAt instanceof Date ? user.createdAt : new Date(user.createdAt || Date.now());

  return (
    <UserDetailView
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        createdAt,
      }}
      currentUser={currentUser}
      assignedTasks={tasks}
      managedLocations={managedLocs}
      canEdit={currentUser?.role === "owner" || currentUser?.id === user.id}
    />
  );
}
