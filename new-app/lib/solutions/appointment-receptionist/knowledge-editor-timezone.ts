import { ensureWizardOperatingMaturity } from "./operating-maturity-wizard";
import type { AppointmentReceptionistWizardState } from "./types";

/** One-way: canonical schedule timezone → legacy scalar for compatibility readers. */
export function mirrorTimezoneFromBusinessSchedule(
  state: AppointmentReceptionistWizardState,
): AppointmentReceptionistWizardState {
  const maturity = ensureWizardOperatingMaturity(state);
  const tz = maturity.businessSchedule.timezone?.trim();
  if (!tz) return { ...state, operatingMaturity: maturity };
  return {
    ...state,
    operatingMaturity: maturity,
    timezone: tz,
  };
}

export function businessScheduleHasHours(state: AppointmentReceptionistWizardState): boolean {
  const maturity = ensureWizardOperatingMaturity(state);
  return Object.values(maturity.businessSchedule.weekly).some(
    (row) => row && !row.closed && row.ranges?.length,
  );
}
