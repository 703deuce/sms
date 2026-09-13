/**
 * Runtime SMS consent for send_resource — independent of model/tool timing.
 */

import { sendResourceConsentAllowed } from "@/lib/voice/tools/send-resource-consent";
import {
  readSendResourceSession,
  type SendResourceSession,
} from "@/lib/voice/tools/send-resource-session";
import { probeSmsConsentFromTelnyxConversation } from "@/lib/voice/tools/telnyx-sms-consent-probe";

export type SendResourceConsentDecision = {
  allowed: boolean;
  reason: "consent_required" | "booking_not_offered" | "ok";
  session: SendResourceSession;
  /** When true, caller should persist sms_consent_confirmed_at before sending SMS. */
  shouldPersistConsent?: boolean;
};

export async function evaluateSendResourceConsent(input: {
  resourceType: string;
  afterHoursProfile: boolean;
  callMetadata: Record<string, unknown>;
  callId?: string | null;
  verbalSmsConsent?: boolean;
  conversationId?: string | null;
  probeDeadlineMs?: number;
}): Promise<SendResourceConsentDecision> {
  const session = readSendResourceSession(input.callMetadata);
  const priorConsent =
    input.callMetadata.verbal_sms_consent === true ||
    input.callMetadata.sms_verbal_consent === true ||
    Boolean(session.sms_consent_confirmed_at);

  if (
    input.afterHoursProfile &&
    input.resourceType === "booking" &&
    input.callId &&
    !session.booking_link_offered_at
  ) {
    const { markBookingLinkOffered } = await import("@/lib/voice/tools/send-resource-session");
    await markBookingLinkOffered(input.callId);
  }

  let sessionAfterOffer = session;
  if (input.callId) {
    const { getPrisma } = await import("@/lib/db");
    const call = await getPrisma().voiceCall.findUnique({
      where: { id: input.callId },
      select: { metadata: true },
    });
    const meta =
      call?.metadata && typeof call.metadata === "object" && !Array.isArray(call.metadata)
        ? (call.metadata as Record<string, unknown>)
        : input.callMetadata;
    sessionAfterOffer = readSendResourceSession(meta);
  }

  if (
    sendResourceConsentAllowed({
      resourceType: input.resourceType,
      priorConsent,
      verbalSmsConsent: input.verbalSmsConsent,
      afterHoursProfile: input.afterHoursProfile,
    })
  ) {
    return {
      allowed: true,
      reason: "ok",
      session: sessionAfterOffer,
      shouldPersistConsent: input.verbalSmsConsent === true && !session.sms_consent_confirmed_at,
    };
  }

  const deadline = input.probeDeadlineMs ?? Date.now() + 1800;
  if (input.conversationId && input.afterHoursProfile) {
    const probe = await probeSmsConsentFromTelnyxConversation({
      conversationId: input.conversationId,
      deadlineMs: deadline,
    });
    if (probe.confirmed) {
      return {
        allowed: true,
        reason: "ok",
        session: sessionAfterOffer,
        shouldPersistConsent: true,
      };
    }
  }

  return {
    allowed: false,
    reason: "consent_required",
    session: sessionAfterOffer,
  };
}
