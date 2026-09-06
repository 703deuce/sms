import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  approveBookingRequest,
  rejectBookingRequest,
} from "@/lib/appointments/booking-approval";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { appointmentId?: string; action?: string };
    const appointmentId = String(body.appointmentId || "");
    if (!appointmentId) return NextResponse.json({ error: "appointmentId required" }, { status: 400 });

    if (body.action === "approve") {
      await approveBookingRequest(auth.workspaceId, appointmentId);
      return NextResponse.json({ data: { status: "confirmed" } });
    }
    if (body.action === "reject") {
      await rejectBookingRequest(auth.workspaceId, appointmentId);
      return NextResponse.json({ data: { status: "canceled" } });
    }
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
