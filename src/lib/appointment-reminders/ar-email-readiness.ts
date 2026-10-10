import "server-only";

import { getPrisma } from "@/lib/db";
import { resolveTransactionalEmailSenderConfig } from "@/lib/email/brevo";

/**
 * Appointment Reminders email readiness — must match `sendTransactionalEmail` / Brevo config.
 * Uses the shared Transovo Brevo integration (not per-workspace Brevo accounts).
 */
export async function evaluateArEmailSenderReadiness(workspaceId: string): Promise<{
  ready: boolean;
  detail: string;
}> {
  const cfg = resolveTransactionalEmailSenderConfig();
  const workspace = await getPrisma().workspace.findUnique({
    where: { id: workspaceId },
    select: { displayName: true, name: true },
  });
  const businessName = workspace?.displayName || workspace?.name || "Your business";

  if (!cfg.productionReady) {
    if (!cfg.apiKeyConfigured) {
      return {
        ready: false,
        detail:
          "Transovo email delivery is not active on this environment yet. SMS reminders can still work; contact support if you need email reminders.",
      };
    }
    return {
      ready: false,
      detail:
        "Transovo’s verified sender address is not configured yet. You do not need your own Brevo account — contact support to enable email reminders.",
    };
  }

  return {
    ready: true,
    detail: `Email reminders send from Transovo’s verified address as “${businessName}”.`,
  };
}
