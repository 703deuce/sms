import {
  isAppointmentRemindersV1Primary,
  isAppointmentsV1Primary,
} from "@/lib/workspace/platform-launch";

/**
 * Single "Transovo Appointments" experience: Appointment Reminders shell + full
 * scheduling routes — without a separate product switcher entry or flipping
 * APPOINTMENTS_V1_PRIMARY / APPOINTMENT_REMINDERS_V1_PRIMARY alone.
 */
export function isUnifiedAppointmentsExperience(): boolean {
  const raw = process.env.UNIFIED_APPOINTMENTS?.trim();
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  if (isAppointmentsV1Primary()) return false;
  return isAppointmentRemindersV1Primary();
}

/** Customer-facing product label when unified chrome is active. */
export function unifiedAppointmentsProductLabel(): string {
  return "Appointments";
}
