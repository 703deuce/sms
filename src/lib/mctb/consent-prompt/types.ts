export type MctbConsentPromptAudioStatus = "none" | "ready" | "stale";

export type MctbConsentPromptConfig = {
  scriptText: string;
  voiceId: string;
  speed: number;
  audioAssetId: string | null;
  scriptHash: string | null;
  audioStatus: MctbConsentPromptAudioStatus;
  publishedAt: string | null;
  publishedScriptHash: string | null;
  publishedAudioAssetId: string | null;
  publishedVersion: number;
  flowId: string | null;
  lastGeneratedAt: string | null;
};

export const MCTB_CONSENT_FLOW_NAME = "MCTB Verified Consent";
