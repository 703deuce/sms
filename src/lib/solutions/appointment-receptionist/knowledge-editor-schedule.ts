import { compileBusinessHoursAmyDisplay } from "@/lib/voice-v3/config/business-hours-display";
import { formatWeeklyHoursForAmy } from "@/lib/voice-v3/config/business-hours-from-wizard";
import { ensureWizardOperatingMaturity } from "./operating-maturity-wizard";
import type { AppointmentReceptionistWizardState } from "./types";
import { upsertKnowledgeItem } from "./knowledge-items-helpers";
import {
  businessScheduleHasHours,
  mirrorTimezoneFromBusinessSchedule,
} from "./knowledge-editor-timezone";

export { businessScheduleHasHours, mirrorTimezoneFromBusinessSchedule };

/** Derive hours knowledge item prose from structured schedule (not a second editor). */
export function syncHoursKnowledgeItemFromSchedule(
  state: AppointmentReceptionistWizardState,
): AppointmentReceptionistWizardState {
  const maturity = ensureWizardOperatingMaturity(state);
  const compiled = compileBusinessHoursAmyDisplay({
    structuredSchedule: maturity.businessSchedule,
    hoursKnowledgeProse: null,
  });
  const display = compiled.hoursDisplay?.trim();
  if (!display) return state;
  return {
    ...state,
    knowledgeItems: upsertKnowledgeItem(state.knowledgeItems, "hours", {
      label: "Hours",
      summary: display,
      status: "complete",
      statusLabel: "From business hours",
    }),
  };
}

export function formatBusinessHoursSummaryLine(
  state: AppointmentReceptionistWizardState,
): string {
  const maturity = ensureWizardOperatingMaturity(state);
  const tz = maturity.businessSchedule.timezone || "America/New_York";
  const formatted = formatWeeklyHoursForAmy(maturity.businessSchedule);
  if (formatted) {
    const firstLine = formatted.split("\n")[0]?.replace(/^[^:]+:\s*/, "") || formatted;
    return `${firstLine} · ${tz}`;
  }
  const openDays = (
    ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const
  ).filter((day) => {
    const row = maturity.businessSchedule.weekly[day];
    return row && !row.closed && row.ranges?.length;
  });
  if (!openDays.length) return `Hours not set (${tz})`;
  const first = maturity.businessSchedule.weekly[openDays[0]!]?.ranges?.[0];
  const range =
    first?.start && first?.end ? `${first.start} – ${first.end}` : "see Business Knowledge";
  const label =
    openDays.length === 5 &&
    !openDays.includes("saturday") &&
    !openDays.includes("sunday")
      ? "Mon–Fri"
      : `${openDays.length} days/week`;
  return `${label} · ${range} · ${tz}`;
}

export function businessScheduleHasHours(state: AppointmentReceptionistWizardState): boolean {
  const maturity = ensureWizardOperatingMaturity(state);
  return Object.values(maturity.businessSchedule.weekly).some(
    (row) => row && !row.closed && row.ranges?.length,
  );
}
