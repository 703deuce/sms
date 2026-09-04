import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { refundMerchantAppointmentPayment } from "@/lib/merchant-payments/service";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      appointmentId?: string;
      amountCents?: number;
      reason?: string;
    };
    const appointmentId = String(body.appointmentId || "");
    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId required" }, { status: 400 });
    }

    const result = await refundMerchantAppointmentPayment({
      workspaceId: auth.workspaceId,
      appointmentId,
      amountCents: body.amountCents,
      reason: body.reason,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Refund failed" }, { status: 400 });
    }

    return NextResponse.json({ data: { refunded: true } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
