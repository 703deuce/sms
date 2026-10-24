import { buildSharedCallerFactsLiveSummary } from "../intake-objective/build-shared-caller-facts";
import { capLiveContextAppendText } from "../live/live-context-append-limits";
import { LiveContextPublisher } from "../live/live-context-publisher";
import { logVoiceV3Pipeline } from "../telemetry/pipeline-log";
import { getVoiceV3CallRuntime } from "../state/call-runtime";

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

  // GPT-Live: avoid mid-call instruction-sized thinking updates; short commentary only.
  publisher.appendCommentary(
    capLiveContextAppendText(buildSharedCallerFactsLiveSummary(config, ctx)),
    delegationId,
  );

  logVoiceV3Pipeline("delegation", "runtime_context_pushed", {
    live_session_id: input.liveSessionId,
    delegation_id: delegationId,
    call_id: ctx.callId,
    state_version: ctx.runtime.version,
    active_goal: ctx.dialog.activeGoal,
  });
}
