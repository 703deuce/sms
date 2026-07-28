import { getPrisma } from "@/lib/db";
import { requireCampaignSendAccess } from "@/lib/billing/entitlements";
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
};

export async function sendQuickSms(input: QuickSendSmsInput) {
  const entitlement = requireCampaignSendAccess(input.workspaceId);
  if (!entitlement.ok) throw new Error(entitlement.error);

  const to = normalizeE164(input.to);
  const prisma = getPrisma();

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
  if (!isMessagingReady(reg)) {
    throw new Error(
      "SMS is blocked until messaging registration is ready (Brand APPROVED, A2P VERIFIED, number attached).",
    );
  }

  const trackingToken = randomTrackingToken();
  const trackedUrl = `${getAppBaseUrl()}/r/${trackingToken}`;
  const destinationUrl =
    input.destinationUrl ||
    process.env.REVIEW_LINK_FALLBACK ||
    "https://transovo.ai";

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

  // Durable outbox row BEFORE provider call — retry after accept won't lose the SID
  const pending = await prisma.message.create({
    data: {
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      to,
      from: reg!.phoneE164 || input.from || "messaging_service",
      body: finalBody,
      status: "sending",
      providerId: input.idempotencyKey ? `idem:${input.idempotencyKey}` : `pending:${trackingToken}`,
      trackingToken,
      destinationUrl,
    },
  });

  try {
    const result = await sendViaRegistration(input.workspaceId, to, finalBody);
    try {
      await prisma.message.update({
        where: { id: pending.id },
        data: {
          status: result.status || "sent",
          providerId: result.sid,
        },
      });
    } catch (persistErr) {
      // Provider already accepted — never tell the client to retry a resend
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

    return { ...result, trackingToken, trackingUrl: trackedUrl, messageId: pending.id };
  } catch (err) {
    // Only mark failed when provider did not accept
    await prisma.message.update({
      where: { id: pending.id },
      data: { status: "failed" },
    }).catch(() => undefined);
    throw err;
  }
}
