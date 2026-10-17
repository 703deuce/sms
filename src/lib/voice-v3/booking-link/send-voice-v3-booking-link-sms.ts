import "server-only";

import { getPrisma } from "@/lib/db";
import { checkCreditBalance } from "@/lib/billing/entitlements";
import { assertWithinWorkspaceLimits } from "@/lib/settings/limits";
import { deductCreditsForSend } from "@/lib/settings/billing";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import { isCanonicalPlatformMctbSenderPhone } from "@/lib/messaging/compliance/phone-number-class";
import { sendViaRegistration } from "@/lib/messaging/registration-processor";

/**
 * Voice V3 SEND_LINK only — not sendQuickSms, not appointment HP route, not campaigns/CRM.
 * Provider send: Telnyx via workspace registration + authorized wizard sender number.
 */
export type VoiceV3BookingLinkSmsInput = {
  workspaceId: string;
  agentId?: string | null;
  callId?: string | null;
  toE164: string;
  fromE164: string;
  phoneNumberId: string;
  /** Final on-wire body (deterministic booking-link template). */
  body: string;
  idempotencyKey: string;
};

export type VoiceV3BookingLinkSmsResult = {
  providerMessageId: string;
  status: string;
  messageId?: string;
  idempotentReplay?: boolean;
};

export async function sendVoiceV3BookingLinkSms(
  input: VoiceV3BookingLinkSmsInput,
): Promise<VoiceV3BookingLinkSmsResult> {
  const workspaceId = input.workspaceId.trim();
  if (!workspaceId) throw new Error("workspaceId required");

  const to = normalizeE164(input.toE164);
  const from = normalizeE164(input.fromE164);
  const phoneNumberId = input.phoneNumberId.trim();
  if (!to || !from || !phoneNumberId) {
    throw new Error("VOICE_V3_BOOKING_LINK_SMS_INVALID_ROUTE");
  }

  console.log("VOICE_V3_BOOKING_LINK_SMS_REQUESTED", {
    workspace_id: workspaceId,
    agent_id: input.agentId ?? null,
    call_id: input.callId ?? null,
    to,
    from,
    phone_number_id: phoneNumberId,
    idempotency_key: input.idempotencyKey,
  });

  const entitlement = await checkCreditBalance(workspaceId);
  if (!entitlement.ok) throw new Error(entitlement.error);
  await assertWithinWorkspaceLimits(workspaceId);

  const prisma = getPrisma();
  const suppressed = await prisma.suppression.findFirst({
    where: { workspaceId, phone: to },
  });
  if (suppressed) {
    throw new Error("Recipient is suppressed (STOP / do-not-contact)");
  }

  const contact = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId, phone: to } },
  });
  if (contact && (contact.status === "UNSUBSCRIBED" || contact.status === "BLOCKED")) {
    throw new Error(`Recipient contact status is ${contact.status}`);
  }

  const phoneAuth = await isPhoneAuthorizedForOutboundSms(phoneNumberId);
  if (!phoneAuth.allowed) {
    throw new Error("Outbound SMS sender is not authorized for this number.");
  }

  const pn = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId },
    select: { e164: true, workspaceId: true, settingsJson: true },
  });
  if (!pn?.e164 || normalizeE164(pn.e164) !== from) {
    throw new Error("Published SMS sender does not match phone record.");
  }
  const canonicalPlatform = await resolveCanonicalMctbPlatformSender();
  const isPlatformSender = isCanonicalPlatformMctbSenderPhone({
    phoneNumberId,
    settingsJson: pn.settingsJson,
    canonical: canonicalPlatform
      ? { phoneNumberId: canonicalPlatform.phoneNumberId }
      : null,
  });
  if (!isPlatformSender && pn.workspaceId !== workspaceId) {
    throw new Error("Published SMS sender does not belong to this workspace.");
  }

  if (input.idempotencyKey) {
    const prior = await prisma.message.findFirst({
      where: { workspaceId, idempotencyKey: input.idempotencyKey },
    });
    if (prior && prior.status !== "failed") {
      console.log("VOICE_V3_BOOKING_LINK_SMS_IDEMPOTENT_REPLAY", {
        workspace_id: workspaceId,
        message_id: prior.id,
      });
      return {
        providerMessageId: prior.providerId || prior.id,
        status: prior.status,
        messageId: prior.id,
        idempotentReplay: true,
      };
    }
  }

  const body = input.body.trim();
  if (!body) throw new Error("SMS body is empty");

  let pendingId: string | null = null;
  try {
    const pending = await prisma.message.create({
      data: {
        workspaceId,
        to,
        from,
        body,
        status: "sending",
        providerId: input.idempotencyKey ? `idem:${input.idempotencyKey}` : `v3bl:${Date.now()}`,
        idempotencyKey: input.idempotencyKey || null,
        campaignId: null,
        trackingToken: null,
        destinationUrl: null,
      },
    });
    pendingId = pending.id;
  } catch (err) {
    if (
      input.idempotencyKey &&
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const existing = await prisma.message.findFirst({
        where: { workspaceId, idempotencyKey: input.idempotencyKey },
      });
      if (existing && existing.status !== "failed") {
        return {
          providerMessageId: existing.providerId || existing.id,
          status: existing.status,
          messageId: existing.id,
          idempotentReplay: true,
        };
      }
    }
    throw err;
  }

  try {
    const result = await sendViaRegistration(workspaceId, to, body, undefined, from, {
      authorizedPhoneNumberId: phoneNumberId,
    });

    await prisma.message.update({
      where: { id: pendingId! },
      data: {
        status: result.status || "sent",
        providerId: result.sid,
      },
    });

    try {
      await deductCreditsForSend(workspaceId, 1, "Voice V3 booking link SMS");
    } catch (creditErr) {
      console.warn("VOICE_V3_BOOKING_LINK_SMS_CREDIT_DEDUCT_FAILED", {
        workspace_id: workspaceId,
        message_id: pendingId,
        err: creditErr instanceof Error ? creditErr.message : String(creditErr),
      });
    }

    console.log("VOICE_V3_BOOKING_LINK_SMS_ACCEPTED", {
      workspace_id: workspaceId,
      call_id: input.callId ?? null,
      provider_message_id: result.sid,
      message_id: pendingId,
    });

    return {
      providerMessageId: result.sid,
      status: result.status || "sent",
      messageId: pendingId!,
    };
  } catch (err) {
    await prisma.message
      .update({
        where: { id: pendingId! },
        data: { status: "failed" },
      })
      .catch(() => undefined);

    console.error("VOICE_V3_BOOKING_LINK_SMS_REJECTED", {
      workspace_id: workspaceId,
      call_id: input.callId ?? null,
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
