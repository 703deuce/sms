import "server-only";

/**
 * Best-effort AR email readiness — uses existing Brevo/transactional configuration.
 */
export async function evaluateArEmailSenderReadiness(workspaceId: string): Promise<{
  ready: boolean;
  detail: string;
}> {
  const apiKey = process.env.BREVO_API_KEY?.trim() || process.env.SENDINBLUE_API_KEY?.trim();
  if (!apiKey) {
    return { ready: false, detail: "Transactional email API key is not configured on the server" };
  }
  const fromEmail =
    process.env.BREVO_SENDER_EMAIL?.trim() ||
    process.env.TRANSOVO_TRANSACTIONAL_FROM_EMAIL?.trim();
  if (!fromEmail) {
    return {
      ready: false,
      detail: "Transactional sender email is not configured (BREVO_SENDER_EMAIL)",
    };
  }
  return { ready: true, detail: `Sender ${fromEmail}` };
}
