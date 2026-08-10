import type { AgentSession } from "@livekit/agents";
import { autoCaptureCallerInformationFromUtterance } from "@/lib/voice/agent-runtime/auto-capture-caller-info";
import { executeDeterministicPipeline } from "@/lib/voice/agent-runtime/deterministic-executor";
import { autoApplyCallerIntentFromUtterance } from "@/lib/voice/workflow-runtime/auto-intent";
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

  const autoCapture = await autoCaptureCallerInformationFromUtterance({
    ctx: callContext,
    userText: transcript,
  });

  const autoIntent = await autoApplyCallerIntentFromUtterance({
    ctx: autoCapture.ctx,
    userText: transcript,
    intentToolAlreadyCalled: false,
  });

  let ctx = autoIntent.ctx;
  const pipeline = await executeDeterministicPipeline({
    ctx,
    preferenceSpoken: transcript,
  });
  ctx = pipeline.ctx;

  if (!autoCapture.applied && !autoIntent.applied && pipeline.steps.length === 0) return;

  session.userData = { ...session.userData, callContext: ctx };
  await syncAmyAgentFromContext(session, ctx);

  console.log(
    JSON.stringify({
      source: "transovo-voice-runtime",
      event: "auto_turn_actions_applied",
      callId: ctx.callId,
      captureApplied: autoCapture.applied,
      intentApplied: autoIntent.applied,
      deterministicSteps: pipeline.steps.map((s) => ({
        toolName: s.toolName,
        ok: s.ok,
      })),
    }),
  );
}
