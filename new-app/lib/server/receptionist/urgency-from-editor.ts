import type { AgentConfig } from "@/lib/agent";
import type { VoiceV2UrgencyRuleRow } from "@/lib/receptionist/after-hours-types";

function resolveFieldKey(editor: AgentConfig, fieldRef: string): string {
  const ref = fieldRef.trim();
  const byId = editor.intake.find((f) => f.id === ref);
  if (byId) return byId.id;
  const byLabel = editor.intake.find((f) => f.label.trim().toLowerCase() === ref.toLowerCase());
  return byLabel?.id ?? ref;
}

function mapOperator(op: AgentConfig["urgency"]["rules"][number]["operator"]): VoiceV2UrgencyRuleRow["operator"] {
  switch (op) {
    case "in":
      return "IN";
    case "contains":
      return "CONTAINS";
    case "exists":
      return "EXISTS";
    case "equals":
    default:
      return "EQUALS";
  }
}

function mapAction(action: AgentConfig["urgency"]["rules"][number]["action"]): VoiceV2UrgencyRuleRow["action"] {
  switch (action) {
    case "TAKE_MESSAGE":
      return "TAKE_MESSAGE";
    case "CALLBACK":
      return "CALLBACK";
    case "CONTINUE":
      return "CONTINUE";
    case "TRANSFER":
    default:
      return "TRANSFER";
  }
}

export function urgencyRulesFromEditor(editor: AgentConfig): VoiceV2UrgencyRuleRow[] {
  return editor.urgency.rules.map((r) => ({
    id: r.id,
    label: r.label,
    fieldKey: resolveFieldKey(editor, r.field),
    operator: mapOperator(r.operator),
    value: r.value,
    severity: r.severity,
    action: mapAction(r.action),
    transferPlanId: r.destinationId ?? null,
    fallbackAction: "TAKE_MESSAGE",
  }));
}
