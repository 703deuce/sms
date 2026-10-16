import type { AppointmentReceptionistWizardState } from "./types";

export function isCollectFieldEnabled(
  field: AppointmentReceptionistWizardState["collectFields"][number],
): boolean {
  return field.enabled !== false;
}

export function patchCollectFieldEnabled(
  fields: AppointmentReceptionistWizardState["collectFields"],
  index: number,
  enabled: boolean,
): AppointmentReceptionistWizardState["collectFields"] {
  return fields.map((f, i) => (i === index ? { ...f, enabled } : f));
}

export function patchCollectFieldRequired(
  fields: AppointmentReceptionistWizardState["collectFields"],
  index: number,
  required: boolean,
): AppointmentReceptionistWizardState["collectFields"] {
  return fields.map((f, i) => (i === index ? { ...f, required } : f));
}

export function requiredCollectFieldIds(
  fields: AppointmentReceptionistWizardState["collectFields"],
): string[] {
  return fields.filter((f) => isCollectFieldEnabled(f) && f.required).map((f) => f.id);
}
