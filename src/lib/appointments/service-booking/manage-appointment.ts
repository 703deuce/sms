import "server-only";

import { getPrisma } from "@/lib/db";
import { generateSecureToken, hashToken } from "./crypto";
import type { ManageAppointmentPermissions } from "./types";
import { evaluateExtendedCancellationPolicy, evaluateExtendedReschedulePolicy } from "./scheduling-limits";
import type { ExtendedCancellationPolicy, ExtendedReschedulePolicy } from "./types";
import { transferAppointmentEntitlements } from "./entitlements";
import { restoreBookingEntitlements } from "./booking-entitlements";
import { transferAppointmentPaymentOnReschedule } from "./manage-payments";

const DEFAULT_PERMISSIONS: ManageAppointmentPermissions = {
  view: true,
  confirm: true,
  reschedule: true,
  cancel: true,
  payBalance: true,
  editIntake: true,
  viewLocation: true,
};

export async function ensureManageAppointmentToken(
  workspaceId: string,
  appointmentId: string,
  permissions?: Partial<ManageAppointmentPermissions>,
): Promise<{ rawToken: string; record: { id: string; appointmentId: string } }> {
  const prisma = getPrisma();
  const existing = await prisma.manageAppointmentToken.findFirst({
    where: { workspaceId, appointmentId },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    const rawToken = generateSecureToken();
    const record = await prisma.manageAppointmentToken.update({
      where: { id: existing.id },
      data: { tokenHash: hashToken(rawToken), permissions: { ...DEFAULT_PERMISSIONS, ...permissions } },
    });
    return { rawToken, record };
  }

  const rawToken = generateSecureToken();
  const record = await prisma.manageAppointmentToken.create({
    data: {
      workspaceId,
      appointmentId,
      tokenHash: hashToken(rawToken),
      permissions: { ...DEFAULT_PERMISSIONS, ...permissions },
    },
  });
  return { rawToken, record };
}

export async function resolveManageAppointmentByToken(token: string) {
  const prisma = getPrisma();
  const row = await prisma.manageAppointmentToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!row) return null;
  if (row.expiresAt && row.expiresAt < new Date()) return null;

  const appointment = await prisma.voiceAppointment.findFirst({
    where: { id: row.appointmentId, workspaceId: row.workspaceId },
  });
  if (!appointment) return null;

  await prisma.manageAppointmentToken.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  });

  return { token: row, appointment };
}

export function manageAppointmentUrl(baseUrl: string, token: string): string {
  const root = baseUrl.replace(/\/$/, "");
  return `${root}/manage/${token}`;
}

export async function manageAppointmentReschedule(
  workspaceId: string,
  appointmentId: string,
  startsAt: string,
  reschedulePolicy?: ExtendedReschedulePolicy,
) {
  const prisma = getPrisma();
  const appointment = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!appointment) throw new Error("Appointment not found");

  const evalResult = evaluateExtendedReschedulePolicy(
    reschedulePolicy,
    new Date(appointment.startsAt),
  );
  if (!evalResult.allowed) {
    throw new Error(evalResult.reason || "Reschedule not allowed");
  }

  const durationMs =
    (appointment.endsAt?.getTime() || appointment.startsAt.getTime() + 3_600_000) -
    appointment.startsAt.getTime();
  const newStart = new Date(startsAt);
  const newEnd = new Date(newStart.getTime() + durationMs);

  const updated = await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: { startsAt: newStart, endsAt: newEnd },
  });

  await transferAppointmentEntitlements(workspaceId, appointmentId, appointmentId);
  await transferAppointmentPaymentOnReschedule(workspaceId, appointmentId, appointmentId);

  return { appointment: updated, afterCutoff: evalResult.afterCutoff, behavior: evalResult.behavior };
}

export async function manageAppointmentCancel(
  workspaceId: string,
  appointmentId: string,
  cancellationPolicy?: ExtendedCancellationPolicy,
) {
  const prisma = getPrisma();
  const appointment = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!appointment) throw new Error("Appointment not found");

  const evalResult = evaluateExtendedCancellationPolicy(
    cancellationPolicy,
    new Date(appointment.startsAt),
  );
  if (!evalResult.allowed) {
    throw new Error(evalResult.reason || "Cancellation not allowed");
  }

  const updated = await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: { status: "canceled" },
  });

  await restoreBookingEntitlements(workspaceId, appointmentId);

  return updated;
}
