import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { matchWaitlistEntriesForCalendarSlot } from "@/lib/appointments/calendar-waitlist-slot-match";

export async function GET(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.read");
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const startsAt = searchParams.get("startsAt");
    if (!startsAt) {
      return NextResponse.json({ error: "startsAt required" }, { status: 400 });
    }
    const matches = await matchWaitlistEntriesForCalendarSlot({
      workspaceId: auth.workspaceId,
      startsAt,
      endsAt: searchParams.get("endsAt") || undefined,
      serviceName: searchParams.get("serviceName") || undefined,
      serviceId: searchParams.get("serviceId") || undefined,
      staffId: searchParams.get("staffId") || undefined,
      locationId: searchParams.get("locationId") || undefined,
    });
    return NextResponse.json({ data: { count: matches.length, matches } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
