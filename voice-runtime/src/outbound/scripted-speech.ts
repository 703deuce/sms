import type { AgentSession } from "@livekit/agents";
import { resolveOutboundRealtimeOutputMode } from "../pipeline";

type ScriptedSpeechOptions = {
  allowInterruptions?: boolean;
  addToChatCtx?: boolean;
};

/**
 * Verbatim scripted line — uses ElevenLabs TTS in half-cascade mode, or
 * generateReply in native realtime mode (session.say requires a TTS plugin).
 */
export async function deliverScriptedSpeech<T>(
  session: AgentSession<T>,
  text: string,
  options: ScriptedSpeechOptions = {},
): Promise<void> {
  const allowInterruptions = options.allowInterruptions ?? false;
  const addToChatCtx = options.addToChatCtx ?? true;

  session.clearUserTurn();

  if (resolveOutboundRealtimeOutputMode() === "elevenlabs") {
    const handle = session.say(text, { allowInterruptions, addToChatCtx });
    await handle.waitForPlayout();
  } else {
    const handle = session.generateReply({
      instructions:
        `Say exactly the following, word for word, with no additions or changes:\n"${text}"`,
      allowInterruptions,
    });
    await handle.waitForPlayout();
  }

  session.clearUserTurn();
}
