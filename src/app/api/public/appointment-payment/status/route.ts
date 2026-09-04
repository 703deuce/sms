import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

/**
 * Public payment status poll — used after Stripe redirect (no booking slug in URL).
 * Returns only non-sensitive payment confirmation state for a single appointment.
 */
export async function GET(request: Request) {
  try {
    const appointmentId = new URL(request.url).searchParams.get("appointmentId");
    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId required" }, { status: 400 });
    }

    const row = await getPrisma().voiceAppointment.findFirst({
      where: { id: appointmentId },
      select: { status: true, metadata: true },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const meta = (row.metadata || {}) as Record<string, unknown>;
    const paymentStatus = typeof meta.paymentStatus === "string" ? meta.paymentStatus : null;
    const paid = paymentStatus === "succeeded" || paymentStatus === "paid";

    return NextResponse.json({
      data: {
        status: row.status,
        paymentStatus,
        paid,
        amountPaidCents: typeof meta.paymentAmountCents === "number" ? meta.paymentAmountCents : null,
        balanceDueCents: typeof meta.balanceDueCents === "number" ? meta.balanceDueCents : null,
        paymentMode: typeof meta.paymentMode === "string" ? meta.paymentMode : null,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
