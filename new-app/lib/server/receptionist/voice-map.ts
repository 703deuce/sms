const VOICE_TO_LIVE: Record<string, string> = {
  aria: "marin",
  theo: "cedar",
  june: "shimmer",
  malik: "ash",
  sofia: "marin",
};

export function mapEditorVoiceToLiveVoiceId(voice: string, customVoiceId: string): string {
  const custom = customVoiceId?.trim();
  if (custom) return custom;
  const key = voice?.trim().toLowerCase();
  return VOICE_TO_LIVE[key] || "marin";
}
