import crypto from "crypto";

export type EntityPrefix =
  | "evt"  // Events
  | "usr"  // Users
  | "itm"  // Inventory Items
  | "cli"  // Clients
  | "qte"  // Quotes
  | "ql"   // Quote Lines
  | "mov"  // Financial Movements
  | "alc"  // Event Allocations
  | "tsk"  // Event Tasks / Checklist
  | "doc"  // Documents
  | "tpl"  // Templates
  | "med"  // Media items / Photos
  | "alt"  // Alerts
  | "loc"  // Storage Locations
  | "log"; // Audit Logs

/**
 * Generates a collision-proof unique identifier with a standard entity prefix.
 * Example outputs:
 * - generateId("evt") -> "evt_7f8a9b1c2d3e"
 * - generateId("usr") -> "usr_4a2d8e6f1c90"
 * - generateId("itm") -> "itm_3e5c7a1b9f2d"
 */
export function generateId(prefix: EntityPrefix): string {
  // 6 random bytes = 12 hex characters (281 trillion possibilities), collision-proof
  const randomHex = crypto.randomBytes(6).toString("hex");
  return `${prefix}_${randomHex}`;
}

/**
 * Generates a human-friendly reference number (e.g. for quotes or formal tickets)
 * Example: generateReferenceCode("EVT", 2026) -> "EVT-2026-842"
 */
export function generateReferenceCode(prefix: string, year: number = new Date().getFullYear()): string {
  const randomPart = Math.floor(1000 + Math.random() * 9000); // 4 digits
  return `${prefix.toUpperCase()}-${year}-${randomPart}`;
}

/**
 * Formats or slugifies a user-provided custom ID (e.g. "Winnie the Pooh" -> "evt-winnie-the-pooh")
 */
export function formatCustomId(prefix: EntityPrefix, rawInput: string): string {
  const clean = rawInput
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!clean) return generateId(prefix);
  return clean.startsWith(`${prefix}-`) || clean.startsWith(`${prefix}_`)
    ? clean
    : `${prefix}-${clean}`;
}
