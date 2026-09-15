"use client";

import { Input } from "@/components/ui/input";
import { INTAKE_FIELD_DEFAULTS } from "@/lib/voice-v2/intake/defaults";
import type {
  IntakeFieldKey,
  IntakeRequirementLevel,
  VoiceV2IntakeWizardConfig,
} from "@/lib/voice-v2/intake/wizard-config";
import { INTAKE_FIELD_KEYS } from "@/lib/voice-v2/intake/wizard-config";

const REQUIREMENT_OPTIONS: { value: IntakeRequirementLevel; label: string }[] = [
  { value: "OPTIONAL", label: "Optional" },
  { value: "REQUIRED_FOR_RECORD", label: "Required for record" },
  { value: "REQUIRED_BEFORE_BOOKING", label: "Required before booking" },
];

type Props = {
  value: VoiceV2IntakeWizardConfig | undefined;
  onChange: (next: VoiceV2IntakeWizardConfig) => void;
};

export function VoiceV2IntakeWizardSection({ value, onChange }: Props) {
  const cfg = value || { fields: {} };

  function patchField(key: IntakeFieldKey, patch: Partial<NonNullable<typeof cfg.fields>[IntakeFieldKey]>) {
    const def = INTAKE_FIELD_DEFAULTS[key];
    const prev = cfg.fields?.[key] || {};
    const enabled = patch.enabled ?? prev.enabled ?? def.enabled;
    let requirementLevel = patch.requirementLevel ?? prev.requirementLevel ?? def.requirementLevel;
    if (!enabled && requirementLevel !== "OPTIONAL") {
      requirementLevel = "OPTIONAL";
    }
    onChange({
      fields: {
        ...cfg.fields,
        [key]: {
          ...prev,
          ...patch,
          enabled,
          requirementLevel,
        },
      },
    });
  }

  return (
    <div className="space-y-6 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold">Caller information (Voice V2 booking)</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Configure what Amy collects during live calls. Intake saves are fast and do not block availability
          lookup.
        </p>
      </div>
      {INTAKE_FIELD_KEYS.map((key) => {
        const def = INTAKE_FIELD_DEFAULTS[key];
        const row = cfg.fields?.[key] || {};
        const enabled = row.enabled ?? def.enabled;
        return (
          <div key={key} className="grid gap-3 border-t border-border pt-4 md:grid-cols-2">
            <div className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => patchField(key, { enabled: e.target.checked })}
                id={`intake-${key}-enabled`}
              />
              <label htmlFor={`intake-${key}-enabled`} className="text-sm font-medium capitalize">
                {key.replace("_", " ")}
              </label>
            </div>
            <label className="text-xs text-muted-foreground">
              Requirement
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                disabled={!enabled}
                value={row.requirementLevel ?? def.requirementLevel}
                onChange={(e) =>
                  patchField(key, { requirementLevel: e.target.value as IntakeRequirementLevel })
                }
              >
                {REQUIREMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Label
              <Input
                className="mt-1"
                disabled={!enabled}
                value={row.label ?? def.label}
                onChange={(e) => patchField(key, { label: e.target.value })}
              />
            </label>
            <label className="text-xs text-muted-foreground md:col-span-2">
              Question text
              <Input
                className="mt-1"
                disabled={!enabled}
                value={row.questionText ?? def.questionText}
                onChange={(e) => patchField(key, { questionText: e.target.value })}
              />
            </label>
          </div>
        );
      })}
    </div>
  );
}
