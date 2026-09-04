import { buildAccountNavItems } from "@/lib/products/account-nav";
import {
  BarChart3,
  Bell,
  Calendar,
  ClipboardList,
  Clock,
  Globe,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Rocket,
  Users,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import {
  isAnalyticsInV1Nav,
  isContactsInV1Nav,
  isConversationsInV1Nav,
} from "@/lib/products/v1-launch-nav";

export type AppointmentsNavOptions = {
  conversationsBadge?: number;
};

/** V1 launch sidebar — flat appointments surfaces + shared ops (no Numbers/Compliance). */
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
      label: "Calendar",
      href: "/appointments/calendar",
      icon: Calendar,
      areaLabel: "Appointments",
    },
    {
      label: "Scheduled",
      href: "/appointments",
      icon: ClipboardList,
    },
    {
      label: "Appointment Types",
      href: "/appointments/types",
      icon: ListChecks,
    },
    {
      label: "Availability",
      href: "/appointments/availability",
      icon: Clock,
    },
    {
      label: "Reminder Settings",
      href: "/appointments/reminders",
      icon: Bell,
    },
    {
      label: "Booking",
      href: "/appointments/booking",
      icon: Globe,
    },
    {
      label: "Get Started",
      href: "/appointments/setup",
      icon: Rocket,
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
      sectionLabel: "Insights",
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
  if (pathname.startsWith("/appointments/booking")) return "Booking";
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
