import {
  BarChart3,
  Bell,
  Calendar,
  CalendarDays,
  Clock,
  CreditCard,
  Globe,
  Link2,
  MessageSquare,
  Puzzle,
  Settings2,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import {
  AR_ROUTES,
  AR_SETTINGS_BUSINESS,
  AR_SETTINGS_INTEGRATIONS,
  AR_SETTINGS_NOTIFICATIONS,
  AR_SETTINGS_SCHEDULING,
} from "@/lib/appointment-reminders/routes";
import type { AppointmentsNavOptions } from "@/lib/products/appointments-nav";

export type UnifiedAppointmentsNavOptions = AppointmentsNavOptions;

/**
 * Approved unified Appointments sidebar (13 primary destinations).
 * Calendar (`/appointment-reminders`) is the product home — no separate Overview nav item.
 */
export function buildUnifiedAppointmentsNav(
  options: UnifiedAppointmentsNavOptions = {},
): NavItem[] {
  const badge = options.conversationsBadge ?? 0;

  return [
    {
      label: "Calendar",
      href: AR_ROUTES.home,
      icon: Calendar,
      matchExact: true,
    },
    {
      label: "Appointments",
      href: AR_ROUTES.appointments,
      icon: CalendarDays,
      children: [
        { label: "All appointments", href: AR_ROUTES.appointments },
        { label: "Scheduled list", href: "/appointments/scheduled" },
        { label: "New appointment", href: "/appointments/new" },
      ],
    },
    {
      label: "Booking",
      href: AR_ROUTES.booking,
      icon: Globe,
      children: [
        { label: "Booking page", href: AR_ROUTES.booking },
        { label: "Services", href: AR_ROUTES.bookingServices },
        { label: "Meetings", href: AR_ROUTES.bookingMeetings },
        { label: "Classes", href: "/appointments/classes" },
        { label: "Workshops", href: "/appointments/workshops" },
        { label: "Booking pages admin", href: "/appointments/booking" },
        { label: "Share & embed", href: "/appointments/booking/share" },
        { label: "Branding", href: "/appointments/booking/branding" },
        { label: "Forms", href: "/appointments/booking/forms" },
        { label: "Contracts", href: "/appointments/booking/contracts" },
        { label: "Team booking", href: "/appointments/team-booking" },
        { label: "Team pages", href: "/appointments/team-pages" },
        { label: "Routing forms", href: "/appointments/routing-forms" },
        { label: "Meeting polls", href: "/appointments/meeting-polls" },
        { label: "AI booking", href: "/appointments/ai-booking" },
      ],
    },
    {
      label: "Availability",
      href: "/appointments/availability",
      icon: Clock,
      children: [
        { label: "Schedules", href: "/appointments/availability" },
        { label: "Staff", href: "/appointments/staff" },
        { label: "Locations", href: "/appointments/locations" },
        { label: "Resources", href: "/appointments/resources" },
        { label: "Routing rules", href: "/appointments/routing" },
        { label: "Restrictions", href: "/appointments/restrictions" },
        { label: "Client restrictions", href: "/appointments/client-restrictions" },
      ],
    },
    {
      label: "Clients",
      href: "/appointments/clients",
      icon: Users,
      children: [
        { label: "Directory", href: "/appointments/clients" },
        { label: "Segments", href: "/appointments/segments" },
        { label: "Contact merge", href: "/appointments/commerce/contact-merge" },
      ],
    },
    {
      label: "Messages & Responses",
      href: "/conversations",
      icon: MessageSquare,
      badge: badge > 0 ? badge : undefined,
      children: [
        { label: "Inbox", href: "/conversations" },
        { label: "Appointment replies", href: AR_ROUTES.responses },
      ],
    },
    {
      label: "Reminders",
      href: AR_ROUTES.reminders,
      icon: Bell,
      children: [
        { label: "Activity & delivery", href: AR_ROUTES.reminders },
        { label: "Sequences", href: AR_ROUTES.remindersSequences },
        { label: "Templates", href: AR_ROUTES.remindersTemplates },
      ],
    },
    {
      label: "Workflows & Automation",
      href: "/appointments/workflows",
      icon: Workflow,
      children: [
        { label: "Workflows", href: "/appointments/workflows" },
        { label: "Automation activity", href: "/appointments/automations/activity" },
        { label: "Automation templates", href: "/appointments/automations/templates" },
        { label: "Voice reminders", href: "/appointments/voice-reminders" },
      ],
    },
    {
      label: "AI Rescheduler",
      href: AR_ROUTES.aiRescheduler,
      icon: Sparkles,
    },
    {
      label: "Commerce",
      href: "/appointments/commerce",
      icon: CreditCard,
      children: [
        { label: "Scheduling overview", href: "/appointments/scheduling" },
        { label: "Sell", href: "/appointments/sell" },
        { label: "Commerce hub", href: "/appointments/commerce" },
        { label: "Packages", href: "/appointments/packages" },
        { label: "Memberships", href: "/appointments/memberships" },
        { label: "Pricing & payments", href: "/appointments/pricing-payments" },
        { label: "Categories", href: "/appointments/categories" },
        { label: "Coupons", href: "/appointments/coupons" },
        { label: "Point of sale", href: "/appointments/point-of-sale" },
        { label: "Payment requests", href: "/payments" },
        { label: "Transactions", href: "/payments/transactions" },
        { label: "Invoices", href: "/payments/invoices" },
        { label: "Waitlist", href: "/appointments/waitlist" },
        { label: "Recalls", href: "/appointments/recalls" },
        { label: "Recall campaigns", href: "/appointments/recall-campaigns" },
        { label: "No-show recovery", href: "/appointments/no-show-recovery" },
      ],
    },
    {
      label: "Analytics & Reports",
      href: AR_ROUTES.analytics,
      icon: BarChart3,
      children: [
        { label: "Reminders (AR)", href: AR_ROUTES.analytics },
        { label: "Scheduling overview", href: "/appointments/analytics" },
        { label: "Booking", href: "/appointments/analytics/booking" },
        { label: "Reminder analytics", href: "/appointments/analytics/reminders" },
        { label: "Automations", href: "/appointments/analytics/automations" },
        { label: "Reports", href: "/appointments/analytics/reports" },
        { label: "Service booking", href: "/appointments/reports/service-booking" },
      ],
    },
    {
      label: "Integrations",
      href: AR_SETTINGS_INTEGRATIONS,
      icon: Puzzle,
      children: [
        { label: "Calendar connections", href: AR_SETTINGS_INTEGRATIONS },
        { label: "Integrations directory", href: "/integrations?provider=calendar" },
        { label: "Calendars hub", href: "/integrations/calendars" },
        { label: "Payments hub", href: "/integrations?provider=stripe" },
      ],
    },
    {
      label: "Settings",
      href: AR_SETTINGS_SCHEDULING,
      icon: Settings2,
      children: [
        { label: "Scheduling & rules", href: AR_SETTINGS_SCHEDULING },
        { label: "Business profile", href: AR_SETTINGS_BUSINESS },
        { label: "Notifications & responses", href: AR_SETTINGS_NOTIFICATIONS },
        { label: "Plan & billing", href: AR_ROUTES.settingsBilling },
        { label: "Global business", href: "/settings/business" },
        { label: "Team", href: "/settings/users" },
        { label: "Messaging", href: "/settings/messaging" },
        { label: "Calendar settings", href: "/settings/calendar" },
        { label: "Security", href: "/settings/security" },
        { label: "Get started", href: "/appointments/setup" },
        { label: "Policies", href: "/appointments/policies" },
        { label: "Forms & documents", href: "/appointments/forms-documents" },
        { label: "Enterprise", href: "/appointments/enterprise" },
        { label: "Service booking admin", href: "/appointments/service-booking" },
      ],
    },
    {
      label: "Help",
      href: "/getting-started",
      icon: Link2,
      sectionLabel: "Support",
    },
  ];
}

export function buildUnifiedAppointmentsMobileNav(
  options: UnifiedAppointmentsNavOptions = {},
): NavItem[] {
  const badge = options.conversationsBadge ?? 0;
  return [
    { label: "Calendar", href: AR_ROUTES.home, icon: Calendar, matchExact: true },
    { label: "Appointments", href: AR_ROUTES.appointments, icon: CalendarDays },
    { label: "Booking", href: AR_ROUTES.booking, icon: Globe },
    {
      label: "Reminders",
      href: AR_ROUTES.reminders,
      icon: Bell,
      badge: badge > 0 ? badge : undefined,
    },
    { label: "Settings", href: AR_SETTINGS_SCHEDULING, icon: Settings2 },
  ];
}
