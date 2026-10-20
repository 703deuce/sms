import type { AppointmentReceptionistWizardState } from "./types";

const REASON_FIELD_IDS = ["service", "service_reason", "reason", "notes"] as const;

/**
 * Default callback-required collect field ids for new agents:
 * name + phone + best available reason/message field.
 */
export function defaultCallbackRequiredCollectFieldIds(
  collectFields: AppointmentReceptionistWizardState["collectFields"],
): string[] {
  const enabled = (collectFields || []).filter((f) => f.enabled !== false);
  const ids: string[] = [];
  const pick = (candidates: string[]) => {
    for (const c of candidates) {
      const hit = enabled.find((f) => f.id === c || f.id === `custom_${c}`);
      if (hit) {
        ids.push(hit.id);
        return true;
      }
    }
    return false;
  };
  pick(["full_name", "name"]);
  pick(["phone", "callback_number"]);
  if (!pick([...REASON_FIELD_IDS])) {
    const customReason = enabled.find((f) =>
      /reason|message|issue/i.test(f.label || f.id),
    );
    if (customReason) ids.push(customReason.id);
  }
  return ids;
}

export function ensureCallbackRequiredCollectFieldIds(
  state: AppointmentReceptionistWizardState,
): string[] {
  const current = state.callbackRequiredCollectFieldIds;
  if (current?.length) return [...current];
  return defaultCallbackRequiredCollectFieldIds(state.collectFields);
}
