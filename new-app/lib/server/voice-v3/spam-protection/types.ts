/**
 * Voice V3 — carrier spam screening + conversational solicitor policies.
 * Telnyx maps inbound_call_screening on publish (narrow PATCH).
 */

export type VoiceV3SpamLikelyPolicy = "BLOCK" | "SCREEN" | "ALLOW";

export type VoiceV3SolicitorPolicy = "DECLINE" | "TAKE_MESSAGE" | "ALLOW";

export type TelnyxInboundCallScreening = "disabled" | "reject_calls" | "flag_calls";

export type VoiceV3CallScreeningClassification =
  | "NORMAL"
  | "TELNYX_SPAM_LIKELY"
  | "TELNYX_SPAM_LIKELY_LEGITIMATE"
  | "UNWANTED_SOLICITATION"
  | "BLOCKLIST_REJECTED"
  | "UNKNOWN";

export interface VoiceV3SpamProtectionConfig {
  /** null = legacy / not configured — do not mutate Telnyx on publish */
  spamLikelyPolicy: VoiceV3SpamLikelyPolicy | null;
  solicitorPolicy: VoiceV3SolicitorPolicy | null;
}

export const VOICE_V3_DEFAULT_SPAM_PROTECTION: VoiceV3SpamProtectionConfig = {
  spamLikelyPolicy: "BLOCK",
  solicitorPolicy: "DECLINE",
};

export const TELNYX_CALL_SCREENING_HEADER = "X-Telnyx-Call-Screening";
export const LIVEKIT_SPAM_SCREENING_ATTR = "transovo.telnyx.call_screening";

export function telnyxInboundScreeningForPolicy(
  policy: VoiceV3SpamLikelyPolicy | null | undefined,
): TelnyxInboundCallScreening | null {
  if (!policy) return null;
  switch (policy) {
    case "BLOCK":
      return "reject_calls";
    case "SCREEN":
      return "flag_calls";
    case "ALLOW":
      // Retain carrier signal for analytics; Amy ignores flag conversationally.
      return "flag_calls";
    default:
      return null;
  }
}

export function normalizeTelnyxScreeningValue(raw: string | null | undefined): "spam_likely" | "normal" | "unknown" {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return "unknown";
  if (v.includes("spam")) return "spam_likely";
  if (v === "normal" || v === "not_spam" || v === "pass") return "normal";
  return "unknown";
}

export function wizardSpamProtectionFromState(input: {
  spamLikelyPolicy?: VoiceV3SpamLikelyPolicy | null;
  solicitorPolicy?: VoiceV3SolicitorPolicy | null;
  salesSolicitationEnabled?: boolean | null;
  salesSolicitationAction?: string | null;
}): VoiceV3SpamProtectionConfig {
  let spamLikelyPolicy = input.spamLikelyPolicy ?? null;
  let solicitorPolicy = input.solicitorPolicy ?? null;

  if (!spamLikelyPolicy && !solicitorPolicy) {
    if (input.salesSolicitationEnabled === true) {
      const action = String(input.salesSolicitationAction || "").toUpperCase();
      solicitorPolicy =
        action === "DECLINE_POLITELY" || action === "DECLINE"
          ? "DECLINE"
          : action === "TAKE_MESSAGE"
            ? "TAKE_MESSAGE"
            : "ALLOW";
    }
  }

  return { spamLikelyPolicy, solicitorPolicy };
}

export function mapLegacySolicitorActionToPolicy(
  action: string | null | undefined,
): VoiceV3SolicitorPolicy {
  const a = String(action || "").toUpperCase();
  if (a === "DECLINE_POLITELY" || a === "DECLINE") return "DECLINE";
  if (a === "TAKE_MESSAGE") return "TAKE_MESSAGE";
  return "ALLOW";
}
