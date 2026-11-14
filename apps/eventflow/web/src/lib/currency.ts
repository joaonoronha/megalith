/**
 * Currency input & formatting helpers for EventFlow / CFM Events.
 *
 * Implements standard Portuguese currency formatting (valor€, comma separator)
 * with cent-shift typing behavior (e.g. typing 129 produces 1,29€; typing 12900 produces 129,00€).
 */

export function formatCurrencyPt(euros: number): string {
  const safe = Number.isFinite(euros) && euros >= 0 ? euros : 0;
  return safe.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function eurosToCents(euros: number): number {
  return Math.max(0, Math.round((euros || 0) * 100));
}

export function centsToEuros(cents: number): number {
  return Math.max(0, Math.floor(cents || 0)) / 100;
}

export function applyCurrencyKeyPress(
  currentCents: number,
  key: string,
  isAllSelected: boolean = false
): number | null {
  if (key >= "0" && key <= "9") {
    const digit = parseInt(key, 10);
    const newCents = isAllSelected ? digit : currentCents * 10 + digit;
    // Cap at 999,999.99€ to prevent overflow
    return newCents <= 99999999 ? newCents : currentCents;
  }
  if (key === "Backspace") {
    return isAllSelected ? 0 : Math.floor(currentCents / 10);
  }
  if (key === "Delete") {
    return 0;
  }
  return null;
}

export function parsePastedCurrency(pastedText: string): number {
  const trimmed = (pastedText || "").trim();
  if (!trimmed) return 0;

  // If decimal separator (, or .) is present, parse as float (euros)
  if (trimmed.includes(",") || trimmed.includes(".")) {
    const normalized = trimmed.replace(/[^\d.,]/g, "").replace(",", ".");
    const num = parseFloat(normalized);
    if (!isNaN(num) && num >= 0) {
      return eurosToCents(num);
    }
  }

  // Pure digits (e.g. "129" -> 129 cents = 1.29€)
  const digits = trimmed.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}
