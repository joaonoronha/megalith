/**
 * Client-safe date formatting utilities for CFM Eventos
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
