import "server-only";

import { getOrCreateMassTextingBillingAccount } from "@/lib/mass-texting/billing-account";
import {
  ensureMessagingProductRegistration,
  getMessagingProductRegistration,
  syncMassTextRegistrationFromTelnyx,
} from "@/lib/mass-texting/messaging-registration";

/** Idempotent baseline when Mass Texting is opened or signed up. */
export async function ensureMassTextingWorkspaceBootstrap(workspaceId: string): Promise<void> {
  await getOrCreateMassTextingBillingAccount(workspaceId);
  await ensureMessagingProductRegistration(workspaceId, "MASS_TEXT_MARKETING");
  await refreshMassTextingSendState(workspaceId);
}

/**
 * Reconcile billing lifecycle + A2P registration before launch/review.
 * Telnyx is the source of truth for number A2P; trial activates when provider-ready.
 */
export async function refreshMassTextingSendState(workspaceId: string): Promise<void> {
  await ensureMessagingProductRegistration(workspaceId, "MASS_TEXT_MARKETING");

  await syncMassTextRegistrationFromTelnyx(workspaceId);

  const { refreshMassTextingTrialState, activateMassTextingTrial } = await import(
    "@/lib/mass-texting/trial-lifecycle"
  );

  await refreshMassTextingTrialState(workspaceId);
  const reg = await getMessagingProductRegistration(workspaceId, "MASS_TEXT_MARKETING");
  if (
    reg &&
    reg.messagingEnabled &&
    reg.phoneAttached &&
    ["approved", "certified", "ready"].includes(reg.overallStatus)
  ) {
    await activateMassTextingTrial(workspaceId);
  }
}
