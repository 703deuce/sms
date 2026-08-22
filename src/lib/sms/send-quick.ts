import { getPrisma } from "@/lib/db";
import { checkCreditBalance } from "@/lib/billing/entitlements";
import { deductCreditsForSend } from "@/lib/settings/billing";
import { assertWithinWorkspaceLimits } from "@/lib/settings/limits";
import { randomTrackingToken } from "@/lib/messaging/crypto";
import { isMessagingReady } from "@/lib/messaging/status";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { sendViaRegistration } from "@/lib/messaging/registration-processor";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";
import { mergeTemplate, splitDisplayName } from "@/lib/messaging/template";

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
   * Route outbound through another workspace's provider registration (e.g. platform Telnyx A2P).
   * Message rows still belong to workspaceId. Does not skip credits/trial unless demoBypass.
   */
  senderRoute?: { sendWorkspaceId: string; fromE164: string };
};

export async function sendQuickSms(input: QuickSendSmsInput) {
  if (!input.demoBypass) {
    const entitlement = await checkCreditBalance(input.workspaceId);
    if (!entitlement.ok) throw new Error(entitlement.error);
    await assertWithinWorkspaceLimits(input.workspaceId);
  }

  const to = normalizeE164(input.to);
  const prisma = getPrisma();

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

  const suppressed = await prisma.suppression.findFirst({
    where: { workspaceId: input.workspaceId, phone: to },
  });
  if (suppressed) {
    throw new Error("Recipient is suppressed (STOP / do-not-contact)");
  }

  const contact = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId: input.workspaceId, phone: to } },
  });
  if (contact && (contact.status === "UNSUBSCRIBED" || contact.status === "BLOCKED")) {
    throw new Error(`Recipient contact status is ${contact.status}`);
  }

  const reg = await getRegistrationByWorkspace(input.workspaceId);
  let sendWorkspaceId = input.workspaceId;
  let activeReg = reg;

  if (input.senderRoute) {
    const routeReg = await getRegistrationByWorkspace(input.senderRoute.sendWorkspaceId);
    if (routeReg) {
      sendWorkspaceId = input.senderRoute.sendWorkspaceId;
      activeReg = routeReg;
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

  if (!input.demoBypass && !input.senderRoute && !isMessagingReady(reg)) {
    throw new Error(
      "SMS is blocked until messaging registration is ready (Brand APPROVED, A2P VERIFIED, number attached).",
    );
  }

  if (input.senderRoute && !isMessagingReady(activeReg)) {
    throw new Error("Outbound SMS sender is not messaging-ready for its provider regime.");
  }

  if (input.demoBypass && !input.senderRoute && !isMessagingReady(activeReg) && !input.from) {
    throw new Error("Platform demo messaging is not configured.");
  }

  const trackingToken = randomTrackingToken();
  const trackedUrl = `${getAppBaseUrl()}/r/${trackingToken}`;
  const { resolveReviewLink } = await import("@/lib/messaging/review-link");
  const destinationUrl = input.destinationUrl || (await resolveReviewLink(input.workspaceId));

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

  const finalBody =
    body.includes(trackedUrl) || !destinationUrl
      ? body
      : `${body.trim()} ${trackedUrl}`.trim();

  let pending;
  try {
    pending = await prisma.message.create({
      data: {
        workspaceId: input.workspaceId,
        campaignId: input.campaignId,
        to,
        from: poolFrom || activeReg?.phoneE164 || input.from || "messaging_service",
        body: finalBody,
        status: "sending",
        providerId: input.idempotencyKey ? `idem:${input.idempotencyKey}` : `pending:${trackingToken}`,
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
      poolFrom || input.from,
    );
    providerAccepted = true;
    providerSid = result.sid;

    try {
      await prisma.message.update({
        where: { id: pending.id },
        data: {
          status: result.status || "sent",
          providerId: result.sid,
        },
      });
    } catch (persistErr) {
      console.warn("[sendQuickSms] post-accept persist failed", persistErr);
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
