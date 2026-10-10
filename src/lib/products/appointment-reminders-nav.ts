import {
  Bell,
  Calendar,
  BarChart3,
  LayoutDashboard,
  Settings2,
  Sparkles,
  MessageSquare,
  CreditCard,
  Building2,
  Link2,
  Video,
  CalendarDays,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { AR_ROUTES } from "@/lib/appointment-reminders/routes";
import { appointmentRemindersHideBookingNav } from "@/lib/appointment-reminders/ar-launch-nav";

const ACCOUNT_SECTION = "Account";

/** Product-local sidebar for Appointment Reminders. */
/** Bottom nav (4 slots + More) — creation paths must be one tap away on mobile. */
export function buildAppointmentRemindersMobileNav(): NavItem[] {
  const hideBooking = appointmentRemindersHideBookingNav();
  if (hideBooking) {
    return [
      { label: "Home", href: AR_ROUTES.home, icon: LayoutDashboard, matchExact: true },
      { label: "Appointments", href: AR_ROUTES.appointments, icon: CalendarDays },
      { label: "Reminders", href: AR_ROUTES.reminders, icon: Bell },
      { label: "Settings", href: AR_ROUTES.settings, icon: Settings2 },
    ];
  }
  return [
    { label: "Home", href: AR_ROUTES.home, icon: LayoutDashboard, matchExact: true },
    { label: "Meetings", href: AR_ROUTES.bookingMeetings, icon: Video },
    { label: "Booking", href: AR_ROUTES.booking, icon: Link2 },
    { label: "Reminders", href: AR_ROUTES.reminders, icon: Bell },
  ];
}

export function buildAppointmentRemindersNav(): NavItem[] {
  const hideBooking = appointmentRemindersHideBookingNav();
  const items: NavItem[] = [
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
      label: "Calendar",
      href: AR_ROUTES.calendar,
      icon: Calendar,
    },
    {
      label: "Reminders",
      href: AR_ROUTES.reminders,
      icon: Bell,
    },
    {
      label: "Responses",
      href: AR_ROUTES.responses,
      icon: MessageSquare,
    },
    {
      label: "AI Rescheduler",
      href: AR_ROUTES.aiRescheduler,
      icon: Sparkles,
    },
    {
      label: "Analytics",
      href: AR_ROUTES.analytics,
      icon: BarChart3,
    },
    {
      label: "Settings",
      href: AR_ROUTES.settings,
      icon: Settings2,
    },
  ];
  if (!hideBooking) {
    items.push(
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
    );
  }
  items.push(
    {
      label: "Plan & Billing",
      href: AR_ROUTES.settingsBilling,
      icon: CreditCard,
      sectionLabel: ACCOUNT_SECTION,
    },
    {
      label: "Business Settings",
      href: "/settings/business",
      icon: Building2,
    },
  );
  return items;
}

export function getAppointmentRemindersPageTitle(pathname: string): string {
  if (pathname.startsWith("/settings/billing")) return "Plan & Billing";
  if (pathname.startsWith(AR_ROUTES.settings) && pathname.includes("tab=billing")) {
    return "Plan & Billing";
  }
  if (pathname.startsWith("/settings/business")) return "Business Settings";
  if (pathname === AR_ROUTES.home) return "Overview";
  if (pathname.startsWith(AR_ROUTES.appointments)) return "Appointments";
  if (
    pathname === AR_ROUTES.calendar ||
    pathname.startsWith(`${AR_ROUTES.calendar}/`)
  ) {
    return "Calendar";
  }
  if (pathname.startsWith(AR_ROUTES.responses)) return "Responses";
  if (pathname.startsWith(AR_ROUTES.heldInbound)) return "Responses";
  if (pathname.startsWith(AR_ROUTES.reminders)) return "Reminders";
  if (pathname.startsWith(AR_ROUTES.analytics)) return "Analytics";
  if (pathname.startsWith(AR_ROUTES.calendars)) return "Settings";
  if (pathname.startsWith(AR_ROUTES.settings)) return "Settings";
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
