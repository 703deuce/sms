import type { AgentSession } from "@livekit/agents";
import { sessionUsesTtsSay } from "../scripted-speech-output-mode";

type ScriptedSpeechOptions = {
  allowInterruptions?: boolean;
  addToChatCtx?: boolean;
};

/**
 * Verbatim scripted line — uses session.say + TTS plugin on half-cascade (Realtime text + ElevenLabs),
 * or generateReply on native realtime audio output.
 */
export async function deliverScriptedSpeech<T>(
  session: AgentSession<T>,
  text: string,
  options: ScriptedSpeechOptions = {},
): Promise<void> {
  const allowInterruptions = options.allowInterruptions ?? false;
  const addToChatCtx = options.addToChatCtx ?? true;

  session.clearUserTurn();

  if (sessionUsesTtsSay(session)) {
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
