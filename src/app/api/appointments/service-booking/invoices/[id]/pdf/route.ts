import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { buildInvoicePdf } from "@/lib/appointments/service-booking/booking-invoices";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentsAccess("appointments.read");
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const pdf = await buildInvoicePdf(auth.workspaceId, id);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${id.slice(-8)}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
