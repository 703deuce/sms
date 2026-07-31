import { getPrisma } from "@/lib/db";

export type EntitlementResult = { ok: true } | { ok: false; error: string };

function outboundPaused(): boolean {
  return (
    process.env.MESSAGING_OUTBOUND_PAUSED === "1" ||
    process.env.MESSAGING_OUTBOUND_PAUSED === "true"
  );
}

/**
 * Entitlement gate for outbound sends. Blocks when:
 * - outbound messaging is paused for the environment,
 * - the workspace billing plan is suspended,
 * - the workspace credit balance has gone negative.
 */
export async function checkCreditBalance(workspaceId: string): Promise<EntitlementResult> {
  if (!workspaceId) return { ok: false, error: "workspaceId required" };
  if (outboundPaused()) {
    return { ok: false, error: "Outbound messaging is paused for this environment" };
  }

  let workspace: {
    billingPlan?: string | null;
    creditBalanceCents?: number | null;
    stripeCustomerId?: string | null;
  } | null = null;
  try {
    workspace = await getPrisma().workspace.findUnique({ where: { id: workspaceId } });
  } catch {
    // If billing state is unavailable, do not hard-block sends on infra errors.
    return { ok: true };
  }

  if (!workspace) return { ok: false, error: "Workspace not found" };

  const plan = (workspace.billingPlan || "").toLowerCase();
  if (plan === "suspended") {
    return { ok: false, error: "Workspace billing is suspended" };
  }
  if (plan === "trial_pending_card" && !workspace.stripeCustomerId && process.env.STRIPE_SECRET_KEY?.trim()) {
    return {
      ok: false,
      error: "Add a payment method in Settings → Billing to finish trial setup before sending.",
    };
  }

  if (Number(workspace.creditBalanceCents ?? 0) < 0) {
    return { ok: false, error: "Insufficient credit balance — add credits to continue sending" };
  }

  return { ok: true };
}
