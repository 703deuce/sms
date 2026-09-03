import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadAppointmentsAnalytics } from "@/lib/appointments";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const rangeRaw = Number(searchParams.get("range") || 7);
    const rangeDays = rangeRaw === 30 ? 30 : 7;
    const data = await loadAppointmentsAnalytics(auth.workspaceId, rangeDays);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
