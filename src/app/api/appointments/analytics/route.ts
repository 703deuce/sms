import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadExtendedAppointmentsAnalytics } from "@/lib/appointments/analytics-reports";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const rangeRaw = Number(searchParams.get("range") || 7);
    const rangeDays = rangeRaw === 90 ? 90 : rangeRaw === 30 ? 30 : 7;
    const data = await loadExtendedAppointmentsAnalytics(
      auth.workspaceId,
      rangeDays as 7 | 30 | 90,
    );
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
