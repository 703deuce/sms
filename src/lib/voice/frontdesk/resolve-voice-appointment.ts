import { getPrisma } from "@/lib/db";
import { formatBookedTimeLabel } from "../../../../voice-runtime/src/frontdesk/booking-recovery";

export type VoiceAppointmentRow = {
  id: string;
  callId: string | null;
  startsAt: Date;
  externalId: string | null;
  metadata?: unknown;
};

export type ResolveVoiceAppointmentResult =
  | { ok: true; appointment: VoiceAppointmentRow }
  | {
      ok: false;
      code: string;
      message: string;
      appointmentOptions?: Array<{ id: string; label: string }>;
    };

async function activeFutureAppointmentsForCaller(
  workspaceId: string,
  callerE164: string,
): Promise<VoiceAppointmentRow[]> {
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

/** Resolve appointment for cancel/reschedule — no LiveKit imports. */
export async function resolveVoiceAppointmentForBridge(input: {
  workspaceId: string;
  callId: string;
  timezone: string;
  callerE164?: string | null;
  appointmentId?: string | null;
  action: "cancel" | "reschedule";
  bookingConfirmedOnCall?: boolean;
  pendingSlotId?: string | null;
}): Promise<ResolveVoiceAppointmentResult> {
  const prisma = getPrisma();
  const appointmentId = input.appointmentId?.trim() || "";

  if (appointmentId) {
    const appointment = await prisma.voiceAppointment.findFirst({
      where: {
        id: appointmentId,
        workspaceId: input.workspaceId,
        status: { in: ["active", "confirmed"] },
      },
      select: { id: true, callId: true, startsAt: true, externalId: true, metadata: true },
    });
    if (!appointment) {
      return {
        ok: false,
        code: "APPOINTMENT_NOT_FOUND",
        message: "I could not find that appointment — it may already be cancelled.",
      };
    }
    return { ok: true, appointment };
  }

  let appointment = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId: input.workspaceId,
      callId: input.callId,
      status: { in: ["active", "confirmed"] },
      startsAt: { gte: new Date() },
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, callId: true, startsAt: true, externalId: true, metadata: true },
  });

  if (
    !appointment &&
    input.pendingSlotId &&
    !input.bookingConfirmedOnCall
  ) {
    return {
      ok: false,
      code: "NO_BOOKING_ON_CALL",
      message:
        "No appointment was booked on this call — the calendar booking did not complete. " +
        "Do not claim cancel/reschedule succeeded.",
    };
  }

  if (!appointment && input.callerE164?.trim()) {
    const candidates = await activeFutureAppointmentsForCaller(
      input.workspaceId,
      input.callerE164.trim(),
    );
    if (candidates.length === 0) {
      return {
        ok: false,
        code: "APPOINTMENT_NOT_FOUND",
        message: "I could not find an upcoming appointment on file for this number.",
      };
    }
    if (candidates.length === 1) {
      return { ok: true, appointment: candidates[0]! };
    }
    return {
      ok: false,
      code: "AMBIGUOUS_APPOINTMENT",
      message: `Multiple upcoming appointments on this number. Ask which one to ${input.action}.`,
      appointmentOptions: candidates.map((row) => ({
        id: row.id,
        label: formatBookedTimeLabel(row.startsAt, input.timezone),
      })),
    };
  }

  if (!appointment) {
    return {
      ok: false,
      code: "APPOINTMENT_NOT_FOUND",
      message: "I could not find an upcoming appointment on file for this number.",
    };
  }

  return { ok: true, appointment };
}

export async function listUpcomingVoiceAppointments(input: {
  workspaceId: string;
  callId: string;
  callerE164?: string | null;
  timezone: string;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    callId: string | null;
    startsAtIso: string;
    spokenLabel: string;
    fromThisCall: boolean;
  }>
> {
  const prisma = getPrisma();
  const limit = Math.min(5, Math.max(1, input.limit ?? 3));
  const rows: VoiceAppointmentRow[] = [];

  const onCall = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId: input.workspaceId,
      callId: input.callId,
      status: { in: ["active", "confirmed"] },
      startsAt: { gte: new Date() },
    },
    orderBy: { startsAt: "asc" },
    take: limit,
    select: { id: true, callId: true, startsAt: true, externalId: true, metadata: true },
  });
  rows.push(...onCall);

  if (rows.length < limit && input.callerE164?.trim()) {
    const callerRows = await activeFutureAppointmentsForCaller(
      input.workspaceId,
      input.callerE164.trim(),
    );
    for (const row of callerRows) {
      if (!rows.some((r) => r.id === row.id)) rows.push(row);
    }
  }

  return rows.slice(0, limit).map((row) => ({
    id: row.id,
    callId: row.callId,
    startsAtIso: row.startsAt.toISOString(),
    spokenLabel: formatBookedTimeLabel(row.startsAt, input.timezone),
    fromThisCall: row.callId === input.callId,
  }));
}

export function emailFromAppointmentMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const inviteeEmail = (metadata as Record<string, unknown>).inviteeEmail;
  const email = typeof inviteeEmail === "string" ? inviteeEmail.trim() : "";
  return email || null;
}
