import {
  Bell,
  Calendar,
  CalendarDays,
  LayoutDashboard,
  Settings2,
  CreditCard,
  Building2,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { AR_ROUTES } from "@/lib/appointment-reminders/routes";

const ACCOUNT_SECTION = "Account";

/** Product-local sidebar for Appointment Reminders. */
export function buildAppointmentRemindersNav(): NavItem[] {
  return [
    {
      label: "Overview",
      href: AR_ROUTES.home,
      icon: LayoutDashboard,
      matchExact: true,
    },
    {
      label: "Appointments",
      href: AR_ROUTES.appointments,
      icon: CalendarDays,
    },
    {
      label: "Reminders",
      href: AR_ROUTES.reminders,
      icon: Bell,
    },
    {
      label: "Calendars",
      href: AR_ROUTES.calendars,
      icon: Calendar,
    },
    {
      label: "Reminder Settings",
      href: AR_ROUTES.settings,
      icon: Settings2,
    },
    {
      label: "Plan & Billing",
      href: "/settings/billing",
      icon: CreditCard,
      sectionLabel: ACCOUNT_SECTION,
    },
    {
      label: "Business Settings",
      href: "/settings/business",
      icon: Building2,
    },
  ];
}

export function getAppointmentRemindersPageTitle(pathname: string): string {
  if (pathname.startsWith("/settings/billing")) return "Plan & Billing";
  if (pathname.startsWith("/settings/business")) return "Business Settings";
  if (pathname === AR_ROUTES.home) return "Overview";
  if (pathname.startsWith(AR_ROUTES.appointments)) return "Appointments";
  if (pathname.startsWith(AR_ROUTES.reminders)) return "Reminders";
  if (pathname.startsWith(AR_ROUTES.calendars)) return "Calendars";
  if (pathname.startsWith(AR_ROUTES.settings)) return "Reminder Settings";
  if (pathname.startsWith(AR_ROUTES.setupConnect)) return "Connect calendar";
  if (pathname.startsWith(AR_ROUTES.setupActivate)) return "Activate reminders";
  return "";
}

/** Shared account routes that keep the Appointment Reminders shell in the switcher. */
export function isAppointmentRemindersSharedWorkspacePath(pathname: string): boolean {
  if (pathname === "/settings/billing" || pathname.startsWith("/settings/billing/")) {
    return true;
  }
  if (pathname === "/settings/business" || pathname.startsWith("/settings/business/")) {
    return true;
  }
  return false;
}
