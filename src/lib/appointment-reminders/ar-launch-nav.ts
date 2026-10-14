import { isUnifiedAppointmentsExperience } from "@/lib/products/unified-appointments";
import {
  isAppointmentRemindersV1Primary,
  isBusinessMessagingUnifiedNav,
} from "@/lib/workspace/platform-launch";

/** Hide booking submodule from AR nav during reminders-first launch (routes preserved). */
export function appointmentRemindersHideBookingNav(): boolean {
  if (isBusinessMessagingUnifiedNav()) return true;
  if (isUnifiedAppointmentsExperience()) return false;
  const raw = process.env.AR_HIDE_BOOKING_NAV?.trim();
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  return isAppointmentRemindersV1Primary();
}
