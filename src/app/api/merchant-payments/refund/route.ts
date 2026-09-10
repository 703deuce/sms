import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { refundAppointmentPayment } from "@/lib/appointments/service-booking/appointment-refunds";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      appointmentId?: string;
      amountCents?: number;
      reason?: string;
      refundToWallet?: boolean;
      contactId?: string;
    };
    const appointmentId = String(body.appointmentId || "");
    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId required" }, { status: 400 });
    }
    if (body.refundToWallet && !body.contactId) {
      return NextResponse.json({ error: "contactId required for account credit refund" }, { status: 400 });
    }

    const result = await refundAppointmentPayment({
      workspaceId: auth.workspaceId,
      appointmentId,
      amountCents: body.amountCents,
      reason: body.reason,
      refundToWallet: Boolean(body.refundToWallet),
      contactId: body.contactId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Refund failed" }, { status: 400 });
    }

    return NextResponse.json({
      data: {
        refunded: true,
        destination: body.refundToWallet ? "account_credit" : "original_method",
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
