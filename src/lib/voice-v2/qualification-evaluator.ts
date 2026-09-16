import "server-only";

import type { VoiceV2CallContext } from "./intake/types";
import type {
  VoiceV2PublishedQualificationConfig,
  VoiceV2QualificationOperator,
  VoiceV2QualificationReasonCode,
  VoiceV2QualificationRuleRow,
  VoiceV2QualificationState,
  VoiceV2QualificationStatus,
} from "./qualification-types";

function fieldValue(ctx: VoiceV2CallContext, key: string): string {
  const v = ctx.intakeState[key]?.value?.trim() || "";
  return v;
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

function evaluateOperator(
  operator: VoiceV2QualificationOperator,
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

function evaluateRule(rule: VoiceV2QualificationRuleRow, ctx: VoiceV2CallContext): boolean {
  const key = rule.fieldKey.trim();
  if (!key) return false;
  const val = fieldValue(ctx, key);
  return evaluateOperator(rule.operator, val, rule.value || "");
}

function missingQualificationFields(
  config: VoiceV2PublishedQualificationConfig,
  ctx: VoiceV2CallContext,
): string[] {
  const missing: string[] = [];
  for (const key of config.qualificationFieldKeys) {
    if (!fieldValue(ctx, key)) missing.push(key);
  }
  return missing;
}

function serviceAreaFromZips(
  config: VoiceV2PublishedQualificationConfig,
  ctx: VoiceV2CallContext,
): { status: VoiceV2QualificationStatus; reasonCode?: VoiceV2QualificationReasonCode; reasonLabel?: string } | null {
  if (!config.supportedZipCodes.length) return null;
  const zipKey = config.qualificationFieldKeys.includes("zip_code")
    ? "zip_code"
    : config.qualificationFieldKeys.find((k) => /zip/i.test(k)) || "zip_code";
  const zip = normalizeZip(fieldValue(ctx, zipKey));
  if (!zip) {
    return {
      status: "NEEDS_REVIEW",
      reasonCode: "MISSING_INFORMATION",
      reasonLabel: "ZIP code needed for service area",
    };
  }
  const allowed = new Set(config.supportedZipCodes.map(normalizeZip));
  if (!allowed.has(zip)) {
    return {
      status: "NOT_QUALIFIED",
      reasonCode: "OUTSIDE_SERVICE_AREA",
      reasonLabel: "Outside configured service area",
    };
  }
  return null;
}

export function evaluateVoiceV2Qualification(
  ctx: VoiceV2CallContext,
  config: VoiceV2PublishedQualificationConfig,
): VoiceV2QualificationState {
  const evaluatedAt = new Date().toISOString();
  if (!config.qualificationEnabled) {
    return {
      status: "UNKNOWN",
      revision: config.qualificationRevision,
      evaluatedAt,
    };
  }

  const missing = missingQualificationFields(config, ctx);
  if (missing.length > 0) {
    return {
      status: "NEEDS_REVIEW",
      reasonCode: "MISSING_INFORMATION",
      reasonLabel: `Missing: ${missing.join(", ")}`,
      revision: config.qualificationRevision,
      evaluatedAt,
    };
  }

  const area = serviceAreaFromZips(config, ctx);
  if (area) {
    return {
      status: area.status,
      reasonCode: area.reasonCode,
      reasonLabel: area.reasonLabel,
      revision: config.qualificationRevision,
      evaluatedAt,
      primaryActionBlocked:
        config.qualificationRequiredBeforePrimaryAction &&
        (area.status === "NOT_QUALIFIED" || area.status === "NEEDS_REVIEW"),
    };
  }

  const rules = config.rules || [];
  if (rules.length) {
    if (config.rulesMatchMode === "ALL") {
      const allMatch = rules.every((rule) => evaluateRule(rule, ctx));
      if (allMatch) {
        const last = rules[rules.length - 1];
        const status = last.resultStatus;
        return {
          status,
          reasonCode: last.reasonCode || "RULE_MATCH",
          reasonLabel: last.reasonLabel || "Configured qualification rules",
          revision: config.qualificationRevision,
          evaluatedAt,
          primaryActionBlocked:
            config.qualificationRequiredBeforePrimaryAction &&
            (status === "NOT_QUALIFIED" || status === "NEEDS_REVIEW"),
        };
      }
    } else {
      for (const rule of rules) {
        if (!evaluateRule(rule, ctx)) continue;
        const status = rule.resultStatus;
        return {
          status,
          reasonCode: rule.reasonCode || "RULE_MATCH",
          reasonLabel: rule.reasonLabel || "Configured qualification rule",
          revision: config.qualificationRevision,
          evaluatedAt,
          primaryActionBlocked:
            config.qualificationRequiredBeforePrimaryAction &&
            (status === "NOT_QUALIFIED" || status === "NEEDS_REVIEW"),
        };
      }
    }
  }

  return {
    status: "QUALIFIED",
    revision: config.qualificationRevision,
    evaluatedAt,
    primaryActionBlocked: false,
  };
}

export function applyQualificationToContext(
  ctx: VoiceV2CallContext,
  config: VoiceV2PublishedQualificationConfig,
): VoiceV2CallContext {
  if (!config.qualificationEnabled) {
    return { ...ctx, qualification: undefined };
  }
  const qualification = evaluateVoiceV2Qualification(ctx, config);
  return { ...ctx, qualification };
}
