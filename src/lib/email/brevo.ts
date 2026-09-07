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
  attachments?: Array<{ name: string; content: string }>;
};

export type SendEmailResult = {
  id: string;
  provider: "brevo" | "stub";
  status: "queued" | "sent" | "failed";
  error?: string;
};

export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const fromEmail = process.env.REVIEW_REQUEST_FROM_EMAIL?.trim() || process.env.BREVO_FROM_EMAIL?.trim();
  const fromName = process.env.REVIEW_REQUEST_FROM_NAME?.trim() || "Transovo";

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
      error: "BREVO_FROM_EMAIL or REVIEW_REQUEST_FROM_EMAIL required when BREVO_API_KEY is set",
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
