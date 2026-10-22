import "server-only";

import { normalizePhoneE164 } from "@/lib/messaging/preferred-sending-number";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { sendVoiceV3BookingLinkSms } from "./send-voice-v3-booking-link-sms";
import { resolveSendLinkSmsSender } from "./resolve-send-link-sms-sender";
import type { VoiceV3CallContext } from "../state/call-context";
import { voiceToolError, toolOk, type VoiceToolResult } from "../tools/types";
import { buildSendBookingLinkSmsBody } from "./sms-body";
import { compileVoiceBookingLinkSpokenDisclosure } from "./spoken-disclosure";
import { isSendLinkStrategy, resolveSendLinkConfig } from "./resolve-config";
import type { VoiceV3BookingLinkCallState } from "./types";
import { recordVoiceBookingLinkVerbalConsent } from "./record-verbal-consent";

export type SendBookingLinkToolArgs = {
  confirmed: boolean;
  destination_phone?: string | null;
};

export type SendBookingLinkDeps = {
  sendSms?: (input: {
    workspaceId: string;
    to: string;
    from: string;
    body: string;
    idempotencyKey: string;
    phoneNumberId: string;
  }) => Promise<{ providerMessageId: string; status: string }>;
  resolveSmsSender?: (input: {
    workspaceId: string;
    agentId?: string | null;
    config: VoiceV3AgentConfig;
  }) => Promise<{ fromE164: string; phoneNumberId: string } | null>;
};

function initialBookingLinkState(): VoiceV3BookingLinkCallState {
  return {
    consent: "NOT_REQUESTED",
    smsDestination: null,
    lastSend: null,
  };
}

function bookingLinkFromContext(ctx: VoiceV3CallContext): VoiceV3BookingLinkCallState {
  return ctx.bookingLink ?? initialBookingLinkState();
}

function buildAttemptId(input: {
  callId: string;
  destinationE164: string;
  configVersion: string;
  bookingUrl: string;
}): string {
  return `${input.callId}:${input.destinationE164}:${input.configVersion}:${input.bookingUrl}`;
}

function resolveDestinationE164(
  ctx: VoiceV3CallContext,
  args: SendBookingLinkToolArgs,
): { e164: string; source: "INBOUND_ANI" | "CALLER_PROVIDED" } | null {
  const alt = args.destination_phone?.trim();
  if (alt) {
    const normalized = normalizePhoneE164(alt);
    if (!normalized) return null;
    return { e164: normalized, source: "CALLER_PROVIDED" };
  }
  const ani = ctx.telephony.inboundCallerE164?.trim();
  if (!ani) return null;
  const normalized = normalizePhoneE164(ani) || ani;
  return { e164: normalized, source: "INBOUND_ANI" };
}

function withBookingLink(
  ctx: VoiceV3CallContext,
  patch: Partial<VoiceV3BookingLinkCallState>,
): VoiceV3CallContext {
  const base = bookingLinkFromContext(ctx);
  return {
    ...ctx,
    updatedAt: new Date().toISOString(),
    bookingLink: { ...base, ...patch },
    runtime: { version: ctx.runtime.version + 1 },
  };
}

