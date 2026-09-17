import "server-only";

import type { LiveControlPlane } from "./live-control-plane";
import { buildLiveControlPlaneSyncEvents } from "./live-backend-state-sync";
import {
  tryAutoDispatchRequiredAction,
  type LiveToolDispatchContext,
} from "./live-auto-dispatch";

export type LiveControlPlaneTurnInput = {
  controlPlane: LiveControlPlane;
  sendLiveOut?: (event: Record<string, unknown>) => void;
  dispatchContext?: LiveToolDispatchContext;
  /** When true, run deterministic required_action tools (FIND/BOOK) from registry. */
  autoDispatch?: boolean;
  reason: string;
};

/**
 * Canonical post-mutation pipeline: persist already done → rehydrate → sync tools → optional auto-dispatch → re-sync.
 */
export async function runLiveControlPlaneTurn(
  input: LiveControlPlaneTurnInput,
): Promise<void> {
  input.controlPlane.invalidateContextCache();
  await input.controlPlane.ensureHydrated();
  input.controlPlane.logStageTransitionIfChanged();

  if (input.sendLiveOut) {
    for (const event of buildLiveControlPlaneSyncEvents(input.controlPlane)) {
      input.sendLiveOut(event);
    }
  }

  if (input.autoDispatch && input.dispatchContext && input.sendLiveOut) {
    const first = await tryAutoDispatchRequiredAction({
      controlPlane: input.controlPlane,
      dispatchContext: input.dispatchContext,
      sendLiveOut: input.sendLiveOut,
    });
    if (first.dispatched) {
      await runLiveControlPlaneTurn({
        ...input,
        autoDispatch: true,
        reason: `${input.reason}_after_${first.toolName}`,
      });
    }
  }

  console.info(
    `LIVE_CONTROL_PLANE_TURN ${JSON.stringify({
      call_id: input.controlPlane.callId,
      reason: input.reason,
      stage: input.controlPlane.getStage(),
      required_action: input.controlPlane.getWorkflowEnvelope().required_action ?? null,
      allowed_next_actions: input.controlPlane.getWorkflowEnvelope().allowed_next_actions,
    })}`,
  );
}
