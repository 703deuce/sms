import { getPrisma } from "@/lib/db";
import { randomTrackingToken } from "@/lib/messaging/crypto";
import { isMessagingReady } from "@/lib/messaging/status";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { sendViaRegistration } from "@/lib/messaging/registration-processor";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";

export type QuickSendSmsInput = {
  workspaceId: string;
  to: string;
  body: string;
  from?: string;
  campaignId?: string;
};

export async function sendQuickSms(input: QuickSendSmsInput) {
  const to = normalizeE164(input.to);
  const prisma = getPrisma();

  const suppressed = await prisma.suppression.findFirst({
    where: { workspaceId: input.workspaceId, phone: to },
  });
  if (suppressed) {
    throw new Error("Recipient is suppressed (STOP / do-not-contact)");
  }

  const reg = await getRegistrationByWorkspace(input.workspaceId);
  if (!isMessagingReady(reg)) {
    throw new Error(
      "SMS is blocked until messaging registration is ready (Brand APPROVED, A2P VERIFIED, number attached).",
    );
  }

  const trackingToken = randomTrackingToken();
  const trackedHint = `${getAppBaseUrl()}/r/${trackingToken}`;
  // Only append tracked URL if body doesn't already contain a link placeholder replacement
  const body = input.body.includes("{{tracking_link}}")
    ? input.body.replaceAll("{{tracking_link}}", trackedHint)
    : input.body;

  const result = await sendViaRegistration(input.workspaceId, to, body);

  await prisma.message.create({
    data: {
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      to,
      from: reg!.phoneE164 || input.from || "messaging_service",
      body,
      status: result.status || "queued",
      providerId: result.sid,
    },
  });

  // Upsert contact
  await prisma.contact.upsert({
    where: { workspaceId_phone: { workspaceId: input.workspaceId, phone: to } },
    create: {
      workspaceId: input.workspaceId,
      phone: to,
      lastMessaged: new Date(),
      consentSource: "quick_send",
      consentDate: new Date(),
    },
    update: { lastMessaged: new Date() },
  });

  return { ...result, trackingToken };
}
