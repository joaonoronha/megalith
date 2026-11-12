import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

export const client = createClient({
  url,
  authToken,
});

export const db = drizzle(client, { schema });

let migrationPromise: Promise<void> | null = null;

export async function ensureDbMigrated(): Promise<void> {
  if (migrationPromise) {
    return migrationPromise;
  }

  migrationPromise = (async () => {
    const migrationStatements = [
      // 1. Events table columns
      "ALTER TABLE events ADD COLUMN linked_event_id TEXT",
      "ALTER TABLE events ADD COLUMN meeting_summary TEXT",
      "ALTER TABLE events ADD COLUMN meeting_participants TEXT",

      // 2. Event Media columns
      "ALTER TABLE event_media ADD COLUMN images TEXT",
      "ALTER TABLE event_media ADD COLUMN comments TEXT",
      "ALTER TABLE event_media ADD COLUMN tag TEXT",
      "ALTER TABLE event_media ADD COLUMN order_index INTEGER",
      "ALTER TABLE event_media ADD COLUMN uploaded_by_name TEXT",

      // 3. Moodboard Comments table
      `CREATE TABLE IF NOT EXISTS moodboard_comments (
        id TEXT PRIMARY KEY,
        media_id TEXT NOT NULL REFERENCES event_media(id) ON DELETE CASCADE,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id TEXT,
        author_name TEXT NOT NULL DEFAULT 'Equipa CFM',
        content TEXT NOT NULL,
        photo_id TEXT,
        photo_index INTEGER,
        photo_label TEXT,
        photo_url TEXT,
        image_url TEXT,
        created_at INTEGER NOT NULL
      )`,

      // 4. Event Meetings table
      `CREATE TABLE IF NOT EXISTS event_meetings (
        id TEXT PRIMARY KEY,
        event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
        client_id TEXT REFERENCES clients(id),
        title TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'google_meet',
        status TEXT NOT NULL DEFAULT 'agendada',
        start_date INTEGER NOT NULL,
        end_date INTEGER,
        location TEXT,
        meet_url TEXT,
        notes TEXT,
        host_user_id TEXT REFERENCES users(id),
        host_name TEXT DEFAULT 'Equipa CFM',
        client_contact_name TEXT,
        client_contact_email TEXT,
        client_contact_phone TEXT,
        source TEXT NOT NULL DEFAULT 'manual',
        calendly_uri TEXT,
        linked_event_row_id TEXT,
        meeting_summary TEXT,
        meeting_participants TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,

      // 5. Columns added to existing tables
      "ALTER TABLE event_tasks ADD COLUMN meeting_id TEXT",
      "ALTER TABLE event_meetings ADD COLUMN meeting_summary TEXT",
      "ALTER TABLE event_meetings ADD COLUMN meeting_participants TEXT",

      // 6. App Uploads Storage (for file uploads across serverless and local dev)
      `CREATE TABLE IF NOT EXISTS app_uploads (
        id TEXT PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        mime_type TEXT NOT NULL,
        data_base64 TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    ];

    for (const sql of migrationStatements) {
      try {
        await client.execute(sql);
      } catch (err: any) {
        // Ignore column already exists or table already exists
      }
    }

    // 6. Migrate any legacy meeting rows in `events` table to `event_meetings` and remove them from `events`
    try {
      const legacyRes = await client.execute(
        "SELECT * FROM events WHERE category = 'Reunião Calendly' OR calendly_event_uri IS NOT NULL"
      );
      for (const row of legacyRes.rows as any[]) {
        const meetingId = `mtg-${String(row.id).replace(/^evt-/, "")}`;
        const existingMtg = await client.execute({
          sql: "SELECT id FROM event_meetings WHERE id = ? OR calendly_uri = ?",
          args: [meetingId, row.calendly_event_uri || ""],
        });

        if (existingMtg.rows.length === 0) {
          await client.execute({
            sql: `INSERT INTO event_meetings (
              id, event_id, client_id, title, type, status, start_date, end_date, location,
              notes, source, calendly_uri, meeting_summary, meeting_participants, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'google_meet', 'agendada', ?, ?, ?, ?, 'calendly', ?, ?, ?, ?, ?)`,
            args: [
              meetingId,
              row.linked_event_id || null,
              row.client_id || null,
              row.name || "Reunião Calendly",
              row.start_date,
              row.end_date || null,
              row.venue || "Google Meet",
              row.notes || null,
              row.calendly_event_uri || null,
              row.meeting_summary || null,
              row.meeting_participants || null,
              row.created_at || Date.now(),
              row.updated_at || Date.now(),
            ],
          });
        }

        // Reassign any tasks linked to the legacy event to the meeting
        await client.execute({
          sql: "UPDATE event_tasks SET meeting_id = ?, event_id = NULL WHERE event_id = ?",
          args: [meetingId, row.id],
        });

        // Delete from events table so events contains ONLY production events
        await client.execute({
          sql: "DELETE FROM events WHERE id = ?",
          args: [row.id],
        });
      }
    } catch (e) {
      // Ignore if columns missing or already migrated
    }
  })();

  return migrationPromise;
}

// Automatically trigger migration on module load
ensureDbMigrated().catch(() => {});

