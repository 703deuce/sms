import "server-only";

import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { getForwardingVerificationStatus } from "@/lib/mctb/onboarding/forwarding-verification";
import { recordMctbHandoffEvent } from "@/lib/mctb/handoff/events";
import { createMctbLeadSnapshot } from "@/lib/mctb/handoff/snapshot";
import { deliverMctbHandoffNotifications } from "@/lib/mctb/handoff/notifications";

const STALE_TEST_MS = 2 * 60 * 60 * 1000;

/**
 * When a workspace previously passed live setup but a re-verification test goes stale
 * without detecting a call, alert the team (idempotent per test start).
 */
export async function maybeNotifyForwardingDegraded(workspaceId: string): Promise<void> {
  const state = await loadMctbOnboardingState(workspaceId);
  if (!state.liveTestPassedAt) return;
  if (!state.forwardingTestStartedAt) return;

  const status = await getForwardingVerificationStatus(workspaceId);
  if (status.verified || status.callDetected) return;

  const startedMs = Date.parse(state.forwardingTestStartedAt);
  if (!Number.isFinite(startedMs) || Date.now() - startedMs < STALE_TEST_MS) return;

  const idempotencyKey = `forwarding-degraded:${workspaceId}:${state.forwardingTestStartedAt}`;
  const { created, event } = await recordMctbHandoffEvent({
    workspaceId,
    eventType: "forwarding_degraded",
    idempotencyKey,
    metadata: {
      businessLineE164: state.businessNumberE164,
      forwardTargetE164: status.forwardTargetE164,
      testStartedAt: state.forwardingTestStartedAt,
    },
  });
  if (!created) return;

  const facts = {
    callerName: "Forwarding check",
    callerPhone: state.businessNumberE164 || undefined,
    serviceReason: "We have not detected a forwarded test call to your Transovo number.",
    additionalDetails:
      "Open Phone & Forwarding and run Test connection, or confirm carrier conditional forwarding is still enabled.",
  };

  await createMctbLeadSnapshot({
    workspaceId,
    triggerEvent: "forwarding_degraded",
    customerFacts: facts,
  });

  await deliverMctbHandoffNotifications({
    workspaceId,
    handoffEventId: event.id,
    eventType: "forwarding_degraded",
    facts,
    derived: { requestedAction: "Verify call forwarding" },
  }).catch(() => undefined);
}
