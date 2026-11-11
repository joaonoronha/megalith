import { db } from "@/db/client";
import {
  events,
  inventoryItems,
  clients,
  quotes,
  financialMovements,
  quoteTemplates,
} from "@/db/schema";
import { desc } from "drizzle-orm";
import EventFlowApp from "@/components/EventFlowApp";

export const dynamic = "force-dynamic";

export default async function HomePage() {
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
  const template = (await db.query.quoteTemplates.findFirst()) || {
    companyName: "CFM EVENTOS",
    tagline: "Produção & Decoração de Eventos",
    contactInfo: "geral@cfmeventos.pt",
    paymentTerms: "50% adjudicação · 50% desmontagem",
    footerNotes: "Obrigado pela preferência.",
    brandColor: "#111111",
  };

  return (
    <EventFlowApp
      initialEvents={allEvents}
      initialItems={allItems}
      initialClients={allClients}
      initialQuotes={allQuotes}
      initialMovements={allMovements}
      initialTemplate={template}
    />
  );
}
