import twilio from "twilio";
import { assertLiveTwilioConfigured, getTwilioParentCredentials } from "./twilio-config";

export type TwilioClient = ReturnType<typeof twilio>;

export function getParentTwilioClient(): TwilioClient {
  const { accountSid, authToken, apiKeySid, apiKeySecret } = getTwilioParentCredentials();
  if (!accountSid) throw new Error("TWILIO_ACCOUNT_SID is required");

  // Parent account token is required for subaccount provisioning (API keys often 401).
  if (authToken) {
    return twilio(accountSid, authToken);
  }
  if (apiKeySid && apiKeySecret) {
    return twilio(apiKeySid, apiKeySecret, { accountSid });
  }
  throw new Error("Twilio auth token or API key is required");
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
