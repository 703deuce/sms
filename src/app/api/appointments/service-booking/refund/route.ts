import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { refundAppointmentPayment } from "@/lib/appointments/service-booking/appointment-refunds";

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.write");
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      appointmentId?: string;
      amountCents?: number;
      refundToAccountCredit?: boolean;
      contactId?: string;
      reason?: string;
    };

    if (!body.appointmentId) {
      return NextResponse.json({ error: "appointmentId is required" }, { status: 400 });
    }

    const result = await refundAppointmentPayment({
      workspaceId: auth.workspaceId,
      appointmentId: body.appointmentId,
      amountCents: body.amountCents,
      refundToWallet: body.refundToAccountCredit,
      contactId: body.contactId,
      reason: body.reason,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
