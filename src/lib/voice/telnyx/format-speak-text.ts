/**
 * Format tool `speak` fields for Telnyx TTS on the live assistant path.
 * Canonical/tool data stays unchanged — only spoken lines are normalized.
 */

import { normalizeTtsText } from "@/lib/voice/tts/normalize-tts-text";

/** Normalize a single line the agent should speak aloud. */
export function formatSpeakForVoice(text: string | null | undefined): string {
  const raw = String(text || "").trim();
  if (!raw) return "";
  return normalizeTtsText(raw);
}

/** Apply speech formatting to Telnyx tool webhook JSON (speak + message). */
export function formatTelnyxToolPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...payload };
  if (typeof out.speak === "string" && out.speak.trim()) {
    out.speak = formatSpeakForVoice(out.speak);
  }
  if (typeof out.message === "string" && out.message.trim()) {
    out.message = formatSpeakForVoice(out.message);
  }
  return out;
}
