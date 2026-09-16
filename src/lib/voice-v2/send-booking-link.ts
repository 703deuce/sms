import "server-only";

import { getPrisma } from "@/lib/db";
import { sendAppointmentSms } from "@/lib/appointments/sms-sender";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { normalizeCallerAni } from "@/lib/voice/call-identity";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { resolveVoiceOutboundSmsFrom } from "@/lib/voice/sms/voice-outbound-sms-from";
import { evaluateSendResourceConsent } from "@/lib/voice/tools/send-resource-consent-runtime";
import {
  confirmSmsConsentForCall,
  mergeSendResourceSession,
  readSendResourceSession,
} from "@/lib/voice/tools/send-resource-session";
import { isAfterHoursVoiceProfile } from "@/lib/voice/runtime/voice-profile";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { resolvePinnedBookingLink } from "./booking-link-config";
import {
  resolveVoiceV2BookingStrategy,
  type VoiceV2BookingStrategy,
} from "./booking-strategy";
import { deliverVoiceV2BusinessRequestNotifications } from "./business-request-notifications";
import { transitionAfterBookingLinkSent } from "./booking-workflow";
import { ensureVoiceV2CallContext, resolveSessionKey } from "./intake/load-call-context";
import { getIntakeReadiness } from "./intake/readiness";
import { getVoiceV2CallContext, setVoiceV2CallContext } from "./intake/session-store";
import type { VoiceV2CallContext } from "./intake/types";
import {
  getSendBookingLinkIdempotentResult,
  storeSendBookingLinkIdempotentResult,
} from "./send-booking-link-idempotency";

export type SendBookingLinkResult =
  | {
      status: "BOOKING_LINK_SENT";
      outcome: "BOOKING_LINK_SENT";
      speak: string;
      voice_v2_status: "BOOKING_LINK_SENT";
    }
  | {
      status: "BOOKING_LINK_SEND_FAILED";
      outcome: "BOOKING_LINK_SEND_FAILED";
      speak: string;
      voice_v2_status: "BOOKING_LINK_SEND_FAILED";
      error?: string;
    }
  | {
      status: "NOT_ALLOWED";
      speak: string;
      voice_v2_status: "BOOKING_LINK_NOT_ALLOWED";
    }
  | {
      status: "CONSENT_REQUIRED";
      speak: string;
      voice_v2_status: "BOOKING_LINK_CONSENT_REQUIRED";
    }
  | { status: "SESSION_UNAVAILABLE"; speak: string; voice_v2_status: "SESSION_UNAVAILABLE" }
  | {
      status: "NOT_CONFIGURED";
      speak: string;
      voice_v2_status: "BOOKING_LINK_NOT_CONFIGURED";
    };

function intakeSnapshot(ctx: VoiceV2CallContext): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, field] of Object.entries(ctx.intakeState)) {
    const v = field?.value?.trim();
    if (v) out[key] = v;
  }
  return out;
}

async function resolveStrategy(
  ctx: VoiceV2CallContext,
  workspaceId: string,
  agentId: string,
): Promise<VoiceV2BookingStrategy> {
  if (ctx.capabilities?.bookingStrategy) return ctx.capabilities.bookingStrategy;
  const runtime = await loadVoiceAgentRuntimeConfig(workspaceId, agentId);
  return resolveVoiceV2BookingStrategy(parseVoiceAgentConfig(runtime));
}

async function loadConfig(workspaceId: string, agentId: string) {
  const runtime = await loadVoiceAgentRuntimeConfig(workspaceId, agentId);
  return parseVoiceAgentConfig(runtime);
}

function wizardFromConfig(config: ReturnType<typeof parseVoiceAgentConfig> | null) {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  return advanced.appointmentReceptionistWizard as AppointmentReceptionistWizardState | undefined;
}

function resolveDestinationPhone(
  ctx: VoiceV2CallContext,
  raw: Record<string, unknown>,
  callerAni?: string | null,
): string {
  const explicit = normalizeE164(
    String(raw.recipient_phone || raw.recipientPhone || raw.destination_phone || "").trim(),
  );
  if (explicit) return explicit;
  const fromIntake = normalizeE164(ctx.intakeState.phone?.value || "");
  if (fromIntake) return fromIntake;
  return normalizeCallerAni(callerAni) || "";
}

function buildSmsBody(businessName: string | null, link: string, label: string): string {
  const name = businessName?.trim() || "us";
  const lead = label.trim() || "Book your appointment";
  return `Thanks for calling ${name}. ${lead}: ${link}`;
}

