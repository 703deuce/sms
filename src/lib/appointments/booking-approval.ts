import "server-only";

import { randomBytes, createHash } from "crypto";
import { getPrisma } from "@/lib/db";

const OTP_TTL_MS = 15 * 60_000;

export async function sendBookingEmailOtp(workspaceId: string, email: string) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const hash = createHash("sha256").update(`${workspaceId}:${email}:${code}`).digest("hex");
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } = await import(
    "@/lib/appointments/settings"
  );
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const otps = { ...((platform as { emailOtps?: Record<string, { hash: string; expiresAt: string }> }).emailOtps || {}) };
  otps[email.toLowerCase()] = { hash, expiresAt };

  await saveAppointmentPlatformConfig(workspaceId, { emailOtps: otps } as object);

  const { sendTransactionalEmail } = await import("@/lib/email/brevo");
  await sendTransactionalEmail({
    to: email,
    subject: "Verify your email to book",
    htmlContent: `<p>Your verification code is <strong>${code}</strong>. It expires in 15 minutes.</p>`,
    textContent: `Your verification code is ${code}. It expires in 15 minutes.`,
  });

  return { ok: true, expiresAt };
}

export async function verifyBookingEmailOtp(
  workspaceId: string,
  email: string,
  code: string,
): Promise<boolean> {
  const { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } = await import(
    "@/lib/appointments/settings"
  );
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const otps = (platform as { emailOtps?: Record<string, { hash: string; expiresAt: string }> }).emailOtps || {};
  const entry = otps[email.toLowerCase()];
  if (!entry) return false;
  if (new Date(entry.expiresAt) < new Date()) return false;
  const hash = createHash("sha256").update(`${workspaceId}:${email}:${code}`).digest("hex");
  if (hash !== entry.hash) return false;
  delete otps[email.toLowerCase()];
  await saveAppointmentPlatformConfig(workspaceId, { emailOtps: otps } as object);
  return true;
}

export async function requestBookingApproval(
  workspaceId: string,
  appointmentId: string,
): Promise<void> {
  const { emitBookingRequested } = await import("@/lib/appointments/workflow-scanners");
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) return;
  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: { status: "awaiting_confirmation" },
  });
  await emitBookingRequested(workspaceId, appointmentId, row.contactId);
}

export async function approveBookingRequest(workspaceId: string, appointmentId: string) {
  const { emitBookingApproved } = await import("@/lib/appointments/workflow-scanners");
  const prisma = getPrisma();
  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: { status: "confirmed" },
  });
  await emitBookingApproved(workspaceId, appointmentId);
  const { onAppointmentConfirmed } = await import("@/lib/appointment-workflows/triggers");
  await onAppointmentConfirmed(workspaceId, appointmentId);
}

export async function rejectBookingRequest(workspaceId: string, appointmentId: string) {
  const { emitBookingRejected } = await import("@/lib/appointments/workflow-scanners");
  await emitBookingRejected(workspaceId, appointmentId);
  const prisma = getPrisma();
  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: { status: "canceled" },
  });
}
