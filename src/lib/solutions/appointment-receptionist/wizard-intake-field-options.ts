import type { AppointmentReceptionistWizardState } from "./types";
import {
  wizardCollectFieldIdToCallerRowId,
} from "./wizard-advanced-bridge";
import { callerFieldIdToIntakeKey } from "@/lib/voice-v2/intake/compile-schema";

export type WizardIntakeFieldOption = {
  key: string;
  label: string;
  enabled: boolean;
};

export function wizardIntakeFieldOptions(
  state: AppointmentReceptionistWizardState,
): WizardIntakeFieldOption[] {
  return (state.collectFields || []).map((f) => {
    const rowId = wizardCollectFieldIdToCallerRowId(f.id);
    const key = callerFieldIdToIntakeKey(rowId);
    return {
      key,
      label: f.label?.trim() || key,
      enabled: f.enabled !== false,
    };
  });
}
