import type { NavItem } from "@/lib/nav";
import {
  buildAppointmentsV1Nav,
  type AppointmentsNavOptions,
} from "@/lib/products/appointments-nav";
import { buildAppointmentRemindersNav } from "@/lib/products/appointment-reminders-nav";
import { buildUnifiedAppointmentsNav } from "@/lib/products/unified-appointments-nav";
import { isAppointmentsV1Primary } from "@/lib/workspace/platform-launch";
import { isUnifiedAppointmentsExperience } from "@/lib/products/unified-appointments";

/**
 * Opus sidebar nav for the scheduling / unified appointments product.
 * When unified mode is active, only `buildUnifiedAppointmentsNav()` — one tree for
 * `/appointment-reminders/**` and `/appointments/**`.
 */
export function buildSchedulingOpusSidebarNav(
  options: AppointmentsNavOptions = {},
): NavItem[] {
  if (isUnifiedAppointmentsExperience()) {
    return buildUnifiedAppointmentsNav(options);
  }
  if (isAppointmentsV1Primary()) {
    return buildAppointmentsV1Nav(options);
  }
  return buildAppointmentRemindersNav();
}
