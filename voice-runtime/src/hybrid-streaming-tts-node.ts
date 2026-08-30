import { voice, type AgentCreateOptions } from "@livekit/agents";
import type { AgentContext } from "@livekit/agents";
import { maybeNormalizeForElevenLabsModel } from "@/lib/voice/tts/normalize-tts-text";
import { phraseBufferStream } from "@/lib/voice/tts/phrase-text-buffer";
import {
  markHybridLlmFirstTextDelta,
  markHybridTtsFirstTextSent,
} from "./hybrid-streaming-telemetry";
import { nextTtsGenerationId } from "@/lib/voice/tts/pipeline-diagnostics";
import {
  resolveOutboundRealtimeOutputMode,
  type OutboundRealtimeOutputMode,
} from "./pipeline";

type AgentHookContext<TUserData> = AgentContext<TUserData>;

/**
 * Phrase-buffered tts_node for Realtime text + ElevenLabs half-cascade.
 * Preserves LiveKit default cancellation (stream.close on interrupt).
 */
export function createHybridStreamingTtsNode<TUserData = unknown>(): NonNullable<
  AgentCreateOptions<TUserData>["ttsNode"]
> {
  return async (ctx: AgentHookContext<TUserData>, text, modelSettings) => {
    const generationId = nextTtsGenerationId("hybrid");
    const bufferedText = phraseBufferStream(
      (async function* () {
        for await (const chunk of text) {
          markHybridLlmFirstTextDelta(chunk);
          yield chunk;
        }
      })(),
    );

    const monitoredText = (async function* () {
      for await (const phrase of bufferedText) {
        const spoken = maybeNormalizeForElevenLabsModel(phrase, process.env.ELEVENLABS_TTS_MODEL);
        markHybridTtsFirstTextSent(spoken);
        if (process.env.VOICE_TTS_PIPELINE_DEBUG === "1") {
          console.log(
            JSON.stringify({
              source: "voice.tts_pipeline",
              event: "hybrid_tts_chunk",
              generationId,
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
