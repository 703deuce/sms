/**
 * Brevo transactional email (same contract as src/lib/email/brevo.ts).
 * Requires BREVO_API_KEY (or SENDINBLUE_API_KEY) and a verified from address env.
 */
export type SendEmailInput = {
  to: string;
  subject: string;
  htmlContent?: string;
  html?: string;
  textContent?: string;
  text?: string;
  replyTo?: string;
  workspaceId?: string;
  senderName?: string;
};

export type TransactionalEmailSenderConfig = {
  apiKeyConfigured: boolean;
  fromEmail: string | null;
  defaultFromName: string;
  productionReady: boolean;
};

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

export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { fromEmail, defaultFromName } = resolveTransactionalEmailSenderConfig();
  const apiKey =
    process.env.BREVO_API_KEY?.trim() || process.env.SENDINBLUE_API_KEY?.trim();
  const fromName = input.senderName?.trim() || defaultFromName;
  const htmlContent = input.htmlContent || input.html || "";
  const textContent = input.textContent || input.text || htmlContent.replace(/<[^>]+>/g, " ");

  if (!apiKey) {
    return {
      id: `email_stub_${Date.now()}`,
      provider: "stub",
      status: "failed",
      error: "BREVO_API_KEY is not configured",
    };
  }

  if (!fromEmail) {
    return {
      id: `email_fail_${Date.now()}`,
      provider: "brevo",
      status: "failed",
      error:
        "Transactional sender email is not configured (set BREVO_FROM_EMAIL or TRANSOVO_TRANSACTIONAL_FROM_EMAIL)",
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
      htmlContent: htmlContent || `<p>${textContent}</p>`,
      textContent,
      replyTo: input.replyTo ? { email: input.replyTo } : undefined,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      id: `email_fail_${Date.now()}`,
      provider: "brevo",
      status: "failed",
      error: text.slice(0, 240),
    };
  }

  const json = (await res.json()) as { messageId?: string };
  return {
    id: json.messageId || `brevo_${Date.now()}`,
    provider: "brevo",
    status: "sent",
  };
}
