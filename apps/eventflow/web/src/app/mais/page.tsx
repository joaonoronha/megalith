import { getAppInitialData } from "@/lib/get-app-data";
import EventFlowApp from "@/components/EventFlowApp";

export const dynamic = "force-dynamic";

export default async function MaisPage() {
  const data = await getAppInitialData();

  return (
    <EventFlowApp
      currentUser={data.currentUser}
      initialUsers={data.allUsers}
      initialEvents={data.allEvents}
      initialItems={data.allItems}
      initialClients={data.allClients}
      initialQuotes={data.allQuotes}
      initialMovements={data.allMovements}
      initialTemplate={data.template}
      initialAlerts={data.allAlerts}
      initialTab="more"
    />
  );
}
