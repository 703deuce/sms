import type { AgentSession } from "@livekit/agents";
import { deliverScriptedSpeech } from "../outbound/scripted-speech";

/**
 * Speak a deterministic booking line on OpenAI Realtime without runCtx.update().
 * runCtx.update() injects agent_config_update items that Realtime rejects, so
 * confirmation/filler audio never plays.
 */
export async function speakBookingLine<T>(
  session: AgentSession<T>,
  text: string,
): Promise<void> {
  await deliverScriptedSpeech(session, text, {
    allowInterruptions: true,
    addToChatCtx: true,
  });
}
