import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadAppointmentBookingAgent } from "@/lib/agents/appointment-booking/load-agent";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const data = await loadAppointmentBookingAgent(auth.workspaceId, id);
    if (!data) {
      return NextResponse.json(
        { error: "Appointment Booking Agent not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
