import { NextResponse } from "next/server";
import {
  regenerateInvoicePayToken,
  voidInvoice,
  invoicePublicPayUrl,
} from "@/lib/appointments/service-booking/booking-invoices";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as { action?: string };
  const action = String(body.action || "");

  if (action === "void") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) => {
      try {
        const invoice = await voidInvoice(workspaceId, id);
        return NextResponse.json({ data: invoice });
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Could not void invoice" },
          { status: 400 },
        );
      }
    });
  }

  if (action === "pay_link") {
    return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
      try {
        const payToken = await regenerateInvoicePayToken(workspaceId, id);
        const origin = new URL(request.url).origin;
        return NextResponse.json({
          data: { payUrl: invoicePublicPayUrl(origin, payToken) },
        });
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Could not generate pay link" },
          { status: 400 },
        );
      }
    });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
