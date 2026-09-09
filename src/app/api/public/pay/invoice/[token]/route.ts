import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { getInvoiceByPayToken, serializePublicInvoice } from "@/lib/appointments/service-booking/booking-invoices";
import { createManageAppointmentPaymentCheckout } from "@/lib/appointments/service-booking/manage-payments";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const row = await getInvoiceByPayToken(token);
    const data = serializePublicInvoice(row);
    if (!data) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const row = await getInvoiceByPayToken(token);
    if (!row) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    const { invoice, contact } = row;
    if (invoice.balanceDueCents <= 0 || invoice.status === "paid") {
      return NextResponse.json({ data: { paid: true } });
    }

    const body = await request.json().catch(() => ({}));
    const appointmentId = (invoice.appointmentIds || [])[0];
    if (!appointmentId) {
      return NextResponse.json(
        {
          error:
            "Online payment is not available for this invoice yet. Contact the business to pay by card or check.",
        },
        { status: 400 },
      );
    }

    const checkout = await createManageAppointmentPaymentCheckout(
      invoice.workspaceId,
      appointmentId,
      body.email ? String(body.email) : contact?.email || undefined,
    );
    if (!checkout.required) {
      return NextResponse.json({ data: { paid: true } });
    }
    if (!checkout.checkoutUrl) {
      return NextResponse.json(
        { error: checkout.error || "Payment checkout is not available for this business." },
        { status: 400 },
      );
    }
    return NextResponse.json({ data: { checkoutUrl: checkout.checkoutUrl } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
