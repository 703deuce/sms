import type { AppointmentSelectionMeaning } from "../intake/appointment-selection-schema";
import type { ExistingAppointment, ExistingAppointmentCandidateSet } from "./appointment-management-types";

export type AppointmentCandidateResolution =
  | { status: "RESOLVED"; appointment: ExistingAppointment }
  | { status: "AMBIGUOUS" }
  | { status: "NOT_IN_SET" };

export function resolveAppointmentCandidate(
  meaning: AppointmentSelectionMeaning,
  candidateSet: ExistingAppointmentCandidateSet | null,
): AppointmentCandidateResolution {
  if (!candidateSet || candidateSet.candidates.length === 0) {
    return { status: "NOT_IN_SET" };
  }
  if (meaning.selection_type === "NONE" || meaning.ordinal === null) {
    return { status: "AMBIGUOUS" };
  }
  const idx = meaning.ordinal - 1;
  if (idx < 0 || idx >= candidateSet.candidates.length) {
    return { status: "NOT_IN_SET" };
  }
  return { status: "RESOLVED", appointment: candidateSet.candidates[idx]!.appointment };
}