export async function executeSendBookingLink(input: {
  workspaceId: string;
  agentId?: string | null;
  config: VoiceV3AgentConfig;
  context: VoiceV3CallContext;
  args: SendBookingLinkToolArgs;
  deps?: SendBookingLinkDeps;
}): Promise<{ result: VoiceToolResult; nextContext: VoiceV3CallContext }> {
  const { config, args } = input;
  let ctx = input.context;

  console.log("SEND_BOOKING_LINK_REQUESTED", {
    call_id: ctx.callId,
    strategy: config.scheduling?.bookingStrategy,
  });

  if (!isSendLinkStrategy(config)) {
    return {
      result: voiceToolError(
        "BOOKING_STRATEGY_MISMATCH",
        "send_booking_link is only available when the published booking strategy is Send booking link.",
        { strategy: config.scheduling?.bookingStrategy },
        "not_allowed",
      ),
      nextContext: ctx,
    };
  }

  const sendConfig = resolveSendLinkConfig(config);
  if (!sendConfig) {
    return {
      result: voiceToolError(
        "SEND_LINK_NOT_CONFIGURED",
        "Booking link URL is missing or invalid in published configuration.",
        {},
        "not_configured",
      ),
      nextContext: ctx,
    };
  }

  const dest = resolveDestinationE164(ctx, args);
  if (!dest) {
    return {
      result: voiceToolError(
        "SMS_DESTINATION_REQUIRED",
        "No valid SMS destination is available for this call.",
        {},
        "not_ready",
      ),
      nextContext: ctx,
    };
  }

  const prior = bookingLinkFromContext(ctx);
  if (prior.consent === "DECLINED" && sendConfig.consentRequired) {
    return {
      result: voiceToolError(
        "SMS_CONSENT_DECLINED",
        "The caller declined SMS consent; do not send the booking link.",
        {},
        "declined",
      ),
      nextContext: ctx,
    };
  }

  if (sendConfig.consentRequired && !args.confirmed) {
    console.log("SEND_BOOKING_LINK_CONSENT_REQUIRED", { call_id: ctx.callId });
    const disclosure = compileVoiceBookingLinkSpokenDisclosure({
      businessName: sendConfig.businessName,
      destinationHint: dest.source === "CALLER_PROVIDED" ? "other_number" : "inbound_ani",
    });
    ctx = withBookingLink(ctx, {
      consent: "REQUESTED",
      smsDestination: {
        source: dest.source,
        e164: dest.e164,
        confirmed: dest.source === "INBOUND_ANI" || Boolean(args.destination_phone),
      },
    });
    return {
      result: voiceToolError(
        "SMS_CONSENT_REQUIRED",
        "SMS consent is required before sending the booking link.",
        { spoken_disclosure: disclosure.text, disclosure_version: disclosure.disclosureVersion },
        "consent_required",
      ),
      nextContext: ctx,
    };
  }

  const attemptId = buildAttemptId({
    callId: ctx.callId,
    destinationE164: dest.e164,
    configVersion: sendConfig.configVersion,
    bookingUrl: sendConfig.bookingUrl,
  });

  if (
    prior.lastSend?.attemptId === attemptId &&
    (prior.lastSend.status === "sent" || prior.lastSend.status === "already_sent")
  ) {
    console.log("SEND_BOOKING_LINK_ALREADY_SENT", { call_id: ctx.callId, attempt_id: attemptId });
    return {
      result: toolOk("already_sent", {
        status: "already_sent",
        provider_message_id: prior.lastSend.providerMessageId,
      }),
      nextContext: ctx,
    };
  }

  console.log("SEND_BOOKING_LINK_ATTEMPT_STARTED", { call_id: ctx.callId, attempt_id: attemptId });

  let fromE164: string;
  let phoneNumberId: string;
  try {
    const resolveSender =
      input.deps?.resolveSmsSender ??
      (async (r) =>
        resolveSendLinkSmsSender({
          workspaceId: r.workspaceId,
          agentId: r.agentId,
          config: r.config,
        }));
    const sender = await resolveSender({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      config,
    });
    if (!sender?.fromE164 || !sender.phoneNumberId) {
      return {
        result: voiceToolError(
          "SMS_SENDER_NOT_AUTHORIZED",
          "Outbound SMS sender is not configured for this agent.",
          {},
          "not_configured",
        ),
        nextContext: ctx,
      };
    }
    fromE164 = sender.fromE164;
    phoneNumberId = sender.phoneNumberId;
  } catch {
    return {
      result: voiceToolError(
        "SMS_SENDER_NOT_AUTHORIZED",
        "Outbound SMS sender is not configured for this agent.",
        {},
        "not_configured",
      ),
      nextContext: ctx,
    };
  }

  const body = buildSendBookingLinkSmsBody({ config: sendConfig });
  const idempotencyKey = `v3_send_link:${attemptId}`;

  const disclosure = compileVoiceBookingLinkSpokenDisclosure({
    businessName: sendConfig.businessName,
    destinationHint: dest.source === "CALLER_PROVIDED" ? "other_number" : "inbound_ani",
  });

  try {
    if (sendConfig.consentRequired) {
      await recordVoiceBookingLinkVerbalConsent({
        workspaceId: input.workspaceId,
        callId: ctx.callId,
        agentId: input.agentId,
        destinationE164: dest.e164,
        senderE164: fromE164,
        affirmativeInput: "verbal_yes",
        disclosureVersion: disclosure.disclosureVersion,
        configVersion: sendConfig.configVersion,
        bookingUrl: sendConfig.bookingUrl,
      });
    }
  } catch (err) {
    console.error("SEND_BOOKING_LINK_CONSENT_RECORD_FAILED", {
      call_id: ctx.callId,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const sendFn =
    input.deps?.sendSms ??
    (async (sms) => {
      const res = await sendVoiceV3BookingLinkSms({
        workspaceId: sms.workspaceId,
        agentId: input.agentId,
        callId: ctx.callId,
        toE164: sms.to,
        fromE164: sms.from,
        phoneNumberId: sms.phoneNumberId,
        body: sms.body,
        idempotencyKey: sms.idempotencyKey,
      });
      return {
        providerMessageId: res.providerMessageId,
        status: res.status,
      };
    });

  try {
    const provider = await sendFn({
      workspaceId: input.workspaceId,
      to: dest.e164,
      from: fromE164,
      body,
      idempotencyKey,
      phoneNumberId,
    });
    console.log("SEND_BOOKING_LINK_PROVIDER_ACCEPTED", {
      call_id: ctx.callId,
      provider_message_id: provider.providerMessageId,
      provider_status: provider.status,
    });
    ctx = withBookingLink(ctx, {
      consent: "GRANTED",
      smsDestination: {
        source: dest.source,
        e164: dest.e164,
        confirmed: true,
      },
      lastSend: {
        attemptId,
        status: "sent",
        providerMessageId: provider.providerMessageId,
        providerInitialStatus: provider.status,
        sentAt: new Date().toISOString(),
      },
    });
    return {
      result: toolOk("sent", {
        status: "sent",
        provider_message_id: provider.providerMessageId,
        provider_initial_status: provider.status,
        booking_url: sendConfig.bookingUrl,
        sms_body_includes_url: body.includes(sendConfig.bookingUrl),
      }),
      nextContext: ctx,
    };
  } catch (err) {
    console.error("SEND_BOOKING_LINK_PROVIDER_REJECTED", {
      call_id: ctx.callId,
      message: err instanceof Error ? err.message : String(err),
    });
    ctx = withBookingLink(ctx, {
      lastSend: {
        attemptId,
        status: "provider_rejected",
        sentAt: new Date().toISOString(),
      },
    });
    return {
      result: voiceToolError(
        "SMS_SEND_FAILED",
        "The SMS provider rejected the booking link message.",
        {},
        "provider_rejected",
        true,
      ),
      nextContext: ctx,
    };
  }
}

export function assertSendLinkPublishable(
  config: VoiceV3AgentConfig,
): { ok: true } | { ok: false; reason: string } {
  if (!isSendLinkStrategy(config)) return { ok: true };
  const url = resolveSendLinkConfig(config);
  if (!url) {
    return { ok: false, reason: "Booking URL missing" };
  }
  const platformFrom = process.env.VOICE_OUTBOUND_SMS_FROM_E164?.trim();
  const platformId = process.env.VOICE_OUTBOUND_SMS_PHONE_NUMBER_ID?.trim();
  const hasPlatformSender = Boolean(platformFrom && platformId);
  const hasTelephonySender = Boolean(
    config.telephony?.outboundSmsE164?.trim() || config.telephony?.outboundSmsPhoneNumberId?.trim(),
  );
  if (!hasTelephonySender && !hasPlatformSender) {
    return { ok: false, reason: "SMS sender not configured" };
  }
  return { ok: true };
}
