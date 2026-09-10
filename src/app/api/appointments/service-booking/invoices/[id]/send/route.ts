import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { sendInvoiceEmail } from "@/lib/appointments/service-booking/booking-invoices";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentsAccess("appointments.write");
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.APP_URL?.trim() ||
      new URL(request.url).origin;

    const result = await sendInvoiceEmail(auth.workspaceId, id, baseUrl);
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
