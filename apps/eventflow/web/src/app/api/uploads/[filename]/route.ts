import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { db, ensureDbMigrated } from "@/db/client";
import { appUploads } from "@/db/schema";
import { eq } from "drizzle-orm";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await context.params;

    // Prevent path traversal
    const safeFilename = path.basename(filename);

    // 1. Check local disk cache (fast in local development)
    try {
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      const filePath = path.join(uploadsDir, safeFilename);
      const fileBuffer = await fs.readFile(filePath);
      const ext = path.extname(safeFilename).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      // Not on disk or read-only serverless filesystem, check database
    }

    // 2. Fetch from persistent Turso database
    await ensureDbMigrated();
    const [record] = await db
      .select()
      .from(appUploads)
      .where(eq(appUploads.filename, safeFilename));

    if (record && record.dataBase64) {
      const fileBuffer = Buffer.from(record.dataBase64, "base64");
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": record.mimeType || "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return NextResponse.json({ error: "File not found" }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
