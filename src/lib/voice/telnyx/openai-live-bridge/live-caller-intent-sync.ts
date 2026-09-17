import "server-only";

import {
  applyCallerIntentToCallContext,
  interpretCallerUtterance,
  logCallerIntentInterpretation,
} from "@/lib/voice-v2/caller-intent-interpreter";
import { dialogFromContext } from "@/lib/voice-v2/dialog-goal";
import {
  loadAuthoritativeCallContextForLive,
  logDialogStateChanged,
  persistCallContext,
} from "@/lib/voice-v2/dialog-manager";
import { ensureVoiceV2CallContext, resolveSessionKey } from "@/lib/voice-v2/intake/load-call-context";
import { getVoiceV2CallContext } from "@/lib/voice-v2/intake/session-store";
import type { LiveControlPlane } from "./live-control-plane";
import type { LiveToolDispatchContext } from "./live-tool-runtime";
import { runLiveControlPlaneTurn } from "./live-control-plane-turn";
import type { RealtimeBridgeStreamClaims } from "../openai-realtime-bridge/stream-token";

export async function syncLiveCallerUtteranceIntent(input: {
  claims: RealtimeBridgeStreamClaims;
  callerUtterance: string;
  controlPlane: LiveControlPlane;
  sendLiveOut: (event: Record<string, unknown>) => void;
  dispatchContext?: LiveToolDispatchContext;
  autoDispatch?: boolean;
}): Promise<void> {
  const utterance = input.callerUtterance.trim();
  if (!utterance) return;

  const sessionKey = resolveSessionKey({
    callControlId: input.claims.callControlId,
    conversationId: input.claims.callControlId,
  });
  if (!sessionKey) return;

  let ctx =
    (await loadAuthoritativeCallContextForLive({
      workspaceId: input.claims.workspaceId,
      agentId: input.claims.agentId,
      callControlId: input.claims.callControlId,
      prismaCallId: input.claims.callId,
    })) ??
    getVoiceV2CallContext(sessionKey) ??
    (await ensureVoiceV2CallContext({
      workspaceId: input.claims.workspaceId,
      agentId: input.claims.agentId,
      callControlId: input.claims.callControlId,
      conversationId: input.claims.callControlId,
      trustedPrismaCallId: input.claims.callId,
    }));
  if (!ctx) return;

  const priorGoal = dialogFromContext(ctx).activeGoal;
  const interpretation = interpretCallerUtterance(utterance, { activeGoal: priorGoal });
  const applied = await applyCallerIntentToCallContext(ctx, interpretation, utterance);

  const nextCtx = {
    ...applied.ctx,
    sessionKey: applied.ctx.sessionKey?.trim() || ctx.sessionKey?.trim() || sessionKey,
  };
  persistCallContext(nextCtx);

  if (applied.previousActiveGoal !== applied.resultingActiveGoal) {
    logDialogStateChanged({
      call_id: input.claims.callId,
      live_session_id: input.controlPlane.getLiveSessionId(),
      previous_active_goal: applied.previousActiveGoal,
      resulting_active_goal: applied.resultingActiveGoal,
      candidate_intent: interpretation.intent,
      confidence: interpretation.confidence,
      explicit: interpretation.explicit,
      evidence: interpretation.evidence?.slice(0, 500) ?? null,
    });
  }

  logCallerIntentInterpretation({
    call_id: input.claims.callId,
    live_session_id: input.controlPlane.getLiveSessionId(),
    caller_utterance: utterance.slice(0, 500),
    previous_active_goal: applied.previousActiveGoal,
    candidate_intent: interpretation.intent,
    confidence: interpretation.confidence,
    explicit: interpretation.explicit,
    evidence: interpretation.evidence,
    digression: interpretation.digression,
    resulting_active_goal: applied.resultingActiveGoal,
    voice_v2_next_stage: input.controlPlane.getStage(),
    allowed_next_actions: input.controlPlane.getWorkflowEnvelope().allowed_next_actions,
    required_action: input.controlPlane.getWorkflowEnvelope().required_action ?? null,
  });

  await runLiveControlPlaneTurn({
    controlPlane: input.controlPlane,
    sendLiveOut: input.sendLiveOut,
    dispatchContext: input.dispatchContext,
    autoDispatch: input.autoDispatch ?? Boolean(input.dispatchContext),
    reason: "caller_intent_sync",
  });
}
