"use client";

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import type { VoiceV2UrgencyRuleRow } from "@/lib/voice-receptionist-wizard/after-hours-handling-types";
import { wizardIntakeFieldOptions } from "@/lib/solutions/appointment-receptionist/wizard-intake-field-options";
import { Input, Label } from "@/components/ui/input";

const OPERATORS: Array<{ value: VoiceV2UrgencyRuleRow["operator"]; label: string }> = [
  { value: "EQUALS", label: "equals" },
  { value: "NOT_EQUALS", label: "does not equal" },
  { value: "CONTAINS", label: "contains" },
  { value: "IN", label: "is one of" },
  { value: "NOT_IN", label: "is not one of" },
  { value: "GREATER_THAN_OR_EQUAL", label: "≥" },
  { value: "LESS_THAN_OR_EQUAL", label: "≤" },
  { value: "EXISTS", label: "has a value" },
  { value: "NOT_EXISTS", label: "is empty" },
];

const ACTIONS: Array<{ value: VoiceV2UrgencyRuleRow["action"]; label: string }> = [
  { value: "TRANSFER", label: "Transfer" },
  { value: "CALLBACK", label: "Callback" },
  { value: "TAKE_MESSAGE", label: "Take message" },
  { value: "REQUEST_ONLY", label: "Request only" },
  { value: "SEND_LINK", label: "Send link" },
  { value: "CONTINUE", label: "Continue with Amy" },
  { value: "END_POLITELY", label: "End politely" },
];

const FALLBACKS = [
  { value: "CONTINUE_WITH_AMY", label: "Continue with Amy" },
  { value: "TAKE_MESSAGE", label: "Take message" },
  { value: "CALLBACK", label: "Callback" },
  { value: "REQUEST_ONLY", label: "Request only" },
  { value: "SEND_LINK", label: "Send link" },
] as const;

export function UrgencyRulesEditor({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
  const fieldOptions = wizardIntakeFieldOptions(state);
  const planId = state.defaultTransferPlanId?.trim() || "default_transfer_plan";
  const rules = state.urgencyRules || [];

  const updateRule = (index: number, next: VoiceV2UrgencyRuleRow) => {
    const copy = [...rules];
    copy[index] = next;
    patch({ urgencyRules: copy });
  };

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Urgency rules
        </p>
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
          onClick={() =>
            patch({
              urgencyRules: [
                ...rules,
                {
                  id: `urgency_${Date.now()}`,
                  fieldKey: fieldOptions.find((f) => f.enabled)?.key || "phone",
                  operator: "EQUALS",
                  value: "",
                  severity: "URGENT",
                  action: "TRANSFER",
                  transferPlanId: planId,
                  fallbackAction: "CALLBACK",
                },
              ],
            })
          }
        >
          + Add rule
        </button>
      </div>
      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Add rules to escalate when collected caller fields match (for example active flooding
          without shutoff).
        </p>
      ) : null}
      {rules.map((rule, ri) => (
        <div
          key={rule.id}
          className="space-y-2 rounded-lg border border-border p-3 text-xs"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-[11px]">When field</Label>
              <select
                className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2"
                value={rule.fieldKey}
                onChange={(e) => updateRule(ri, { ...rule, fieldKey: e.target.value })}
              >
                {fieldOptions.map((f) => (
                  <option key={f.key} value={f.key} disabled={!f.enabled}>
                    {f.label} ({f.key}){f.enabled ? "" : " — disabled"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[11px]">Operator</Label>
              <select
                className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2"
                value={rule.operator}
                onChange={(e) =>
                  updateRule(ri, {
                    ...rule,
                    operator: e.target.value as VoiceV2UrgencyRuleRow["operator"],
                  })
                }
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-[11px]">Value</Label>
              <Input
                className="mt-1 h-9"
                value={rule.value}
                onChange={(e) => updateRule(ri, { ...rule, value: e.target.value })}
                placeholder="Comparison value (comma-separated for lists)"
                disabled={rule.operator === "EXISTS" || rule.operator === "NOT_EXISTS"}
              />
            </div>
            <div>
              <Label className="text-[11px]">Severity</Label>
              <select
                className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2"
                value={rule.severity}
                onChange={(e) =>
                  updateRule(ri, {
                    ...rule,
                    severity: e.target.value as VoiceV2UrgencyRuleRow["severity"],
                  })
                }
              >
                <option value="URGENT">Urgent</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <Label className="text-[11px]">Action</Label>
              <select
                className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2"
                value={rule.action}
                onChange={(e) =>
                  updateRule(ri, {
                    ...rule,
                    action: e.target.value as VoiceV2UrgencyRuleRow["action"],
                  })
                }
              >
                {ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            {rule.action === "TRANSFER" ? (
              <>
                <div>
                  <Label className="text-[11px]">Transfer plan</Label>
                  <select
                    className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2"
                    value={rule.transferPlanId || planId}
                    onChange={(e) =>
                      updateRule(ri, { ...rule, transferPlanId: e.target.value })
                    }
                  >
                    <option value={planId}>Default transfer plan</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[11px]">Fallback</Label>
                  <select
                    className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2"
                    value={rule.fallbackAction || "CALLBACK"}
                    onChange={(e) =>
                      updateRule(ri, {
                        ...rule,
                        fallbackAction: e.target.value as VoiceV2UrgencyRuleRow["fallbackAction"],
                      })
                    }
                  >
                    {FALLBACKS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}
            <div className="sm:col-span-2">
              <Label className="text-[11px]">Label (optional)</Label>
              <Input
                className="mt-1 h-9"
                value={rule.label || ""}
                onChange={(e) => updateRule(ri, { ...rule, label: e.target.value })}
                placeholder="Reason shown internally"
              />
            </div>
          </div>
          <button
            type="button"
            className="text-[11px] font-semibold text-rose-600"
            onClick={() =>
              patch({ urgencyRules: rules.filter((_, i) => i !== ri) })
            }
          >
            Delete rule
          </button>
        </div>
      ))}
    </div>
  );
}
