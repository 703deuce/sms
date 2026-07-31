import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { getAvailability, bookAppointment } from "@/lib/voice/calendar/booking";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const rows = await getPrisma().voiceCalendarConnection.findMany({
      where: { workspaceId: auth.workspaceId },
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      name?: string;
      provider?: string;
      config?: Record<string, unknown>;
    };
    const row = await getPrisma().voiceCalendarConnection.create({
      data: {
        workspaceId: auth.workspaceId,
        name: body.name || "Calendar",
        provider: body.provider || "internal",
        config: body.config || {},
        status: body.provider === "google" || body.provider === "microsoft" ? "pending_oauth" : "connected",
      },
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
