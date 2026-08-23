import { createHmac, timingSafeEqual } from "crypto";
import { getTwilioSmsWebhookUrl } from "@/lib/app-url";
import { cleanSecret } from "@/lib/env/secrets";
import { normalizePhoneE164 } from "@/lib/reputation/phone";
import { fetchWithTimeout, providerTimeoutMs } from "@/lib/providers/fetch-with-timeout";

export type TwilioSendParams = {
  toPhone: string;
  body: string;
  /** Public URL for delivery receipts (MessageStatus callbacks). */
  statusCallbackUrl?: string;
  /** When set, successful sends append a usage_ledger row. */
  organizationId?: string | null;
  businessId?: string | null;
  jobId?: string | null;
  /** Stable ledger key so retries do not double-count. */
  idempotencyKey?: string | null;
};

export type TwilioSendResult =
  | { ok: true; messageSid: string; usedTrialTemplate?: boolean }
  | { ok: false; error: string };

/**
 * Account Auth Token used to sign inbound webhooks (console "Auth Token").
 * Separate from TWILIO_AUTH_TOKEN which is the API Key secret (SK...).
 */
export function getTwilioWebhookAuthToken(): string | undefined {
  return (
    process.env.TWILIO_ACCOUNT_AUTH_TOKEN?.trim() ||
    process.env.TWILIO_WEBHOOK_AUTH_TOKEN?.trim() ||
    undefined
  );
}

/**
 * Validate X-Twilio-Signature (HMAC-SHA1 of URL + sorted POST body params).
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
export function verifyTwilioRequestSignature(params: {
  authToken: string;
  signature: string | null | undefined;
  url: string;
  formParams: Record<string, string>;
}): boolean {
  if (!params.signature) return false;

  const data =
    params.url +
    Object.keys(params.formParams)
      .sort()
      .map((key) => key + params.formParams[key])
      .join("");

  const expected = createHmac("sha1", params.authToken)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");

  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(params.signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Twilio auth: API key SID (SK...) + secret, with Account SID (AC...) in the URL.
 * Trial accounts: set trial SMS template env var —
 * only predefined template bodies are allowed until the account is upgraded.
 */
export async function sendTwilioSms(params: TwilioSendParams): Promise<TwilioSendResult> {
  const accountSid = cleanSecret(process.env.TWILIO_ACCOUNT_SID);
  const apiKeySid = cleanSecret(process.env.TWILIO_API_KEY_SID);
  const apiKeySecret = cleanSecret(process.env.TWILIO_AUTH_TOKEN);
  const fromNumber = cleanSecret(process.env.TWILIO_FROM_NUMBER);
  const trialTemplate = process.env.TWILIO_TRIAL_SMS_TEMPLATE?.trim();

  if (!accountSid?.startsWith("AC")) {
    return { ok: false, error: "TWILIO_ACCOUNT_SID must be your Account SID (starts with AC)" };
  }
  if (!apiKeySid?.startsWith("SK")) {
    return { ok: false, error: "TWILIO_API_KEY_SID must be your API Key SID (starts with SK)" };
  }
  if (!apiKeySecret) return { ok: false, error: "TWILIO_AUTH_TOKEN is not configured" };
  if (!fromNumber) return { ok: false, error: "TWILIO_FROM_NUMBER is not configured" };

  const to = normalizePhoneE164(params.toPhone);
  if (!to) return { ok: false, error: "Invalid phone number format" };

  const outboundBody = trialTemplate || params.body;

  const body = new URLSearchParams({
    To: to,
    From: fromNumber,
    Body: outboundBody,
  });
  const statusUrl = params.statusCallbackUrl?.trim() || getTwilioSmsWebhookUrl();
  if (statusUrl) {
    body.set("StatusCallback", statusUrl);
    body.set("StatusCallbackMethod", "POST");
  }

  try {
    const res = await fetchWithTimeout(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      },
      {
        provider: "twilio",
        timeoutMs: providerTimeoutMs("twilio", 20_000),
        label: "sendSms",
        usage: params.organizationId
          ? {
              organizationId: params.organizationId,
              businessId: params.businessId,
              jobId: params.jobId,
              feature: "review_sms",
              unitType: "message",
              estimatedCostUsd: 0.0079,
              idempotencyKey: params.idempotencyKey ?? null,
            }
          : undefined,
      }
    );

    const json = (await res.json().catch(() => ({}))) as {
      sid?: string;
      message?: string;
      code?: number;
    };

    if (!res.ok) {
      const detail = json.message ?? res.statusText;
      return { ok: false, error: `Twilio error: ${detail}` };
    }

    return {
      ok: true,
      messageSid: json.sid ?? "unknown",
      usedTrialTemplate: Boolean(trialTemplate),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Twilio request failed" };
  }
}
