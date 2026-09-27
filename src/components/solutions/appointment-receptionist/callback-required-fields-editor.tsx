"use client";

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import {
  callbackRequiredFieldIds,
  enabledCollectFieldsForCallback,
  resetCallbackRequiredToDefaults,
  setCallbackRequiredField,
} from "@/lib/solutions/appointment-receptionist/callback-required-fields-logic";
import {
  pickWizardFieldComponents,
  type WizardPresentation,
  WizardToggleField,
} from "./wizard-field-kit";

export function CallbackRequiredFieldsEditor({
  state,
  patch,
  presentation = "legacy",
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  presentation?: WizardPresentation;
}) {
  const { Label, Button } = pickWizardFieldComponents(presentation);
  const enabledFields = enabledCollectFieldsForCallback(state);
  const selected = callbackRequiredFieldIds(state);

  if (enabledFields.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Add caller information fields in Appointments → Collect information first.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <Label>Required before recording a callback</Label>
      <p className="text-xs text-muted-foreground">
        Uses the same caller fields you configure for this agent. Booking and callback can require
        different subsets.
      </p>
      <ul className="space-y-2">
        {enabledFields.map((field) => {
          const checked = selected.has(field.id);
          return (
            <li key={field.id}>
              <WizardToggleField
                presentation={presentation}
                label={field.label?.trim() || field.id}
                description="Shared field — not a separate callback-only question."
                checked={checked}
                onCheckedChange={(on) => setCallbackRequiredField(state, patch, field.id, on)}
              />
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs font-semibold"
        onClick={() => resetCallbackRequiredToDefaults(state, patch)}
      >
        Reset to recommended defaults
      </Button>
    </div>
  );
}
