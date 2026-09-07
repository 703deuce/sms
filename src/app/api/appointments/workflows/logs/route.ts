import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";

function mapLogStatus(state: string): string {
  switch (state) {
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "scheduled":
      return "scheduled";
    case "skipped":
      return "skipped";
    case "failed":
      return "failed";
    case "suppressed":
      return "suppressed";
    default:
      return state;
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
    const prisma = getPrisma();
    const rows = await prisma.appointmentWorkflowStepExecution.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        execution: {
          select: {
            appointmentId: true,
            status: true,
            workflow: { select: { name: true } },
          },
        },
      },
    });

    const appointmentIds = [
      ...new Set(
        rows
          .map((r) => r.execution?.appointmentId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const appointments = appointmentIds.length
      ? await prisma.voiceAppointment.findMany({
          where: { workspaceId: auth.workspaceId, id: { in: appointmentIds } },
          select: { id: true, metadata: true },
        })
      : [];
    const contactNameByAppointment = new Map(
      appointments.map((a) => {
        const meta = (a.metadata || {}) as AppointmentMetadata;
        return [a.id, meta.inviteeName || null];
      }),
    );

    return NextResponse.json({
      data: rows.map((r) => {
        const payload = (r.payload || {}) as {
          stepName?: string;
          messagePreview?: string;
          body?: string;
        };
        const appointmentId = r.execution?.appointmentId ?? null;
        return {
          id: r.id,
          workflowName: r.execution?.workflow?.name || "Workflow",
          appointmentId,
          contactName: appointmentId ? contactNameByAppointment.get(appointmentId) ?? null : null,
          stepName: payload.stepName || r.stepId,
          status: mapLogStatus(r.state),
          channel: (r.channel as "sms" | "email" | null) || null,
          scheduledFor: r.scheduledFor?.toISOString(),
          executedAt: r.executedAt?.toISOString(),
          error: r.failureReason,
          createdAt: r.createdAt.toISOString(),
          messagePreview: payload.messagePreview || payload.body || null,
        };
      }),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