export async function executeVoiceV2SendBookingLink(input: {
  workspaceId: string;
  agentId: string;
  callControlId?: string | null;
  conversationId?: string | null;
  voiceCallId?: string | null;
  raw: Record<string, unknown>;
  callerE164?: string | null;
}): Promise<SendBookingLinkResult> {
  const toolInvocationId = String(
    input.raw.tool_invocation_id || input.raw.toolInvocationId || "",
  ).trim();

  const sessionKey = resolveSessionKey({
    callControlId: input.callControlId,
    conversationId: input.conversationId,
  });

  let ctx =
    (sessionKey ? getVoiceV2CallContext(sessionKey) : null) ||
    (await ensureVoiceV2CallContext({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callControlId: input.callControlId,
      conversationId: input.conversationId,
      fromE164: input.callerE164,
    }));

  if (!ctx) {
    return {
      status: "SESSION_UNAVAILABLE",
      speak: "I could not send the link right now. Please try again in a moment.",
      voice_v2_status: "SESSION_UNAVAILABLE",
    };
  }

  const canonicalSessionKey = ctx.sessionKey;

  if (toolInvocationId) {
    const cached = await getSendBookingLinkIdempotentResult(canonicalSessionKey, toolInvocationId);
    if (cached) return cached;
  }

  const strategy = await resolveStrategy(ctx, input.workspaceId, input.agentId);
  if (strategy !== "SEND_LINK") {
    const result: SendBookingLinkResult = {
      status: "NOT_ALLOWED",
      speak: "I can't send a booking link on this line right now.",
      voice_v2_status: "BOOKING_LINK_NOT_ALLOWED",
    };
    if (toolInvocationId) {
      await storeSendBookingLinkIdempotentResult(canonicalSessionKey, toolInvocationId, result);
    }
    return result;
  }

  const config = await loadConfig(input.workspaceId, input.agentId);
  const pinned = resolvePinnedBookingLink(config);
  if (!pinned) {
    const result: SendBookingLinkResult = {
      status: "NOT_CONFIGURED",
      speak: "Our booking link isn't set up yet. I can take your information for a callback.",
      voice_v2_status: "BOOKING_LINK_NOT_CONFIGURED",
    };
    if (toolInvocationId) {
      await storeSendBookingLinkIdempotentResult(canonicalSessionKey, toolInvocationId, result);
    }
    return result;
  }

  const qualGate = await (
    await import("./qualification-gate")
  ).evaluateQualificationPrimaryActionGate({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    ctx,
  });
  if (!qualGate.allowed) {
    const result: SendBookingLinkResult = {
      status: "NOT_ALLOWED",
      speak: qualGate.speak,
      voice_v2_status: "BOOKING_LINK_NOT_ALLOWED",
    };
    if (toolInvocationId) {
      await storeSendBookingLinkIdempotentResult(canonicalSessionKey, toolInvocationId, result);
    }
    return result;
  }

  const prisma = getPrisma();
  const callId = input.voiceCallId?.trim() || null;
  let metadata: Record<string, unknown> = {};
  if (callId) {
    const call = await prisma.voiceCall.findFirst({
      where: { id: callId, workspaceId: input.workspaceId },
      select: { metadata: true, fromE164: true },
    });
    if (call?.metadata && typeof call.metadata === "object") {
      metadata = call.metadata as Record<string, unknown>;
    }
    if (!input.callerE164 && call?.fromE164) {
      input.callerE164 = call.fromE164;
    }
  }

  const wizard = wizardFromConfig(config);
  const afterHoursProfile = wizard ? isAfterHoursVoiceProfile(wizard) : false;
  const verbalConsent =
    input.raw.verbal_sms_consent === true || input.raw.verbalSmsConsent === true;

  const consentDecision = await evaluateSendResourceConsent({
    resourceType: "booking",
    afterHoursProfile,
    callMetadata: metadata,
    callId,
    verbalSmsConsent: verbalConsent,
    conversationId: input.conversationId,
    probeDeadlineMs: Date.now() + 2000,
  });

  if (!consentDecision.allowed) {
    if (callId) {
      await mergeSendResourceSession(callId, {
        last_send_resource_denied_at: new Date().toISOString(),
        last_send_resource_denied_reason: consentDecision.reason,
      });
    }
    const result: SendBookingLinkResult = {
      status: "CONSENT_REQUIRED",
      speak:
        "I can text you our booking link — is it okay if I send that to your phone? Message and data rates may apply.",
      voice_v2_status: "BOOKING_LINK_CONSENT_REQUIRED",
    };
    if (toolInvocationId) {
      await storeSendBookingLinkIdempotentResult(canonicalSessionKey, toolInvocationId, result);
    }
    return result;
  }

  if (callId && consentDecision.shouldPersistConsent) {
    await confirmSmsConsentForCall(callId);
  }

  const destination = resolveDestinationPhone(ctx, input.raw, input.callerE164);
  if (!destination) {
    const result: SendBookingLinkResult = {
      status: "BOOKING_LINK_SEND_FAILED",
      outcome: "BOOKING_LINK_SEND_FAILED",
      speak: "What mobile number should I text the booking link to?",
      voice_v2_status: "BOOKING_LINK_SEND_FAILED",
      error: "destination_missing",
    };
    if (toolInvocationId) {
      await storeSendBookingLinkIdempotentResult(canonicalSessionKey, toolInvocationId, result);
    }
    return result;
  }

  const businessName = wizard?.businessName?.trim() || config?.businessName?.trim() || null;
  const body = buildSmsBody(businessName, pinned.url, pinned.label);
  const idempotencyKey = toolInvocationId
    ? `voice-v2-send-link:${canonicalSessionKey}:${toolInvocationId}`
    : `voice-v2-send-link:${canonicalSessionKey}:${Date.now()}`;

  try {
    const fromE164 = await resolveVoiceOutboundSmsFrom({
      workspaceId: input.workspaceId,
      calledE164: null,
      agentId: input.agentId,
      config,
    });
    await sendAppointmentSms({
      workspaceId: input.workspaceId,
      to: destination,
      from: fromE164,
      body,
      idempotencyKey,
    });

    const nextCtx = transitionAfterBookingLinkSent(ctx, destination);
    setVoiceV2CallContext(nextCtx);

    const intake = intakeSnapshot(nextCtx);
    const summaryParts = [
      intake.name ? `${intake.name} called` : "Caller",
      intake.service_reason ? `about ${intake.service_reason}` : "",
      "and received the booking link by SMS.",
    ].filter(Boolean);
    const summary = summaryParts.join(" ");

    if (callId) {
      await prisma.voiceCall.update({
        where: { id: callId },
        data: {
          outcome: "booking_link_sent",
          metadata: {
            ...metadata,
            voiceV2StructuredOutcome: "BOOKING_LINK_SENT",
            bookingLinkSentAt: new Date().toISOString(),
            bookingLinkDestination: destination,
            bookingLinkUrlHost: new URL(pinned.url).hostname,
          },
        },
      });
    }

    const advanced = (config.advanced || {}) as Record<string, unknown>;
    const receptionistAdvanced = advanced.receptionistAdvanced as {
      notifications?: { messageEmail?: string; messageSms?: string };
    } | undefined;
    const notifications = receptionistAdvanced?.notifications;

    void deliverVoiceV2BusinessRequestNotifications({
      workspaceId: input.workspaceId,
      callId,
      outcome: "BOOKING_LINK_SENT",
      callerName: intake.name,
      callerPhone: intake.phone || destination,
      serviceReason: intake.service_reason,
      customFields: intake,
      summary,
      messageEmail: notifications?.messageEmail,
      messageSms: notifications?.messageSms,
    }).catch(() => {});

    const success: SendBookingLinkResult = {
      status: "BOOKING_LINK_SENT",
      outcome: "BOOKING_LINK_SENT",
      speak:
        "I just sent the booking link. You can use that link to choose the appointment time that works best.",
      voice_v2_status: "BOOKING_LINK_SENT",
    };
    if (toolInvocationId) {
      await storeSendBookingLinkIdempotentResult(canonicalSessionKey, toolInvocationId, success);
    }
    return success;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failed: SendBookingLinkResult = {
      status: "BOOKING_LINK_SEND_FAILED",
      outcome: "BOOKING_LINK_SEND_FAILED",
      speak: "I wasn't able to send the link to that number. Do you have another mobile number I can try?",
      voice_v2_status: "BOOKING_LINK_SEND_FAILED",
      error: msg,
    };
    if (toolInvocationId) {
      await storeSendBookingLinkIdempotentResult(canonicalSessionKey, toolInvocationId, failed);
    }
    return failed;
  }
}
