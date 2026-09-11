import "server-only";

import { getPrisma } from "@/lib/db";
import { generateSecureToken, hashToken } from "./crypto";
import type { ManageAppointmentPermissions } from "./types";
import { evaluateExtendedCancellationPolicy, evaluateExtendedReschedulePolicy } from "./scheduling-limits";
import type { ExtendedCancellationPolicy, ExtendedReschedulePolicy } from "./types";
import { restoreBookingEntitlements } from "./booking-entitlements";

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

/**
 * Change policies belong to the booking type, so they are read from the server
 * rather than taken from the request body — a customer-supplied policy could
 * otherwise wave away the business's own cutoff.
 */
async function policiesForAppointment(
  workspaceId: string,
  serviceName: string | null,
): Promise<{
  cancellation?: ExtendedCancellationPolicy;
  reschedule?: ExtendedReschedulePolicy;
}> {
  if (!serviceName) return {};
  const prisma = getPrisma();
  const type = await prisma.voiceService.findFirst({
    where: { workspaceId, name: serviceName },
    select: { config: true },
  });
  const cfg = (type?.config || {}) as {
    extendedCancellationPolicy?: ExtendedCancellationPolicy;
    extendedReschedulePolicy?: ExtendedReschedulePolicy;
    cancellationPolicy?: { allowed: string; cutoffHours?: number; policyText?: string };
    reschedulePolicy?: { allowed: string; cutoffHours?: number; policyText?: string };
  };

  function widen(
    basic?: { allowed: string; cutoffHours?: number; policyText?: string },
  ): ExtendedCancellationPolicy | undefined {
    if (!basic) return undefined;
    if (basic.allowed === "disabled") return { allowed: "disabled", policyText: basic.policyText };
    if (basic.allowed === "until_hours_before") {
      return {
        allowed: "until_before",
        cutoff: { enabled: true, unit: "hours", value: basic.cutoffHours ?? 24 },
        policyText: basic.policyText,
      };
    }
    return { allowed: "anytime", policyText: basic.policyText };
  }

  return {
    cancellation: cfg.extendedCancellationPolicy || widen(cfg.cancellationPolicy),
    reschedule: cfg.extendedReschedulePolicy || widen(cfg.reschedulePolicy),
  };
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

  const policies = await policiesForAppointment(workspaceId, appointment.serviceName);
  const evalResult = evaluateExtendedReschedulePolicy(
    policies.reschedule || reschedulePolicy,
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

  const policies = await policiesForAppointment(workspaceId, appointment.serviceName);
  const evalResult = evaluateExtendedCancellationPolicy(
    policies.cancellation || cancellationPolicy,
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

  const { executePolicyFee } = await import("@/lib/appointments/policy-fees");
  const fee = await executePolicyFee(workspaceId, appointmentId, {
    kind: "cancel",
    afterCutoff: evalResult.afterCutoff,
  });

  return { appointment: updated, policyFee: fee };
}
