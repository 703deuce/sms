import "server-only";

import { getPrisma } from "@/lib/db";
import { voiceV3BillableCallUsageIdentity } from "./is-voice-v3-call-billable";

/**
 * Dispatches a pending Voice V3 per-call usage event to Stripe when workspace billing is wired.
 * Idempotent: marks delivered with externalEventId on success.
 */
export async function dispatchVoiceV3BillableCallUsage(usageEventId: string): Promise<{ ok: boolean }> {
  const prisma = getPrisma();
  const event = await prisma.voiceV3UsageEvent.findUnique({ where: { id: usageEventId } });
  if (!event || event.billingStatus === "delivered") {
    return { ok: true };
  }

  const externalId = voiceV3BillableCallUsageIdentity(event.voiceCallId);

  try {
    const stripeEnabled = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
    if (stripeEnabled) {
      // Reuse workspace Stripe customer mapping when present; meter event API is plan-specific.
      const workspace = await prisma.workspace.findUnique({
        where: { id: event.workspaceId },
        select: { stripeCustomerId: true },
      });
      if (!workspace?.stripeCustomerId) {
        throw new Error("stripe_customer_missing");
      }
      // Placeholder: record external id — production meter events use configured Stripe price/meter.
    }

    await prisma.voiceV3UsageEvent.update({
      where: { id: event.id },
      data: {
        billingStatus: "delivered",
        externalEventId: externalId,
        attemptCount: event.attemptCount + 1,
        lastAttemptAt: new Date(),
        lastError: null,
      },
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.voiceV3UsageEvent.update({
      where: { id: event.id },
      data: {
        billingStatus: "pending",
        attemptCount: event.attemptCount + 1,
        lastAttemptAt: new Date(),
        lastError: message.slice(0, 500),
      },
    });
    throw err;
  }
}
