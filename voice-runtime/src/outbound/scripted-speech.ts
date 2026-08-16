import type { AgentSession } from "@livekit/agents";
import { sessionUsesTtsSay } from "../scripted-speech-output-mode";
import type { FrontDeskUserData } from "../frontdesk/userdata";
import {
  bumpCollectionTurnSeq,
  controlledGenerateReply,
  isRuntimeCollectionState,
} from "../frontdesk/receptionist/collection-realtime-control";

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
    const frontDeskSession = session as unknown as AgentSession<FrontDeskUserData>;
    const ud = frontDeskSession.userData;
    const turnId = isRuntimeCollectionState(ud) ? bumpCollectionTurnSeq(ud) : "scripted";
    await controlledGenerateReply(frontDeskSession, "scripted_speech", turnId, {
      instructions:
        `Say exactly the following, word for word, with no additions or changes:\n"${text}"`,
      allowInterruptions,
    });
  }

  session.clearUserTurn();
}
