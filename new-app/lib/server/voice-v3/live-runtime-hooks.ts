/**
 * Sideband hooks for pushing authoritative backend context to GPT-Live.
 * Thinking append alone does not request speech — pair with requestSpeak when the caller should hear an update.
 */

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
