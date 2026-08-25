import type {
  QualificationBusinessOutcome,
  QualificationDefinition,
  QualificationOutcomeRule,
} from "./types";

export function normalizeQualificationFields(
  raw: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) out[key] = text;
  }
  return out;
}

export function mergeQualificationFields(
  existing: Record<string, string>,
  patch: Record<string, string>,
): Record<string, string> {
  return { ...existing, ...normalizeQualificationFields(patch) };
}

export function missingRequiredFields(
  definition: QualificationDefinition,
  collected: Record<string, string>,
): string[] {
  return definition.fields
    .filter((f) => f.required)
    .map((f) => f.field_id)
    .filter((id) => !collected[id]?.trim());
}

function ruleMatches(
  rule: QualificationOutcomeRule,
  collected: Record<string, string>,
  flags: { interested: boolean },
): boolean {
  if (rule.outcome === "NOT_INTERESTED" && flags.interested) return false;
  if (rule.requireInterested && !flags.interested) return false;
  for (const fieldId of rule.requiredFields || []) {
    if (!collected[fieldId]?.trim()) return false;
  }
  return true;
}

export function evaluateQualificationOutcome(input: {
  definition: QualificationDefinition;
  collectedFields: Record<string, string>;
  explicitOutcome?: QualificationBusinessOutcome | null;
  interested?: boolean;
}): QualificationBusinessOutcome {
  const collected = normalizeQualificationFields(input.collectedFields);
  const flags = { interested: input.interested !== false };

  if (input.explicitOutcome) {
    if (input.definition.allowedOutcomes.includes(input.explicitOutcome)) {
      return input.explicitOutcome;
    }
  }

  if (input.explicitOutcome === "WRONG_NUMBER") return "WRONG_NUMBER";
  if (input.explicitOutcome === "NOT_INTERESTED") return "NOT_INTERESTED";
  if (input.explicitOutcome === "CALLBACK_REQUESTED") return "CALLBACK_REQUESTED";

  for (const rule of input.definition.rules) {
    if (ruleMatches(rule, collected, flags)) {
      return rule.outcome;
    }
  }

  const missing = missingRequiredFields(input.definition, collected);
  if (!flags.interested) return "NOT_INTERESTED";
  if (missing.length) return "NOT_QUALIFIED";
  return "COMPLETED_INTAKE";
}

export function buildQualificationSummary(input: {
  collectedFields: Record<string, string>;
  businessName: string;
  outcome: QualificationBusinessOutcome;
}): string {
  const parts = Object.entries(input.collectedFields)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);
  const body = parts.length ? parts.join("; ") : "No structured fields captured.";
  return `${input.businessName} outbound qualification (${input.outcome}). ${body}`;
}

export function nextActionForOutcome(outcome: QualificationBusinessOutcome): string {
  switch (outcome) {
    case "QUALIFIED":
    case "HOT":
    case "COMPLETED_INTAKE":
      return "Human agent follow-up";
    case "NURTURE":
      return "Add to nurture sequence";
    case "CALLBACK_REQUESTED":
      return "Staff callback requested";
    case "NOT_INTERESTED":
      return "Close lead — not interested";
    case "WRONG_NUMBER":
      return "Verify lead phone number";
    case "NOT_QUALIFIED":
      return "Review incomplete intake";
    default:
      return "Review call";
  }
}
