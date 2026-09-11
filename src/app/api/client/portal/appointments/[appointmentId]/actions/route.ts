import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jsonError } from "@/lib/api-auth";
import {
  assertAppointmentOwnedBySession,
  requireClientPortalSession,
} from "@/lib/appointments/client-portal/auth";
import {
  manageAppointmentCancel,
  manageAppointmentReschedule,
  ensureManageAppointmentToken,
} from "@/lib/appointments/service-booking/manage-appointment";
import { createManageAppointmentPaymentCheckout } from "@/lib/appointments/service-booking/manage-payments";
import { buildClientPortalAppointmentDetail } from "@/lib/appointments/client-portal/workspace";

type Params = { params: Promise<{ appointmentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireClientPortalSession(request);
    const { appointmentId } = await params;
    await assertAppointmentOwnedBySession(ctx, appointmentId);
    const body = (await request.json()) as {
      action?: string;
      startsAt?: string;
    };

    if (body.action === "cancel") {
      await manageAppointmentCancel(ctx.workspaceId, appointmentId);
      const data = await buildClientPortalAppointmentDetail(ctx, appointmentId);
      return NextResponse.json({ data });
    }

    if (body.action === "reschedule") {
      if (!body.startsAt) return NextResponse.json({ error: "startsAt required" }, { status: 400 });
      await manageAppointmentReschedule(ctx.workspaceId, appointmentId, body.startsAt);
      const data = await buildClientPortalAppointmentDetail(ctx, appointmentId);
      return NextResponse.json({ data });
    }

    if (body.action === "pay_balance") {
      const checkout = await createManageAppointmentPaymentCheckout(
        ctx.workspaceId,
        appointmentId,
      );
      return NextResponse.json({ data: checkout });
    }

    if (body.action === "manage_token") {
      const { rawToken } = await ensureManageAppointmentToken(ctx.workspaceId, appointmentId);
      return NextResponse.json({ data: { managePath: `/manage/${rawToken}` } });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Action failed";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: msg }, { status: 403 });
    return jsonError(err, 400);
  }
}
