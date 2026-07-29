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

/**
 * Messaging execution mode:
 * - "live": real Twilio ISV (subaccounts, TrustHub, A2P, Messaging Service sends).
 * - "test": A2P/registration runs through the mock adapter (reaches "ready" without real
 *   ISV), but outbound SMS is sent through the real Twilio Messages API using **test
 *   credentials** and the magic sender number (+15005550006). Twilio returns a simulated
 *   response — real SID, no carrier delivery, no charge, no A2P required.
 * - "mock": no Twilio calls at all (fully local fake SIDs).
 */
export function getMessagingMode(): "live" | "test" | "mock" {
  const adapter = process.env.MESSAGING_ADAPTER?.trim().toLowerCase();
  const mode = process.env.TWILIO_MODE?.trim().toLowerCase();
  if (adapter) {
    if (adapter === "twilio") return "live";
    if (adapter === "test") return "test";
    return "mock";
  }
  if (mode === "test") return "test";
  return truthy(mode) ? "live" : "mock";
}

export function isLiveMessagingAdapter() {
  return getMessagingMode() === "live";
}

export function isTestMessagingMode() {
  return getMessagingMode() === "test";
}

/** Twilio "magic" sender number for test-credential sends (simulated success). */
export const TWILIO_TEST_MAGIC_FROM = "+15005550006";

/** Twilio Virtual Phone destination — receives test SMS without A2P/carrier delivery. */
export const TWILIO_VIRTUAL_PHONE = "+18777804236";

/** Test-credential pair (Twilio Console → Account → API keys & tokens → Test credentials). */
export function getTwilioTestCredentials() {
  const accountSid = process.env.TWILIO_TEST_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_TEST_AUTH_TOKEN?.trim();
  return { accountSid, authToken };
}

/**
 * Resolve the credentials + sender for test-mode sends. Two supported strategies:
 *
 * 1. **Simulated API test** — when TWILIO_TEST_ACCOUNT_SID/TWILIO_TEST_AUTH_TOKEN are set:
 *    uses those test credentials + the magic sender (+15005550006). Twilio returns a
 *    simulated success (no delivery/charge). Send to any number.
 *
 * 2. **Virtual Phone / live sender** — otherwise: uses the live account credentials + a
 *    real Twilio number your account owns (TWILIO_TEST_FROM_NUMBER, falling back to
 *    TWILIO_FROM_NUMBER). Send `to` the Twilio Virtual Phone (+18777804236) to test
 *    end-to-end without A2P. The `from` MUST be a number the account actually owns.
 */
export function getTestModeSender(): {
  accountSid: string;
  authToken: string;
  from: string;
  simulated: boolean;
} {
  const test = getTwilioTestCredentials();
  if (test.accountSid && test.authToken) {
    return {
      accountSid: test.accountSid,
      authToken: test.authToken,
      from: process.env.TWILIO_TEST_FROM_NUMBER?.trim() || TWILIO_TEST_MAGIC_FROM,
      simulated: true,
    };
  }

  const { accountSid, authToken } = getTwilioParentCredentials();
  const from = process.env.TWILIO_TEST_FROM_NUMBER?.trim() || process.env.TWILIO_FROM_NUMBER?.trim();
  const missing: string[] = [];
  if (!accountSid || !authToken) {
    missing.push(
      "Twilio test credentials (TWILIO_TEST_ACCOUNT_SID + TWILIO_TEST_AUTH_TOKEN) " +
        "or live credentials (TWILIO_ACCOUNT_SID + auth token)",
    );
  }
  if (!from) {
    missing.push("TWILIO_TEST_FROM_NUMBER (or TWILIO_FROM_NUMBER) — a Twilio number your account owns");
  }
  if (missing.length) {
    throw new Error(`Twilio test mode is missing: ${missing.join("; ")}`);
  }
  return { accountSid: accountSid!, authToken: authToken!, from: from!, simulated: false };
}

/** Resolved from-number for test-mode sends (non-throwing, for logging). */
export function getTestFromNumber() {
  const test = getTwilioTestCredentials();
  return (
    process.env.TWILIO_TEST_FROM_NUMBER?.trim() ||
    (test.accountSid && test.authToken
      ? TWILIO_TEST_MAGIC_FROM
      : process.env.TWILIO_FROM_NUMBER?.trim() || TWILIO_TEST_MAGIC_FROM)
  );
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
