import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jsonError } from "@/lib/api-auth";
import {
  assertAppointmentOwnedBySession,
  requireClientPortalSession,
} from "@/lib/appointments/client-portal/auth";
import { buildClientPortalAppointmentDetail } from "@/lib/appointments/client-portal/workspace";

type Params = { params: Promise<{ appointmentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireClientPortalSession(request);
    const { appointmentId } = await params;
    await assertAppointmentOwnedBySession(ctx, appointmentId);
    const data = await buildClientPortalAppointmentDetail(ctx, appointmentId);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: msg }, { status: 403 });
    return jsonError(err, 400);
  }
}
