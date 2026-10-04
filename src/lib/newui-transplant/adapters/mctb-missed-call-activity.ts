export type MctbCustomerActivityStep = {
  label: string;
  at: string;
  done: boolean;
};

const TECHNICAL_ONLY = new Set([
  "Eligible for recovery",
  "SMS queued",
  "SMS send started",
  "SMS sent",
  "SMS delivered",
  "SMS failed",
  "SMS blocked",
]);

function friendlyLabel(label: string): string {
  const map: Record<string, string> = {
    "Call received": "Missed call",
    "Existing consent config verified": "Consent verified",
    "Consent recorded": "Consent captured",
    "Recovery text sent": "Recovery text sent",
    "Customer replied": "Caller replied",
  };
  return map[label] ?? label;
}

/** Customer-facing activity timeline (deduped, no provider pipeline jargon). */
export function buildCustomerActivitySteps(
  steps: Array<{ label: string; detail: string; done: boolean }>,
  input: { callerName?: string; reply: boolean },
): MctbCustomerActivityStep[] {
  const out: MctbCustomerActivityStep[] = [];
  const seen = new Set<string>();

  for (const step of steps) {
    if (TECHNICAL_ONLY.has(step.label)) continue;
    const label = friendlyLabel(step.label);
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      label,
      at: step.detail,
      done: step.done,
    });
  }

  if (input.reply && !seen.has("caller replied")) {
    out.push({
      label: input.callerName ? `${input.callerName} replied` : "Caller replied",
      at: "",
      done: true,
    });
  }

  return out;
}

export function buildTechnicalDeliverySteps(
  steps: Array<{ label: string; detail: string; done: boolean }>,
): MctbCustomerActivityStep[] {
  return steps
    .filter((s) => TECHNICAL_ONLY.has(s.label) || s.label.includes("SMS"))
    .map((s) => ({
      label: s.label,
      at: s.detail,
      done: s.done,
    }));
}
