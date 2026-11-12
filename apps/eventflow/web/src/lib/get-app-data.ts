import { db } from "@/db/client";
import {
  events,
  inventoryItems,
  clients,
  quotes,
  financialMovements,
  quoteTemplates,
  users,
} from "@/db/schema";
import { desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function getAppInitialData() {
  const currentUser = await getCurrentUser();

  const allEvents = await db.query.events.findMany({
    orderBy: [desc(events.startDate)],
  });

  const allItems = await db.query.inventoryItems.findMany();
  const allClients = await db.query.clients.findMany();
  const allQuotes = await db.query.quotes.findMany({
    orderBy: [desc(quotes.createdAt)],
  });
  const allMovements = await db.query.financialMovements.findMany({
    orderBy: [desc(financialMovements.date)],
  });
  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users);

  const template = (await db.query.quoteTemplates.findFirst()) || {
    companyName: "CFM EVENTOS",
    tagline: "Produção & Decoração de Eventos",
    contactInfo: "geral@cfmeventos.pt",
    paymentTerms: "50% adjudicação · 50% desmontagem",
    footerNotes: "Obrigado pela preferência.",
    brandColor: "#111111",
  };

  return {
    currentUser,
    allEvents,
    allItems,
    allClients,
    allQuotes,
    allMovements,
    allUsers,
    template,
  };
}
