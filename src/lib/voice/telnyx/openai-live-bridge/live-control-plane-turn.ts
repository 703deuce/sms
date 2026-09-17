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
 * Canonical post-mutation pipeline: persist already done → rehydrate → auto-dispatch → sync Live tools.
 * No delegation episode required; runs on every caller-intent merge and post-tool state change.
 */
export async function runLiveControlPlaneTurn(
  input: LiveControlPlaneTurnInput,
): Promise<void> {
  input.controlPlane.invalidateContextCache();
  await input.controlPlane.ensureHydrated();
  input.controlPlane.logStageTransitionIfChanged();

  let dispatchedTool: string | undefined;
  const requiredBeforeDispatch =
    input.controlPlane.getWorkflowEnvelope().required_action ?? null;
  if (input.autoDispatch && input.dispatchContext) {
    const first = await tryAutoDispatchRequiredAction({
      controlPlane: input.controlPlane,
      dispatchContext: input.dispatchContext,
      sendLiveOut: input.sendLiveOut,
    });
    if (first.dispatched) {
      dispatchedTool = first.toolName;
      input.controlPlane.invalidateContextCache();
      await input.controlPlane.ensureHydrated();
      input.controlPlane.logStageTransitionIfChanged();
    }
  }

  if (input.sendLiveOut) {
    for (const event of buildLiveControlPlaneSyncEvents(input.controlPlane)) {
      input.sendLiveOut(event);
    }
  }

  if (dispatchedTool) {
    const requiredAfter =
      input.controlPlane.getWorkflowEnvelope().required_action ?? null;
    const stageAfter = input.controlPlane.getStage();
    const progressed =
      requiredAfter !== requiredBeforeDispatch || requiredAfter !== dispatchedTool;
    if (progressed) {
      await runLiveControlPlaneTurn({
        ...input,
        autoDispatch: true,
        reason: `${input.reason}_after_${dispatchedTool}`,
      });
    } else {
      console.warn(
        `LIVE_CONTROL_PLANE_TURN_STALLED ${JSON.stringify({
          call_id: input.controlPlane.callId,
          tool: dispatchedTool,
          stage: stageAfter,
          required_action: requiredAfter,
        })}`,
      );
    }
    return;
  }

  console.info(
    `LIVE_CONTROL_PLANE_TURN ${JSON.stringify({
      call_id: input.controlPlane.callId,
      reason: input.reason,
      stage: input.controlPlane.getStage(),
      required_action: input.controlPlane.getWorkflowEnvelope().required_action ?? null,
      runtime_owned_actions: input.controlPlane.getWorkflowEnvelope().runtime_owned_actions,
      delegation_allowed_actions:
        input.controlPlane.getWorkflowEnvelope().delegation_allowed_actions,
    })}`,
  );
}
