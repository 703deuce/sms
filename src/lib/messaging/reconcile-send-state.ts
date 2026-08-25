import "server-only";

import { appendRegistrationEvent, getRegistrationByWorkspace, updateRegistration } from "./store";
import {
  isTelnyxProviderA2pApproved,
  telnyxProviderApprovedRegistrationPatch,
} from "./messaging-authority";
import { registrationProviderName } from "./status";

/**
 * Sync Telnyx provider approval inward — never downgrade based on local form fields.
 */
export async function reconcileTelnyxSendStateIfNeeded(workspaceId: string): Promise<boolean> {
  const reg = await getRegistrationByWorkspace(workspaceId);
  if (!reg || registrationProviderName(reg) !== "telnyx") return false;
  if (!isTelnyxProviderA2pApproved(reg)) return false;

  const patch = telnyxProviderApprovedRegistrationPatch(reg);
  const needsHeal =
    !reg.messagingEnabled ||
    reg.overallStatus !== "ready" ||
    (typeof reg.lastError === "string" && reg.lastError.length > 0);

  if (!needsHeal) return false;

  const updated = await updateRegistration(workspaceId, patch);

  await appendRegistrationEvent({
    workspaceId,
    registrationId: updated.id,
    eventType: "telnyx_provider_state_synced",
    message: "Synced inward from Telnyx provider approval (no local form re-judge)",
    payload: {
      previousOverallStatus: reg.overallStatus,
      previousMessagingEnabled: reg.messagingEnabled,
      previousLastError: reg.lastError,
    },
  });

  console.log(
    JSON.stringify({
      service: "transovo-web",
      event: "telnyx_provider_state_synced",
      workspaceId,
      previousOverallStatus: reg.overallStatus,
      previousMessagingEnabled: reg.messagingEnabled,
    }),
  );

  return true;
}

/** Reconcile platform demo owner + optional workspace list (boot / pre-send). */
export async function reconcileCriticalMessagingSendState(
  workspaceIds: string[],
): Promise<number> {
  let healed = 0;
  for (const workspaceId of workspaceIds) {
    if (await reconcileTelnyxSendStateIfNeeded(workspaceId)) healed += 1;
  }
  return healed;
}
