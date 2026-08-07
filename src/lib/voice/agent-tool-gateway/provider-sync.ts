import { getPrisma } from "@/lib/db";
import { appointmentSyncStatus } from "./booking-workflow";

export async function syncAppointmentToProvider(input: {
  workspaceId: string;
  appointmentId: string;
  agentId?: string | null;
  callId?: string | null;
  operationId?: string | null;
}) {
  const prisma = getPrisma();
  const appointment = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!appointment) throw new Error("Appointment not found");

  const meta = (appointment.metadata || {}) as Record<string, unknown>;
  if (appointment.externalId) {
    return { ok: true, skipped: true, externalId: appointment.externalId };
  }

  const syncStatus = appointmentSyncStatus(meta);
  if (syncStatus === "not_required" || syncStatus === "synced") {
    return { ok: true, skipped: true };
  }

  const provider = String(meta.provider || "calendly");
  if (provider !== "calendly") {
    await prisma.voiceAppointment.update({
      where: { id: appointment.id },
      data: {
        metadata: {
          ...meta,
          syncStatus: "not_required",
        } as object,
      },
    });
    return { ok: true, skipped: true, reason: "internal_only" };
  }

  const name = String(meta.inviteeName || "Caller");
  const email = String(meta.inviteeEmail || "");
  const phone = meta.inviteePhone ? String(meta.inviteePhone) : null;
  if (!email) throw new Error("invitee email missing on appointment metadata");

  const { bookEventInvitee } = await import("@/lib/integrations/adapters/calendly-actions");
  const { buildAdapterContext } = await import("@/lib/integrations/framework/context");
  const ctx = await buildAdapterContext(input.workspaceId, "calendly");

  const booked = await bookEventInvitee(ctx, {
    startTime: appointment.startsAt.toISOString(),
    name,
    email,
    phone,
    timezone: appointment.timezone || "America/New_York",
  });

  const eventUri = booked.eventUri;

  await prisma.voiceAppointment.update({
    where: { id: appointment.id },
    data: {
      externalId: eventUri ? `calendly:${eventUri}` : appointment.externalId,
      metadata: {
        ...meta,
        syncStatus: "synced",
        syncedAt: new Date().toISOString(),
        calendlyInviteeUri: booked.inviteeUri,
        calendlyEventUri: booked.eventUri,
        cancelUrl: booked.cancelUrl,
        rescheduleUrl: booked.rescheduleUrl,
      } as object,
    },
  });

  return { ok: true, externalId: eventUri, synced: true };
}

export async function markAppointmentSyncFailed(
  appointmentId: string,
  workspaceId: string,
  error: unknown,
) {
  const prisma = getPrisma();
  const appointment = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!appointment) return;
  const meta = (appointment.metadata || {}) as Record<string, unknown>;
  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      metadata: {
        ...meta,
        syncStatus: "failed",
        syncError: error instanceof Error ? error.message : String(error),
        syncFailedAt: new Date().toISOString(),
      } as object,
    },
  });
}
