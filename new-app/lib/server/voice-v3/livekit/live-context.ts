import "server-only";

import { pushDelegatedRuntimeContextToLive } from "@/lib/server/voice-v3/delegation/push-delegated-runtime-context";

export type VoiceV3LiveKitLiveContextEvent = {
  type: string;
  [key: string]: unknown;
};

export const VOICE_V3_LIVEKIT_LIVE_CONTEXT_RESULT_KEY = "liveContextEvents";

export function createVoiceV3LiveKitLiveContextCollector(): {
  sendContext: (event: VoiceV3LiveKitLiveContextEvent) => void;
  events: VoiceV3LiveKitLiveContextEvent[];
} {
  const events: VoiceV3LiveKitLiveContextEvent[] = [];
  return {
    events,
    sendContext: (event) => {
      events.push(event);
    },
  };
}

export function attachLiveContextEventsToToolResult<T extends Record<string, unknown>>(
  result: T,
  events: VoiceV3LiveKitLiveContextEvent[],
): T & { liveContextEvents?: VoiceV3LiveKitLiveContextEvent[] } {
  if (events.length === 0) return result;
  return { ...result, [VOICE_V3_LIVEKIT_LIVE_CONTEXT_RESULT_KEY]: events };
}

export function resolveVoiceV3DelegatedRuntimeContextForLiveKit(input: {
  liveSessionId: string;
  delegationId?: string | null;
}): { liveContextEvents: VoiceV3LiveKitLiveContextEvent[] } {
  const liveContextEvents: VoiceV3LiveKitLiveContextEvent[] = [];
  pushDelegatedRuntimeContextToLive({
    liveSessionId: input.liveSessionId.trim(),
    delegationId: input.delegationId ?? null,
    send: (event) => {
      liveContextEvents.push(event as VoiceV3LiveKitLiveContextEvent);
    },
  });
  return { liveContextEvents };
}
