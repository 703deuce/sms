import type { AgentSession } from "@livekit/agents";
import { deliverScriptedSpeech } from "../outbound/scripted-speech";

/**
 * Speak a deterministic booking line on OpenAI Realtime without runCtx.update().
 * Uses generateReply via deliverScriptedSpeech (server VAD owns interruption).
 *
 * Returns false if playout timed out or failed — caller should fall back to tool result.
 */
export async function speakBookingLine<T>(
  session: AgentSession<T>,
  text: string,
  options?: { maxWaitMs?: number },
): Promise<boolean> {
  const maxWaitMs = options?.maxWaitMs ?? 10_000;

  try {
    await Promise.race([
      deliverScriptedSpeech(session, text, {
        allowInterruptions: true,
        addToChatCtx: true,
      }),
      new Promise<void>((resolve) => setTimeout(resolve, maxWaitMs)),
    ]);
    return true;
  } catch {
    return false;
  }
}
