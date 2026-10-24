import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceV2UrgencyRuleRow } from "@/lib/voice-receptionist-wizard/after-hours-handling-types";
import { evaluateDeterministicFieldRule } from "@/lib/voice-receptionist-wizard/deterministic-rules";

export type VoiceV3UrgencyEvaluation = {
  matched: boolean;
  severity: "NORMAL" | "URGENT" | "CRITICAL";
  action: VoiceV2UrgencyRuleRow["action"] | null;
  transferPlanId: string | null;
  fallbackAction: VoiceV2UrgencyRuleRow["fallbackAction"];
  ruleId: string | null;
  label: string | null;
};

function intakeValue(ctx: VoiceV3CallContext, fieldKey: string): string | null {
  return ctx.intake.values[fieldKey]?.value?.trim() || null;
}

export function evaluateVoiceV3Urgency(
  config: VoiceV3AgentConfig,
  ctx: VoiceV3CallContext,
): VoiceV3UrgencyEvaluation {
  const none: VoiceV3UrgencyEvaluation = {
    matched: false,
    severity: "NORMAL",
    action: null,
    transferPlanId: null,
    fallbackAction: null,
    ruleId: null,
    label: null,
  };

  if (!config.callHandling.urgencyEnabled) return none;

  const rules = (config.callHandling.urgencyRules ?? []) as VoiceV2UrgencyRuleRow[];
  for (const rule of rules) {
    if (!rule.fieldKey?.trim()) continue;
    const actual = intakeValue(ctx, rule.fieldKey);
    const hit = evaluateDeterministicFieldRule({
      operator: rule.operator,
      expected: rule.value,
      actual,
    });
    if (!hit) continue;
    return {
      matched: true,
      severity: rule.severity === "CRITICAL" ? "CRITICAL" : "URGENT",
      action: rule.action,
      transferPlanId: rule.transferPlanId?.trim() || null,
      fallbackAction: rule.fallbackAction ?? null,
      ruleId: rule.id,
      label: rule.label?.trim() || rule.fieldKey,
    };
  }
  return none;
}
