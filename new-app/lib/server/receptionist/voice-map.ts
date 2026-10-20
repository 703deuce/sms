import { normalizeGptLiveVoiceId } from "@/lib/voice/gpt-live-built-in-voices";

export function mapEditorVoiceToLiveVoiceId(voice: string, customVoiceId: string): string {
  const custom = customVoiceId?.trim();
  if (custom) return normalizeGptLiveVoiceId(custom);
  return normalizeGptLiveVoiceId(voice);
}
