import { getPrisma } from "@/lib/db";
import { checkCreditBalance } from "@/lib/billing/entitlements";
import { deductCreditsForSend } from "@/lib/settings/billing";
import { assertWithinWorkspaceLimits } from "@/lib/settings/limits";
import { randomTrackingToken } from "@/lib/messaging/crypto";
import { isMessagingReady, isMessagingSendAuthorized } from "@/lib/messaging/status";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { sendViaRegistration } from "@/lib/messaging/registration-processor";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";
import { mergeTemplate, splitDisplayName } from "@/lib/messaging/template";
import {
  resolvePersistedOutboundMessageFrom,
  resolveProviderOutboundFromE164,
} from "@/lib/sms/persisted-message-from";

export type QuickSendSmsInput = {
  workspaceId: string;
  to: string;
  body: string;
  from?: string;
  campaignId?: string;
  customerName?: string;
  businessName?: string;
  destinationUrl?: string;
  idempotencyKey?: string;
  mediaUrls?: string[];
  senderPoolId?: string;
  /** Skip messaging registration + credit gates for platform demo SMS. */
  demoBypass?: boolean;
  /**
   * MCTB and other customer-care SMS: never append /r/ tracking or auto review links.
   * Booking / template links must appear only as explicit URLs in the message body.
   */
  omitConsumerTrackingLink?: boolean;
  /**
   * Appointment Reminders (and similar transactional appointment SMS): do not apply
   * marketing/MCTB suppression store or contact UNSUBSCRIBED from STOP — eligibility
   * is enforced on the appointment/consent path instead.
   */
  skipRecipientSuppressionGate?: boolean;
  /**
   * Route outbound through another workspace's provider registration (e.g. platform Telnyx A2P).
   * Message rows still belong to workspaceId. Does not skip credits/trial unless demoBypass.
   */
  senderRoute?: { sendWorkspaceId: string; fromE164: string; phoneNumberId?: string };
  /** Lower = higher priority for shared platform sender dispatch (default bulk). */
  platformDispatchPriority?: number;
  /** Do not acquire a platform dispatch slot before this instant (scheduled sends). */
  platformDispatchNotBefore?: Date;
};

async function applyPlatformDispatchGate(input: QuickSendSmsInput) {
  const { assertPlatformDispatchForSendQuickSms } = await import(
    "@/lib/messaging/platform-dispatch/coordinator"
  );
  await assertPlatformDispatchForSendQuickSms(input);
}

