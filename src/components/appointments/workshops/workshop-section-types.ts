export const WORKSHOP_SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    description: "What this workshop is, when it runs and how registration is going.",
  },
  {
    id: "date-time",
    label: "Date & time",
    description: "The day it happens, and any extra sessions it runs across.",
  },
  {
    id: "place",
    label: "Place",
    description: "Where it happens, who runs it and what the room needs.",
  },
  {
    id: "registration",
    label: "Registration",
    description: "Capacity, the registration window, registrants and the waitlist.",
  },
  {
    id: "pricing-access",
    label: "Pricing & access",
    description: "What it costs and which packages or memberships get someone in.",
  },
  {
    id: "customer-setup",
    label: "Customer setup",
    description: "What a customer is asked when they register.",
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "Policies, admission, confirmation and reminders.",
  },
] as const;

export type WorkshopSectionId = (typeof WORKSHOP_SECTIONS)[number]["id"];
