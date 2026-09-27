"use client";

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import {
  callbackRequiredFieldIds,
  enabledCollectFieldsForCallback,
  resetCallbackRequiredToDefaults,
  setCallbackRequiredField,
} from "@/lib/solutions/appointment-receptionist/callback-required-fields-logic";
import { FieldRow } from "@/newui-transplant/components/app/kit";
import { OpusDividedList } from "@/components/solutions/appointment-receptionist/wizard-opus-ui";
import { Button } from "@/newui-transplant/components/ui/button";
import { Checkbox } from "@/newui-transplant/components/ui/checkbox";
import { Label } from "@/newui-transplant/components/ui/label";

export function CallbackRequiredFieldsOpus({
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
        Enable caller information fields on the left before choosing callback requirements.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium">Required for a callback</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Uses the same caller fields you configure for this agent. Booking and callback can require
          different subsets.
        </p>
      </div>
      <OpusDividedList>
        {enabledFields.map((field) => {
          const checked = selected.has(field.id);
          return (
            <div key={field.id} className="px-3 py-2.5">
              <FieldRow
                label={field.label?.trim() || field.id}
                description="Shared field — not a separate callback-only question."
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(on) => setCallbackRequiredField(state, patch, field.id, on === true)}
                  aria-label={`Require ${field.label || field.id} for callback`}
                />
              </FieldRow>
            </div>
          );
        })}
      </OpusDividedList>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto p-0"
        onClick={() => resetCallbackRequiredToDefaults(state, patch)}
      >
        Reset to recommended defaults
      </Button>
    </div>
  );
}
