import "server-only";

import { handleMctbPlatformSenderInboundCore } from "@/lib/mctb/messaging/platform-sender-inbound-core";
import { isActiveMctbPlatformSenderE164 } from "@/lib/mctb/messaging/platform-sender-config";

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
  const isPlatform = await isActiveMctbPlatformSenderE164(input.toRaw);
  if (!isPlatform) {
    return { handled: false };
  }

  try {
    const core = await handleMctbPlatformSenderInboundCore({
      channel: "twilio",
      toRaw: input.toRaw,
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
