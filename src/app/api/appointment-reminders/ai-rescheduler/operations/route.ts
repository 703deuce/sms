import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { voiceAppointmentModificationRecencyOrder } from "@/lib/appointments/voice-appointment-query";
import {
  AR_RESCHEDULER_OPERATIONS_LOOKBACK_MS,
  buildAiReschedulerOperationsWhere,
  type ReschedulerOperationsMetadata,
} from "@/lib/appointment-reminders/ai-rescheduler/operations-query";

export async function GET() {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
    if ("error" in auth) return auth.error;

    const prisma = getPrisma();
    const since = new Date(Date.now() - AR_RESCHEDULER_OPERATIONS_LOOKBACK_MS);
    const rows = await prisma.voiceAppointment.findMany({
      where: buildAiReschedulerOperationsWhere(auth.workspaceId, since),
      orderBy: voiceAppointmentModificationRecencyOrder,
      take: 120,
      select: {
        id: true,
        serviceName: true,
        startsAt: true,
        status: true,
        metadata: true,
        contactId: true,
      },
    });

    const contactIds = [...new Set(rows.map((r) => r.contactId).filter(Boolean))] as string[];
    const contacts =
      contactIds.length > 0
        ? await prisma.contact.findMany({
            where: { workspaceId: auth.workspaceId, id: { in: contactIds } },
            select: { id: true, firstName: true, lastName: true, phone: true },
          })
        : [];
    const contactById = new Map(contacts.map((c) => [c.id, c]));

    const pendingApproval: Array<Record<string, unknown>> = [];
    const reconcilePending: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      const contact = row.contactId ? contactById.get(row.contactId) : undefined;
      const metaInvitee = (row.metadata || {}) as AppointmentMetadata;
      const meta = (row.metadata || {}) as ReschedulerOperationsMetadata;
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
          contactPhone: contact?.phone ?? metaInvitee.inviteePhone ?? null,
          contactName:
            [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") ||
            metaInvitee.inviteeName ||
            "",
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
