/**
 * Utility functions for events and meetings in CFM Events (EventFlow).
 *
 * Core Business Rules:
 * 1. Meetings (Calendly syncs, consultations, briefings) do NOT receive quotas/quotes.
 * 2. Only actual production events can get quotas/quotes.
 * 3. A quota must always be generated inside an event configuration, never outside of it.
 * 4. Cancelled events do NOT count for the finance part (projected pipeline, margin, profit, or cash flow projections).
 */

export interface EventLike {
  id?: string;
  name?: string | null;
  category?: string | null;
  theme?: string | null;
  status?: string | null;
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

/**
 * Checks whether an event entity has been cancelled.
 * Cancelled events must not count towards financial reporting, profitability, or projected cash flows.
 */
export function isCancelledEvent(evt: EventLike | null | undefined): boolean {
  if (!evt) return false;
  const status = String(evt.status || "").toLowerCase().trim();
  return (
    status === "cancelado" ||
    status === "cancelada" ||
    status === "cancelled" ||
    status === "canceled"
  );
}

/**
 * Validates whether an event should count in financial totals and projections.
 * Must be a real production event (not a meeting) and not cancelled.
 */
export function countsForFinance(evt: EventLike | null | undefined): boolean {
  if (!evt) return false;
  return !isMeetingEvent(evt) && !isCancelledEvent(evt);
}

/**
 * Curated high-resolution Unsplash event cover photos for CFM Events.
 */
export const EVENT_COVER_IMAGES = [
  "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80", // Casamento jardim
  "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80", // Gala corporativa e iluminação
  "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=80", // Jantar elegante / receção
  "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1200&q=80", // Aniversário / balões festivos
  "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80", // Festa com luzes ao ar livre
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80", // Celebração de palco & iluminação
  "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80", // Conferência & evento corporativo
  "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80", // Cocktail & celebração social
  "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=80", // Banquete sofisticado
  "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1200&q=80", // Flores e decoração elegante
  "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=1200&q=80", // Casamento / pôr-do-sol
  "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1200&q=80", // Celebração ao ar livre
  "https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80", // Pista de dança & festa
  "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80", // Casamento romântico
];

/**
 * Returns a random event-related cover image, optionally tuned by event category.
 */
export function getRandomEventCoverImage(category?: string | null): string {
  const cat = (category || "").toLowerCase().trim();
  if (cat.includes("infantil") || cat.includes("aniversário") || cat.includes("aniversario")) {
    const birthdayPool = [
      "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=1200&q=80",
    ];
    return birthdayPool[Math.floor(Math.random() * birthdayPool.length)];
  }
  if (cat.includes("casamento") || cat.includes("batizado")) {
    const weddingPool = [
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80",
    ];
    return weddingPool[Math.floor(Math.random() * weddingPool.length)];
  }
  if (cat.includes("gala") || cat.includes("corporativ") || cat.includes("marca")) {
    const corporatePool = [
      "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=80",
    ];
    return corporatePool[Math.floor(Math.random() * corporatePool.length)];
  }
  return EVENT_COVER_IMAGES[Math.floor(Math.random() * EVENT_COVER_IMAGES.length)];
}

/**
 * Parses and returns the color themes for an event.
 * Falls back to category presets or brand palette if none provided.
 */
export function getEventThemeColors(vibeColors: string | null | undefined, category?: string | null): string[] {
  try {
    if (vibeColors) {
      const parsed = typeof vibeColors === "string" ? JSON.parse(vibeColors) : vibeColors;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter((c) => typeof c === "string" && (c.startsWith("#") || c.startsWith("rgb")));
        if (valid.length > 0) return valid;
      }
    }
  } catch {}

  const cat = (category || "").toLowerCase().trim();
  if (cat.includes("casamento")) return ["#C97A63", "#E3C9B8", "#687B65", "#FAF6F0"];
  if (cat.includes("gala")) return ["#111111", "#D4AF37", "#2C3E50", "#E0E0E0"];
  if (cat.includes("aniversário") || cat.includes("aniversario") || cat.includes("infantil")) {
    return ["#F5A623", "#D32F2F", "#5C7658", "#FFF8DC"];
  }
  if (cat.includes("jantar") || cat.includes("marca")) return ["#B76E79", "#2E151B", "#E8D8D8", "#C0C0C0"];
  if (cat.includes("batizado")) return ["#FFFFFF", "#EEDC82", "#A0C4DF"];
  return ["#007AFF", "#5856D6", "#FF9500", "#34C759"];
}
