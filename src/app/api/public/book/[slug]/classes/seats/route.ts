import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { resolveWorkspaceBySlug, loadAppointmentPlatformConfig } from "@/lib/appointments";
import { getSeatMapWithAvailability, listSeatMaps } from "@/lib/appointments/service-booking/phase2";

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const config = await loadAppointmentPlatformConfig(workspace.id);
    if (!config.bookingEnabled) {
      return NextResponse.json({ error: "Booking disabled" }, { status: 403 });
    }

    const url = new URL(request.url);
    const occurrenceId = url.searchParams.get("occurrenceId");
    const seatMapId = url.searchParams.get("seatMapId");

    if (seatMapId) {
      const map = await getSeatMapWithAvailability(workspace.id, seatMapId);
      return NextResponse.json({ data: map });
    }

    if (!occurrenceId) {
      return NextResponse.json({ error: "occurrenceId or seatMapId required" }, { status: 400 });
    }

    const maps = await listSeatMaps(workspace.id, { occurrenceId });
    const active = maps.find((m: { active: boolean }) => m.active) || maps[0];
    if (!active) {
      return NextResponse.json({ data: null });
    }

    const map = await getSeatMapWithAvailability(workspace.id, active.id);
    return NextResponse.json({ data: map });
  } catch (err) {
    return jsonError(err, 500);
  }
}
