import {
  applyWizardPreset,
  createDefaultWizardState,
} from "@/lib/solutions/appointment-receptionist/defaults";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { ensureWizardOperatingMaturity } from "@/lib/solutions/appointment-receptionist/operating-maturity-wizard";

export const RECEPTIONIST_EDITOR_SECTIONS = [
  { id: "identity-voice", label: "Identity & Voice" },
  { id: "greeting-conversation", label: "Greeting & Conversation" },
  { id: "responsibilities", label: "Responsibilities" },
  { id: "caller-information", label: "Caller Information" },
  { id: "appointment-handling", label: "Appointment Handling" },
  { id: "messages-callbacks", label: "Messages & Callbacks" },
] as const;

export function receptionistEditorBaseState(): AppointmentReceptionistWizardState {
  const base = applyWizardPreset(createDefaultWizardState(), "after_hours");
  return {
    ...base,
    solutionName: "AI Receptionist",
    role: "Front-desk receptionist",
  };
}

export function formatReceptionistHoursSummary(state: AppointmentReceptionistWizardState): string {
  const m = ensureWizardOperatingMaturity(state);
  const tz = m.businessSchedule.timezone || "America/New_York";
  const openDays = (
    ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const
  ).filter((day) => {
    const row = m.businessSchedule.weekly[day];
    return row && !row.closed && row.ranges?.length;
  });
  if (!openDays.length) return `Hours not set (${tz})`;
  const first = m.businessSchedule.weekly[openDays[0]!]?.ranges?.[0];
  const range =
    first?.start && first?.end ? `${first.start} – ${first.end}` : "see Business Knowledge";
  const label =
    openDays.length === 5 && !openDays.includes("saturday") && !openDays.includes("sunday")
      ? "Mon – Fri"
      : `${openDays.length} days/week`;
  return `${label}, ${range} (${tz})`;
}
