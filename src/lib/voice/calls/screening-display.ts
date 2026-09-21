import type { VoiceV3ScreeningCallMetadata } from "@/lib/voice-v3/spam-protection/screening-call-metadata";
import { readVoiceV3ScreeningFromCallMetadata } from "@/lib/voice-v3/spam-protection/screening-call-metadata";

export type CallScreeningUi = {
  showSection: boolean;
  carrierLabel: string | null;
  outcomeLabel: string | null;
  billingLabel: string | null;
  extraBadges: Array<"Spam Likely" | "Solicitor">;
};

export function buildCallScreeningUi(input: {
  metadata?: unknown;
  outcome?: string | null;
}): CallScreeningUi {
  const screening = readVoiceV3ScreeningFromCallMetadata(input.metadata);
  const outcome = String(input.outcome || "").toLowerCase();
  const extraBadges: CallScreeningUi["extraBadges"] = [];

  const spamLikely =
    screening?.suspectedSpamLikely === true ||
    screening?.carrierScreeningNormalized === "spam_likely";
  if (spamLikely) extraBadges.push("Spam Likely");

  const solicitor =
    screening?.transovoOutcome === "UNWANTED_SOLICITATION" ||
    outcome.includes("unwanted_solicitation") ||
    outcome.includes("solicitation");
  if (solicitor) extraBadges.push("Solicitor");

  const showSection = Boolean(
    screening &&
      (screening.carrierScreeningRaw ||
        screening.carrierScreeningNormalized ||
        screening.transovoOutcome ||
        screening.suspectedSpamLikely),
  );

  let carrierLabel: string | null = null;
  if (screening?.carrierScreeningNormalized === "spam_likely") {
    carrierLabel = "Spam Likely";
  } else if (screening?.carrierScreeningNormalized === "normal") {
    carrierLabel = "Normal";
  } else if (screening?.carrierScreeningRaw) {
    carrierLabel = screening.carrierScreeningRaw;
  }

  let outcomeLabel: string | null = null;
  if (screening?.transovoOutcome === "UNWANTED_SOLICITATION") {
    outcomeLabel = "Unwanted solicitor";
  } else if (spamLikely && !solicitor) {
    outcomeLabel = "Legitimate caller";
  }

  let billingLabel: string | null = null;
  if (screening?.customerBillable === false) {
    billingLabel = "Not charged";
  }

  return {
    showSection,
    carrierLabel,
    outcomeLabel,
    billingLabel,
    extraBadges,
  };
}

export function screeningFromMetadata(metadata: unknown): VoiceV3ScreeningCallMetadata | null {
  return readVoiceV3ScreeningFromCallMetadata(metadata);
}
