/**
 * Presentation metadata for workspace-level calendar & payment integrations.
 * Backends: /api/integrations/calendars, /api/merchant-payments/*
 */

export type PlatformIntegrationId = "microsoft_calendar" | "google_calendar" | "stripe" | "square";

export type PlatformIntegrationCard = {
  id: PlatformIntegrationId;
  name: string;
  description: string;
  category: "Calendar & scheduling" | "Payments";
  usedBy: string[];
};

export const PLATFORM_INTEGRATION_CARDS: PlatformIntegrationCard[] = [
  {
    id: "microsoft_calendar",
    name: "Microsoft Calendar",
    description: "Sync appointments and block busy times using your Microsoft 365 calendar.",
    category: "Calendar & scheduling",
    usedBy: ["Calendar", "Appointments", "MCTB Booking"],
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    description: "Sync appointments and availability with Google Calendar.",
    category: "Calendar & scheduling",
    usedBy: ["Calendar", "Appointments", "MCTB Booking"],
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Accept payments for appointments and Text-to-Pay.",
    category: "Payments",
    usedBy: ["Appointments", "Payments / Text-to-Pay"],
  },
  {
    id: "square",
    name: "Square",
    description: "Accept payments using your Square account.",
    category: "Payments",
    usedBy: ["Appointments"],
  },
];

export const PLATFORM_CATEGORY_ORDER = ["Calendar & scheduling", "Payments"] as const;
