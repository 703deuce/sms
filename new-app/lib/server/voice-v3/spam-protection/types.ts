export type VoiceV3SpamLikelyPolicy = "BLOCK" | "SCREEN" | "ALLOW";
export type VoiceV3SolicitorPolicy = "DECLINE" | "TAKE_MESSAGE" | "ALLOW";

export interface VoiceV3SpamProtectionConfig {
  spamLikelyPolicy: VoiceV3SpamLikelyPolicy | null;
  solicitorPolicy: VoiceV3SolicitorPolicy | null;
}
