import { NextResponse } from "next/server";
import { ensureDbMigrated } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDbMigrated();
    return NextResponse.json({
      success: true,
      message: "Database schema successfully migrated (linked_event_id, meeting_summary, meeting_participants, comments, moodboard_comments, event_meetings).",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
