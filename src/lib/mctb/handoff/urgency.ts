import type { MctbHandoffConfigDto } from "./types";

const URGENT_KEYWORDS =
  /\b(emergency|urgent|flooding|flood|burst pipe|no water|no heat|locked out|sparks|fire|smoke|gas leak|bleeding|unconscious)\b/i;

export type UrgencyAssessmentResult = {
  classification: "urgent" | "normal" | "uncertain";
  confidence: number;
  reason: string;
  ruleVersion: string;
};

export function assessMctbUrgency(input: {
  customerText: string;
  config: MctbHandoffConfigDto;
}): UrgencyAssessmentResult | null {
  if (!input.config.emergencyDetectionEnabled) return null;
  const text = input.customerText.trim();
  if (!text) return null;

  const criteria = input.config.emergencyCriteria?.trim();
  if (criteria) {
    const terms = criteria
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    for (const term of terms) {
      if (text.toLowerCase().includes(term.toLowerCase())) {
        return {
          classification: "urgent",
          confidence: 0.85,
          reason: `Matched configured urgency term: ${term}`,
          ruleVersion: "mctb_urgency_v1_criteria",
        };
      }
    }
  }

  if (URGENT_KEYWORDS.test(text)) {
    return {
      classification: "urgent",
      confidence: 0.75,
      reason: "Matched built-in urgency keyword pattern",
      ruleVersion: "mctb_urgency_v1_keywords",
    };
  }

  if (input.config.emergencyUncertainBehavior === "handoff_human") {
    return {
      classification: "uncertain",
      confidence: 0.4,
      reason: "No urgency match — conservative handoff",
      ruleVersion: "mctb_urgency_v1_conservative",
    };
  }

  return {
    classification: "normal",
    confidence: 0.6,
    reason: "No urgency indicators detected",
    ruleVersion: "mctb_urgency_v1_normal",
  };
}

export function isUrgentClassification(
  assessment: UrgencyAssessmentResult | null | undefined,
): boolean {
  return assessment?.classification === "urgent";
}
