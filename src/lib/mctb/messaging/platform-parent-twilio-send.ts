import "server-only";

import { assertLiveTwilioConfigured, getWebhookUrls } from "@/lib/messaging/twilio-config";
import { getLiveParentClient } from "@/lib/messaging/twilio-client";
import { getPrisma } from "@/lib/db";
import { isPlatformMctbSenderPhoneRecord } from "@/lib/messaging/compliance/phone-number-class";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";
import {
  resolveCanonicalMctbPlatformSender,
  type CanonicalMctbPlatformSender,
} from "@/lib/mctb/messaging/platform-sender-config";

/** Pure gate for tests — parent credentials only when every condition holds. */
export function isMctbPlatformParentTwilioSendEligible(input: {
  authorizedPhoneNumberId: string | null | undefined;
  canonical: CanonicalMctbPlatformSender | null;
  phoneHasPlatformSenderRole: boolean;
  outboundSmsAuthorized: boolean;
}): boolean {
  if (!input.authorizedPhoneNumberId || !input.canonical) return false;
  if (input.canonical.provider !== "twilio") return false;
  if (input.canonical.phoneNumberId !== input.authorizedPhoneNumberId) return false;
  if (!input.phoneHasPlatformSenderRole) return false;
  if (!input.outboundSmsAuthorized) return false;
  return true;
}

/**
 * True only for the canonical MCTB platform sender PhoneNumber row (not arbitrary DIDs).
 */
export async function isCanonicalMctbPlatformTwilioSenderPhoneNumberId(
  phoneNumberId: string,
): Promise<boolean> {
  const platform = await resolveCanonicalMctbPlatformSender();
  if (!platform) return false;
  return platform.phoneNumberId === phoneNumberId && platform.provider === "twilio";
}

/**
 * MCTB PLATFORM + Twilio: send using Transovo parent account credentials.
 * Does NOT use workspace subaccounts. Never called for WORKSPACE senders.
 */
export async function trySendMctbPlatformParentTwilio(input: {
  authorizedPhoneNumberId: string;
  to: string;
  body: string;
  mediaUrls?: string[];
  fromOverride?: string;
  /** Voice agent / released inventory — skip isPhoneAuthorizedForOutboundSms re-check. */
  trustInventoryReleasedSender?: boolean;
}): Promise<{
  sid: string;
  status: string;
  to: string;
  messagingServiceSid: string | null;
} | null> {
  const platform = await resolveCanonicalMctbPlatformSender();
  const prisma = getPrisma();
  const phoneRow = await prisma.phoneNumber.findFirst({
    where: { id: input.authorizedPhoneNumberId },
    select: { id: true, settingsJson: true },
  });
  const hasRole = Boolean(
    phoneRow && isPlatformMctbSenderPhoneRecord({ settingsJson: phoneRow.settingsJson }),
  );
  const auth = input.trustInventoryReleasedSender
    ? { allowed: true }
    : await isPhoneAuthorizedForOutboundSms(input.authorizedPhoneNumberId);

  if (
    !isMctbPlatformParentTwilioSendEligible({
      authorizedPhoneNumberId: input.authorizedPhoneNumberId,
      canonical: platform,
      phoneHasPlatformSenderRole: hasRole,
      outboundSmsAuthorized: auth.allowed,
    })
  ) {
    if (
      !input.trustInventoryReleasedSender &&
      platform?.phoneNumberId === input.authorizedPhoneNumberId &&
      !auth.allowed
    ) {
      throw new Error("mctb_platform_sender_not_authorized");
    }
    return null;
  }

  return sendMctbPlatformParentTwilioMessage(platform!, input);
}

export async function sendMctbPlatformParentTwilioMessage(
  platform: CanonicalMctbPlatformSender,
  input: {
    to: string;
    body: string;
    mediaUrls?: string[];
    fromOverride?: string;
  },
) {
  assertLiveTwilioConfigured();
  const client = getLiveParentClient();
  const urls = getWebhookUrls();
  const from = (input.fromOverride || platform.e164).trim();

  const msg = await client.messages.create({
    to: input.to,
    body: input.body,
    from,
    statusCallback: urls.messageStatus,
  });

  return {
    sid: msg.sid,
    status: msg.status || "queued",
    to: input.to,
    messagingServiceSid: null,
  };
}
