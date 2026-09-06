export type BookingQuestion = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "radio" | "checkbox" | "multiselect" | "phone" | "email" | "number" | "date";
  required?: boolean;
  placeholder?: string;
  description?: string;
  options?: string[];
};

export type DurationOption = { id: string; label: string; minutes: number };

export type PaymentRequirement = {
  mode: "none" | "full" | "deposit";
  priceCents?: number;
  depositCents?: number;
  depositPercent?: number;
  currency?: string;
};

export type BookingType = {
  id: string;
  name: string;
  durationMinutes: number;
  description?: string;
  location?: string;
  priceDisplay?: string;
  durationOptions?: DurationOption[];
  payment?: PaymentRequirement;
  bookingQuestions?: BookingQuestion[];
  groupBooking?: { enabled: boolean; maxAttendees: number };
  recurring?: { enabled: boolean };
  staffAssignment?: "any" | "specific" | "round_robin";
  staffIds?: string[];
  locationIds?: string[];
};

export type StaffOption = { id: string; name: string; role?: string };
export type LocationOption = { id: string; name: string; kind?: string; address?: string };
export type Slot = { startsAt: string; endsAt: string; remaining?: number; capacity?: number };

export const workspace = {
  name: "Brightline Dental Studio",
  slug: "brightline-dental",
  timezone: "America/New_York",
  timezoneLabel: "Eastern Time (ET)",
  phone: "(202) 555-0148",
  address: "1420 K Street NW, Suite 300, Washington, DC 20005",
  logoInitial: "B",
};

export const smsConsentDisclosure =
  "By checking this box, you agree to receive appointment-related text messages from Brightline Dental Studio at the mobile number provided, including confirmations, reminders, and updates. Message frequency varies. Message and data rates may apply. Reply STOP to opt out at any time, HELP for help. Consent is not a condition of purchase.";

export const bookingTypes: BookingType[] = [
  {
    id: "bt-consult",
    name: "New Patient Consultation",
    durationMinutes: 30,
    description:
      "A one-on-one visit with a care coordinator to review your goals, health history, and treatment options.",
    location: "In person · Downtown office",
    priceDisplay: "Free",
    staffAssignment: "specific",
    staffIds: ["st-1", "st-2"],
    locationIds: ["loc-1"],
    bookingQuestions: [
      {
        id: "q-reason",
        label: "What brings you in?",
        type: "textarea",
        placeholder: "Tell us briefly what you'd like to discuss…",
        description: "This helps your provider prepare for the visit.",
      },
      {
        id: "q-referral",
        label: "How did you hear about us?",
        type: "select",
        options: ["Google search", "Friend or family", "Insurance directory", "Social media", "Other"],
      },
    ],
  },
  {
    id: "bt-cleaning",
    name: "Cleaning & Exam",
    durationMinutes: 60,
    description: "Comprehensive cleaning, polish, and exam with one of our hygienists.",
    location: "In person · Downtown office",
    priceDisplay: "$120.00",
    payment: { mode: "deposit", priceCents: 12000, depositPercent: 25, currency: "usd" },
    staffAssignment: "any",
    locationIds: ["loc-1", "loc-2"],
    recurring: { enabled: true },
  },
  {
    id: "bt-whitening",
    name: "Teeth Whitening Session",
    durationMinutes: 45,
    description: "Professional in-office whitening with take-home trays included.",
    location: "In person · Georgetown office",
    priceDisplay: "$299.00",
    payment: { mode: "full", priceCents: 29900, currency: "usd" },
    staffAssignment: "specific",
    staffIds: ["st-2"],
    locationIds: ["loc-2"],
    durationOptions: [
      { id: "d-45", label: "Standard · 45 min", minutes: 45 },
      { id: "d-75", label: "Extended · 75 min", minutes: 75 },
    ],
  },
  {
    id: "bt-aligner",
    name: "Aligner Fitting (Group)",
    durationMinutes: 40,
    description: "Small-group fitting session for clear aligners. Up to 4 attendees per slot.",
    location: "In person · Downtown office",
    priceDisplay: "$75.00 per person",
    staffAssignment: "round_robin",
    locationIds: ["loc-1"],
    groupBooking: { enabled: true, maxAttendees: 4 },
    bookingQuestions: [
      {
        id: "q-prior",
        label: "Have you worn aligners or braces before?",
        type: "radio",
        required: true,
        options: ["Yes", "No"],
      },
      {
        id: "q-notes",
        label: "Anything we should know?",
        type: "text",
        placeholder: "Optional",
      },
    ],
  },
];

export const staffOptions: StaffOption[] = [
  { id: "st-1", name: "Dr. Amara Osei", role: "Lead Dentist" },
  { id: "st-2", name: "Dr. Daniel Reyes", role: "Cosmetic Dentistry" },
  { id: "st-3", name: "Jasmine Park", role: "Hygienist" },
];

export const locationOptions: LocationOption[] = [
  { id: "loc-1", name: "Downtown Office", kind: "in_person", address: "1420 K Street NW, Suite 300" },
  { id: "loc-2", name: "Georgetown Office", kind: "in_person", address: "3210 M Street NW" },
];

function makeSlots(dayOffset: number, times: string[], capacity?: number): Slot[] {
  const base = new Date();
  base.setDate(base.getDate() + dayOffset);
  return times.map((t) => {
    const [h, m] = t.split(":").map(Number);
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    const end = new Date(d.getTime() + 30 * 60000);
    return {
      startsAt: d.toISOString(),
      endsAt: end.toISOString(),
      ...(capacity ? { capacity, remaining: Math.max(1, capacity - 1) } : {}),
    };
  });
}

export const slotsByDay: Record<number, Slot[]> = {
  1: makeSlots(1, ["09:00", "09:30", "10:30", "11:00", "13:00", "14:30", "15:00", "16:30"], 4),
  2: makeSlots(2, ["08:30", "09:00", "10:00", "11:30", "13:30", "14:00", "15:30", "16:00"], 4),
  3: makeSlots(3, ["09:00", "10:00", "10:30", "13:00", "14:00", "15:00"], 4),
  4: makeSlots(4, ["08:30", "09:30", "11:00", "13:30", "14:30", "16:00"], 4),
  5: makeSlots(5, ["09:00", "09:30", "10:30", "13:00", "14:00"], 4),
  8: makeSlots(8, ["09:00", "10:00", "11:00", "13:30", "14:30", "15:30"], 4),
  9: makeSlots(9, ["08:30", "09:30", "10:30", "13:00", "14:00", "15:00", "16:00"], 4),
};

export const availableDayOffsets = Object.keys(slotsByDay).map(Number).sort((a, b) => a - b);

export const aiInitialMessages = [
  {
    role: "assistant" as const,
    text: "Hi! I can help you book with Brightline Dental Studio. What kind of visit are you looking for — a consultation, cleaning, whitening, or an aligner fitting?",
  },
];

export const aiSuggestions = ["Book a cleaning next week", "Do you have anything Friday afternoon?", "I need a new patient consultation"];

export const squareConfig = {
  applicationId: "sandbox-sq0idb-demo",
  locationId: "L-DEMO-001",
  sandbox: true,
};
