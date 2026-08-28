import "server-only";

import { getOrCreateMassTextingBillingAccount, updateMassTextingLifecycle } from "@/lib/mass-texting/billing-account";
import { assertWorkspaceMessagingSendAllowed } from "@/lib/messaging/unified-send-gate";

/** Idempotent baseline when Mass Texting is opened or signed up. */
export async function ensureMassTextingWorkspaceBootstrap(workspaceId: string): Promise<void> {
  await getOrCreateMassTextingBillingAccount(workspaceId);
  await refreshMassTextingSendState(workspaceId);
}

/**
 * Reconcile billing lifecycle + shared workspace A2P before launch/review.
 * Telnyx is the source of truth; trial activates when the workspace campaign is provider-ready.
 */
export async function refreshMassTextingSendState(workspaceId: string): Promise<void> {
  const { refreshMassTextingTrialState, activateMassTextingTrial } = await import(
    "@/lib/mass-texting/trial-lifecycle"
  );

  await refreshMassTextingTrialState(workspaceId);
  const a2p = await assertWorkspaceMessagingSendAllowed(workspaceId);
  if (!a2p.allowed) return;

  const account = await getOrCreateMassTextingBillingAccount(workspaceId);
  if (account.lifecycleState === "PRODUCTION_A2P_PENDING") {
    await updateMassTextingLifecycle(workspaceId, "PRODUCTION_ACTIVE");
  }
  if (
    account.lifecycleState === "TRIAL_PENDING_A2P" ||
    account.lifecycleState === "TRIAL_ACTIVE"
  ) {
    await activateMassTextingTrial(workspaceId);
  }
}
