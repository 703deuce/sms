import type { NavItem } from "@/lib/nav";
import { Home } from "lucide-react";
import {
  buildAppointmentsV1Nav,
  type AppointmentsNavOptions,
} from "@/lib/products/appointments-nav";
import { buildUnifiedAppointmentsNav } from "@/lib/products/unified-appointments-nav";
import { isAppointmentsV1Primary } from "@/lib/workspace/platform-launch";
import { isUnifiedAppointmentsExperience } from "@/lib/products/unified-appointments";

/**
 * Opus (dark) sidebar — same destinations as legacy gray Appointments chrome.
 * Single source for scheduling product nav inside `AppSidebar`.
 */
export function buildSchedulingOpusSidebarNav(
  options: AppointmentsNavOptions = {},
): NavItem[] {
  if (isAppointmentsV1Primary()) {
    return buildAppointmentsV1Nav(options);
  }

  if (isUnifiedAppointmentsExperience()) {
    return [
      {
        label: "Home",
        href: "/appointments/overview",
        icon: Home,
        matchExact: true,
      },
      ...buildUnifiedAppointmentsNav(options),
    ];
  }

  return buildAppointmentsV1Nav(options);
}
