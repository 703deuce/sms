import { llm } from "@livekit/agents";
import { getPrisma } from "@/lib/db";
import type { FrontDeskUserData } from "./userdata";
import { isBookingConfirmed } from "./userdata";
import { formatBookedTimeLabel } from "./booking-recovery";

export type AppointmentRow = {
  id: string;
  callId: string | null;
  startsAt: Date;
  externalId: string | null;
  metadata?: unknown;
};

async function activeFutureAppointmentsForCaller(
  workspaceId: string,
  callerE164: string,
): Promise<AppointmentRow[]> {
  const prisma = getPrisma();
  const calls = await prisma.voiceCall.findMany({
    where: { workspaceId, fromE164: callerE164 },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: { id: true },
  });
  const callIds = calls.map((c: { id: string }) => c.id);
  if (!callIds.length) return [];

  return prisma.voiceAppointment.findMany({
    where: {
      workspaceId,
      callId: { in: callIds },
      status: { in: ["active", "confirmed"] },
      startsAt: { gte: new Date() },
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, callId: true, startsAt: true, externalId: true, metadata: true },
  });
}

export async function resolveFrontDeskAppointment(
  ud: FrontDeskUserData,
  appointment_id?: string,
  action: "cancel" | "reschedule" = "cancel",
): Promise<AppointmentRow> {
  const prisma = getPrisma();
  const toolName = action === "reschedule" ? "reschedule_appointment" : "cancel_appointment";
  let appointment: AppointmentRow | null = null;

  if (appointment_id) {
    appointment = await prisma.voiceAppointment.findFirst({
      where: {
        id: appointment_id,
        workspaceId: ud.workspaceId,
        status: { in: ["active", "confirmed"] },
      },
      select: { id: true, callId: true, startsAt: true, externalId: true, metadata: true },
    });
    if (!appointment) {
      throw new llm.ToolError(
        "I could not find that appointment — it may already be cancelled.",
      );
    }
    return appointment;
  }

  appointment = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId: ud.workspaceId,
      callId: ud.callId,
      status: { in: ["active", "confirmed"] },
      startsAt: { gte: new Date() },
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, callId: true, startsAt: true, externalId: true, metadata: true },
  });

  if (!appointment && ud.pendingSlotId && !isBookingConfirmed(ud)) {
    throw new llm.ToolError(
      "No appointment was booked on this call — the calendar booking did not complete. " +
        "Do not claim a cancellation succeeded. Offer to try booking again or check other visits on file.",
    );
  }

  if (!appointment && ud.callerE164) {
    const candidates = await activeFutureAppointmentsForCaller(ud.workspaceId, ud.callerE164);
    if (candidates.length === 0) {
      throw new llm.ToolError(
        "I could not find an upcoming appointment on file for this number.",
      );
    }
    if (candidates.length === 1) {
      return candidates[0]!;
    }
    const options = candidates
      .map((row) => {
        const when = formatBookedTimeLabel(row.startsAt, ud.timezone);
        return `${when} (id ${row.id})`;
      })
      .join("; ");
    throw new llm.ToolError(
      `Multiple upcoming appointments on this number: ${options}. ` +
        `Ask which one to ${action}, then call ${toolName} again with appointment_id.`,
    );
  }

  if (!appointment) {
    throw new llm.ToolError(
      "I could not find an upcoming appointment on file for this number.",
    );
  }

  return appointment;
}

export function emailFromAppointmentMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const inviteeEmail = (metadata as Record<string, unknown>).inviteeEmail;
  const email = typeof inviteeEmail === "string" ? inviteeEmail.trim() : "";
  return email || null;
}

/** Best-effort email from the current call's booking without multi-appt disambiguation. */
export async function peekEmailForFrontDeskCall(
  ud: FrontDeskUserData,
  appointment_id?: string,
): Promise<string | null> {
  const prisma = getPrisma();
  if (appointment_id) {
    const row = await prisma.voiceAppointment.findFirst({
      where: {
        id: appointment_id,
        workspaceId: ud.workspaceId,
        status: { in: ["active", "confirmed"] },
      },
      select: { metadata: true },
    });
    return emailFromAppointmentMetadata(row?.metadata);
  }
  const onThisCall = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId: ud.workspaceId,
      callId: ud.callId,
      status: { in: ["active", "confirmed"] },
      startsAt: { gte: new Date() },
    },
    orderBy: { startsAt: "asc" },
    select: { metadata: true },
  });
  return emailFromAppointmentMetadata(onThisCall?.metadata);
}
