import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { resolveMctbSmsSender } from "@/lib/agents/missed-call-text-back/sms-sender";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { sendQuickSms } from "@/lib/sms/send-quick";

export async function isVoiceBookingSmsEnabled(input: {
  workspaceId: string;
  agentId?: string;
}): Promise<boolean> {
  if (!input.agentId) return true;
  const { loadVoiceAgentRuntimeConfigRecord } = await import("./load-agent-config");
  const cfg = await loadVoiceAgentRuntimeConfigRecord(input.workspaceId, input.agentId);
  const messaging = (cfg.messaging || {}) as Record<string, unknown>;
  if ("smsConfirmations" in messaging) {
    return Boolean(messaging.smsConfirmations);
  }
  const advanced = (cfg.advanced || {}) as Record<string, unknown>;
  const profile = String(advanced.livekitProfile || "").trim().toLowerCase();
  if (profile === "frontdesk" || profile === "frontdesk_realtime") {
    return true;
  }
  const tools = Array.isArray(cfg.enabledBuiltinTools)
    ? (cfg.enabledBuiltinTools as string[])
    : [];
  return tools.includes("send_sms");
}

async function resolveCallerPhone(input: {
  workspaceId: string;
  callId?: string;
  to?: string | null;
}): Promise<string | null> {
  const direct = input.to?.trim();
  if (direct) return normalizeE164(direct);
  if (!input.callId) return null;
  const call = await getPrisma().voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { fromE164: true },
  });
  if (!call?.fromE164 || call.fromE164 === "unknown") return null;
  return normalizeE164(call.fromE164);
}

/**
 * Send a post-booking confirmation SMS to the caller.
 *
 * Inbound voice may ring on toll-free (866) while A2P SMS must originate from
 * the registered local DID (571). Reuses John's `resolveMctbSmsSender` so the
 * from-number matches MCTB / messaging registration.
 */
export async function sendVoiceBookingConfirmationSms(input: {
  workspaceId: string;
  agentId?: string;
  callId?: string;
  to?: string | null;
  startsAt: Date | string;
  serviceName?: string;
  businessName?: string;
  timezone?: string;
  idempotencyKey?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const to = await resolveCallerPhone(input);
  if (!to) return { sent: false, reason: "no_recipient_phone" };

  const smsEnabled = await isVoiceBookingSmsEnabled(input);
  if (!smsEnabled) return { sent: false, reason: "sms_disabled" };

  const startsAt =
    input.startsAt instanceof Date ? input.startsAt : new Date(String(input.startsAt));
  if (Number.isNaN(startsAt.getTime())) {
    return { sent: false, reason: "invalid_start_time" };
  }

  const tz = input.timezone || "America/New_York";
  const label = (input.serviceName || input.businessName || "appointment").trim();
  const when = startsAt.toLocaleString("en-US", {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  });
  const body = `Your ${label} is confirmed for ${when}.`;

  const mctbConfig = await loadMissedCallTextConfig(input.workspaceId);
  const sender = await resolveMctbSmsSender({
    workspaceId: input.workspaceId,
    config: mctbConfig,
  });
  if (!sender?.e164) return { sent: false, reason: "no_sms_sender" };

  await sendQuickSms({
    workspaceId: input.workspaceId,
    to,
    body,
    from: sender.e164,
    idempotencyKey:
      input.idempotencyKey ||
      (input.callId ? `booking-confirm:${input.callId}` : undefined),
  });

  return { sent: true };
}
