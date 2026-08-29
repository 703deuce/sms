import "server-only";

import { getOrCreateMassTextingBillingAccount, updateMassTextingLifecycle } from "@/lib/mass-texting/billing-account";
import { assertWorkspaceMessagingSendAllowed } from "@/lib/messaging/unified-send-gate";

/** Idempotent baseline when Mass Texting is opened or signed up (DB only). */
export async function ensureMassTextingWorkspaceBootstrap(workspaceId: string): Promise<void> {
  await getOrCreateMassTextingBillingAccount(workspaceId);
  await refreshMassTextingSendState(workspaceId);
}

/**
 * Reconcile billing lifecycle from cached A2P registration — no Telnyx API calls.
 * Use syncMassTextingSendStateFromTelnyx when provider state must be refreshed.
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

/** Explicit Telnyx reconciliation — compliance page refresh, post-registration change. */
export async function syncMassTextingSendStateFromTelnyx(workspaceId: string): Promise<void> {
  const { syncWorkspaceMessagingFromTelnyx } = await import(
    "@/lib/messaging/unified-send-gate"
  );
  await syncWorkspaceMessagingFromTelnyx(workspaceId);
  await refreshMassTextingSendState(workspaceId);
}
