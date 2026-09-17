import "server-only";

import { createHash } from "node:crypto";

import { applyCallerMeaningToCallContext } from "@/lib/voice-v2/caller-meaning-apply";
import { buildInterpreterContext } from "@/lib/voice-v2/build-interpreter-context";
import { interpretStableCallerUtterance } from "@/lib/voice-v2/resolve-caller-interpreter";
import { stableUtteranceTextHash } from "@/lib/voice-v2/astra-caller-interpreter";
import { dialogFromContext } from "@/lib/voice-v2/dialog-goal";
import { workflowFromContext } from "@/lib/voice-v2/booking-workflow";
import {
  loadAuthoritativeCallContextForLive,
  logDialogStateChanged,
  persistCallContext,
} from "@/lib/voice-v2/dialog-manager";
import { ensureVoiceV2CallContext, resolveSessionKey } from "@/lib/voice-v2/intake/load-call-context";
import { isTrustedPrismaVoiceCallId } from "@/lib/voice-v2/intake/resolve-trusted-call-id";
import { getVoiceV2CallContext } from "@/lib/voice-v2/intake/session-store";
import { getIntakeReadiness } from "@/lib/voice-v2/intake/readiness";
import { deriveRequiredActionForStage } from "@/lib/voice-v2/booking-workflow";
import type { LiveControlPlane } from "./live-control-plane";
import type { LiveToolDispatchContext } from "./live-tool-runtime";
import { runLiveControlPlaneTurn } from "./live-control-plane-turn";
import type { RealtimeBridgeStreamClaims } from "../openai-realtime-bridge/stream-token";
import type { StableCallerUtterance } from "./live-caller-utterance-assembler";
import {
  beginUtteranceInterpretation,
  markUtteranceInterpretationApplied,
  registerStableCallerUtterance,
  shouldApplyUtteranceInterpretation,
} from "./live-utterance-revision-guard";

function utteranceTextHash(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex").slice(0, 16);
}

export type SyncLiveCallerUtteranceIntentResult = {
  terminal: "interpreted" | "superseded" | "failed" | "rejected" | "queued";
  reason?: string;
  phase?: string;
};

function logStableUtteranceFailed(fields: Record<string, unknown>) {
  console.info(`VOICE_STABLE_UTTERANCE_FAILED ${JSON.stringify(fields)}`);
}

function logStableUtteranceRejected(fields: Record<string, unknown>) {
  console.info(`VOICE_STABLE_UTTERANCE_REJECTED ${JSON.stringify(fields)}`);
}

