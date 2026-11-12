import { db } from "@/db/client";
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
  alerts,
} from "@/db/schema";
import { desc, asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function getAppInitialData() {
  let currentUser = null;
  try {
    currentUser = await getCurrentUser();
  } catch (err) {
    console.error("getAppInitialData: error resolving currentUser", err);
  }

  let allEvents: any[] = [];
  let allItems: any[] = [];
  let allClients: any[] = [];
  let allQuotes: any[] = [];
  let allMovements: any[] = [];
  let allUsers: any[] = [];
  let allLocations: any[] = [];
  let allAllocations: any[] = [];
  let templateRow: any = null;

  try {
    const results = await Promise.all([
      db.query.events.findMany({
        orderBy: [desc(events.startDate)],
      }).catch((e) => {
        console.error("getAppInitialData: error loading events", e);
        return [];
      }),
      db.query.inventoryItems.findMany().catch((e) => {
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
    ]);

    allEvents = results[0] || [];
    allItems = results[1] || [];
    allClients = results[2] || [];
    allQuotes = results[3] || [];
    allMovements = results[4] || [];
    allUsers = results[5] || [];
    allLocations = results[6] || [];
    allAllocations = results[7] || [];
    templateRow = results[8] || null;
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

  let allAlerts: any[] = [];
  try {
    const { evaluateAndSyncAlerts } = await import("@/lib/alerts");
    allAlerts = await evaluateAndSyncAlerts();
  } catch (err) {
    console.error("getAppInitialData: alerts sync error, reading alerts table directly", err);
    try {
      allAlerts = await db.query.alerts.findMany({
        orderBy: [desc(alerts.lastTriggeredAt)],
      });
    } catch {
      allAlerts = [];
    }
  }

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
    template,
    allAlerts: allAlerts || [],
  };
}
