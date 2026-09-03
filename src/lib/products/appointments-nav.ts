import { buildAccountNavItems } from "@/lib/products/account-nav";
import {
  BarChart3,
  Calendar,
  ClipboardList,
  LayoutDashboard,
  MessageSquare,
  Phone,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import {
  isAnalyticsInV1Nav,
  isComplianceInV1Nav,
  isContactsInV1Nav,
  isConversationsInV1Nav,
  isNumbersInV1Nav,
} from "@/lib/products/v1-launch-nav";

export type AppointmentsNavOptions = {
  conversationsBadge?: number;
};

/** V1 launch sidebar — Appointments + shared ops surfaces (MCTB deferred). */
export function buildAppointmentsV1Nav(options: AppointmentsNavOptions = {}): NavItem[] {
  const badge = options.conversationsBadge ?? 0;
  const items: NavItem[] = [
    {
      label: "Overview",
      href: "/appointments/overview",
      icon: LayoutDashboard,
      sectionLabel: "Main",
    },
    {
      label: "Appointments",
      href: "/appointments/calendar",
      icon: Calendar,
      children: [
        { label: "Calendar", href: "/appointments/calendar" },
        { label: "Scheduled", href: "/appointments" },
        { label: "Appointment Types", href: "/appointments/types" },
        { label: "Availability", href: "/appointments/availability" },
        { label: "Reminder Settings", href: "/appointments/reminders" },
        { label: "Booking Page", href: "/appointments/booking" },
        { label: "Get Started", href: "/appointments/setup" },
      ],
    },
  ];

  if (isConversationsInV1Nav()) {
    items.push({
      label: "Conversations",
      href: "/conversations",
      icon: MessageSquare,
      badge: badge > 0 ? badge : undefined,
    });
  }

  if (isContactsInV1Nav()) {
    items.push({
      label: "Contacts",
      href: "/contacts",
      icon: Users,
      children: [
        { label: "Contacts", href: "/contacts" },
        { label: "Lists", href: "/contacts/lists" },
        { label: "Segments", href: "/contacts/segments" },
      ],
    });
  }

  if (isAnalyticsInV1Nav()) {
    items.push({
      label: "Analytics",
      href: "/appointments/analytics",
      icon: BarChart3,
    });
  }

  if (isNumbersInV1Nav()) {
    items.push({
      label: "Numbers",
      href: "/numbers",
      icon: Phone,
    });
  }

  if (isComplianceInV1Nav()) {
    items.push({
      label: "Compliance",
      href: "/compliance",
      icon: ShieldCheck,
    });
  }

  items.push(...buildAccountNavItems());

  return items;
}

/** Bottom nav for mobile — top-level appointments surfaces. */
export function buildAppointmentsMobileNav(options: AppointmentsNavOptions = {}): NavItem[] {
  const badge = options.conversationsBadge ?? 0;
  const items: NavItem[] = [
    { label: "Overview", href: "/appointments/overview", icon: LayoutDashboard },
    { label: "Calendar", href: "/appointments/calendar", icon: Calendar },
    { label: "Scheduled", href: "/appointments", icon: ClipboardList },
  ];
  if (isConversationsInV1Nav()) {
    items.push({
      label: "Inbox",
      href: "/conversations",
      icon: MessageSquare,
      badge: badge > 0 ? badge : undefined,
    });
  }
  if (isContactsInV1Nav()) {
    items.push({ label: "Contacts", href: "/contacts", icon: Users });
  }
  return items.slice(0, 4);
}

export function getAppointmentsPageTitle(pathname: string): string {
  if (pathname.startsWith("/appointments/overview")) return "Overview";
  if (pathname.startsWith("/appointments/calendar")) return "Calendar";
  if (pathname.startsWith("/appointments/types")) return "Appointment Types";
  if (pathname.startsWith("/appointments/availability")) return "Availability";
  if (pathname.startsWith("/appointments/reminders")) return "Reminder Settings";
  if (pathname.startsWith("/appointments/setup")) return "Get Started";
  if (pathname.startsWith("/appointments/booking")) return "Booking Page";
  if (pathname.startsWith("/appointments/analytics")) return "Analytics";
  if (pathname.startsWith("/appointments/new")) return "New Appointment";
  if (pathname.match(/\/appointments\/[^/]+$/)) return "Appointment";
  if (pathname.startsWith("/appointments")) return "Scheduled Appointments";
  if (pathname.startsWith("/conversations")) return "Conversations";
  if (pathname.startsWith("/contacts/lists")) return "Lists";
  if (pathname.startsWith("/contacts/segments")) return "Segments";
  if (pathname.startsWith("/contacts")) return "Contacts";
  if (pathname.startsWith("/compliance")) return "Compliance";
  if (pathname.startsWith("/numbers")) return "Numbers";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/help")) return "Help";
  return "";
}
