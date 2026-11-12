import { db, ensureDbMigrated } from "@/db/client";
import { clients, events, integrations, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/id";

export interface CalendlySyncResult {
  success: boolean;
  count: number;
  message: string;
  meetings: Array<{
    id: string;
    name: string;
    clientName: string;
    startDate: string;
    endDate: string | null;
  }>;
}

export async function getCalendlyAccessToken(): Promise<string | null> {
  // 1. Check environment variable
  if (process.env.CALENDLY_ACCESS_TOKEN) {
    return process.env.CALENDLY_ACCESS_TOKEN;
  }

  // 2. Check integrations table
  try {
    const integration = await db.query.integrations.findFirst({
      where: eq(integrations.id, "calendly"),
    });

    if (integration?.accessToken) {
      if (integration.expiresAt && integration.refreshToken) {
        const expiresTime = new Date(integration.expiresAt).getTime();
        const now = Date.now();
        if (now + 5 * 60 * 1000 >= expiresTime) {
          const refreshed = await refreshCalendlyOAuthToken(integration.refreshToken);
          if (refreshed) return refreshed;
        }
      }
      return integration.accessToken;
    }
  } catch (err) {
    console.error("Error reading calendly integration:", err);
  }

  return null;
}

export async function refreshCalendlyOAuthToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.CALENDLY_CLIENT_ID;
  const clientSecret = process.env.CALENDLY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch("https://auth.calendly.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const expiresAt = new Date(Date.now() + (data.expires_in || 7200) * 1000);

    await db
      .update(integrations)
      .set({
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, "calendly"));

    return data.access_token;
  } catch (err) {
    console.error("Failed to refresh Calendly OAuth token:", err);
    return null;
  }
}

