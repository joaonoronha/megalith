/**
 * Client-safe date formatting utilities for CFM Events
 */

export function formatRelativeTime(
  dateInput: Date | number | string | null | undefined,
  locale: "pt" | "en" = "pt"
): string {
  if (!dateInput) {
    return locale === "pt" ? "recentemente" : "recently";
  }

  const date = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return locale === "pt" ? "há instantes" : "just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    if (diffInMinutes === 1) {
      return locale === "pt" ? "há 1 minuto" : "1 minute ago";
    }
    return locale === "pt" ? `há ${diffInMinutes} minutos` : `${diffInMinutes} minutes ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    if (diffInHours === 1) {
      return locale === "pt" ? "há 1 hora" : "1 hour ago";
    }
    return locale === "pt" ? `há ${diffInHours} horas` : `${diffInHours} hours ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    return locale === "pt" ? "ontem" : "yesterday";
  }
  if (diffInDays < 7) {
    return locale === "pt" ? `há ${diffInDays} dias` : `${diffInDays} days ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    if (diffInWeeks === 1) {
      return locale === "pt" ? "há 1 semana" : "1 week ago";
    }
    return locale === "pt" ? `há ${diffInWeeks} semanas` : `${diffInWeeks} weeks ago`;
  }

  return formatAuditDate(date);
}

export function formatAuditDate(dateInput: Date | number | string): string {
  const date = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  const months = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${hours}:${minutes} · ${day} ${month} ${year}`;
}

export function formatUpcomingTime(dateInput: Date | number | string | null | undefined): string {
  if (!dateInput) return "";
  const date = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    const pastDays = Math.abs(diffDays);
    if (pastDays === 0) return "Hoje (anterior)";
    if (pastDays === 1) return "Ontem";
    return `Há ${pastDays} dias`;
  }

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Amanhã";
  if (diffDays < 7) return `Em ${diffDays} dias`;
  if (diffDays < 30) {
    const weeks = Math.round(diffDays / 7);
    return `Em ${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
  }
  return `Em ${Math.round(diffDays / 30)} meses`;
}

export function formatMeetingRange(
  startInput: Date | string | number | null | undefined,
  endInput?: Date | string | number | null
): string {
  if (!startInput) return "";
  const start = typeof startInput === "object" ? startInput : new Date(startInput);
  const startHours = String(start.getHours()).padStart(2, "0");
  const startMinutes = String(start.getMinutes()).padStart(2, "0");

  const months = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  const day = start.getDate();
  const month = months[start.getMonth()];
  const year = start.getFullYear();

  if (!endInput) {
    return `${day} ${month} ${year} · ${startHours}:${startMinutes}`;
  }

  const end = typeof endInput === "object" ? endInput : new Date(endInput);
  const endHours = String(end.getHours()).padStart(2, "0");
  const endMinutes = String(end.getMinutes()).padStart(2, "0");

  const durationMin = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  const durationText = durationMin > 0 ? ` (${durationMin} min)` : "";

  return `${day} ${month} ${year} · ${startHours}:${startMinutes} - ${endHours}:${endMinutes}${durationText}`;
}
