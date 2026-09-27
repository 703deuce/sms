"use client";

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import type { VoiceV2UrgencyRuleRow } from "@/lib/voice-receptionist-wizard/after-hours-handling-types";
import { wizardIntakeFieldOptions } from "@/lib/solutions/appointment-receptionist/wizard-intake-field-options";
import {
  pickWizardFieldComponents,
  type WizardPresentation,
  WizardSelectField,
} from "./wizard-field-kit";
import { OpusCompactPanel } from "./wizard-opus-ui";

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
  presentation = "legacy",
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  presentation?: WizardPresentation;
}) {
  const { Input, Label, Button } = pickWizardFieldComponents(presentation);
  const isOpus = presentation === "opus";
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
        <Button
          type="button"
          variant="outline"
          size="sm"
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
        </Button>
      </div>
      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Add rules to escalate when collected caller fields match (for example active flooding
          without shutoff).
        </p>
      ) : null}
      {rules.map((rule, ri) => (
        <OpusCompactPanel key={rule.id} isOpus={isOpus} className="text-xs">
          <div className="grid gap-2 sm:grid-cols-2">
            <WizardSelectField
              presentation={presentation}
              label="When field"
              value={rule.fieldKey}
              onChange={(v) => updateRule(ri, { ...rule, fieldKey: v })}
              options={fieldOptions.map((f) => ({
                value: f.key,
                label: `${f.label} (${f.key})${f.enabled ? "" : " — disabled"}`,
              }))}
            />
            <WizardSelectField
              presentation={presentation}
              label="Operator"
              value={rule.operator}
              onChange={(v) =>
                updateRule(ri, {
                  ...rule,
                  operator: v as VoiceV2UrgencyRuleRow["operator"],
                })
              }
              options={OPERATORS.map((op) => ({ value: op.value, label: op.label }))}
            />
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
            <WizardSelectField
              presentation={presentation}
              label="Severity"
              value={rule.severity}
              onChange={(v) =>
                updateRule(ri, {
                  ...rule,
                  severity: v as VoiceV2UrgencyRuleRow["severity"],
                })
              }
              options={[
                { value: "URGENT", label: "Urgent" },
                { value: "CRITICAL", label: "Critical" },
              ]}
            />
            <WizardSelectField
              presentation={presentation}
              label="Action"
              value={rule.action}
              onChange={(v) =>
                updateRule(ri, {
                  ...rule,
                  action: v as VoiceV2UrgencyRuleRow["action"],
                })
              }
              options={ACTIONS.map((a) => ({ value: a.value, label: a.label }))}
            />
            {rule.action === "TRANSFER" ? (
              <>
                <WizardSelectField
                  presentation={presentation}
                  label="Transfer plan"
                  value={rule.transferPlanId || planId}
                  onChange={(v) => updateRule(ri, { ...rule, transferPlanId: v })}
                  options={[{ value: planId, label: "Default transfer plan" }]}
                />
                <WizardSelectField
                  presentation={presentation}
                  label="Fallback"
                  value={rule.fallbackAction || "CALLBACK"}
                  onChange={(v) =>
                    updateRule(ri, {
                      ...rule,
                      fallbackAction: v as VoiceV2UrgencyRuleRow["fallbackAction"],
                    })
                  }
                  options={FALLBACKS.map((f) => ({ value: f.value, label: f.label }))}
                />
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() =>
              patch({
                urgencyRules: rules.filter((_, i) => i !== ri),
              })
            }
          >
            Remove rule
          </Button>
        </OpusCompactPanel>
      ))}
    </div>
  );
}