export async function sendQuickSms(input: QuickSendSmsInput) {
  const { isRecordingSmsMode, deliverRecordingSms } = await import(
    "@/lib/voice/testing/headless/recording-sms"
  );
  const recording = isRecordingSmsMode();

  if (!recording && !input.demoBypass) {
    const entitlement = await checkCreditBalance(input.workspaceId);
    if (!entitlement.ok) throw new Error(entitlement.error);
    await assertWithinWorkspaceLimits(input.workspaceId);
  }

  const to = normalizeE164(input.to);

  if (recording) {
    if (input.senderRoute) {
      await applyPlatformDispatchGate(input);
    }
    return deliverRecordingSms(input);
  }

  const prisma = getPrisma();
  const { pickPreferredSmsSendingNumber } = await import(
    "@/lib/messaging/preferred-sending-number"
  );
  const ownedNumbers = await prisma.phoneNumber.findMany({
    where: { workspaceId: input.workspaceId, status: "Active" },
  });
  const preferredFrom = pickPreferredSmsSendingNumber(ownedNumbers)?.e164;

  if (input.idempotencyKey) {
    const prior = await prisma.message.findFirst({
      where: {
        workspaceId: input.workspaceId,
        idempotencyKey: input.idempotencyKey,
      },
    });
    if (prior) {
      const staleMs = 10 * 60 * 1000;
      const isStaleSending =
        prior.status === "sending" &&
        Date.now() - prior.createdAt.getTime() > staleMs &&
        (prior.providerId?.startsWith("idem:") || prior.providerId?.startsWith("pending:"));

      if (isStaleSending) {
        // Ambiguous provider outcome — never resend; assume accepted
        await prisma.message.update({
          where: { id: prior.id },
          data: {
            status: "sent",
            providerId: prior.providerId,
          },
        });
        return {
          sid: prior.id,
          status: "sent",
          trackingToken: prior.trackingToken,
          trackingUrl: prior.trackingToken
            ? `${getAppBaseUrl()}/r/${prior.trackingToken}`
            : undefined,
          messageId: prior.id,
          idempotentReplay: true,
          assumedSentAfterCrash: true,
        };
      }

      if (prior.status === "failed") {
        await prisma.message.update({
          where: { id: prior.id },
          data: { idempotencyKey: null },
        });
      } else {
        return {
          sid: prior.providerId?.startsWith("idem:") || prior.providerId?.startsWith("pending:")
            ? prior.id
            : prior.providerId || prior.id,
          status: prior.status,
          trackingToken: prior.trackingToken,
          trackingUrl: prior.trackingToken
            ? `${getAppBaseUrl()}/r/${prior.trackingToken}`
            : undefined,
          messageId: prior.id,
          idempotentReplay: true,
        };
      }
    }
  }

  if (!input.skipRecipientSuppressionGate) {
    const suppressed = await prisma.suppression.findFirst({
      where: { workspaceId: input.workspaceId, phone: to },
    });
    if (suppressed) {
      throw new Error("Recipient is suppressed (STOP / do-not-contact)");
    }
  }

  const contact = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId: input.workspaceId, phone: to } },
  });
  if (contact?.status === "BLOCKED") {
    throw new Error(`Recipient contact status is ${contact.status}`);
  }
  if (!input.skipRecipientSuppressionGate && contact?.status === "UNSUBSCRIBED") {
    throw new Error(`Recipient contact status is ${contact.status}`);
  }

  const reg = await getRegistrationByWorkspace(input.workspaceId);
  let sendWorkspaceId = input.workspaceId;
  let activeReg = reg;
  let sendFromAuthorizedPhone = false;

  if (input.senderRoute) {
    const routeReg = await getRegistrationByWorkspace(input.senderRoute.sendWorkspaceId);
    if (routeReg) {
      sendWorkspaceId = input.senderRoute.sendWorkspaceId;
      activeReg = routeReg;
    }
    if (input.senderRoute.phoneNumberId) {
      const { isPhoneAuthorizedForOutboundSms } = await import(
        "@/lib/mctb/messaging/outbound-sms-route"
      );
      const phoneAuth = await isPhoneAuthorizedForOutboundSms(input.senderRoute.phoneNumberId);
      sendFromAuthorizedPhone = phoneAuth.allowed;
    }
  } else if (input.demoBypass) {
    const { resolvePlatformDemoOwnerWorkspaceId } = await import(
      "@/lib/mctb/onboarding/platform-demo"
    );
    const demoWorkspaceId = await resolvePlatformDemoOwnerWorkspaceId();
    if (demoWorkspaceId) {
      const demoReg = await getRegistrationByWorkspace(demoWorkspaceId);
      if (demoReg) {
        sendWorkspaceId = demoWorkspaceId;
        activeReg = demoReg;
      }
    }
  }

  if (!input.demoBypass && !sendFromAuthorizedPhone && !input.senderRoute && !isMessagingReady(reg)) {
    throw new Error(
      "SMS is blocked until messaging registration is ready (Brand APPROVED, A2P VERIFIED, number attached).",
    );
  }

  let mctbPlatformParentTwilioSend = false;
  if (input.senderRoute?.phoneNumberId && sendFromAuthorizedPhone) {
    const { isCanonicalMctbPlatformTwilioSenderPhoneNumberId } = await import(
      "@/lib/mctb/messaging/platform-parent-twilio-send"
    );
    mctbPlatformParentTwilioSend = await isCanonicalMctbPlatformTwilioSenderPhoneNumberId(
      input.senderRoute.phoneNumberId,
    );
  }

  if (
    input.senderRoute &&
    !sendFromAuthorizedPhone &&
    !isMessagingSendAuthorized(activeReg) &&
    !mctbPlatformParentTwilioSend
  ) {
    throw new Error("Outbound SMS sender is not messaging-ready for its provider regime.");
  }

  if (input.demoBypass && !input.senderRoute && !isMessagingSendAuthorized(activeReg) && !input.from) {
    throw new Error("Platform demo messaging is not configured.");
  }

  const omitTracking = input.omitConsumerTrackingLink === true;
  const trackingToken = omitTracking ? null : randomTrackingToken();
  const trackedUrl = trackingToken ? `${getAppBaseUrl()}/r/${trackingToken}` : "";
  const { resolveReviewLink } = await import("@/lib/messaging/review-link");
  const destinationUrl = omitTracking
    ? input.destinationUrl?.trim() || null
    : input.destinationUrl || (await resolveReviewLink(input.workspaceId));

  let poolFrom: string | undefined;
  if (input.senderPoolId) {
    const { resolvePoolSender } = await import("@/lib/numbers/sender-pool");
    poolFrom = await resolvePoolSender(input.workspaceId, input.senderPoolId);
  }

  const names = splitDisplayName(input.customerName);
  const body = mergeTemplate(input.body, {
    ...names,
    customer_name: input.customerName || names.name,
    business_name: input.businessName || reg?.legalBusinessName || "",
    phone: to,
    tracking_link: trackedUrl,
    review_link: trackedUrl,
  });

  const finalBody = omitTracking
    ? body.trim()
    : body.includes(trackedUrl) || !destinationUrl
      ? body
      : `${body.trim()} ${trackedUrl}`.trim();

  const persistedFrom = resolvePersistedOutboundMessageFrom({
    poolFrom,
    senderRouteFromE164: input.senderRoute?.fromE164,
    explicitFrom: input.from,
    preferredWorkspaceFrom: preferredFrom,
    registrationFrom: activeReg?.phoneE164,
  });

  const providerFrom = resolveProviderOutboundFromE164({
    poolFrom,
    senderRouteFromE164: input.senderRoute?.fromE164,
    explicitFrom: input.from,
    preferredWorkspaceFrom: preferredFrom,
  });

  await applyPlatformDispatchGate(input);

  let pending;
  try {
    pending = await prisma.message.create({
      data: {
        workspaceId: input.workspaceId,
        campaignId: input.campaignId,
        to,
        from: persistedFrom,
        body: finalBody,
        status: "sending",
        providerId: input.idempotencyKey
          ? `idem:${input.idempotencyKey}`
          : `pending:${trackingToken ?? randomTrackingToken()}`,
        idempotencyKey: input.idempotencyKey || null,
        trackingToken,
        destinationUrl,
      },
    });
  } catch (err) {
    if (
      input.idempotencyKey &&
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const existing = await prisma.message.findFirst({
        where: {
          workspaceId: input.workspaceId,
          idempotencyKey: input.idempotencyKey,
        },
      });
      if (existing && existing.status !== "failed") {
        return {
          sid: existing.providerId || existing.id,
          status: existing.status,
          trackingToken: existing.trackingToken,
          trackingUrl: existing.trackingToken
            ? `${getAppBaseUrl()}/r/${existing.trackingToken}`
            : undefined,
          messageId: existing.id,
          idempotentReplay: true,
        };
      }
    }
    throw err;
  }

  let providerAccepted = false;
  let providerSid: string | null = null;

  try {
    const result = await sendViaRegistration(
      sendWorkspaceId,
      to,
      finalBody,
      input.mediaUrls,
      providerFrom,
      input.senderRoute?.phoneNumberId
        ? { authorizedPhoneNumberId: input.senderRoute.phoneNumberId }
        : undefined,
    );
    providerAccepted = true;
    providerSid = result.sid;

    // Persist provider id before any other post-send work so Telnyx delivery webhooks can match.
    try {
      await prisma.message.update({
        where: { id: pending.id },
        data: {
          providerId: result.sid,
          status: result.status || "sent",
        },
      });
    } catch (persistErr) {
      console.warn("[sendQuickSms] post-accept providerId persist failed", persistErr);
    }

    try {
      await prisma.contact.upsert({
        where: { workspaceId_phone: { workspaceId: input.workspaceId, phone: to } },
        create: {
          workspaceId: input.workspaceId,
          phone: to,
          firstName: names.first_name || null,
          lastName: names.last_name || null,
          lastMessaged: new Date(),
          consentSource: "quick_send",
          consentDate: new Date(),
        },
        update: { lastMessaged: new Date() },
      });
    } catch (contactErr) {
      console.warn("[sendQuickSms] contact upsert failed after send", contactErr);
    }

    try {
      if (!input.demoBypass) {
        await deductCreditsForSend(input.workspaceId, 1, "Quick SMS send");
      }
    } catch (creditErr) {
      console.warn("[sendQuickSms] credit deduction failed", pending.id, creditErr);
    }

    // CRM framework — push outbound SMS/MMS to connected CRMs (async).
    try {
      const contactRow = await prisma.contact.findUnique({
        where: { workspaceId_phone: { workspaceId: input.workspaceId, phone: to } },
      });
      const { publishSmsEvent } = await import("@/lib/crm/events");
      await publishSmsEvent({
        workspaceId: input.workspaceId,
        contactId: contactRow?.id || null,
        direction: "outbound",
        from: poolFrom || reg!.phoneE164 || input.from || null,
        to,
        body: finalBody,
        status: result.status || "sent",
        messageId: pending.id,
        mediaUrls: input.mediaUrls?.filter(Boolean),
      });
    } catch {
      // CRM push is optional
    }

    return { ...result, trackingToken, trackingUrl: trackedUrl, messageId: pending.id };
  } catch (err) {
    if (providerAccepted) {
      await prisma.message
        .update({
          where: { id: pending.id },
          data: {
            status: "sent",
            providerId: providerSid || pending.providerId,
          },
        })
        .catch(() => undefined);
      try {
        await deductCreditsForSend(input.workspaceId, 1, "Quick SMS send");
      } catch (creditErr) {
        console.warn("[sendQuickSms] credit deduction failed", pending.id, creditErr);
      }
      return {
        sid: providerSid || pending.id,
        status: "sent",
        trackingToken,
        trackingUrl: trackedUrl,
        messageId: pending.id,
      };
    }

    await prisma.message
      .update({
        where: { id: pending.id },
        data: { status: "failed" },
      })
      .catch(() => undefined);
    throw err;
  }
}
