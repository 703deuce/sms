import type { NeedsAttentionKind } from "./needs-attention-types";

/** Voice Calls attention queue — excludes MCTB-owned work items. */
export const VOICE_CALLS_ATTENTION_KINDS: ReadonlySet<NeedsAttentionKind> = new Set([
  "callback_request",
  "failed_transfer",
  "voicemail",
  "form_submission",
  "repeat_caller",
]);

export function isVoiceCallsAttentionKind(kind: NeedsAttentionKind): boolean {
  return VOICE_CALLS_ATTENTION_KINDS.has(kind);
}
