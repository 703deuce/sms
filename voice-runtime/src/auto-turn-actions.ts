import type { AgentSession } from "@livekit/agents";
import { autoApplyCallerIntentFromUtterance } from "@/lib/voice/workflow-runtime/auto-intent";
import { executeDeterministicPipeline } from "@/lib/voice/agent-runtime/deterministic-executor";
import type { AmyProcessUserData } from "./metadata";
import { syncAmyAgentFromContext } from "./amy-tools";

/**
 * Apply authoritative runtime actions from final caller transcripts before the LLM turn.
 */
export async function applyAutoTurnActionsFromTranscript(
  session: AgentSession<AmyProcessUserData>,
  transcript: string,
): Promise<void> {
  const callContext = session.userData.callContext;
  if (!callContext || !transcript.trim()) return;

  callContext.session.lastUserUtterance = transcript;

  const autoIntent = await autoApplyCallerIntentFromUtterance({
    ctx: callContext,
    userText: transcript,
    intentToolAlreadyCalled: false,
  });

  let ctx = autoIntent.ctx;
  const pipeline = await executeDeterministicPipeline({
    ctx,
    preferenceSpoken: transcript,
  });
  ctx = pipeline.ctx;

  if (!autoIntent.applied && pipeline.steps.length === 0) return;

  session.userData = { ...session.userData, callContext: ctx };
  await syncAmyAgentFromContext(session, ctx);

  console.log(
    JSON.stringify({
      source: "transovo-voice-runtime",
      event: "auto_turn_actions_applied",
      callId: ctx.callId,
      intentApplied: autoIntent.applied,
      deterministicSteps: pipeline.steps.map((s) => ({
        toolName: s.toolName,
        ok: s.ok,
      })),
    }),
  );
}
