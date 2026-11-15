export interface ClientBoundEvent {
  id: string;
  name: string;
  clientId?: string | null;
  status?: string;
}

export interface ClientDeletionWarningInfo {
  hasBoundEvents: boolean;
  boundEventsCount: number;
  boundEvents: ClientBoundEvent[];
  specificEventName?: string;
  headline: string;
  detail: string;
}

/**
 * Returns all events where the given client is assigned.
 */
export function getClientBoundEvents(
  clientId: string,
  eventsList: ClientBoundEvent[]
): ClientBoundEvent[] {
  if (!clientId || !Array.isArray(eventsList)) return [];
  return eventsList.filter((e) => e && e.clientId === clientId);
}

/**
 * Generates clear, user-facing warning copy when deleting a customer.
 * If the customer is assigned to one or more events, explains the exact event(s)
 * they are bound to and that deleting will unbind them from the event(s).
 */
export function formatClientDeletionWarning(
  clientName: string,
  boundEvents: ClientBoundEvent[]
): ClientDeletionWarningInfo {
  const safeName = clientName?.trim() || "o cliente";
  const count = boundEvents.length;

  if (count === 0) {
    return {
      hasBoundEvents: false,
      boundEventsCount: 0,
      boundEvents: [],
      headline: `Eliminar ${safeName}`,
      detail: `Tens a certeza de que desejas eliminar ${safeName}? Esta ação é permanente e não pode ser revertida.`,
    };
  }

  if (count === 1) {
    const eventName = boundEvents[0].name || "Evento sem nome";
    return {
      hasBoundEvents: true,
      boundEventsCount: 1,
      boundEvents,
      specificEventName: eventName,
      headline: `Atenção: Cliente associado a evento`,
      detail: `Este cliente está atualmente associado ao evento "${eventName}". Ao eliminar ${safeName}, o cliente será removido da base de contactos e desvinculado do evento, mantendo os dados da produção intactos.`,
    };
  }

  const eventNames = boundEvents.map((e) => `"${e.name || "Evento"}"`).join(", ");
  return {
    hasBoundEvents: true,
    boundEventsCount: count,
    boundEvents,
    specificEventName: boundEvents[0].name,
    headline: `Atenção: Cliente associado a ${count} eventos`,
    detail: `Este cliente está atualmente associado a ${count} eventos: ${eventNames}. Ao eliminar ${safeName}, o cliente será desvinculado destes eventos, mantendo o histórico de produção intacto.`,
  };
}
