import "server-only";

import type { VoiceV2CallContext } from "./intake/types";
import type {
  VoiceV2PublishedAfterHoursHandlingConfig,
  VoiceV2UrgencyState,
} from "./after-hours-handling-types";
import { evaluateDeterministicRule } from "./deterministic-rules";

export function evaluateUrgencyForContext(
  ctx: VoiceV2CallContext,
  config: VoiceV2PublishedAfterHoursHandlingConfig,
): VoiceV2UrgencyState {
  const base: VoiceV2UrgencyState = {
    status: "NORMAL",
    evaluatedAt: new Date().toISOString(),
    stateVersion: ctx.afterHours?.urgency?.stateVersion ?? 0,
  };
  if (!config.urgencyEnabled || !config.urgencyRules.length) {
    return { ...base, status: "UNKNOWN" };
  }

  let matched: (typeof config.urgencyRules)[number] | null = null;
  for (const rule of config.urgencyRules) {
    if (evaluateDeterministicRule(rule, ctx)) {
      matched = rule;
      if (rule.severity === "CRITICAL") break;
    }
  }
  if (!matched) return base;

  return {
    status: matched.severity === "CRITICAL" ? "CRITICAL" : "URGENT",
    reason: matched.label || matched.fieldKey,
    matchedRuleId: matched.id,
    evaluatedAt: new Date().toISOString(),
    stateVersion: (ctx.afterHours?.urgency?.stateVersion ?? 0) + 1,
    sideEffectGeneration: ctx.afterHours?.urgency?.sideEffectGeneration,
  };
}

export function urgencyHandlingActionForRule(
  config: VoiceV2PublishedAfterHoursHandlingConfig,
  ruleId: string | undefined,
): import("./after-hours-handling-types").VoiceV2HandlingAction | null {
  if (!ruleId) return null;
  const rule = config.urgencyRules.find((r) => r.id === ruleId);
  return rule?.action ?? null;
}
