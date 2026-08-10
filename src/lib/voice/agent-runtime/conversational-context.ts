/**
 * @deprecated LiveKit runtime uses healthcare-style prompts in amy-livekit-prompt.ts.
 * Root instructions only — no SESSION block or workflow guidance.
 */
import type { LiveKitCallContext } from "@/lib/voice/domain-actions";

/** @deprecated No longer injected into the LLM prompt. Tasks use updateChatCtx for live data. */
export function buildConversationalContextBlock(_ctx: LiveKitCallContext): string {
  return "";
}
