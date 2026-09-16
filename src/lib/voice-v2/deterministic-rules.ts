import type { VoiceV2CallContext } from "./intake/types";
import type { VoiceV2QualificationOperator } from "./qualification-types";

export type VoiceV2DeterministicOperator = VoiceV2QualificationOperator;

export type VoiceV2DeterministicRuleRow = {
  id: string;
  fieldKey: string;
  operator: VoiceV2DeterministicOperator;
  value: string;
};

export function intakeFieldValue(ctx: VoiceV2CallContext, key: string): string {
  return ctx.intakeState[key]?.value?.trim() || "";
}

function parseList(raw: string): string[] {
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeZip(v: string): string {
  return v.replace(/\D/g, "").slice(0, 10);
}

export function evaluateDeterministicOperator(
  operator: VoiceV2DeterministicOperator,
  fieldVal: string,
  ruleValue: string,
): boolean {
  const fv = fieldVal.trim();
  const empty = !fv;
  switch (operator) {
    case "EXISTS":
      return !empty;
    case "NOT_EXISTS":
      return empty;
    case "EQUALS":
      return fv.toLowerCase() === ruleValue.trim().toLowerCase();
    case "NOT_EQUALS":
      return fv.toLowerCase() !== ruleValue.trim().toLowerCase();
    case "CONTAINS":
      return fv.toLowerCase().includes(ruleValue.trim().toLowerCase());
    case "IN": {
      const list = parseList(ruleValue).map((x) => x.toLowerCase());
      const zipMode = list.every((x) => /^\d{5}/.test(x));
      if (zipMode) {
        const z = normalizeZip(fv);
        return list.some((x) => normalizeZip(x) === z);
      }
      return list.includes(fv.toLowerCase());
    }
    case "NOT_IN": {
      const list = parseList(ruleValue).map((x) => x.toLowerCase());
      const zipMode = list.every((x) => /^\d{5}/.test(x));
      if (zipMode) {
        const z = normalizeZip(fv);
        return !list.some((x) => normalizeZip(x) === z);
      }
      return !list.includes(fv.toLowerCase());
    }
    case "GREATER_THAN_OR_EQUAL": {
      const n = Number(fv.replace(/[^0-9.]/g, ""));
      const t = Number(ruleValue.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(n) || !Number.isFinite(t)) return false;
      return n >= t;
    }
    case "LESS_THAN_OR_EQUAL": {
      const n = Number(fv.replace(/[^0-9.]/g, ""));
      const t = Number(ruleValue.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(n) || !Number.isFinite(t)) return false;
      return n <= t;
    }
    default:
      return false;
  }
}

export function evaluateDeterministicRule(
  rule: VoiceV2DeterministicRuleRow,
  ctx: VoiceV2CallContext,
): boolean {
  const key = rule.fieldKey.trim();
  if (!key) return false;
  return evaluateDeterministicOperator(rule.operator, intakeFieldValue(ctx, key), rule.value || "");
}

export function evaluateDeterministicRuleGroup(input: {
  rules: VoiceV2DeterministicRuleRow[];
  matchMode: "ALL" | "ANY";
  ctx: VoiceV2CallContext;
}): boolean {
  if (!input.rules.length) return false;
  if (input.matchMode === "ANY") {
    return input.rules.some((r) => evaluateDeterministicRule(r, input.ctx));
  }
  return input.rules.every((r) => evaluateDeterministicRule(r, input.ctx));
}
