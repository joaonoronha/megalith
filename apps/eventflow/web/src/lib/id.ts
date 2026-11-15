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
  | "eci"  // Event Custom Items (Bespoke items specific to 1 event)
  | "tsk"  // Event Tasks / Checklist
  | "doc"  // Documents
  | "tpl"  // Templates
  | "med"  // Media items / Photos
  | "alt"  // Alerts
  | "loc"  // Storage Locations
  | "f"    // Uploaded Files
  | "img"  // Staged / Nested Media Images
  | "mtg"  // Event Meetings (Google Meet / In Person)
  | "cmt"  // Moodboard Comments & Notes
  | "mbw"  // Moodboard Watchers
  | "upl"  // App Uploads Storage
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

/**
 * Resolves the SKU for an inventory item:
 * - If an explicit SKU is provided (from barcode scan or user input), preserves it directly without sluggification.
 * - If a barcode is provided and no SKU is given, uses the barcode directly as the SKU without sluggification.
 * - Only if neither SKU nor barcode is provided, falls back to sluggifying the item name.
 */
export function determineItemSku(params: {
  sku?: string | null;
  barcode?: string | null;
  name?: string | null;
}): string {
  const cleanSku = (params.sku || "").trim();
  if (cleanSku) {
    return cleanSku.toUpperCase();
  }

  const cleanBarcode = (params.barcode || "").trim();
  if (cleanBarcode) {
    return cleanBarcode.toUpperCase();
  }

  const cleanName = (params.name || "").trim();
  if (cleanName) {
    const baseSlug = cleanName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toUpperCase();
    return baseSlug || `ART-${Date.now()}`;
  }

  return `ART-${Date.now()}`;
}
