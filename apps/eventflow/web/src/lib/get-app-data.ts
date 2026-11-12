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
} from "@/db/schema";
import { desc, asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function getAppInitialData() {
  const currentUser = await getCurrentUser();

  const [
    allEvents,
    allItems,
    allClients,
    allQuotes,
    allMovements,
    allUsers,
    allLocations,
    allAllocations,
    templateRow,
  ] = await Promise.all([
    db.query.events.findMany({
      orderBy: [desc(events.startDate)],
    }),
    db.query.inventoryItems.findMany(),
    db.query.clients.findMany(),
    db.query.quotes.findMany({
      orderBy: [desc(quotes.createdAt)],
    }),
    db.query.financialMovements.findMany({
      orderBy: [desc(financialMovements.date)],
    }),
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users),
    db.query.storageLocations.findMany({
      orderBy: [asc(storageLocations.name)],
    }),
    db.query.eventAllocations.findMany(),
    db.query.quoteTemplates.findFirst(),
  ]);

  const template = templateRow || {
    companyName: "CFM EVENTOS",
    tagline: "Produção & Decoração de Eventos",
    contactInfo: "geral@cfmeventos.pt",
    paymentTerms: "50% adjudicação · 50% desmontagem",
    footerNotes: "Obrigado pela preferência.",
    brandColor: "#111111",
  };

  const { evaluateAndSyncAlerts } = await import("@/lib/alerts");
  const allAlerts = await evaluateAndSyncAlerts();

  return {
    currentUser,
    allEvents,
    allItems,
    allClients,
    allQuotes,
    allMovements,
    allUsers,
    allLocations,
    allAllocations,
    template,
    allAlerts,
  };
}
