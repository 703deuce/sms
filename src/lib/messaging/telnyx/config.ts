/**
 * Telnyx env helpers and webhook URL builders.
 */

export function getTelnyxApiKey() {
  return process.env.TELNYX_API_KEY?.trim() || "";
}

export function getTelnyxPublicKey() {
  return process.env.TELNYX_PUBLIC_KEY?.trim() || "";
}

export function getTelnyxOrgId() {
  return process.env.TELNYX_ORG_ID?.trim() || "";
}

export function getTelnyxApiBaseUrl() {
  return (
    process.env.TELNYX_API_BASE_URL?.replace(/\/$/, "") ||
    "https://api.telnyx.com/v2"
  );
}

export function getTelnyxUseTwexit() {
  const v = process.env.TELNYX_USE_TWEXIT?.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(v || "");
}

/** Platform-level profile only — never use for customer sending. */
export function getTelnyxDefaultMessagingProfileId() {
  return process.env.TELNYX_DEFAULT_MESSAGING_PROFILE_ID?.trim() || "";
}

export function getAppBaseUrl() {
  return (
    process.env.APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function getTelnyxWebhookUrls() {
  const base = getAppBaseUrl();
  return {
    /** Unified messaging profile webhook (inbound + delivery events). */
    messaging: `${base}/api/telnyx/messaging`,
    /** Legacy aliases — still accepted; prefer `messaging`. */
    inbound: `${base}/api/telnyx/inbound`,
    messageStatus: `${base}/api/telnyx/message-status`,
    compliance: `${base}/api/telnyx/compliance`,
  };
}

export function assertTelnyxConfigured() {
  const apiKey = getTelnyxApiKey();
  if (!apiKey) {
    throw new Error("Live Telnyx messaging is missing env: TELNYX_API_KEY");
  }
  return { apiKey };
}
