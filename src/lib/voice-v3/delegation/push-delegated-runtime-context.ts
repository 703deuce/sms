import {
  buildAstraBusinessContext,
  formatAstraBusinessContextForThinking,
} from "../agent/astra-business-context";
import { buildIntakeObjectiveContext } from "../intake-objective";
import { buildSharedCallerFactsLiveSummary } from "../intake-objective/build-shared-caller-facts";
import { LiveContextPublisher } from "../live/live-context-publisher";
import { logVoiceV3Pipeline } from "../telemetry/pipeline-log";
import {
  buildAuthoritativeThinkingSnapshot,
  getVoiceV3CallRuntime,
} from "../state/call-runtime";

/**
 * Golden-era parity: every fresh Amy→Astra delegation must see the same authoritative
 * call runtime (intake values, goal, scheduling) — not only static session instructions.
 * Phase 10 business projection was compiled but never wired until this hook.
 */
export function pushDelegatedRuntimeContextToLive(input: {
  liveSessionId: string;
  delegationId: string | null;
  send: (event: { type: string; [key: string]: unknown }) => void;
}): void {
  const runtime = getVoiceV3CallRuntime(input.liveSessionId);
  if (!runtime) {
    logVoiceV3Pipeline("delegation", "runtime_context_skipped", {
      live_session_id: input.liveSessionId,
      reason: "no_runtime",
    });
    return;
  }

  const config = runtime.config;
  const ctx = runtime.getSnapshot();
  const publisher = new LiveContextPublisher(input.send);
  const delegationId = input.delegationId;

  const thinking = [
    buildAuthoritativeThinkingSnapshot(runtime),
    formatAstraBusinessContextForThinking(buildAstraBusinessContext(ctx, config)),
    buildIntakeObjectiveContext(config, ctx),
  ].join("\n\n");

  publisher.appendThinking(thinking, delegationId);
  publisher.appendCommentary(buildSharedCallerFactsLiveSummary(config, ctx), delegationId);

  logVoiceV3Pipeline("delegation", "runtime_context_pushed", {
    live_session_id: input.liveSessionId,
    delegation_id: delegationId,
    call_id: ctx.callId,
    state_version: ctx.runtime.version,
    active_goal: ctx.dialog.activeGoal,
  });
}
