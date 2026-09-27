import {
  defaultCallbackRequiredCollectFieldIds,
  ensureCallbackRequiredCollectFieldIds,
} from "@/lib/solutions/appointment-receptionist/callback-required-field-defaults";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";

export function enabledCollectFieldsForCallback(state: AppointmentReceptionistWizardState) {
  return (state.collectFields || []).filter((f) => f.enabled !== false);
}

export function callbackRequiredFieldIds(state: AppointmentReceptionistWizardState) {
  return new Set(ensureCallbackRequiredCollectFieldIds(state));
}

export function setCallbackRequiredField(
  state: AppointmentReceptionistWizardState,
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void,
  fieldId: string,
  on: boolean,
) {
  const base = ensureCallbackRequiredCollectFieldIds(state);
  const next = new Set(base);
  if (on) next.add(fieldId);
  else next.delete(fieldId);
  patch({ callbackRequiredCollectFieldIds: [...next] });
}

export function resetCallbackRequiredToDefaults(
  state: AppointmentReceptionistWizardState,
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void,
) {
  patch({
    callbackRequiredCollectFieldIds: defaultCallbackRequiredCollectFieldIds(state.collectFields),
  });
}
