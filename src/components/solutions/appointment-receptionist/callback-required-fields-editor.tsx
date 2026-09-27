"use client";

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import {
  callbackRequiredFieldIds,
  enabledCollectFieldsForCallback,
  resetCallbackRequiredToDefaults,
  setCallbackRequiredField,
} from "@/lib/solutions/appointment-receptionist/callback-required-fields-logic";
import { Label } from "@/components/ui/input";

export function CallbackRequiredFieldsEditor({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
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
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border"
                  checked={checked}
                  onChange={(e) => setCallbackRequiredField(state, patch, field.id, e.target.checked)}
                />
                <span>
                  <span className="font-medium">{field.label?.trim() || field.id}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Shared field — not a separate callback-only question.
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
        onClick={() => resetCallbackRequiredToDefaults(state, patch)}
      >
        Reset to recommended defaults
      </button>
    </div>
  );
}
