import type { AgentSession } from "@livekit/agents";
import { deliverScriptedSpeech } from "../outbound/scripted-speech";
import { safeInterruptSession } from "../session-utils";

export type BookingSpeechRunContext = {
  disallowInterruptions?: () => void;
};

/**
 * Speak a deterministic booking line on OpenAI Realtime without runCtx.update().
 * runCtx.update() injects agent_config_update items that Realtime rejects, so
 * confirmation/filler audio uses generateReply via deliverScriptedSpeech.
 *
 * Returns false if playout was interrupted, timed out, or failed — caller should
 * fall back to a tool result that tells the model to speak confirmation.
 */
export async function speakBookingLine<T>(
  session: AgentSession<T>,
  text: string,
  options?: { runCtx?: BookingSpeechRunContext; maxWaitMs?: number },
): Promise<boolean> {
  try {
    options?.runCtx?.disallowInterruptions?.();
  } catch {
    // Best effort — continue even if interruptions cannot be disabled.
  }

  await safeInterruptSession(session);

  const maxWaitMs = options?.maxWaitMs ?? 10_000;

  try {
    await Promise.race([
      deliverScriptedSpeech(session, text, {
        allowInterruptions: false,
        addToChatCtx: true,
      }),
      new Promise<void>((resolve) => setTimeout(resolve, maxWaitMs)),
    ]);
    return true;
  } catch {
    return false;
  }
}
