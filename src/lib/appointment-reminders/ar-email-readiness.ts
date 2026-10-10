import "server-only";

import { resolveTransactionalEmailSenderConfig } from "@/lib/email/brevo";

/**
 * Appointment Reminders email readiness — must match `sendTransactionalEmail` / Brevo config.
 */
export async function evaluateArEmailSenderReadiness(
  _workspaceId: string,
): Promise<{
  ready: boolean;
  detail: string;
}> {
  const cfg = resolveTransactionalEmailSenderConfig();
  if (!cfg.apiKeyConfigured) {
    return {
      ready: false,
      detail:
        "Email sending is not configured on this environment. Contact support if you need email reminders.",
    };
  }
  if (!cfg.fromEmail) {
    return {
      ready: false,
      detail:
        "Transactional sender address is not configured. Contact support — you do not need your own Brevo account.",
    };
  }
  return {
    ready: true,
    detail: "Platform email sending is configured",
  };
}
