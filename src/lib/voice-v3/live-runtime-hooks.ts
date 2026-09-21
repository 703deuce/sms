/**
 * Sideband hooks for pushing authoritative backend context to GPT-Live.
 * Thinking append alone does not request speech — pair with requestSpeak when the caller should hear an update.
 */

import { requestLiveSpeakContinuation } from "./live-response-trigger";
import type { LiveSidebandSend } from "./greeting";

export type VoiceV3ThinkingAppendEvent = {
  type: "session.thinking.append";
  content: string;
  delegation_id: null;
  event_id?: string | null;
};

export type VoiceV3LiveRuntimeHooks = {
  onLiveContext?: (event: VoiceV3ThinkingAppendEvent) => void;
  /** Issue response.create so Live speaks after async backend work. */
  requestSpeak?: (reason: string) => void;
};

export function pushLiveThinkingContext(
  hooks: VoiceV3LiveRuntimeHooks,
  content: string,
  speakReason: string,
): void {
  hooks.onLiveContext?.({
    type: "session.thinking.append",
    content,
    delegation_id: null,
  });
  hooks.requestSpeak?.(speakReason);
}

export function pushLiveThinkingEvent(
  hooks: VoiceV3LiveRuntimeHooks,
  event: VoiceV3ThinkingAppendEvent,
  speakReason: string,
): void {
  hooks.onLiveContext?.(event);
  hooks.requestSpeak?.(speakReason);
}

/** Wire tool sideband context + speak continuation (FIND/BOOK/intake acks). */
export function buildVoiceV3ToolLiveHooks(input: {
  liveSessionId: string;
  sendContext: (event: { type: string; [key: string]: unknown }) => void;
}): VoiceV3LiveRuntimeHooks {
  const send = input.sendContext as LiveSidebandSend;
  const liveSessionId = input.liveSessionId.trim();
  return {
    onLiveContext: (event) => input.sendContext(event),
    requestSpeak: (reason) => {
      if (!liveSessionId) return;
      requestLiveSpeakContinuation({ send, liveSessionId, reason });
    },
  };
}
