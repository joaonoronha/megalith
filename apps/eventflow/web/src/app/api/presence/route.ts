import { NextRequest, NextResponse } from "next/server";
import { db, ensureDbMigrated } from "@/db/client";
import { userPresence, users } from "@/db/schema";
import { eq, lt, gte, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const PRESENCE_TTL_MS = 45 * 1000; // 45 seconds considered active
const CLEANUP_TTL_MS = 90 * 1000;  // 90 seconds purge threshold

async function getOnlineUsers() {
  const activeCutoff = new Date(Date.now() - PRESENCE_TTL_MS);
  const rows = await db
    .select({
      userId: userPresence.userId,
      userName: userPresence.userName,
      userEmail: userPresence.userEmail,
      userRole: userPresence.userRole,
      avatarUrl: userPresence.avatarUrl,
      editingEntityType: userPresence.editingEntityType,
      editingEntityId: userPresence.editingEntityId,
      editingEntityTitle: userPresence.editingEntityTitle,
      lastSeenAt: userPresence.lastSeenAt,
    })
    .from(userPresence)
    .where(gte(userPresence.lastSeenAt, activeCutoff));

  return rows.map((r) => ({
    ...r,
    isOnline: true,
  }));
}

export async function GET() {
  try {
    await ensureDbMigrated();
    const online = await getOnlineUsers();
    return NextResponse.json({ success: true, onlineUsers: online });
  } catch (err: any) {
    console.error("GET /api/presence error:", err);
    return NextResponse.json({ success: false, error: err?.message, onlineUsers: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDbMigrated();
    const body = await req.json().catch(() => ({}));
    const {
      userId,
      userName,
      userEmail,
      userRole,
      avatarUrl,
      editing,
      action,
    } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId obrigatório" }, { status: 400 });
    }

    if (action === "offline") {
      // User explicitly disconnected (tab closed / unmounted / beforeunload)
      await db.delete(userPresence).where(eq(userPresence.userId, userId));
      const online = await getOnlineUsers();
      return NextResponse.json({ success: true, onlineUsers: online });
    }

    // Lookup avatarUrl if not provided
    let resolvedAvatar = avatarUrl;
    if (resolvedAvatar === undefined) {
      const u = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { avatarUrl: true },
      });
      resolvedAvatar = u?.avatarUrl || null;
    }

    const now = new Date();

    // Upsert presence heartbeat
    await db
      .insert(userPresence)
      .values({
        userId,
        userName: userName || "Membro da Equipa",
        userEmail: userEmail || null,
        userRole: userRole || "admin",
        avatarUrl: resolvedAvatar || null,
        editingEntityType: editing?.type || null,
        editingEntityId: editing?.id || null,
        editingEntityTitle: editing?.title || null,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: userPresence.userId,
        set: {
          userName: userName || "Membro da Equipa",
          userEmail: userEmail || null,
          userRole: userRole || "admin",
          avatarUrl: resolvedAvatar || null,
          editingEntityType: editing?.type || null,
          editingEntityId: editing?.id || null,
          editingEntityTitle: editing?.title || null,
          lastSeenAt: now,
        },
      });

    // Clean up stale rows older than 90 seconds (best effort)
    try {
      const purgeCutoff = new Date(Date.now() - CLEANUP_TTL_MS);
      await db.delete(userPresence).where(lt(userPresence.lastSeenAt, purgeCutoff));
    } catch {
      // Best effort cleanup
    }

    const online = await getOnlineUsers();
    return NextResponse.json({ success: true, onlineUsers: online });
  } catch (err: any) {
    console.error("POST /api/presence error:", err);
    return NextResponse.json({ success: false, error: err?.message, onlineUsers: [] }, { status: 500 });
  }
}
