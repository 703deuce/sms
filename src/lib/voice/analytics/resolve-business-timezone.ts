import { loadAppointmentReceptionistSetup } from "@/lib/solutions/appointment-receptionist/save-setup";
import { ensureWizardOperatingMaturity } from "@/lib/solutions/appointment-receptionist/operating-maturity-wizard";

const FALLBACK_TZ = "America/New_York";

/** Canonical business timezone from appointment-receptionist setup (Business Knowledge schedule). */
export async function resolveVoiceBusinessTimezone(workspaceId: string): Promise<string> {
  const setup = await loadAppointmentReceptionistSetup(workspaceId);
  const state = setup?.state;
  if (!state) return FALLBACK_TZ;
  const maturity = ensureWizardOperatingMaturity({
    operatingMaturity: state.operatingMaturity,
    timezone: state.timezone,
  });
  return maturity.businessSchedule.timezone || FALLBACK_TZ;
}
