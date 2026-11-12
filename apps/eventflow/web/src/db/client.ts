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

      // 2. Event Media comments column
      "ALTER TABLE event_media ADD COLUMN comments TEXT",

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
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    ];

    for (const sql of migrationStatements) {
      try {
        await client.execute(sql);
      } catch (err: any) {
        // Ignore column already exists or table already exists
      }
    }
  })();

  return migrationPromise;
}

// Automatically trigger migration on module load
ensureDbMigrated().catch(() => {});

