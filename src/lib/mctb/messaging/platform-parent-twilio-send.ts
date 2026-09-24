import "server-only";

import { assertLiveTwilioConfigured, getWebhookUrls } from "@/lib/messaging/twilio-config";
import { getLiveParentClient } from "@/lib/messaging/twilio-client";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";
import {
  resolveCanonicalMctbPlatformSender,
  type CanonicalMctbPlatformSender,
} from "@/lib/mctb/messaging/platform-sender-config";

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
}): Promise<{
  sid: string;
  status: string;
  to: string;
  messagingServiceSid: string | null;
} | null> {
  const platform = await resolveCanonicalMctbPlatformSender();
  if (!platform || platform.phoneNumberId !== input.authorizedPhoneNumberId) {
    return null;
  }
  if (platform.provider !== "twilio") {
    return null;
  }

  const auth = await isPhoneAuthorizedForOutboundSms(platform.phoneNumberId);
  if (!auth.allowed) {
    throw new Error("mctb_platform_sender_not_authorized");
  }

  return sendMctbPlatformParentTwilioMessage(platform, input);
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
