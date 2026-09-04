import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { resolveWorkspaceBySlug } from "@/lib/appointments/settings";
import { completeSquareAppointmentPayment } from "@/lib/merchant-payments/service";
import { getPrisma } from "@/lib/db";

type Params = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await request.json()) as {
      appointmentId?: string;
      sourceId?: string;
      idempotencyKey?: string;
    };

    const appointmentId = String(body.appointmentId || "");
    const sourceId = String(body.sourceId || "");
    const idempotencyKey = String(body.idempotencyKey || "");

    if (!appointmentId || !sourceId || !idempotencyKey) {
      return NextResponse.json({ error: "appointmentId, sourceId, and idempotencyKey required" }, { status: 400 });
    }

    const row = await getPrisma().voiceAppointment.findFirst({
      where: { id: appointmentId, workspaceId: workspace.id },
    });
    if (!row) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });

    const result = await completeSquareAppointmentPayment({
      workspaceId: workspace.id,
      appointmentId,
      sourceId,
      idempotencyKey,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Payment failed" }, { status: 400 });
    }

    return NextResponse.json({ data: { status: "succeeded" } });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const appointmentId = new URL(request.url).searchParams.get("appointmentId");
    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId required" }, { status: 400 });
    }

    const row = await getPrisma().voiceAppointment.findFirst({
      where: { id: appointmentId, workspaceId: workspace.id },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const meta = (row.metadata || {}) as Record<string, unknown>;
    return NextResponse.json({
      data: {
        status: row.status,
        paymentStatus: meta.paymentStatus || null,
        paid: meta.paymentStatus === "succeeded" || meta.paymentStatus === "paid",
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
