/**
 * Per-call send_resource session flags (metadata on VoiceCall).
 * Tool request is not authorization — consent must be confirmed in session or probe.
 */

import { getPrisma } from "@/lib/db";

export type SendResourceSession = {
  booking_link_offered_at?: string;
  sms_consent_confirmed_at?: string;
  /** Monotonic counter when consent is (re)confirmed — ties idempotency to consent generation. */
  consent_action_version?: number;
  last_send_resource_denied_at?: string;
  last_send_resource_denied_reason?: string;
};

const SESSION_KEY = "sendResourceSession";

export function readSendResourceSession(
  metadata: Record<string, unknown> | null | undefined,
): SendResourceSession {
  if (!metadata || typeof metadata !== "object") return {};
  const raw = metadata[SESSION_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as SendResourceSession;
}

export async function mergeSendResourceSession(
  callId: string,
  patch: Partial<SendResourceSession>,
): Promise<SendResourceSession> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  if (!call) return { ...patch };

  const meta =
    call.metadata && typeof call.metadata === "object" && !Array.isArray(call.metadata)
      ? (call.metadata as Record<string, unknown>)
      : {};
  const prev = readSendResourceSession(meta);
  const next: SendResourceSession = { ...prev, ...patch };
  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      metadata: {
        ...meta,
        [SESSION_KEY]: next,
        ...(patch.sms_consent_confirmed_at
          ? {
              verbal_sms_consent: true,
              sms_verbal_consent: true,
            }
          : {}),
      },
    },
  });
  return next;
}

export async function markBookingLinkOffered(callId: string): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  if (!call) return;
  const meta =
    call.metadata && typeof call.metadata === "object" && !Array.isArray(call.metadata)
      ? (call.metadata as Record<string, unknown>)
      : {};
  const session = readSendResourceSession(meta);
  if (session.booking_link_offered_at) return;
  await mergeSendResourceSession(callId, {
    booking_link_offered_at: new Date().toISOString(),
  });
}

export async function confirmSmsConsentForCall(callId: string): Promise<SendResourceSession> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  const meta =
    call?.metadata && typeof call.metadata === "object" && !Array.isArray(call.metadata)
      ? (call.metadata as Record<string, unknown>)
      : {};
  const session = readSendResourceSession(meta);
  const version = (session.consent_action_version ?? 0) + 1;
  return mergeSendResourceSession(callId, {
    sms_consent_confirmed_at: new Date().toISOString(),
    consent_action_version: version,
  });
}
