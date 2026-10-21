export type MctbConsentPromptSource = "tts" | "upload" | "elevenlabs";

export type MctbConsentPromptConfig = {
  source: MctbConsentPromptSource;
  scriptText: string;
  voiceId: string | null;
  audioUrl: string | null;
};
