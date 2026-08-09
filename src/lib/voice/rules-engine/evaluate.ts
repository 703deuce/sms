export type QualificationRule = {
  id: string;
  when: {
    classification: string;
    equals: string;
  };
  then: {
    action: "transfer" | "take_message" | "priority_schedule" | "block_booking" | "continue";
    destination?: string | null;
    message?: string | null;
  };
};

export type RuleEvaluationContext = {
  classifications: Record<string, string>;
  collectedFields: Record<string, string>;
  eligibilityStatus?: string | null;
};

export type RuleEvaluationResult = {
  matched: QualificationRule[];
  primaryAction?: QualificationRule["then"] | null;
  flags: Record<string, boolean>;
};

export function evaluateQualificationRules(
  rules: QualificationRule[],
  context: RuleEvaluationContext,
): RuleEvaluationResult {
  const matched: QualificationRule[] = [];
  const flags: Record<string, boolean> = {};

  for (const rule of rules) {
    const actual = context.classifications[rule.when.classification];
    if (actual?.toLowerCase() === rule.when.equals.toLowerCase()) {
      matched.push(rule);
      flags[`rule_${rule.id}`] = true;
    }
  }

  const primary = matched[0]?.then || null;
  return { matched, primaryAction: primary, flags };
}

/** Infer classifications from collected fields + utterance keywords. */
export function inferClassifications(input: {
  collectedFields: Record<string, string>;
  utterance?: string | null;
}): Record<string, string> {
  const out: Record<string, string> = {};
  const text = [
    ...Object.values(input.collectedFields),
    input.utterance || "",
  ]
    .join(" ")
    .toLowerCase();

  if (/\b(gas smell|gas leak|carbon monoxide|co detector)\b/.test(text)) {
    out.urgency = "emergency";
    out.safety = "gas_smell";
  } else if (/\b(no heat|furnace.*(stopped|not working|broken)|freezing)\b/.test(text)) {
    out.urgency = "urgent";
  } else if (/\b(emergency|urgent|asap|right away)\b/.test(text)) {
    out.urgency = "urgent";
  } else {
    out.urgency = "normal";
  }

  if (input.collectedFields.fld_urgency) {
    out.urgency = input.collectedFields.fld_urgency.toLowerCase();
  }

  return out;
}
