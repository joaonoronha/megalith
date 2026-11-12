/**
 * Utility functions for events and meetings in CFM Events (EventFlow).
 *
 * Core Business Rules:
 * 1. Meetings (Calendly syncs, consultations, briefings) do NOT receive quotas/quotes.
 * 2. Only actual production events can get quotas/quotes.
 * 3. A quota must always be generated inside an event configuration, never outside of it.
 */

export interface EventLike {
  id?: string;
  name?: string | null;
  category?: string | null;
  theme?: string | null;
  calendlyEventUri?: string | null;
}

/**
 * Checks whether an event entity represents a meeting / briefing / Calendly consultation.
 */
export function isMeetingEvent(evt: EventLike | null | undefined): boolean {
  if (!evt) return false;
  return Boolean(
    evt.calendlyEventUri ||
    evt.category === "Reunião Calendly" ||
    evt.category === "Consulta / Briefing" ||
    (typeof evt.name === "string" && evt.name.toLowerCase().startsWith("reunião")) ||
    (typeof evt.theme === "string" && evt.theme.toLowerCase().includes("briefing"))
  );
}

/**
 * Validates if an event is eligible to receive commercial quotes / quotas.
 * Meetings are strictly ineligible; only production events can receive quotas.
 */
export function canEventReceiveQuote(evt: EventLike | null | undefined): boolean {
  if (!evt) return false;
  return !isMeetingEvent(evt);
}
