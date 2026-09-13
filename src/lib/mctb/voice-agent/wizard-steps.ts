import { WIZARD_STEPS, type WizardStepId } from "@/lib/solutions/appointment-receptionist/types";
import { visibleWizardSteps } from "@/lib/solutions/appointment-receptionist/wizard-presets";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";

/** URL query values for deep links (`?step=`). */
export const MCTB_VOICE_AGENT_STEP_QUERY: Record<WizardStepId, string> = {
  goals: "goals",
  phone: "phone",
  information: "information",
  appointments: "booking",
  "call-handling": "call-handling",
  voice: "voice",
  test: "test",
  activate: "activate",
};

const QUERY_TO_STEP: Record<string, WizardStepId> = Object.fromEntries(
  Object.entries(MCTB_VOICE_AGENT_STEP_QUERY).map(([id, q]) => [q, id as WizardStepId]),
) as Record<string, WizardStepId>;

export const MCTB_VOICE_AGENT_STEP_LABELS: Record<WizardStepId, string> = {
  goals: "Purpose",
  phone: "Phone",
  information: "Business Knowledge",
  appointments: "Booking",
  "call-handling": "Call Handling",
  voice: "Voice",
  test: "Test",
  activate: "Activate",
};

export function mctbVisibleWizardSteps(
  state: Pick<AppointmentReceptionistWizardState, "capabilities" | "preset">,
) {
  const base = visibleWizardSteps(state);
  return base.map((s) => ({
    id: s.id,
    label: MCTB_VOICE_AGENT_STEP_LABELS[s.id] ?? s.label,
  }));
}

export function stepIndexFromQuery(
  stepParam: string | null | undefined,
  steps: Array<{ id: WizardStepId }>,
): number | null {
  if (!stepParam?.trim()) return null;
  const id = QUERY_TO_STEP[stepParam.trim().toLowerCase()];
  if (!id) return null;
  const idx = steps.findIndex((s) => s.id === id);
  return idx >= 0 ? idx : null;
}

export function stepQueryFromIndex(
  index: number,
  steps: Array<{ id: WizardStepId }>,
): string {
  const id = steps[index]?.id;
  if (!id) return MCTB_VOICE_AGENT_STEP_QUERY.goals;
  return MCTB_VOICE_AGENT_STEP_QUERY[id] ?? id;
}

export function allCanonicalStepIds(): WizardStepId[] {
  return WIZARD_STEPS.map((s) => s.id);
}
