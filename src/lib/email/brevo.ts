/**
 * Optional Brevo transactional email. No-ops with a clear stub when BREVO_API_KEY is unset.
 */
export type SendEmailInput = {
  to: string;
  subject: string;
  htmlContent: string;
  html?: string;
  textContent?: string;
  text?: string;
  replyTo?: string;
  workspaceId?: string;
  /** Overrides REVIEW_REQUEST_FROM_NAME for this message (e.g. workspace business name). */
  senderName?: string;
  attachments?: Array<{ name: string; content: string }>;
};

export type TransactionalEmailSenderConfig = {
  apiKeyConfigured: boolean;
  fromEmail: string | null;
  defaultFromName: string;
  /** Brevo can send when API key and verified from address are set. */
  productionReady: boolean;
};

/** Shared sender resolution for Brevo — same vars as `sendTransactionalEmail`. */
export function resolveTransactionalEmailSenderConfig(): TransactionalEmailSenderConfig {
  const apiKey =
    process.env.BREVO_API_KEY?.trim() || process.env.SENDINBLUE_API_KEY?.trim();
  const fromEmail =
    process.env.REVIEW_REQUEST_FROM_EMAIL?.trim() ||
    process.env.BREVO_FROM_EMAIL?.trim() ||
    process.env.TRANSOVO_TRANSACTIONAL_FROM_EMAIL?.trim() ||
    process.env.BREVO_SENDER_EMAIL?.trim() ||
    process.env.APPOINTMENTS_FROM_EMAIL?.trim() ||
    null;
  const defaultFromName = process.env.REVIEW_REQUEST_FROM_NAME?.trim() || "Transovo";
  return {
    apiKeyConfigured: Boolean(apiKey),
    fromEmail,
    defaultFromName,
    productionReady: Boolean(apiKey && fromEmail),
  };
}

export type SendEmailResult = {
  id: string;
  provider: "brevo" | "stub";
  status: "queued" | "sent" | "failed";
  error?: string;
};

/** Used by MCTB handoff certification scripts only (see MCTB_HANDOFF_EMAIL_TEST_CAPTURE). */
const handoffTestEmailCapture: string[] = [];

export function drainMctbHandoffTestEmailCapture(): string[] {
  const copy = [...handoffTestEmailCapture];
  handoffTestEmailCapture.length = 0;
  return copy;
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (process.env.MCTB_HANDOFF_EMAIL_TEST_CAPTURE === "1") {
    handoffTestEmailCapture.push(input.to);
  }
  const { fromEmail, defaultFromName } = resolveTransactionalEmailSenderConfig();
  const apiKey =
    process.env.BREVO_API_KEY?.trim() || process.env.SENDINBLUE_API_KEY?.trim();
  const fromName = input.senderName?.trim() || defaultFromName;

  if (!apiKey) {
    return {
      id: `email_stub_${Date.now()}`,
      provider: "stub",
      status: "sent",
    };
  }

  if (!fromEmail) {
    return {
      id: `email_fail_${Date.now()}`,
      provider: "brevo",
      status: "failed",
      error: "Transactional sender email is not configured",
    };
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: fromEmail, name: fromName },
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.htmlContent,
      textContent: input.textContent,
      replyTo: input.replyTo ? { email: input.replyTo } : undefined,
      attachment: input.attachments?.map((a) => ({
        name: a.name,
        content: a.content,
      })),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      id: `email_fail_${Date.now()}`,
      provider: "brevo",
      status: "failed",
      error: `Brevo ${res.status}: ${text.slice(0, 300)}`,
    };
  }

  const data = (await res.json()) as { messageId?: string };
  return {
    id: data.messageId || `brevo_${Date.now()}`,
    provider: "brevo",
    status: "queued",
  };
}
