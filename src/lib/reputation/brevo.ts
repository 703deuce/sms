import { cleanSecret, secretFingerprint } from "@/lib/env/secrets";
import { fetchWithTimeout, providerTimeoutMs } from "@/lib/providers/fetch-with-timeout";
import { normalizeProviderMessageId } from "@/lib/reputation/provider-ids";
import { logger } from "@/lib/observability/logger";

export type BrevoSendParams = {
  toEmail: string;
  toName?: string;
  subject: string;
  textBody: string;
  /** Display name shown in the recipient's inbox (defaults to REVIEW_REQUEST_FROM_NAME). */
  fromName?: string;
  replyToEmail?: string | null;
  /** One-click / mailto List-Unsubscribe URL (RFC 2369). */
  listUnsubscribeUrl?: string | null;
  /** When set, successful sends append a usage_ledger row. */
  organizationId?: string | null;
  businessId?: string | null;
  jobId?: string | null;
  /** Stable ledger key so retries do not double-count. */
  idempotencyKey?: string | null;
};

export type BrevoSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

export async function sendBrevoEmail(params: BrevoSendParams): Promise<BrevoSendResult> {
  const apiKey = cleanSecret(process.env.BREVO_API_KEY);
  const fromEmail = cleanSecret(process.env.REVIEW_REQUEST_FROM_EMAIL);
  const defaultFromName =
    cleanSecret(process.env.REVIEW_REQUEST_FROM_NAME) ?? "Maps Growth Reviews";
  const fromName = params.fromName?.trim() || defaultFromName;

  if (!apiKey) return { ok: false, error: "BREVO_API_KEY is not configured" };
  if (!fromEmail) return { ok: false, error: "REVIEW_REQUEST_FROM_EMAIL is not configured" };

  const payload: Record<string, unknown> = {
    sender: { name: fromName, email: fromEmail },
    to: [{ email: params.toEmail, name: params.toName ?? params.toEmail }],
    subject: params.subject,
    textContent: params.textBody,
  };

  if (params.replyToEmail) {
    payload.replyTo = { email: params.replyToEmail, name: fromName };
  }

  if (params.listUnsubscribeUrl) {
    const unsub = params.listUnsubscribeUrl.trim();
    payload.headers = {
      "List-Unsubscribe": `<${unsub}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }

  try {
    const res = await fetchWithTimeout(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      },
      {
        provider: "brevo",
        timeoutMs: providerTimeoutMs("brevo", 20_000),
        label: "sendEmail",
        usage: params.organizationId
          ? {
              organizationId: params.organizationId,
              businessId: params.businessId,
              jobId: params.jobId,
              feature: "review_email",
              unitType: "message",
              estimatedCostUsd: 0.001,
              idempotencyKey: params.idempotencyKey ?? null,
            }
          : undefined,
      }
    );

    const json = (await res.json().catch(() => ({}))) as {
      messageId?: string;
      message?: string;
      code?: string;
    };

    if (!res.ok) {
      const detail = json.message ?? json.code ?? res.statusText;
      const detailStr = String(detail);
      if (/key not found|unauthorized|invalid.*key|unrecognised/i.test(detailStr)) {
        const fp = secretFingerprint(process.env.BREVO_API_KEY);
        logger.error("brevo_api_key_rejected", {
          status: res.status,
          detail: detailStr,
          keyPresent: fp.present,
          keyLength: fp.length,
          keyPrefix: fp.prefix,
          keySuffix: fp.suffix,
          keyHadWhitespaceOrQuotes: fp.hadWhitespace,
          looksLikeBrevoKey: Boolean(apiKey.startsWith("xkeysib-")),
        });
        return {
          ok: false,
          error:
            "Brevo API key rejected (Key not found). The worker read a BREVO_API_KEY but Brevo did not accept it — often trailing whitespace/quotes in Coolify. Check messaging-worker logs for keyLength/keyHadWhitespaceOrQuotes.",
        };
      }
      return { ok: false, error: `Brevo error: ${detailStr}` };
    }

    const rawId = json.messageId ?? "unknown";
    return { ok: true, messageId: normalizeProviderMessageId(rawId) || rawId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Brevo request failed" };
  }
}
