import type { NavItem } from "@/lib/nav";
import {
  buildAppointmentRemindersMobileNav,
  buildAppointmentRemindersNav,
} from "@/lib/products/appointment-reminders-nav";
import {
  buildAppointmentsMobileNav,
  buildAppointmentsV1Nav,
  type AppointmentsNavOptions,
} from "@/lib/products/appointments-nav";
import type { SchedulingModuleFlags } from "@/lib/products/scheduling-modules";

export type UnifiedAppointmentsNavOptions = AppointmentsNavOptions & {
  modules?: Partial<SchedulingModuleFlags>;
};

/** Full scheduling module visibility for unified restoration (overridable per workspace later). */
export function unifiedSchedulingModuleFlags(
  overrides?: Partial<SchedulingModuleFlags>,
): SchedulingModuleFlags {
  return {
    workflows: true,
    meetings: true,
    payments: true,
    analytics: true,
    integrations: true,
    classes: true,
    commerce: true,
    globalSearch: true,
    ...overrides,
  };
}

function schedulingPlatformSectionLabel(item: NavItem, index: number): NavItem {
  if (index === 0 && !item.sectionLabel) {
    return { ...item, sectionLabel: "Scheduling platform" };
  }
  return item;
}

/**
 * Merges Appointment Reminders nav with the full Acuity-style scheduling tree.
 * AR routes stay canonical for reminders/sync; `/appointments/**` stays reachable.
 */
export function buildUnifiedAppointmentsNav(
  options: UnifiedAppointmentsNavOptions = {},
): NavItem[] {
  const arItems = buildAppointmentRemindersNav();
  const schedulingItems = buildAppointmentsV1Nav({
    conversationsBadge: options.conversationsBadge,
    modules: unifiedSchedulingModuleFlags(options.modules),
  }).map(schedulingPlatformSectionLabel);

  return [...arItems, ...schedulingItems];
}

export function buildUnifiedAppointmentsMobileNav(
  options: UnifiedAppointmentsNavOptions = {},
): NavItem[] {
  const arMobile = buildAppointmentRemindersMobileNav();
  const schedulingMobile = buildAppointmentsMobileNav({
    conversationsBadge: options.conversationsBadge,
    modules: unifiedSchedulingModuleFlags(options.modules),
  });
  return [...arMobile, ...schedulingMobile].slice(0, 8);
}
