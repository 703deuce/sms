import type { SessionAcceptParams } from "openai/resources/live/sessions";
import type { VoiceV3AgentConfig } from "@/lib/voice-v3/config/agent-config";
import {
  assertLiveDelegationAcceptPayloadCompatible,
  buildVoiceV3AstraDelegationResponses,
  validateAndLogLiveAcceptDelegationPayload,
} from "@/lib/voice-v3/intake/delegation-config";
import {
  buildVoiceV3Prompts,
  resolveVoiceV3DefaultPromptInput,
} from "@/lib/voice-v3/prompts/build-voice-v3-prompts";
import { formatBusinessLocalDateTime } from "@/lib/voice-v3/prompts/business-local-time";
import { resolveVoiceV3AgentConfig } from "@/lib/voice-v3/state/call-runtime";
import { listVoiceV3AstraToolNamesForConfig } from "@/lib/voice-v3/tools/voice-tool-catalog";

export const VOICE_V3_BASIC_LIVE_MODEL = "gpt-live-1";
export const VOICE_V3_BASIC_BACKEND_MODEL = "gpt-6-astra";

let configLogged = false;

export function logVoiceV3BasicConfigOnce(): void {
  if (configLogged) return;
  configLogged = true;
  console.log("VOICE_V3_BASIC_CONFIG", {
    frontend: VOICE_V3_BASIC_LIVE_MODEL,
    backend: VOICE_V3_BASIC_BACKEND_MODEL,
  });
}

/**
 * SIP accept configuration: no audio.format (negotiated by SIP).
 * Native Responses delegation to GPT-6 Astra — no separate Astra loop.
 * Prompts: src/lib/voice-v3/prompts/* (SDK SessionAcceptParams.Session).
 * Architecture: docs/voice-v3/OPENAI-NATIVE-FIRST-ARCHITECTURE.md
 */
export function buildBasicLiveSession(
  at: Date = new Date(),
  agentConfig?: VoiceV3AgentConfig,
): SessionAcceptParams.Session {
  logVoiceV3BasicConfigOnce();
  const config = agentConfig ?? resolveVoiceV3AgentConfig();
  const promptInput = resolveVoiceV3DefaultPromptInput(at, config);
  const toolNames = listVoiceV3AstraToolNamesForConfig(config);
  const prompts = buildVoiceV3Prompts({
    ...promptInput,
    businessName: config.businessName ?? promptInput.businessName,
    timezone: config.timezone ?? promptInput.timezone,
    agentName: config.identity?.agentName ?? promptInput.agentName,
    currentLocalDateTime: formatBusinessLocalDateTime(
      config.timezone ?? promptInput.timezone,
      at,
    ),
    agentConfig: config,
    toolNames,
  });

  const responses = buildVoiceV3AstraDelegationResponses(
    prompts.astraInstructions,
    config,
  );
  assertLiveDelegationAcceptPayloadCompatible(responses);
  validateAndLogLiveAcceptDelegationPayload(responses);

  return {
    type: "live",
    model: VOICE_V3_BASIC_LIVE_MODEL,
    instructions: prompts.liveInstructions,
    audio: {
      output: {
        voice: config.telephony?.liveVoiceId?.trim() || "marin",
      },
    },
    delegation: {
      type: "responses",
      responses,
    },
  };
}

export function buildBasicLiveSessionAcceptParams(
  at: Date = new Date(),
  agentConfig?: VoiceV3AgentConfig,
): SessionAcceptParams {
  const config = agentConfig ?? resolveVoiceV3AgentConfig();
  return { session: buildBasicLiveSession(at, config) };
}
