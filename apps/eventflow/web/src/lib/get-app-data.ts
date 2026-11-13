import { db, ensureDbMigrated } from "@/db/client";
import {
  events,
  inventoryItems,
  clients,
  quotes,
  financialMovements,
  quoteTemplates,
  storageLocations,
  users,
  eventAllocations,
  eventCustomItems,
  eventMeetings,
  alerts,
} from "@/db/schema";
import { desc, asc, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function getAppInitialData() {
  await ensureDbMigrated().catch(() => {});

  // Trigger non-blocking background tasks so SSR is completely instantaneous
  import("@/lib/calendly-sync")
    .then(({ syncCalendlyIfDue }) => syncCalendlyIfDue())
    .catch((e) => console.error("getAppInitialData: background Calendly sync error", e));

  import("@/lib/alerts")
    .then(({ evaluateAndSyncAlerts }) => evaluateAndSyncAlerts())
    .catch((e) => console.error("getAppInitialData: background alerts sync error", e));

  let currentUser = null;
  let allEvents: any[] = [];
  let allItems: any[] = [];
  let allClients: any[] = [];
  let allQuotes: any[] = [];
  let allMovements: any[] = [];
  let allUsers: any[] = [];
  let allLocations: any[] = [];
  let allAllocations: any[] = [];
  let allCustomItems: any[] = [];
  let allMeetings: any[] = [];
  let templateRow: any = null;
  let allAlerts: any[] = [];

  try {
    const results = await Promise.all([
      db.query.events.findMany({
        orderBy: [desc(events.startDate)],
      }).catch((e) => {
        console.error("getAppInitialData: error loading events", e);
        return [];
      }),
      db.query.inventoryItems.findMany({
        where: isNull(inventoryItems.deletedAt),
      }).catch((e) => {
        console.error("getAppInitialData: error loading items", e);
        return [];
      }),
      db.query.clients.findMany().catch((e) => {
        console.error("getAppInitialData: error loading clients", e);
        return [];
      }),
      db.query.quotes.findMany({
        orderBy: [desc(quotes.createdAt)],
      }).catch((e) => {
        console.error("getAppInitialData: error loading quotes", e);
        return [];
      }),
      db.query.financialMovements.findMany({
        orderBy: [desc(financialMovements.date)],
      }).catch((e) => {
        console.error("getAppInitialData: error loading movements", e);
        return [];
      }),
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .catch((e) => {
          console.error("getAppInitialData: error loading users", e);
          return [];
        }),
      db.query.storageLocations.findMany({
        orderBy: [asc(storageLocations.name)],
      }).catch((e) => {
        console.error("getAppInitialData: error loading locations", e);
        return [];
      }),
      db.query.eventAllocations.findMany().catch((e) => {
        console.error("getAppInitialData: error loading allocations", e);
        return [];
      }),
      db.query.quoteTemplates.findFirst().catch((e) => {
        console.error("getAppInitialData: error loading template", e);
        return null;
      }),
      db.query.eventMeetings.findMany({
        orderBy: [asc(eventMeetings.startDate)],
      }).catch((e) => {
        console.error("getAppInitialData: error loading meetings", e);
        return [];
      }),
      db.query.eventCustomItems.findMany().catch((e) => {
        console.error("getAppInitialData: error loading custom items", e);
        return [];
      }),
      db.query.alerts.findMany({
        orderBy: [desc(alerts.lastTriggeredAt)],
        limit: 50,
      }).catch((e) => {
        console.error("getAppInitialData: error loading alerts", e);
        return [];
      }),
      getCurrentUser().catch((e) => {
        console.error("getAppInitialData: error loading currentUser", e);
        return null;
      }),
    ]);

    allEvents = (results[0] || []).filter(
      (e: any) => e.category !== "Reunião Calendly" && !e.calendlyEventUri
    );
    allItems = results[1] || [];
    allClients = results[2] || [];
    allQuotes = results[3] || [];
    allMovements = results[4] || [];
    allUsers = results[5] || [];
    allLocations = results[6] || [];
    allAllocations = results[7] || [];
    templateRow = results[8] || null;
    allMeetings = results[9] || [];
    allCustomItems = results[10] || [];
    allAlerts = results[11] || [];
    currentUser = results[12] || null;
  } catch (err) {
    console.error("getAppInitialData: bulk query error", err);
  }

  const template = templateRow || {
    companyName: "CFM EVENTS",
    tagline: "Produção & Decoração de Eventos",
    contactInfo: "geral@cfmeventos.pt",
    paymentTerms: "50% adjudicação · 50% desmontagem",
    footerNotes: "Obrigado pela preferência.",
    brandColor: "#111111",
  };

  return {
    currentUser,
    allEvents: allEvents || [],
    allItems: allItems || [],
    allClients: allClients || [],
    allQuotes: allQuotes || [],
    allMovements: allMovements || [],
    allUsers: allUsers || [],
    allLocations: allLocations || [],
    allAllocations: allAllocations || [],
    allCustomItems: allCustomItems || [],
    allMeetings: allMeetings || [],
    template,
    allAlerts: allAlerts || [],
  };
}
