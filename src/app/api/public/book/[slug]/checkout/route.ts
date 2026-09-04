import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { createAppointmentCheckoutSession } from "@/lib/appointments/payment-checkout";
import { getPrisma } from "@/lib/db";
import { resolveWorkspaceBySlug } from "@/lib/appointments/settings";
import type { PaymentRequirement } from "@/lib/appointments/types";

type Params = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await request.json()) as {
      appointmentId?: string;
      payment?: PaymentRequirement;
      customerEmail?: string;
    };

    const appointmentId = String(body.appointmentId || "");
    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId required" }, { status: 400 });
    }

    const row = await getPrisma().voiceAppointment.findFirst({
      where: { id: appointmentId, workspaceId: workspace.id },
    });
    if (!row) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });

    const payment = body.payment;
    if (!payment || payment.mode === "none") {
      return NextResponse.json({ data: { required: false } });
    }

    const result = await createAppointmentCheckoutSession({
      workspaceId: workspace.id,
      appointmentId,
      payment,
      customerEmail: body.customerEmail,
      description: row.serviceName ? `${row.serviceName} appointment` : "Appointment",
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
