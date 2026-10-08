import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";

export async function GET() {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
    if ("error" in auth) return auth.error;

    const prisma = getPrisma();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await prisma.voiceAppointment.findMany({
      where: {
        workspaceId: auth.workspaceId,
        updatedAt: { gte: since },
      },
      orderBy: { updatedAt: "desc" },
      take: 120,
      select: {
        id: true,
        serviceName: true,
        startsAt: true,
        status: true,
        metadata: true,
        contact: { select: { firstName: true, lastName: true, phone: true } },
      },
    });

    const pendingApproval: Array<Record<string, unknown>> = [];
    const reconcilePending: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      const meta = (row.metadata || {}) as AppointmentMetadata & {
        arRescheduleRequest?: { status?: string; requestedAt?: string };
        arReconcilePending?: { operationId?: string; proposedStartsAt?: string };
      };
      const req = meta.arRescheduleRequest;
      if (
        req &&
        (req.status === "pending_approval" ||
          req.status === "pending_business" ||
          req.status === "processing")
      ) {
        pendingApproval.push({
          appointmentId: row.id,
          serviceName: row.serviceName,
          startsAt: row.startsAt.toISOString(),
          status: row.status,
          requestStatus: req.status,
          requestedAt: req.requestedAt,
          contactPhone: row.contact?.phone,
          contactName: [row.contact?.firstName, row.contact?.lastName].filter(Boolean).join(" "),
        });
      }
      if (meta.arReconcilePending?.operationId) {
        reconcilePending.push({
          appointmentId: row.id,
          serviceName: row.serviceName,
          startsAt: row.startsAt.toISOString(),
          operationId: meta.arReconcilePending.operationId,
          proposedStartsAt: meta.arReconcilePending.proposedStartsAt,
        });
      }
    }

    return NextResponse.json({
      data: {
        pendingApproval,
        reconcilePending,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
