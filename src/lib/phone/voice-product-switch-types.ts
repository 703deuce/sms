export type VoiceIngressProductId = "mctb" | "ai_receptionist" | "none";

export const VOICE_INGRESS_PRODUCT_LABEL: Record<VoiceIngressProductId, string> = {
  mctb: "Missed Call Text Back",
  ai_receptionist: "AI Receptionist",
  none: "Not assigned",
};

export type VoiceProductSwitchConflict = {
  code: "PHONE_VOICE_PRODUCT_SWITCH_REQUIRED";
  phoneNumberId: string;
  e164: string;
  existingProduct: VoiceIngressProductId;
  existingProductLabel: string;
  targetProduct: VoiceIngressProductId;
  targetProductLabel: string;
  existingAgentId?: string | null;
  existingAgentName?: string | null;
  message: string;
};
