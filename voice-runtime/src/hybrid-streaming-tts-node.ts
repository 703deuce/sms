import { voice, type AgentCreateOptions } from "@livekit/agents";
import type { AgentContext } from "@livekit/agents";
import { maybeNormalizeForElevenLabsModel } from "@/lib/voice/tts/normalize-tts-text";
import { phraseBufferStream } from "@/lib/voice/tts/phrase-text-buffer";
import {
  isGenerationActive,
  startAssistantGeneration,
} from "@/lib/voice/tts/generation-context";
import { compileSemanticForSpeech } from "@/lib/voice/tts/speech-compiler";
import {
  markHybridLlmFirstTextDelta,
  markHybridTtsFirstTextSent,
} from "./hybrid-streaming-telemetry";
import {
  resolveOutboundRealtimeOutputMode,
  type OutboundRealtimeOutputMode,
} from "./pipeline";

type AgentHookContext<TUserData> = AgentContext<TUserData>;

function resolveCallIdFromCtx<TUserData>(ctx: AgentHookContext<TUserData>): string {
  const session = ctx.agent.session;
  const ud = session?.userData as
    | { callId?: string; callContext?: { callId?: string } }
    | undefined;
  return ud?.callId ?? ud?.callContext?.callId ?? "unknown";
}

/** Phrase buffer is opt-in — ElevenLabs SentenceTokenizer handles buffering by default. */
function usePhraseBuffer(): boolean {
  return process.env.VOICE_TTS_USE_PHRASE_BUFFER === "1";
}

/**
 * Hybrid tts_node for Realtime text + ElevenLabs half-cascade.
 * Generation isolation: stale LLM/TTS chunks are dropped on caller interrupt.
 */
export function createHybridStreamingTtsNode<TUserData = unknown>(): NonNullable<
  AgentCreateOptions<TUserData>["ttsNode"]
> {
  return async (ctx: AgentHookContext<TUserData>, text, modelSettings) => {
    const callId = resolveCallIdFromCtx(ctx);
    const { generationId, turnId } = startAssistantGeneration(callId);
    const ttsModel = process.env.ELEVENLABS_TTS_MODEL;

    const sourceStream = (async function* () {
      for await (const chunk of text) {
        if (!isGenerationActive(callId, generationId)) break;
        markHybridLlmFirstTextDelta(chunk);
        yield chunk;
      }
    })();

    const phraseOrRaw = usePhraseBuffer()
      ? phraseBufferStream(sourceStream)
      : sourceStream;

    const monitoredText = (async function* () {
      for await (const phrase of phraseOrRaw) {
        if (!isGenerationActive(callId, generationId)) break;
        const compiled = compileSemanticForSpeech(phrase);
        const spoken = maybeNormalizeForElevenLabsModel(compiled.speechText, ttsModel);
        markHybridTtsFirstTextSent(spoken);
        if (process.env.VOICE_TTS_PIPELINE_DEBUG === "1") {
          console.log(
            JSON.stringify({
              source: "voice.tts_pipeline",
              event: "hybrid_tts_chunk",
              callId,
              turnId,
              generationId,
              commitMode: compiled.commitMode,
              phraseBuffer: usePhraseBuffer(),
              ttsChunkPreview: spoken.slice(0, 120),
            }),
          );
        }
        yield spoken;
      }
    })();

    return voice.Agent.default.ttsNode(ctx.agent, monitoredText, modelSettings);
  };
}

/** Merge hybrid streaming hooks when REALTIME_ELEVENLABS output mode is active. */
export function withHybridStreamingAgentOptions<TUserData>(
  options: AgentCreateOptions<TUserData>,
  outputMode?: OutboundRealtimeOutputMode,
): AgentCreateOptions<TUserData> {
  const mode = outputMode ?? resolveOutboundRealtimeOutputMode();
  if (mode !== "elevenlabs") {
    return options;
  }
  if (options.ttsNode) {
    return options;
  }
  const merged: AgentCreateOptions<TUserData> = {
    ...options,
    ttsNode: createHybridStreamingTtsNode<TUserData>(),
  };
  return merged;
}
