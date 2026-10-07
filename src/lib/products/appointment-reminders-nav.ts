import {
  Bell,
  Calendar,
  CalendarDays,
  LayoutDashboard,
  Settings2,
  Sparkles,
  CreditCard,
  Building2,
  Link2,
  Video,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { AR_ROUTES } from "@/lib/appointment-reminders/routes";

const ACCOUNT_SECTION = "Account";

/** Product-local sidebar for Appointment Reminders. */
/** Bottom nav (4 slots + More) — creation paths must be one tap away on mobile. */
export function buildAppointmentRemindersMobileNav(): NavItem[] {
  return [
    { label: "Home", href: AR_ROUTES.home, icon: LayoutDashboard, matchExact: true },
    { label: "Meetings", href: AR_ROUTES.bookingMeetings, icon: Video },
    { label: "Booking", href: AR_ROUTES.booking, icon: Link2 },
    { label: "Reminders", href: AR_ROUTES.reminders, icon: Bell },
  ];
}

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
      label: "AI Rescheduler",
      href: AR_ROUTES.aiRescheduler,
      icon: Sparkles,
    },
    {
      label: "Booking page",
      href: AR_ROUTES.booking,
      icon: Link2,
      sectionLabel: "Booking",
    },
    {
      label: "Meetings",
      href: AR_ROUTES.bookingMeetings,
      icon: Video,
      sectionLabel: "Booking",
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
  if (pathname.startsWith(AR_ROUTES.aiRescheduler)) return "AI Rescheduler";
  if (pathname.startsWith(AR_ROUTES.bookingServices)) return "Meetings";
  if (pathname.startsWith(AR_ROUTES.bookingMeetings)) return "Meetings";
  if (pathname.startsWith(AR_ROUTES.booking)) return "Booking page";
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
