import type { AppointmentReceptionistWizardState, WizardStepId } from "./types";
import { wizardStepOwnedFields } from "./merge-wizard-state-on-save";

/** Canonical save groups for the permanent Receptionist editor (maps 1:1 to wizardStepId). */
export type ReceptionistOwnershipGroup =
  | "goals"
  | "information"
  | "voice"
  | "appointments"
  | "callHandling";

export const RECEPTIONIST_OWNERSHIP_GROUPS: ReceptionistOwnershipGroup[] = [
  "goals",
  "information",
  "voice",
  "appointments",
  "callHandling",
];

export const OWNERSHIP_TO_WIZARD_STEP: Record<ReceptionistOwnershipGroup, WizardStepId> = {
  goals: "goals",
  information: "information",
  voice: "voice",
  appointments: "appointments",
  callHandling: "call-handling",
};

const GROUP_FIELDS: Record<ReceptionistOwnershipGroup, Set<string>> = {
  goals: new Set(wizardStepOwnedFields("goals").map(String)),
  information: new Set(wizardStepOwnedFields("information").map(String)),
  voice: new Set(wizardStepOwnedFields("voice").map(String)),
  appointments: new Set(wizardStepOwnedFields("appointments").map(String)),
  callHandling: new Set(wizardStepOwnedFields("call-handling").map(String)),
};

export function ownershipGroupsForPatch(
  patch: Partial<AppointmentReceptionistWizardState>,
): ReceptionistOwnershipGroup[] {
  const touched = new Set<string>(Object.keys(patch));
  const groups: ReceptionistOwnershipGroup[] = [];
  for (const g of RECEPTIONIST_OWNERSHIP_GROUPS) {
    for (const key of GROUP_FIELDS[g]) {
      if (touched.has(key)) {
        groups.push(g);
        break;
      }
    }
  }
  return groups;
}

export function pickOwnershipSlice(
  state: AppointmentReceptionistWizardState,
  group: ReceptionistOwnershipGroup,
): Partial<AppointmentReceptionistWizardState> {
  const out: Partial<AppointmentReceptionistWizardState> = {};
  for (const key of GROUP_FIELDS[group]) {
    const k = key as keyof AppointmentReceptionistWizardState;
    if (state[k] !== undefined) {
      (out as Record<string, unknown>)[key] = state[k];
    }
  }
  return out;
}

export function stableStringifySlice(
  state: AppointmentReceptionistWizardState,
  group: ReceptionistOwnershipGroup,
): string {
  return JSON.stringify(pickOwnershipSlice(state, group));
}

export function computeDirtyGroups(
  current: AppointmentReceptionistWizardState,
  baseline: AppointmentReceptionistWizardState,
): Set<ReceptionistOwnershipGroup> {
  const dirty = new Set<ReceptionistOwnershipGroup>();
  for (const g of RECEPTIONIST_OWNERSHIP_GROUPS) {
    if (stableStringifySlice(current, g) !== stableStringifySlice(baseline, g)) {
      dirty.add(g);
    }
  }
  return dirty;
}
