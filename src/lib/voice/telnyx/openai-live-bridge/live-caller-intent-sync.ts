import "server-only";

import { createHash } from "node:crypto";

import { applyCallerIntentToCallContext } from "@/lib/voice-v2/caller-intent-interpreter";
import { callerMeaningToIntentInterpretation } from "@/lib/voice-v2/caller-meaning-apply";
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

export async function syncLiveCallerUtteranceIntent(input: {
  claims: RealtimeBridgeStreamClaims;
  callerUtterance: string;
  controlPlane: LiveControlPlane;
  sendLiveOut: (event: Record<string, unknown>) => void;
  dispatchContext?: LiveToolDispatchContext;
  autoDispatch?: boolean;
  stableUtterance?: StableCallerUtterance;
}): Promise<void> {
  const utterance = input.callerUtterance.trim();
  if (!utterance) return;

  const callId = input.claims.callId;
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
    return;
  }

  const stageBefore = input.controlPlane.getStage();
  const requiredBefore =
    input.controlPlane.getWorkflowEnvelope().required_action ?? null;

  try {
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
    const interpretationResult = await interpretStableCallerUtterance({
      priorActiveGoal: priorGoal,
      businessTimezone: ctx.businessTimezone,
      stable,
      callId,
    });

    if (!shouldApplyUtteranceInterpretation(callId, stable)) {
      console.info(
        `VOICE_CALLER_UTTERANCE_SUPERSEDED ${JSON.stringify({
          call_id: callId,
          utterance_id: stable.utterance_id,
          revision: stable.revision,
          phase: "post_interpret",
        })}`,
      );
      return;
    }

    const interpretation = callerMeaningToIntentInterpretation(interpretationResult.meaning);
    const turnId = stable.utterance_id;

    const applied = await applyCallerIntentToCallContext(ctx, interpretation, utterance, {
      turnId,
    });

    if (!shouldApplyUtteranceInterpretation(callId, stable)) {
      console.info(
        `VOICE_CALLER_UTTERANCE_SUPERSEDED ${JSON.stringify({
          call_id: callId,
          utterance_id: stable.utterance_id,
          revision: stable.revision,
          phase: "post_merge",
        })}`,
      );
      return;
    }

    if (applied.schedulingChanged && input.dispatchContext?.bumpSchedulingGeneration) {
      input.dispatchContext.bumpSchedulingGeneration("caller_scheduling_facts_superseded");
    }

    const nextCtx = {
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
        candidate_intent: interpretation.intent,
        confidence: interpretation.confidence,
        explicit: interpretation.explicit,
        evidence: interpretation.evidence?.slice(0, 500) ?? null,
      });
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

    console.info(
      `VOICE_STABLE_UTTERANCE_INTERPRETED ${JSON.stringify({
        call_id: callId,
        utterance_id: stable.utterance_id,
        revision: stable.revision,
        text_hash: utteranceTextHash(utterance),
        stable_text_hash: stableUtteranceTextHash(utterance),
        interpreter: interpretationResult.implementationId,
        interpretation_latency_ms: interpretationResult.latencyMs,
        fallback_reason: interpretationResult.fallbackReason ?? null,
        corrections: interpretationResult.meaning.corrections,
        ambiguities: interpretationResult.meaning.ambiguities,
        scheduling_changed: applied.schedulingChanged,
        facts_merged: {
          requested_date: interpretationResult.meaning.facts.requested_date ?? null,
          requested_daypart: interpretationResult.meaning.facts.requested_daypart ?? null,
        },
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
              knownRequestedDate: nextCtx.schedulingPreference?.requestedDate ?? wf.requestedDate ?? null,
            },
          ) ?? null,
        active_goal: interpretationResult.meaning.active_goal,
      })}`,
    );
  } catch (err) {
    console.error("[live-media] caller intent sync failed", err);
  }
}
