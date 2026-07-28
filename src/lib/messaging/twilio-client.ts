import twilio from "twilio";
import { assertLiveTwilioConfigured, getTwilioParentCredentials } from "./twilio-config";

export type TwilioClient = ReturnType<typeof twilio>;

export function getParentTwilioClient(): TwilioClient {
  const { accountSid, authToken, apiKeySid, apiKeySecret } = getTwilioParentCredentials();
  if (!accountSid) throw new Error("TWILIO_ACCOUNT_SID is required");

  if (apiKeySid && apiKeySecret) {
    return twilio(apiKeySid, apiKeySecret, { accountSid });
  }
  if (!authToken) throw new Error("Twilio auth token or API key is required");
  return twilio(accountSid, authToken);
}

export function getSubaccountTwilioClient(subaccountSid: string, authToken: string): TwilioClient {
  return twilio(subaccountSid, authToken);
}

export function getLiveParentClient(): TwilioClient {
  assertLiveTwilioConfigured();
  return getParentTwilioClient();
}

export function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>,
): boolean {
  return twilio.validateRequest(authToken, signature, url, params);
}
