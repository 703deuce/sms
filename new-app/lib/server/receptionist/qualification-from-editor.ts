import type { AgentConfig } from "@/lib/agent";
import type { VoiceV3QualificationConfig } from "@/lib/server/voice-v3/config/agent-config";
import { DEFAULT_V3_QUALIFICATION } from "@/lib/server/voice-v3/config/default-nested-config";
import type { VoiceV2QualificationRuleRow } from "@/lib/server/voice-v3/qualification/qualification-types";

function resolveIntakeFieldKey(editor: AgentConfig, fieldRef: string): string {
  const ref = fieldRef.trim();
  if (!ref) return ref;
  const byId = editor.intake.find((f) => f.id === ref);
  if (byId) return byId.id;
  const byLabel = editor.intake.find((f) => f.label.trim().toLowerCase() === ref.toLowerCase());
  return byLabel?.id ?? ref;
}

function mapOperator(op: AgentConfig["qualification"]["rules"][number]["operator"]): VoiceV2QualificationRuleRow["operator"] {
  switch (op) {
    case "in":
      return "IN";
    case "not_in":
      return "NOT_IN";
    case "equals":
    default:
      return "EQUALS";
  }
}

function mapFallback(
  fallback: AgentConfig["qualification"]["fallback"],
): string | null {
  switch (fallback) {
    case "callback":
      return "TAKE_MESSAGE";
    case "transfer":
      return "CONTINUE_PRIMARY_MODE";
    case "decline":
      return "TAKE_MESSAGE";
    default:
      return null;
  }
}

export function qualificationConfigFromEditor(editor: AgentConfig): VoiceV3QualificationConfig {
  const enabled = editor.capabilities.qualify === true;
  const rules: VoiceV2QualificationRuleRow[] = editor.qualification.rules.map((r) => ({
    id: r.id,
    fieldKey: resolveIntakeFieldKey(editor, r.field),
    operator: mapOperator(r.operator),
    value: r.values,
    resultStatus: "NOT_QUALIFIED",
    reasonCode: "RULE_MATCH",
    reasonLabel: "Did not meet qualification rules",
  }));

  const zipField = editor.intake.find((f) => f.type === "zip" || f.qualifies);
  const supportedZipCodes: string[] = [];
  if (zipField && rules.some((r) => r.fieldKey === zipField.id && r.operator === "IN")) {
    const zipRule = rules.find((r) => r.fieldKey === zipField.id);
    if (zipRule?.value) {
      supportedZipCodes.push(
        ...zipRule.value
          .split(/[,;|]/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
  }

  return {
    ...DEFAULT_V3_QUALIFICATION,
    enabled,
    requiredBeforePrimaryAction: enabled,
    rulesMatchMode: editor.qualification.match === "any" ? "ANY" : "ALL",
    notQualifiedFallback: mapFallback(editor.qualification.fallback),
    needsReviewFallback: mapFallback(editor.qualification.fallback),
    rules,
    supportedZipCodes,
  };
}
