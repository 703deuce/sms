/**
 * Thin Live adapter — reuses Realtime tool schemas and names without modifying certified executors.
 */
import {
  buildOpenAiRealtimeVoiceV2Tools,
  type OpenAiRealtimeFunctionTool,
} from "../openai-realtime-bridge/realtime-tools";
import type { VoiceAgentConfig } from "@/lib/voice/types";

export type LiveDelegationFunctionTool = OpenAiRealtimeFunctionTool;

export function buildLiveDelegationTools(input: {
  config: VoiceAgentConfig;
  transferEnabled?: boolean;
}): LiveDelegationFunctionTool[] {
  return buildOpenAiRealtimeVoiceV2Tools(input);
}
