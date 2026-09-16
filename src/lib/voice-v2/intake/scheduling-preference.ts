import type { VoiceV2CallContext } from "./types";
import {
  applyIntakeWorkflowSignals,
  mergeWorkflowIntoContext,
  normalizeRequestedDate,
  workflowFromContext,
} from "../booking-workflow";

export function extractSchedulingRequestedDate(raw: Record<string, unknown>): string | null {
  const pref = (raw.scheduling_preference || raw.schedulingPreference) as
    | { requested_date?: string; requestedDate?: string }
    | undefined;
  return normalizeRequestedDate(pref?.requested_date ?? pref?.requestedDate);
}

export function intakeFieldsHaveValues(fieldsRaw: Record<string, unknown>): boolean {
  for (const value of Object.values(fieldsRaw)) {
    if (String(value ?? "").trim()) return true;
  }
  return false;
}

export function applySchedulingPreferenceToContext(
  ctx: VoiceV2CallContext,
  raw: Record<string, unknown>,
  requestedDate: string,
): VoiceV2CallContext {
  let workflow = applyIntakeWorkflowSignals(workflowFromContext(ctx), {
    raw,
    savedKeys: [],
    schedulingDateFromSave: requestedDate,
  });
  workflow = { ...workflow, bookingIntentActive: true, requestedDate };
  return mergeWorkflowIntoContext(ctx, workflow);
}
