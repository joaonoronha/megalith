import { NextResponse } from "next/server";
import { db, ensureDbMigrated } from "@/db/client";
import { alerts } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

let lastSystemSyncTime = 0;
const SYSTEM_SYNC_COOLDOWN_MS = 30 * 1000; // Throttle evaluateAndSyncAlerts to at most once per 30 seconds

export async function GET() {
  try {
    await ensureDbMigrated();
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ success: true, alerts: [] });
    }

    // Trigger evaluateAndSyncAlerts periodically in background without blocking request
    const now = Date.now();
    if (now - lastSystemSyncTime > SYSTEM_SYNC_COOLDOWN_MS) {
      lastSystemSyncTime = now;
      import("@/lib/alerts")
        .then(({ evaluateAndSyncAlerts }) => evaluateAndSyncAlerts())
        .catch((e) => console.error("Background evaluateAndSyncAlerts error:", e));
    }

    const rows = await db.query.alerts.findMany({
      orderBy: [desc(alerts.lastTriggeredAt)],
      limit: 60,
    });

    return NextResponse.json({
      success: true,
      alerts: rows,
    });
  } catch (err: any) {
    console.error("GET /api/alerts error:", err);
    return NextResponse.json(
      { success: false, error: err?.message, alerts: [] },
      { status: 500 }
    );
  }
}
