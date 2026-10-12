import "server-only";

import type { AppointmentMetadata } from "@/lib/appointments/types";
import { publicToken } from "@/lib/appointments/settings";
import { getPrisma } from "@/lib/db";

export type PublicActionTokens = {
  confirmToken: string;
  cancelToken: string;
  rescheduleToken: string;
  manageToken: string;
};

/** Mint missing per-appointment public tokens (idempotent). */
export function ensurePublicActionTokensOnMetadata(
  meta: AppointmentMetadata,
): AppointmentMetadata & PublicActionTokens {
  const confirmToken = meta.confirmToken || publicToken();
  const cancelToken = meta.cancelToken || publicToken();
  const rescheduleToken = meta.rescheduleToken || publicToken();
  const manageToken = meta.manageToken || publicToken();
  return {
    ...meta,
    confirmToken,
    cancelToken,
    rescheduleToken,
    manageToken,
    manageAppointmentTokenIssuedAt:
      meta.manageAppointmentTokenIssuedAt || new Date().toISOString(),
  };
}

export async function ensurePublicActionTokensForAppointment(
  workspaceId: string,
  appointmentId: string,
): Promise<PublicActionTokens | null> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
    select: { metadata: true },
  });
  if (!row) return null;
  const meta = (row.metadata || {}) as AppointmentMetadata;
  if (
    meta.confirmToken &&
    meta.cancelToken &&
    meta.rescheduleToken &&
    meta.manageToken
  ) {
    return {
      confirmToken: meta.confirmToken,
      cancelToken: meta.cancelToken,
      rescheduleToken: meta.rescheduleToken,
      manageToken: meta.manageToken,
    };
  }
  const next = ensurePublicActionTokensOnMetadata(meta);
  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: { metadata: next as object },
  });
  return {
    confirmToken: next.confirmToken!,
    cancelToken: next.cancelToken!,
    rescheduleToken: next.rescheduleToken!,
    manageToken: next.manageToken!,
  };
}
