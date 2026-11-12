import { NextRequest, NextResponse } from "next/server";
import { pullCalendlyMeetings } from "@/lib/calendly-sync";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    let token: string | undefined;
    try {
      const body = await req.json();
      token = body?.token;
    } catch {
      // No JSON body
    }

    const result = await pullCalendlyMeetings(token);
    try {
      revalidatePath("/");
      revalidatePath("/calendario");
      revalidatePath("/calendar");
      revalidatePath("/eventos");
      revalidatePath("/events");
    } catch {}

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Sync failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const result = await pullCalendlyMeetings();
  try {
    revalidatePath("/");
    revalidatePath("/calendario");
    revalidatePath("/calendar");
    revalidatePath("/eventos");
    revalidatePath("/events");
  } catch {}
  return NextResponse.json(result);
}
