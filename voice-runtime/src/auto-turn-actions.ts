import type { AgentSession } from "@livekit/agents";
import { autoApplyCallerIntentFromUtterance } from "@/lib/voice/workflow-runtime/auto-intent";
import { autoApplyWorkflowActionsFromUtterance } from "@/lib/voice/workflow-runtime/auto-workflow-actions";
import type { AmyProcessUserData } from "./metadata";
import { syncAmyAgentFromContext } from "./amy-tools";

/**
 * Apply authoritative runtime actions from final caller transcripts before the LLM turn.
 * Mirrors text-simulator post-turn auto-apply for phone parity.
 */
export async function applyAutoTurnActionsFromTranscript(
  session: AgentSession<AmyProcessUserData>,
  transcript: string,
): Promise<void> {
  const callContext = session.userData.callContext;
  if (!callContext || !transcript.trim()) return;

  const autoIntent = await autoApplyCallerIntentFromUtterance({
    ctx: callContext,
    userText: transcript,
    intentToolAlreadyCalled: false,
  });

  let ctx = autoIntent.ctx;
  const autoWorkflow = await autoApplyWorkflowActionsFromUtterance({
    ctx,
    userText: transcript,
    toolsCalledThisTurn: autoIntent.applied ? ["detect_caller_intent"] : [],
  });
  ctx = autoWorkflow.ctx;

  if (!autoIntent.applied && autoWorkflow.actions.length === 0) return;

  session.userData = { ...session.userData, callContext: ctx };
  await syncAmyAgentFromContext(session, ctx);

  console.log(
    JSON.stringify({
      source: "transovo-voice-runtime",
      event: "auto_turn_actions_applied",
      callId: ctx.callId,
      intentApplied: autoIntent.applied,
      workflowActions: autoWorkflow.actions.map((a) => ({
        toolName: a.toolName,
        ok: a.ok,
      })),
    }),
  );
}