export async function syncLiveCallerUtteranceIntent(input: {
  claims: RealtimeBridgeStreamClaims;
  callerUtterance: string;
  fullConversationTranscript: string;
  controlPlane: LiveControlPlane;
  sendLiveOut: (event: Record<string, unknown>) => void;
  dispatchContext?: LiveToolDispatchContext;
  autoDispatch?: boolean;
  stableUtterance?: StableCallerUtterance;
}): Promise<SyncLiveCallerUtteranceIntentResult> {
  const utterance = input.callerUtterance.trim();
  const callId = input.claims.callId;
  if (!utterance) {
    logStableUtteranceRejected({
      call_id: callId,
      reason: "empty_utterance",
    });
    return { terminal: "rejected", reason: "empty_utterance" };
  }

  const stable =
    input.stableUtterance ??
    ({
      utterance_id: `legacy_${Date.now()}`,
      revision: 1,
      start_ms: 0,
      end_ms: 0,
      stable_at: Date.now(),
      text: utterance,
    } satisfies StableCallerUtterance);

  registerStableCallerUtterance(callId, stable);
  if (!beginUtteranceInterpretation(callId, stable)) {
    console.info(
      `VOICE_CALLER_UTTERANCE_SUPERSEDED ${JSON.stringify({
        call_id: callId,
        utterance_id: stable.utterance_id,
        revision: stable.revision,
        phase: "begin",
      })}`,
    );
    return { terminal: "superseded", phase: "begin" };
  }

  const stageBefore = input.controlPlane.getStage();
  const requiredBefore =
    input.controlPlane.getWorkflowEnvelope().required_action ?? null;

  try {
    const sessionKey = resolveSessionKey({
      callControlId: input.claims.callControlId,
      conversationId: input.claims.callControlId,
    });
    if (!sessionKey) {
      logStableUtteranceFailed({
        call_id: callId,
        utterance_id: stable.utterance_id,
        revision: stable.revision,
        reason: "missing_session_key",
      });
      return { terminal: "failed", reason: "missing_session_key" };
    }

    const trustedPrisma = isTrustedPrismaVoiceCallId(callId) ? callId : undefined;
    let ctx =
      getVoiceV2CallContext(sessionKey) ??
      (await loadAuthoritativeCallContextForLive({
        workspaceId: input.claims.workspaceId,
        agentId: input.claims.agentId,
        callControlId: input.claims.callControlId,
        prismaCallId: callId,
      })) ??
      (await ensureVoiceV2CallContext({
        workspaceId: input.claims.workspaceId,
        agentId: input.claims.agentId,
        callControlId: input.claims.callControlId,
        conversationId: input.claims.callControlId,
        trustedPrismaCallId: trustedPrisma,
      }));
    if (!ctx) {
      logStableUtteranceFailed({
        call_id: callId,
        utterance_id: stable.utterance_id,
        revision: stable.revision,
        reason: "missing_call_context",
        session_key: sessionKey,
      });
      return { terminal: "failed", reason: "missing_call_context" };
    }

    const interpreterCtx = await buildInterpreterContext({
      stable,
      fullConversationTranscript: input.fullConversationTranscript,
      callContext: ctx,
      currentWorkflowStage: input.controlPlane.getStage(),
      callId,
    });

    const interpretationResult = await interpretStableCallerUtterance(interpreterCtx);

    if (!shouldApplyUtteranceInterpretation(callId, stable)) {
      console.info(
        `VOICE_CALLER_UTTERANCE_SUPERSEDED ${JSON.stringify({
          call_id: callId,
          utterance_id: stable.utterance_id,
          revision: stable.revision,
          phase: "post_interpret",
        })}`,
      );
      return { terminal: "superseded", phase: "post_interpret" };
    }

    const turnId = stable.utterance_id;
    const ctxBeforeJson = JSON.stringify({
      goal: dialogFromContext(ctx).activeGoal,
      scheduling: ctx.schedulingPreference?.requestedDate ?? null,
      email: ctx.intakeState.email?.value ?? null,
    });

    const applied = await applyCallerMeaningToCallContext(
      ctx,
      interpretationResult.meaning,
      interpretationResult.mergePolicy,
      { turnId },
    );

    if (!shouldApplyUtteranceInterpretation(callId, stable)) {
      console.info(
        `VOICE_CALLER_UTTERANCE_SUPERSEDED ${JSON.stringify({
          call_id: callId,
          utterance_id: stable.utterance_id,
          revision: stable.revision,
          phase: "post_merge",
        })}`,
      );
      return { terminal: "superseded", phase: "post_merge" };
    }

    let nextCtx = applied.ctx;
    if (interpretationResult.mergePolicy !== "none") {
      if (applied.schedulingChanged && input.dispatchContext?.bumpSchedulingGeneration) {
        input.dispatchContext.bumpSchedulingGeneration("caller_scheduling_facts_superseded");
      }
      nextCtx = {
        ...applied.ctx,
        sessionKey: applied.ctx.sessionKey?.trim() || ctx.sessionKey?.trim() || sessionKey,
      };
      persistCallContext(nextCtx);
      markUtteranceInterpretationApplied(callId, stable);

      if (applied.previousActiveGoal !== applied.resultingActiveGoal) {
        logDialogStateChanged({
          call_id: input.claims.callId,
          live_session_id: input.controlPlane.getLiveSessionId(),
          previous_active_goal: applied.previousActiveGoal,
          resulting_active_goal: applied.resultingActiveGoal,
          candidate_intent: interpretationResult.meaning.active_goal,
          confidence: interpretationResult.meaning.confidence,
          explicit: interpretationResult.meaning.explicit_action_requests.length > 0,
          evidence: interpretationResult.meaning.evidence?.slice(0, 500) ?? null,
        });
      }
    } else {
      markUtteranceInterpretationApplied(callId, stable);
    }

    await runLiveControlPlaneTurn({
      controlPlane: input.controlPlane,
      sendLiveOut: input.sendLiveOut,
      dispatchContext: input.dispatchContext,
      autoDispatch: input.autoDispatch ?? Boolean(input.dispatchContext),
      reason: "caller_intent_sync",
    });

    const stageAfter = input.controlPlane.getStage();
    const requiredAfter =
      input.controlPlane.getWorkflowEnvelope().required_action ?? null;
    const wf = workflowFromContext(nextCtx);
    const ctxAfterJson = JSON.stringify({
      goal: dialogFromContext(nextCtx).activeGoal,
      scheduling: nextCtx.schedulingPreference?.requestedDate ?? null,
      email: nextCtx.intakeState.email?.value ?? null,
    });

    console.info(
      `VOICE_STABLE_UTTERANCE_INTERPRETED ${JSON.stringify({
        call_id: callId,
        utterance_id: stable.utterance_id,
        revision: stable.revision,
        text_hash: utteranceTextHash(utterance),
        stable_text_hash: stableUtteranceTextHash(utterance),
        transcript_chars: input.fullConversationTranscript.length,
        interpreter: interpretationResult.implementationId,
        merge_policy: interpretationResult.mergePolicy,
        interpretation_latency_ms: interpretationResult.latencyMs,
        fallback_reason: interpretationResult.fallbackReason ?? null,
        corrections: interpretationResult.meaning.corrections,
        ambiguities: interpretationResult.meaning.ambiguities,
        scheduling_changed: applied.schedulingChanged,
        facts_merged: interpretationResult.meaning.facts,
        call_context_before: ctxBeforeJson,
        call_context_after: ctxAfterJson,
        stage_before: stageBefore,
        stage_after: stageAfter,
        required_action_before: requiredBefore,
        required_action_after: requiredAfter,
        auto_dispatch_key:
          deriveRequiredActionForStage(
            stageAfter,
            wf,
            getIntakeReadiness(nextCtx.intakeSchema, nextCtx.intakeState),
            {
              hasActiveOfferSet: Boolean(nextCtx.currentOfferSet?.offerSetId),
              knownRequestedDate:
                nextCtx.schedulingPreference?.requestedDate ?? wf.requestedDate ?? null,
            },
          ) ?? null,
        active_goal: interpretationResult.meaning.active_goal,
      })}`,
    );
    return { terminal: "interpreted" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logStableUtteranceFailed({
      call_id: callId,
      utterance_id: stable.utterance_id,
      revision: stable.revision,
      reason: "interpreter_sync_exception",
      error: message,
    });
    console.error("[live-media] caller intent sync failed", err);
    return { terminal: "failed", reason: "interpreter_sync_exception" };
  }
}