export async function pullCalendlyMeetings(overrideToken?: string): Promise<CalendlySyncResult> {
  await ensureDbMigrated().catch(() => {});

  const token = overrideToken?.trim() || (await getCalendlyAccessToken());
  if (!token) {
    return {
      success: false,
      count: 0,
      message:
        "Nenhum token de acesso Calendly configurado. Autorize a aplicação através do botão 'Ligar / Autorizar Calendly' ou insira um Personal Access Token.",
      meetings: [],
    };
  }

  try {
    // 1. Get current user
    const userRes = await fetch("https://api.calendly.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      return {
        success: false,
        count: 0,
        message: `Falha na autenticação com a Calendly (${userRes.status}): ${errText}`,
        meetings: [],
      };
    }

    const userData = await userRes.json();
    const userUri = userData.resource?.uri;
    const orgUri = userData.resource?.current_organization;
    const ownerName = userData.resource?.name || "Conta CFM";
    const ownerEmail = userData.resource?.email;

    // Save/update integration
    await db
      .insert(integrations)
      .values({
        id: "calendly",
        accessToken: token,
        userUri,
        organizationUri: orgUri,
        ownerName,
        ownerEmail,
        syncStatus: "syncing",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: integrations.id,
        set: {
          accessToken: token,
          userUri,
          organizationUri: orgUri,
          ownerName,
          ownerEmail,
          syncStatus: "syncing",
          updatedAt: new Date(),
        },
      });

    // 2. Fetch scheduled events
    const eventsUrl = new URL("https://api.calendly.com/scheduled_events");
    if (userUri) eventsUrl.searchParams.set("user", userUri);
    eventsUrl.searchParams.set("status", "active");
    eventsUrl.searchParams.set("count", "50");

    const eventsRes = await fetch(eventsUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!eventsRes.ok) {
      const errText = await eventsRes.text();
      return {
        success: false,
        count: 0,
        message: `Erro ao obter lista de reuniões da Calendly: ${errText}`,
        meetings: [],
      };
    }

    const eventsData = await eventsRes.json();
    const scheduledEvents = eventsData.collection || [];

    const syncedMeetings: Array<{
      id: string;
      name: string;
      clientName: string;
      startDate: string;
      endDate: string | null;
    }> = [];

    for (const calEvent of scheduledEvents) {
      const eventUri = calEvent.uri;
      const eventUuid = eventUri.split("/").pop();

      // Fetch invitees details
      let inviteeName = "Cliente Calendly";
      let inviteeEmail: string | null = null;
      let inviteePhone: string | null = null;
      let qaNotes = "";

      try {
        const inviteesRes = await fetch(
          `https://api.calendly.com/scheduled_events/${eventUuid}/invitees`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (inviteesRes.ok) {
          const inviteesData = await inviteesRes.json();
          const firstInvitee = inviteesData.collection?.[0];
          if (firstInvitee) {
            inviteeName = firstInvitee.name || inviteeName;
            inviteeEmail = firstInvitee.email?.toLowerCase().trim() || null;
            inviteePhone = firstInvitee.text_reminder_number || null;
            qaNotes = (firstInvitee.questions_and_answers || [])
              .map((qa: { question: string; answer: string }) => `• ${qa.question}: ${qa.answer}`)
              .join("\n");
          }
        }
      } catch (err) {
        console.warn("Could not fetch invitee details for event", eventUuid, err);
      }

      // Find or create client in CRM
      let clientId: string | null = null;
      if (inviteeEmail) {
        const existingClient = await db.query.clients.findFirst({
          where: eq(clients.email, inviteeEmail),
        });
        if (existingClient) {
          clientId = existingClient.id;
        }
      }

      if (!clientId) {
        clientId = generateId("cli");
        await db.insert(clients).values({
          id: clientId,
          name: inviteeName,
          contactName: inviteeName,
          email: inviteeEmail,
          phone: inviteePhone,
          notes: `Cliente registado automaticamente via reunião Calendly (${calEvent.name || "Consulta"})`,
          source: "calendly",
          createdAt: new Date(),
        });
      }

      // Check if event already exists
      const existingEvent = await db.query.events.findFirst({
        where: eq(events.calendlyEventUri, eventUri),
      });

      const startDate = new Date(calEvent.start_time);
      const endDate = calEvent.end_time ? new Date(calEvent.end_time) : null;
      const venue =
        calEvent.location?.location ||
        (calEvent.location?.type === "google_conference"
          ? "Google Meet (Reunião Online)"
          : calEvent.location?.type === "zoom"
          ? "Zoom (Reunião Online)"
          : "Consulta & Briefing CFM");

      const eventTitle = `Reunião: ${inviteeName} (${calEvent.name || "Briefing"})`;
      const notesContent = `Reunião marcada via Calendly para discutir evento/decoração.\n\nTipo: ${calEvent.name || "Consulta"}\nLocalização: ${venue}${qaNotes ? `\n\nRespostas do Cliente:\n${qaNotes}` : ""}`;

      let targetEventId: string;

      if (existingEvent) {
        targetEventId = existingEvent.id;
        await db
          .update(events)
          .set({
            name: eventTitle,
            startDate,
            endDate,
            venue,
            notes: notesContent,
            category: "Reunião Calendly",
            status: calEvent.status === "active" ? "planeamento" : "cancelado",
            updatedAt: new Date(),
          })
          .where(eq(events.id, existingEvent.id));
      } else {
        targetEventId = generateId("evt");
        await db.insert(events).values({
          id: targetEventId,
          name: eventTitle,
          clientId,
          startDate,
          endDate,
          venue,
          status: "planeamento",
          category: "Reunião Calendly",
          theme: "Briefing & Consulta de Evento",
          notes: notesContent,
          coverImageUrl:
            "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=600&q=80",
          calendlyEventUri: eventUri,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Audit log
        await db.insert(auditLogs).values({
          id: generateId("log"),
          entityType: "event",
          entityId: targetEventId,
          action: "criado",
          title: "Reunião Calendly Importada",
          details: `Reunião com ${inviteeName} importada automaticamente do Calendly.`,
          userName: "Sincronizador Calendly",
          createdAt: new Date(),
        });
      }

      syncedMeetings.push({
        id: targetEventId,
        name: eventTitle,
        clientName: inviteeName,
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : null,
      });
    }

    // Update integration status
    await db
      .update(integrations)
      .set({
        lastSyncedAt: new Date(),
        syncStatus: "success",
        syncError: null,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, "calendly"));

    return {
      success: true,
      count: syncedMeetings.length,
      message: `${syncedMeetings.length} reuniões importadas/sincronizadas da Calendly com sucesso!`,
      meetings: syncedMeetings,
    };
  } catch (err: any) {
    console.error("Calendly sync error:", err);
    await db
      .update(integrations)
      .set({
        syncStatus: "error",
        syncError: err?.message || String(err),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, "calendly"))
      .catch(() => {});

    return {
      success: false,
      count: 0,
      message: `Erro durante a sincronização: ${err?.message || String(err)}`,
      meetings: [],
    };
  }
}

/**
 * Synchronizes Calendly meetings if more than `maxAgeMs` (default 1 hour)
 * has passed since the last successful sync, or if it has never been synced yet.
 */
export async function syncCalendlyIfDue(maxAgeMs = 60 * 60 * 1000): Promise<CalendlySyncResult | null> {
  try {
    const token = await getCalendlyAccessToken();
    if (!token) return null;

    const integration = await db.query.integrations.findFirst({
      where: eq(integrations.id, "calendly"),
    });

    if (integration?.lastSyncedAt) {
      const lastSyncTime = new Date(integration.lastSyncedAt).getTime();
      const elapsed = Date.now() - lastSyncTime;
      if (elapsed < maxAgeMs) {
        // Still fresh (within 1 hour)
        return null;
      }
    }

    return await pullCalendlyMeetings(token);
  } catch (err) {
    console.warn("syncCalendlyIfDue error:", err);
    return null;
  }
}
