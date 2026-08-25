import "server-only";

import { appendRegistrationEvent, getRegistrationByWorkspace, updateRegistration } from "./store";
import {
  isTelnyxRegistrationProviderReady,
  registrationProviderName,
} from "./status";

/**
 * When Telnyx brand/campaign/number are approved at the provider, heal stale UI flags
 * (messagingEnabled, overallStatus) that background advance jobs may have cleared.
 */
export async function reconcileTelnyxSendStateIfNeeded(workspaceId: string): Promise<boolean> {
  const reg = await getRegistrationByWorkspace(workspaceId);
  if (!reg || registrationProviderName(reg) !== "telnyx") return false;
  if (!isTelnyxRegistrationProviderReady(reg)) return false;

  const staleOnboardingError =
    typeof reg.lastError === "string" &&
    /complete business details|use case before registration/i.test(reg.lastError);

  const needsHeal =
    !reg.messagingEnabled ||
    reg.overallStatus !== "ready" ||
    staleOnboardingError;

  if (!needsHeal) return false;

  const updated = await updateRegistration(workspaceId, {
    overallStatus: "ready",
    messagingEnabled: true,
    messagingActivationStatus: "approved",
    numberStatus: reg.phoneAttached ? "ready" : reg.numberStatus,
    lastError: null,
    registrationApprovedAt: reg.registrationApprovedAt || new Date(),
  });

  await appendRegistrationEvent({
    workspaceId,
    registrationId: updated.id,
    eventType: "telnyx_send_state_reconciled",
    message: "Healed stale messagingEnabled/overallStatus — Telnyx provider already approved",
    payload: {
      previousOverallStatus: reg.overallStatus,
      previousMessagingEnabled: reg.messagingEnabled,
      previousLastError: reg.lastError,
    },
  });

  console.log(
    JSON.stringify({
      service: "transovo-web",
      event: "telnyx_send_state_reconciled",
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
