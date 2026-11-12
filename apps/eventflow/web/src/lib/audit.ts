import { db } from "@/db/client";
import { auditLogs, events, inventoryItems, quotes } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { generateId } from "@/lib/id";

export interface RecordAuditParams {
  entityType: "event" | "inventory" | "quote" | "user";
  entityId: string;
  action:
    | "criado"
    | "atualizado"
    | "alterou_estado"
    | "triagem"
    | "alocou_material"
    | "removeu_material"
    | "tarefa"
    | "aprovado"
    | string;
  title: string;
  details?: string;
  changes?: Record<string, any> | string;
  userOverride?: {
    id?: string;
    name: string;
    email?: string;
    role?: string;
  };
}

/**
 * Record an audit log entry and update the entity's `updatedAt` and `lastUpdatedByName`.
 */
export async function recordAuditLog(params: RecordAuditParams) {
  try {
    const currentUser = params.userOverride || (await getCurrentUser());
    const userName = currentUser?.name || "Administrador CFM";
    const userId = currentUser?.id || null;
    const userEmail = currentUser?.email || "admin@cfmeventos.pt";
    const userRole = currentUser?.role || "admin";

    const now = new Date();
    const logId = generateId("log");

    const changesStr =
      typeof params.changes === "object"
        ? JSON.stringify(params.changes)
        : params.changes || null;

    // 1. Insert audit log
    await db.insert(auditLogs).values({
      id: logId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      title: params.title,
      details: params.details || null,
      userId,
      userName,
      userEmail,
      userRole,
      changes: changesStr,
      createdAt: now,
    });

    // 2. Update entity's last updated metadata
    if (params.entityType === "event") {
      await db
        .update(events)
        .set({
          updatedAt: now,
          lastUpdatedByUserId: userId,
          lastUpdatedByName: userName,
        })
        .where(eq(events.id, params.entityId));
    } else if (params.entityType === "inventory") {
      await db
        .update(inventoryItems)
        .set({
          updatedAt: now,
          lastUpdatedByUserId: userId,
          lastUpdatedByName: userName,
        })
        .where(eq(inventoryItems.id, params.entityId));
    } else if (params.entityType === "quote") {
      await db
        .update(quotes)
        .set({
          updatedAt: now,
          lastUpdatedByUserId: userId,
          lastUpdatedByName: userName,
        })
        .where(eq(quotes.id, params.entityId));
    }

    return { success: true, logId };
  } catch (err) {
    console.error("Failed to record audit log:", err);
    return { success: false, error: err };
  }
}

/**
 * Retrieve all audit logs for a specific entity, ordered from most recent to oldest.
 */
export async function getAuditLogsForEntity(
  entityType: "event" | "inventory" | "quote",
  entityId: string
) {
  return await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
    .orderBy(desc(auditLogs.createdAt));
}

/**
 * Retrieve recent audit logs across the application.
 */
export async function getRecentAuditLogs(limit: number = 30) {
  return await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

export { formatRelativeTime, formatAuditDate } from "./date-format";
