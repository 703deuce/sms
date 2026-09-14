import type { MctbHandoffConfigDto } from "./types";
import type { StructuredLeadIntent } from "@/lib/mctb/lead-recovery/types";

export type UrgencyAssessmentResult = {
  classification: "urgent" | "normal" | "uncertain";
  confidence: number;
  reason: string;
  ruleVersion: string;
};

function matchConfiguredCriteriaOnText(text: string, criteria: string): string | null {
  const terms = criteria
    .split(/[\n,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const lower = text.toLowerCase();
  for (const term of terms) {
    if (lower.includes(term.toLowerCase())) return term;
  }
  return null;
}

/**
 * Production MCTB Lead Recovery path — urgency from DeepSeek structured intent only.
 */
export function assessMctbUrgencyFromStructuredIntent(input: {
  intent: StructuredLeadIntent;
  config: MctbHandoffConfigDto;
}): UrgencyAssessmentResult | null {
  if (!input.config.emergencyDetectionEnabled) return null;

  const { intent } = input;
  if (intent.urgency === "EMERGENCY") {
    return {
      classification: "urgent",
      confidence: Math.max(0.7, intent.confidence),
      reason: intent.reason_for_contact?.trim() || "Intent agent classified EMERGENCY urgency",
      ruleVersion: "mctb_urgency_semantic_v2",
    };
  }
  if (intent.urgency === "HIGH") {
    return {
      classification: "urgent",
      confidence: Math.max(0.65, intent.confidence * 0.95),
      reason: intent.reason_for_contact?.trim() || "Intent agent classified HIGH urgency",
      ruleVersion: "mctb_urgency_semantic_v2",
    };
  }

  const criteria = input.config.emergencyCriteria?.trim();
  if (criteria) {
    const semanticBlob = [
      intent.reason_for_contact,
      intent.location?.raw,
      intent.location?.resolved,
      intent.service_category,
      ...(intent.semantic_missing_information ?? []),
    ]
      .filter(Boolean)
      .join(" ");
    const matched = matchConfiguredCriteriaOnText(semanticBlob, criteria);
    if (matched) {
      return {
        classification: "urgent",
        confidence: 0.85,
        reason: `Workspace urgency criteria matched semantic field: ${matched}`,
        ruleVersion: "mctb_urgency_v1_criteria_semantic",
      };
    }
  }

  if (intent.urgency === "NORMAL" || intent.urgency === "LOW") {
    return {
      classification: "normal",
      confidence: Math.max(0.55, intent.confidence * 0.9),
      reason: "Intent agent classified non-emergency urgency",
      ruleVersion: "mctb_urgency_semantic_v2",
    };
  }

  if (input.config.emergencyUncertainBehavior === "handoff_human") {
    return {
      classification: "uncertain",
      confidence: 0.4,
      reason: "No structured urgency — conservative handoff",
      ruleVersion: "mctb_urgency_v2_conservative",
    };
  }

  return {
    classification: "normal",
    confidence: 0.55,
    reason: "No emergency urgency in structured intent",
    ruleVersion: "mctb_urgency_semantic_v2",
  };
}

/**
 * Legacy handoff automation only (not Lead Recovery customer SMS).
 * Does not scan customer SMS with built-in keyword lists.
 */
export function assessMctbUrgency(input: {
  customerText: string;
  config: MctbHandoffConfigDto;
  intent?: StructuredLeadIntent | null;
}): UrgencyAssessmentResult | null {
  if (input.intent) {
    return assessMctbUrgencyFromStructuredIntent({ intent: input.intent, config: input.config });
  }
  if (!input.config.emergencyDetectionEnabled) return null;
  const text = input.customerText.trim();
  if (!text) return null;

  const criteria = input.config.emergencyCriteria?.trim();
  if (criteria) {
    const matched = matchConfiguredCriteriaOnText(text, criteria);
    if (matched) {
      return {
        classification: "urgent",
        confidence: 0.85,
        reason: `Matched configured urgency term: ${matched}`,
        ruleVersion: "mctb_urgency_v1_criteria",
      };
    }
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
    reason: "No configured urgency criteria match",
    ruleVersion: "mctb_urgency_v1_normal",
  };
}

export function isUrgentClassification(
  assessment: UrgencyAssessmentResult | null | undefined,
): boolean {
  return assessment?.classification === "urgent";
}
