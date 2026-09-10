import {
  BarChart3,
  Calendar,
  CreditCard,
  Globe,
  Home,
  MessageSquare,
  Puzzle,
  Settings,
  Sparkles,
  Users,
  Workflow,
  HelpCircle,
  Clock,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import type { SchedulingModuleFlags } from "@/lib/products/scheduling-modules";
import {
  isAnalyticsInV1Nav,
  isContactsInV1Nav,
  isConversationsInV1Nav,
} from "@/lib/products/v1-launch-nav";

export type AppointmentsNavOptions = {
  conversationsBadge?: number;
  modules?: Partial<SchedulingModuleFlags>;
};

function calendarChildren(): NavItem["children"] {
  return [
    { label: "Calendar", href: "/appointments/calendar" },
    { label: "Appointments", href: "/appointments" },
    { label: "Waitlist", href: "/appointments/waitlist" },
    { label: "Recalls", href: "/appointments/recalls" },
  ];
}

function bookingChildren(modules: SchedulingModuleFlags): NavItem["children"] {
  const children = [
    { label: "Booking Types", href: "/appointments/types" },
    { label: "Booking Pages", href: "/appointments/booking" },
    { label: "Forms & Documents", href: "/appointments/booking/forms" },
    { label: "Rooms & Equipment", href: "/appointments/booking/rooms-equipment" },
    { label: "Share & embed", href: "/appointments/booking/share" },
  ];
  if (modules.commerce) {
    children.push({ label: "Packages & Memberships", href: "/appointments/commerce" });
    children.push({ label: "Contact merge", href: "/appointments/commerce/contact-merge" });
    children.push({ label: "POS checkout", href: "/appointments/pos" });
  }
  if (modules.classes) {
    children.push({ label: "Classes", href: "/appointments/classes" });
  }
  children.push(
    { label: "Routing", href: "/appointments/routing-forms" },
    { label: "Team Booking", href: "/appointments/team-pages" },
    { label: "Meeting Polls", href: "/appointments/polls" },
    { label: "AI Booking", href: "/appointments/ai-booking" },
  );
  return children;
}

function availabilityChildren(): NavItem["children"] {
  return [
    { label: "Schedules", href: "/appointments/availability" },
    { label: "Locations", href: "/appointments/locations" },
    { label: "Rooms & Equipment", href: "/appointments/booking/rooms-equipment" },
  ];
}

function automationsChildren(modules: SchedulingModuleFlags): NavItem["children"] {
  const children: NavItem["children"] = [
    { label: "Reminders", href: "/appointments/reminders" },
  ];
  if (modules.workflows) {
    children.push({ label: "Workflows", href: "/appointments/workflows" });
  }
  children.push(
    { label: "Templates", href: "/appointments/automations/templates" },
    { label: "Activity", href: "/appointments/automations/activity" },
    { label: "Recall automation", href: "/appointments/automations/recall" },
    { label: "No-show follow-up", href: "/appointments/automations/no-show" },
  );
  return children;
}

function meetingsChildren(): NavItem["children"] {
  return [
    { label: "Upcoming", href: "/video" },
    { label: "Recaps", href: "/meetings" },
  ];
}

function analyticsChildren(): NavItem["children"] {
  return [
    { label: "Overview", href: "/appointments/analytics" },
    { label: "Booking", href: "/appointments/analytics/booking" },
    { label: "Reminders", href: "/appointments/analytics/reminders" },
    { label: "Automations", href: "/appointments/analytics/automations" },
    { label: "Revenue", href: "/appointments/analytics/revenue" },
    { label: "Reports", href: "/appointments/analytics/reports" },
  ];
}

function contactsChildren(): NavItem["children"] {
  return [
    { label: "All contacts", href: "/contacts" },
    { label: "Segments", href: "/contacts/segments" },
    { label: "Customer fields", href: "/contacts/fields" },
    { label: "Import", href: "/contacts/imports" },
  ];
}

function integrationsChildren(): NavItem["children"] {
  return [
    { label: "Calendars", href: "/integrations/calendars" },
    { label: "Payments", href: "/integrations/payments" },
  ];
}

function settingsChildren(): NavItem["children"] {
  return [
    { label: "Business", href: "/settings/business" },
    { label: "Team", href: "/settings/users" },
    { label: "Messaging", href: "/settings/messaging" },
    { label: "Calendar", href: "/settings/calendar" },
    { label: "Meetings", href: "/settings/ai-notetaker" },
    { label: "Security", href: "/settings/security" },
    { label: "Billing", href: "/settings/billing" },
  ];
}

/**
 * Appointments platform sidebar — booking-first hierarchy with progressive disclosure.
 * Advanced config routes (categories, restrictions, classes) live inside their parent surfaces.
 */
export function buildAppointmentsV1Nav(options: AppointmentsNavOptions = {}): NavItem[] {
  const badge = options.conversationsBadge ?? 0;
  const modules = {
    workflows: options.modules?.workflows ?? false,
    meetings: options.modules?.meetings ?? false,
    payments: options.modules?.payments ?? true,
    analytics: options.modules?.analytics ?? true,
    integrations: options.modules?.integrations ?? true,
    classes: options.modules?.classes ?? false,
    commerce: options.modules?.commerce ?? true,
    globalSearch: options.modules?.globalSearch ?? true,
  };
  const items: NavItem[] = [
    {
      label: "Home",
      href: "/appointments/overview",
      icon: Home,
      matchExact: true,
    },
    {
      label: "Booking",
      href: "/appointments/types",
      icon: Globe,
      children: bookingChildren(modules),
    },
    {
      label: "Calendar",
      href: "/appointments/calendar",
      icon: Calendar,
      children: calendarChildren(),
    },
    {
      label: "Availability",
      href: "/appointments/availability",
      icon: Clock,
      children: availabilityChildren(),
    },
  ];

  if (isContactsInV1Nav()) {
    items.push({
      label: "Contacts",
      href: "/contacts",
      icon: Users,
      children: contactsChildren(),
    });
  }

  if (isConversationsInV1Nav()) {
    items.push({
      label: "Messages",
      href: "/conversations",
      icon: MessageSquare,
      badge: badge > 0 ? badge : undefined,
      children: [{ label: "Inbox", href: "/conversations" }],
    });
  }

  items.push({
    label: "Automations",
    href: "/appointments/reminders",
    icon: Workflow,
    children: automationsChildren(modules),
  });

  if (modules.meetings) {
    items.push({
      label: "Meetings",
      href: "/video",
      icon: Sparkles,
      children: meetingsChildren(),
    });
  }

  if (modules.payments) {
    items.push({
      label: "Payments",
      href: "/payments/transactions",
      icon: CreditCard,
      children: [
        { label: "Transactions", href: "/payments/transactions" },
        { label: "Invoices", href: "/payments/invoices" },
      ],
    });
  }

  if (modules.analytics && isAnalyticsInV1Nav()) {
    items.push({
      label: "Analytics",
      href: "/appointments/analytics",
      icon: BarChart3,
      children: analyticsChildren(),
    });
  }

  if (modules.integrations) {
    items.push({
      label: "Integrations",
      href: "/integrations/calendars",
      icon: Puzzle,
      sectionLabel: "Platform",
      children: integrationsChildren(),
    });
  }

  items.push(
    {
      label: "Settings",
      href: "/settings/business",
      icon: Settings,
      children: settingsChildren(),
    },
    {
      label: "Help",
      href: "/getting-started",
      icon: HelpCircle,
    },
  );

  return items;
}

/** Bottom nav for mobile — primary appointment-platform destinations. */
export function buildAppointmentsMobileNav(options: AppointmentsNavOptions = {}): NavItem[] {
  const badge = options.conversationsBadge ?? 0;
  const items: NavItem[] = [
    { label: "Home", href: "/appointments/overview", icon: Home },
    { label: "Calendar", href: "/appointments/calendar", icon: Calendar },
    { label: "Booking", href: "/appointments/types", icon: Globe },
  ];

  if (isConversationsInV1Nav()) {
    items.push({
      label: "Messages",
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
  if (pathname.startsWith("/appointments/overview")) return "Home";
  if (pathname.startsWith("/appointments/calendar")) return "Calendar";
  if (pathname.startsWith("/appointments/recalls")) return "Recalls";
  if (pathname.startsWith("/appointments/commerce")) return "Packages & Memberships";
  if (pathname.startsWith("/appointments/categories")) return "Categories";
  if (pathname.startsWith("/appointments/locations")) return "Locations";
  if (pathname.startsWith("/appointments/resources")) return "Resources";
  if (pathname.startsWith("/payments/invoices")) return "Invoices";
  if (pathname.startsWith("/appointments/classes")) return "Classes";
  if (pathname.startsWith("/appointments/client-restrictions")) return "Client restrictions";
  if (pathname.startsWith("/appointments/reports/service-booking")) return "Service booking reports";
  if (pathname.startsWith("/appointments/automations/recall")) return "Recall automation";
  if (pathname.startsWith("/appointments/automations/no-show")) return "No-show follow-up";
  if (pathname.startsWith("/appointments/types")) return "Booking Types";
  if (pathname.startsWith("/appointments/availability")) return "Availability";
  if (pathname.startsWith("/appointments/routing-forms")) return "Routing";
  if (pathname.startsWith("/appointments/routing")) return "Routing";
  if (pathname.startsWith("/appointments/team-pages")) return "Team Booking";
  if (pathname.startsWith("/appointments/booking/contracts")) return "Contracts";
  if (pathname.startsWith("/appointments/booking/branding")) return "Booking appearance";
  if (pathname.startsWith("/appointments/booking")) return "Booking Pages";
  if (pathname.startsWith("/appointments/waitlist")) return "Waitlist";
  if (pathname.startsWith("/appointments/polls")) return "Meeting Polls";
  if (pathname.startsWith("/appointments/integrations")) return "Integrations";
  if (pathname.startsWith("/appointments/recall-campaigns")) return "Recall campaigns";
  if (pathname.startsWith("/appointments/no-show-recovery")) return "No-show recovery";
  if (pathname.startsWith("/appointments/automations")) return "Automations";
  if (pathname.startsWith("/appointments/reminders")) return "Reminders";
  if (pathname.startsWith("/appointments/voice-reminders")) return "Reminders";
  if (pathname.startsWith("/appointments/automations/templates")) return "Templates";
  if (pathname.startsWith("/appointments/automations/activity")) return "Activity";
  if (pathname.startsWith("/appointments/workflows/setup/")) return "Set up workflow";
  if (pathname.startsWith("/appointments/workflows")) return "Workflows";
  if (pathname.startsWith("/appointments/setup")) return "Get Started";
  if (pathname.startsWith("/appointments/ai-booking")) return "AI Booking";
  if (pathname.startsWith("/appointments/analytics/booking")) return "Booking analytics";
  if (pathname.startsWith("/appointments/analytics/reminders")) return "Reminder analytics";
  if (pathname.startsWith("/appointments/analytics/automations")) return "Automation analytics";
  if (pathname.startsWith("/appointments/analytics/revenue")) return "Revenue analytics";
  if (pathname.startsWith("/appointments/analytics/reports")) return "Reports";
  if (pathname.startsWith("/contacts/fields")) return "Customer fields";
  if (pathname.startsWith("/contacts/imports")) return "Import";
  if (pathname.startsWith("/appointments/analytics")) return "Analytics";
  if (pathname.startsWith("/appointments/enterprise")) return "Team";
  if (pathname.startsWith("/appointments/staff")) return "Team";
  if (pathname.startsWith("/appointments/new")) return "New Appointment";
  if (pathname.match(/\/appointments\/[^/]+$/)) return "Appointment";
  if (pathname.startsWith("/appointments")) return "Appointments";
  if (pathname.startsWith("/video")) return "Upcoming meetings";
  if (pathname.startsWith("/meetings")) return "Recaps";
  if (pathname.startsWith("/payments")) return "Payments";
  if (pathname.startsWith("/conversations")) return "Messages";
  if (pathname.startsWith("/contacts/lists")) return "Lists";
  if (pathname.startsWith("/contacts/segments")) return "Segments";
  if (pathname.startsWith("/contacts")) return "Contacts";
  if (pathname.startsWith("/integrations/payments")) return "Payment integrations";
  if (pathname.startsWith("/integrations/calendars")) return "Calendar integrations";
  if (pathname.startsWith("/integrations")) return "Integrations";
  if (pathname.startsWith("/settings/calendar")) return "Calendar settings";
  if (pathname.startsWith("/settings/ai-notetaker")) return "Meetings settings";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/help")) return "Help";
  return "";
}
