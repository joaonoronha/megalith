import { NextResponse } from "next/server";
import { db, ensureDbMigrated } from "@/db/client";
import { inventoryItems } from "@/db/schema";
import { or, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDbMigrated();

    const tintaItem = await db.query.inventoryItems.findFirst({
      where: or(
        sql`${inventoryItems.name} LIKE '%Tinta%primário%'`,
        sql`${inventoryItems.name} LIKE '%Tinta%primario%'`,
        sql`${inventoryItems.sku} LIKE 'TINTA-PRIMARIO%'`
      ),
    });

    return NextResponse.json({
      success: true,
      message: "Database schema and data successfully migrated.",
      tintaItem: tintaItem
        ? {
            id: tintaItem.id,
            name: tintaItem.name,
            sku: tintaItem.sku,
            barcode: tintaItem.barcode,
          }
        : null,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
