/**
 * Pure sequence interpreter for multi-step campaigns / automations.
 */

export type SequenceStepType = "send_sms" | "send_email" | "wait" | "condition" | "end";

export type SequenceStep = {
  step_key: string;
  step_type: SequenceStepType;
  config?: Record<string, unknown>;
};

export type ConditionFacts = {
  message_delivered?: boolean;
  link_clicked?: boolean;
  customer_replied?: boolean;
  customer_opted_out?: boolean;
  review_detected?: boolean;
  payment_received?: boolean;
  no_activity?: boolean;
  valid_phone?: boolean;
  valid_email?: boolean;
};

export function waitDurationMs(config: Record<string, unknown> | undefined): number {
  const days = Number(config?.days || 0);
  const hours = Number(config?.hours || 0);
  const minutes = Number(config?.minutes || 0);
  const ms = ((days * 24 + hours) * 60 + minutes) * 60_000;
  return Math.max(ms, 60_000); // minimum 1 minute
}

/** SMS bodies that will actually enqueue — used to reserve Mass Text credits. */
export function sendSmsBodiesForCreditEstimate(
  sequenceJson: unknown,
  fallbackBody = "",
): string[] {
  const sequence = parseSequence(sequenceJson);
  const bodies = sequence
    .filter((s) => s.step_type === "send_sms")
    .map((s) => String(s.config?.body || fallbackBody || ""));
  return bodies.length ? bodies : [fallbackBody || ""];
}

export function attachMediaToFirstSmsStep(
  sequence: SequenceStep[],
  mediaUrls: string[],
): SequenceStep[] {
  if (!mediaUrls.length) return sequence;
  let attached = false;
  return sequence.map((step) => {
    if (attached || step.step_type !== "send_sms") return step;
    attached = true;
    return {
      ...step,
      config: { ...(step.config || {}), mediaUrls },
    };
  });
}

export function parseSequence(raw: unknown): SequenceStep[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    try {
      return parseSequence(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.filter((s) => s && typeof s === "object" && "step_key" in s && "step_type" in s) as SequenceStep[];
}

export function findStep(sequence: SequenceStep[], stepKey: string | null | undefined) {
  if (!stepKey) return sequence[0] || null;
  return sequence.find((s) => s.step_key === stepKey) || null;
}

export function nextStepAfter(sequence: SequenceStep[], stepKey: string): SequenceStep | null {
  const idx = sequence.findIndex((s) => s.step_key === stepKey);
  if (idx < 0 || idx >= sequence.length - 1) return null;
  return sequence[idx + 1];
}

export function evaluateCondition(step: SequenceStep, facts: ConditionFacts): string {
  const when = String(step.config?.when || "no_activity");
  const thenKey = String(step.config?.then || "end");
  const elseKey = String(step.config?.else || "end");
  const hit = Boolean(facts[when as keyof ConditionFacts]);
  return hit ? thenKey : elseKey;
}

export function defaultSmsEmailSequence(): SequenceStep[] {
  return [
    { step_key: "sms_1", step_type: "send_sms", config: { template_role: "initial" } },
    { step_key: "wait_2d", step_type: "wait", config: { days: 2 } },
    { step_key: "email_1", step_type: "send_email", config: { template_role: "reminder" } },
    { step_key: "wait_2d_b", step_type: "wait", config: { days: 2 } },
    {
      step_key: "gate_no_click",
      step_type: "condition",
      config: { when: "no_activity", then: "sms_2", else: "end" },
    },
    { step_key: "sms_2", step_type: "send_sms", config: { template_role: "final_reminder" } },
    { step_key: "end", step_type: "end", config: {} },
  ];
}
