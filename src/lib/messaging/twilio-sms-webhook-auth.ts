import { decryptSecret } from "@/lib/messaging/crypto";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import {
  getTwilioParentCredentials,
  getWebhookUrls,
  isLiveMessagingAdapter,
} from "@/lib/messaging/twilio-config";
import { validateTwilioSignature } from "@/lib/messaging/twilio-client";
import { resolveTwilioWebhookRequestUrl } from "@/lib/numbers/providers/voice/twilio-voice-webhook-auth";
import { getPrisma } from "@/lib/db";

export { resolveTwilioWebhookRequestUrl };

export async function verifyTwilioSmsWebhookSignature(
  request: Request,
  params: Record<string, string>,
  registration?: { subaccountAuthTokenEnc: string | null } | null,
): Promise<boolean> {
  const signature = request.headers.get("x-twilio-signature") || "";
  if (!signature) {
    if (process.env.NODE_ENV === "production") return false;
    if (isLiveMessagingAdapter()) return false;
    return true;
  }

  const tokens: string[] = [];
  if (registration?.subaccountAuthTokenEnc) {
    try {
      tokens.push(decryptSecret(registration.subaccountAuthTokenEnc));
    } catch {
      // ignore decrypt errors
    }
  }

  const accountSid = params.AccountSid;
  if (accountSid && !tokens.length) {
    const reg = await getPrisma().messagingRegistration.findFirst({
      where: { subaccountSid: accountSid },
    });
    if (reg?.subaccountAuthTokenEnc) {
      try {
        tokens.push(decryptSecret(reg.subaccountAuthTokenEnc));
      } catch {
        // ignore
      }
    }
  }

  const parent = getTwilioParentCredentials().authToken;
  if (parent) tokens.push(parent);

  if (!tokens.length) return process.env.NODE_ENV !== "production";

  const validationUrl = resolveTwilioWebhookRequestUrl(request);
  return tokens.some((token) => validateTwilioSignature(token, signature, validationUrl, params));
}

/** Canonical inbound URL Twilio signs in production (APP_URL + path). */
export function canonicalTwilioInboundWebhookUrl(): string {
  return getWebhookUrls().inbound;
}
