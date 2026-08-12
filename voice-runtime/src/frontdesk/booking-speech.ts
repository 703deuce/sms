import type { AgentSession } from "@livekit/agents";
import { deliverScriptedSpeech } from "../outbound/scripted-speech";

/**
 * Speak a deterministic booking line on OpenAI Realtime without runCtx.update().
 * Uses generateReply via deliverScriptedSpeech (server VAD owns interruption).
 *
 * Returns true only when playout completes within maxWaitMs — never on timeout alone.
 */
export async function speakBookingLine<T>(
  session: AgentSession<T>,
  text: string,
  options?: { maxWaitMs?: number },
): Promise<boolean> {
  const maxWaitMs = options?.maxWaitMs ?? 10_000;

  try {
    let completed = false;
    const playout = deliverScriptedSpeech(session, text, {
      allowInterruptions: true,
      addToChatCtx: true,
    }).then(() => {
      completed = true;
    });

    await Promise.race([
      playout,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("speakBookingLine_timeout")), maxWaitMs),
      ),
    ]);
    return completed;
  } catch {
    return false;
  }
}
