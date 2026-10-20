import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import type {
  VoiceV2QualificationRuleRow,
  VoiceV2QualificationStatus,
} from "./qualification-types";
import { evaluateDeterministicFieldRule } from "./deterministic-rules";

export type VoiceV3QualificationEvaluation = {
  status: VoiceV2QualificationStatus;
  reasonCode?: string;
  reasonLabel?: string;
  primaryActionBlocked: boolean;
  evaluatedAt: string;
};

function intakeValue(ctx: VoiceV3CallContext, fieldKey: string): string | null {
  const direct = ctx.intake.values[fieldKey]?.value?.trim();
  if (direct) return direct;
  if (fieldKey === "zip" || fieldKey === "zip_code") {
    return ctx.intake.values.zip_code?.value?.trim() || ctx.intake.values.zip?.value?.trim() || null;
  }
  return null;
}

function zipSupported(config: VoiceV3AgentConfig, zip: string | null): boolean {
  const list = config.qualification.supportedZipCodes ?? [];
  if (!list.length) return true;
  if (!zip?.trim()) return false;
  const n = zip.trim().slice(0, 5);
  return list.some((z) => z.trim().slice(0, 5) === n);
}

function evaluateRules(
  rules: VoiceV2QualificationRuleRow[],
  matchMode: "ALL" | "ANY",
  ctx: VoiceV3CallContext,
): VoiceV2QualificationRuleRow | null {
  const hits: VoiceV2QualificationRuleRow[] = [];
  for (const rule of rules) {
    const actual = intakeValue(ctx, rule.fieldKey);
    const cond = evaluateDeterministicFieldRule({
      operator: rule.operator,
      expected: rule.value,
      actual,
    });
    if (cond) hits.push(rule);
  }
  if (!hits.length) return null;
  if (matchMode === "ANY") return hits[0];
  if (hits.length === rules.length) return hits[0];
  return null;
}

export function evaluateVoiceV3Qualification(
  config: VoiceV3AgentConfig,
  ctx: VoiceV3CallContext,
  at?: string,
): VoiceV3QualificationEvaluation {
  const evaluatedAt = at ?? new Date().toISOString();
  const q = config.qualification;
  if (!q.enabled) {
    return {
      status: "UNKNOWN",
      primaryActionBlocked: false,
      evaluatedAt,
    };
  }

  const rules = (q.rules as VoiceV2QualificationRuleRow[]).filter((r) => r.fieldKey?.trim());
  const matchMode = q.rulesMatchMode === "ANY" ? "ANY" : "ALL";

  const zip = intakeValue(ctx, "zip_code") || intakeValue(ctx, "zip");
  if (!zipSupported(config, zip)) {
    return {
      status: "NOT_QUALIFIED",
      reasonCode: "OUTSIDE_SERVICE_AREA",
      reasonLabel: "Outside supported service area",
      primaryActionBlocked: q.requiredBeforePrimaryAction,
      evaluatedAt,
    };
  }

  const matched = evaluateRules(rules, matchMode, ctx);
  if (!matched) {
    const missingRequired = q.requiredBeforePrimaryAction && rules.length > 0;
    return {
      status: missingRequired ? "NEEDS_REVIEW" : "UNKNOWN",
      reasonCode: missingRequired ? "MISSING_INFORMATION" : undefined,
      reasonLabel: missingRequired ? "Qualification information incomplete" : undefined,
      primaryActionBlocked: missingRequired,
      evaluatedAt,
    };
  }

  const status = matched.resultStatus;
  const blocked =
    q.requiredBeforePrimaryAction &&
    (status === "NOT_QUALIFIED" || status === "NEEDS_REVIEW");

  return {
    status,
    reasonCode: matched.reasonCode,
    reasonLabel: matched.reasonLabel,
    primaryActionBlocked: blocked,
    evaluatedAt,
  };
}

export function isQualificationBlockingCalendarActions(
  config: VoiceV3AgentConfig,
  ctx: VoiceV3CallContext,
): boolean {
  const eval_ = evaluateVoiceV3Qualification(config, ctx);
  return eval_.primaryActionBlocked;
}
