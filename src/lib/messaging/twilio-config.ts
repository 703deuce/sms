/**
 * Twilio ISV / messaging env gate and webhook URL helpers.
 */

function truthy(value: string | undefined) {
  if (!value) return false;
  return ["1", "true", "live", "twilio", "yes", "on"].includes(value.trim().toLowerCase());
}

export function getAppBaseUrl() {
  return (
    process.env.APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.TWILIO_STATUS_CALLBACK_BASE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function isLiveMessagingAdapter() {
  if (process.env.MESSAGING_ADAPTER) {
    return process.env.MESSAGING_ADAPTER.trim().toLowerCase() === "twilio";
  }
  return truthy(process.env.TWILIO_MODE);
}

export function getTwilioParentCredentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken =
    process.env.TWILIO_ACCOUNT_AUTH_TOKEN?.trim() ||
    process.env.TWILIO_PARENT_AUTH_TOKEN?.trim() ||
    process.env.TWILIO_WEBHOOK_AUTH_TOKEN?.trim() ||
    process.env.TWILIO_AUTH_TOKEN?.trim();
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim();
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim() || process.env.TWILIO_AUTH_TOKEN?.trim();
  const primaryProfileSid = process.env.TWILIO_PRIMARY_PROFILE_SID?.trim();

  return { accountSid, authToken, apiKeySid, apiKeySecret, primaryProfileSid };
}

export function assertLiveTwilioConfigured() {
  const { accountSid, authToken, primaryProfileSid } = getTwilioParentCredentials();
  const missing: string[] = [];
  if (!accountSid) missing.push("TWILIO_ACCOUNT_SID");
  if (!authToken) missing.push("TWILIO_ACCOUNT_AUTH_TOKEN (or TWILIO_AUTH_TOKEN)");
  if (!primaryProfileSid) missing.push("TWILIO_PRIMARY_PROFILE_SID");
  if (missing.length) {
    throw new Error(`Live Twilio ISV is missing env: ${missing.join(", ")}`);
  }
  return { accountSid: accountSid!, authToken: authToken!, primaryProfileSid: primaryProfileSid! };
}

export function getWebhookUrls() {
  const base = getAppBaseUrl();
  return {
    inbound: `${base}/api/twilio/inbound`,
    messageStatus: `${base}/api/twilio/message-status`,
    complianceStatus: `${base}/api/twilio/compliance-status`,
  };
}

export function getStatusEmail() {
  return process.env.TWILIO_STATUS_EMAIL?.trim() || process.env.MESSAGING_STATUS_EMAIL?.trim() || undefined;
}

export function getNumberGraceDays() {
  const raw = process.env.MESSAGING_NUMBER_GRACE_DAYS;
  const n = raw ? Number(raw) : 14;
  return Number.isFinite(n) && n > 0 ? n : 14;
}

/** TrustHub policy SIDs (Twilio-published constants for US A2P). */
export const TRUSTHUB_POLICIES = {
  secondaryCustomerProfile: "RNdfbf3fae0e1107c8a73eb860510c6e87",
  a2pTrustProduct: "RNb0d4771c2c98518d321f9d719b9d7355",
} as const;
