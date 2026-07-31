import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getAvailability, bookAppointment } from "@/lib/voice/calendar/booking";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const days = Number(new URL(request.url).searchParams.get("days") || 7);
    const result = await getAvailability(auth.workspaceId, { daysAhead: days });
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "availability");
    if (action === "book") {
      const result = await bookAppointment(auth.workspaceId, body);
      return NextResponse.json({ data: result });
    }
    const result = await getAvailability(auth.workspaceId, body);
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
