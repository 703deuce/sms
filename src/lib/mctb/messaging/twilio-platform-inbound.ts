import "server-only";

import { resolvePlatformInboundDestination } from "@/lib/messaging/platform-inbound-destination";
import { dispatchSharedPlatformSmsInbound } from "@/lib/messaging/platform-sms-inbound-dispatch";

export type TwilioPlatformInboundResult =
  | { handled: false }
  | {
      handled: true;
      twimlBody?: string;
      status: number;
      plainText?: string;
    };

/**
 * Narrow MCTB platform-sender path for Twilio inbound — does not alter generic routing.
 */
export async function tryHandleTwilioMctbPlatformSenderInbound(input: {
  toRaw: string;
  fromE164: string;
  body: string;
  providerMessageId?: string;
  mediaUrls?: string[];
}): Promise<TwilioPlatformInboundResult> {
  const destination = await resolvePlatformInboundDestination(input.toRaw);
  if (!destination) {
    return { handled: false };
  }

  try {
    const core = await dispatchSharedPlatformSmsInbound({
      channel: "twilio",
      destination,
      fromE164: input.fromE164,
      body: input.body,
      providerMessageId: input.providerMessageId,
      mediaUrls: input.mediaUrls,
    });
    return {
      handled: true,
      status: 200,
      twimlBody: core.replyText,
    };
  } catch (err) {
    console.error("[twilio/platform-inbound]", err);
    return { handled: true, status: 500, plainText: "Inbound processing failed" };
  }
}
