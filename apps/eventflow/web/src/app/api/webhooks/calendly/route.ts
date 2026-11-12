import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { clients, events } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { generateId } from "@/lib/id";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "CFM EventFlow Calendly Webhook endpoint is active and awaiting events.",
    endpoint: "/api/webhooks/calendly",
  });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("calendly-webhook-signature");
    const secret = process.env.CALENDLY_WEBHOOK_SECRET;

    // Verify webhook signature if secret configured
    if (secret && signature) {
      const parts = signature.split(",");
      const t = parts.find((p) => p.startsWith("t="))?.replace("t=", "");
      const v1 = parts.find((p) => p.startsWith("v1="))?.replace("v1=", "");
      if (t && v1) {
        const expectedSig = crypto
          .createHmac("sha256", secret)
          .update(`${t}.${rawBody}`)
          .digest("hex");
        if (expectedSig !== v1) {
          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
      }
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event; // "invitee.created" | "invitee.canceled"
    const data = payload.payload;

    if (eventType === "invitee.created") {
      const inviteeEmail = data.email?.toLowerCase().trim();
      const inviteeName = data.name || "Novo Cliente";
      const inviteePhone = data.text_reminder_number || null;
      const scheduledEvent = data.scheduled_event || {};
      const meetingStart = scheduledEvent.start_time ? new Date(scheduledEvent.start_time) : new Date();
      const meetingEnd = scheduledEvent.end_time ? new Date(scheduledEvent.end_time) : null;
      const meetingName = scheduledEvent.name || "Consulta / Briefing";

      // Format custom Q&A answers from Calendly booking form
      const qaNotes = (data.questions_and_answers || [])
        .map((qa: { question: string; answer: string }) => `• ${qa.question}: ${qa.answer}`)
        .join("\n");

      // 1. Find or create client
      let existingClient = inviteeEmail
        ? await db.query.clients.findFirst({
            where: eq(clients.email, inviteeEmail),
          })
        : null;

      let clientId = existingClient?.id;

      if (!clientId) {
        clientId = generateId("cli");
        await db.insert(clients).values({
          id: clientId,
          name: inviteeName,
          contactName: inviteeName,
          email: inviteeEmail,
          phone: inviteePhone,
          notes: `Lead criado automaticamente via Calendly (${meetingName})`,
          source: "calendly",
          createdAt: new Date(),
        });
      }

      // 2. Create Event in "Planeamento" stage
      const eventId = generateId("evt");
      await db.insert(events).values({
        id: eventId,
        name: `${inviteeName} · ${meetingName}`,
        clientId: clientId,
        venue: scheduledEvent.location?.location || "Reunião de Briefing",
        startDate: meetingStart,
        endDate: meetingEnd,
        status: "planeamento",
        category: "Reunião Calendly",
        theme: "Briefing & Consulta de Evento",
        notes: `Agendado via Calendly.\n${qaNotes}`,
        calendlyEventUri: data.event,
        createdAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        message: "Client and event created from Calendly booking",
        clientId,
        eventId,
      });
    }

    if (eventType === "invitee.canceled") {
      const eventUri = data.event;
      if (eventUri) {
        await db
          .update(events)
          .set({ status: "cancelado", notes: "Cancelado via Calendly." })
          .where(eq(events.calendlyEventUri, eventUri));
      }
      return NextResponse.json({ success: true, message: "Event cancelled" });
    }

    return NextResponse.json({ success: true, message: `Ignored event: ${eventType}` });
  } catch (error) {
    console.error("Calendly webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
