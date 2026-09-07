export type SetupStep = {
  id: number;
  label: string;
  description: string;
  done: boolean;
  href?: string;
  icon: string; // key into icon map
  optional?: boolean;
};

export type GettingStartedData = {
  workspaceName: string;
  workspaceType: string;
  userRole: "OWNER" | "ADMIN" | "STAFF";
  messagingStatus: "READY" | "PENDING" | "NOT_STARTED";
  steps: SetupStep[];
};

export const gettingStartedData: GettingStartedData = {
  workspaceName: "Riverside Dental Studio",
  workspaceType: "Business",
  userRole: "OWNER",
  messagingStatus: "PENDING",
  steps: [
    {
      id: 1,
      label: "Create your workspace",
      description: "Your account and business workspace are ready.",
      done: true,
      icon: "UserCheck",
    },
    {
      id: 2,
      label: "Add business details",
      description: "Legal business name, address, and timezone used on booking pages and messages.",
      done: true,
      href: "/settings/business",
      icon: "Building2",
    },
    {
      id: 3,
      label: "Create your first booking type",
      description: "Define a service customers can book — duration, location, and host.",
      done: false,
      href: "/appointments/types",
      icon: "CalendarPlus",
    },
    {
      id: 4,
      label: "Set your availability",
      description: "Weekly hours, buffers, and booking rules that control when customers can book.",
      done: false,
      href: "/appointments/availability",
      icon: "Clock",
    },
    {
      id: 5,
      label: "Enable your booking page",
      description: "Turn on your public booking page and share the link with customers.",
      done: false,
      href: "/appointments/booking",
      icon: "Globe",
    },
    {
      id: 6,
      label: "Connect a calendar",
      description: "Sync Google or Microsoft so busy times are blocked automatically.",
      done: false,
      href: "/integrations/calendars",
      icon: "CalendarSync",
      optional: true,
    },
    {
      id: 7,
      label: "Configure appointment reminders",
      description: "Confirmation plus 24-hour and 2-hour SMS reminders, on by default.",
      done: true,
      href: "/appointments/reminders",
      icon: "BellRing",
    },
    {
      id: 8,
      label: "Import contacts",
      description: "Bring your existing customers in so you can book and message them.",
      done: false,
      href: "/contacts/imports",
      icon: "Users",
    },
    {
      id: 9,
      label: "Complete business texting registration",
      description: "Carrier registration required before SMS reminders can be sent from your number.",
      done: false,
      href: "/settings/messaging",
      icon: "ShieldCheck",
    },
    {
      id: 10,
      label: "Book a test appointment",
      description: "Walk through the customer booking flow end to end, then confirm reminders fire.",
      done: false,
      href: "/appointments/new",
      icon: "Sparkles",
    },
  ],
};

export const resources = [
  {
    title: "Booking & scheduling guide",
    description: "Booking types, availability windows, buffers, and public booking pages.",
    href: "/help/booking",
    icon: "BookOpen",
  },
  {
    title: "Reminder sequences",
    description: "How confirmations and SMS reminders are scheduled around appointments.",
    href: "/help/reminders",
    icon: "BellRing",
  },
  {
    title: "Texting registration",
    description: "What carriers require, what to submit, and how review works.",
    href: "/help/messaging",
    icon: "MessageSquareText",
  },
  {
    title: "Contact support",
    description: "Talk to the Transovo team about setup, migration, or account questions.",
    href: "mailto:support@transovo.com",
    icon: "LifeBuoy",
  },
];
