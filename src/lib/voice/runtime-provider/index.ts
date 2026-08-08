import { getVoiceRuntimeProviderId } from "./config";
import { liveKitRuntimeProvider } from "./livekit";
import { telnyxAssistantRuntimeProvider } from "./telnyx-assistant";
import type { VoiceRuntimeProvider } from "./types";

export type {
  VoiceRuntimeProvider,
  VoiceRuntimeProviderId,
  InboundSessionMetadata,
} from "./types";

export {
  getVoiceRuntimeProviderId,
  isLiveKitVoiceRuntime,
  isTelnyxAssistantVoiceRuntime,
  getVoicePipelineConfig,
  requireLiveKitEnv,
} from "./config";
export type { VoicePipelineConfig } from "./config";

export { telnyxAssistantRuntimeProvider } from "./telnyx-assistant";
export { liveKitRuntimeProvider } from "./livekit";

export function getVoiceRuntimeProvider(): VoiceRuntimeProvider {
  return getVoiceRuntimeProviderId() === "livekit"
    ? liveKitRuntimeProvider
    : telnyxAssistantRuntimeProvider;
}
