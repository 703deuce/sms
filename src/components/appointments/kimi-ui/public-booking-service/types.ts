export type BookingQuestion = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "radio" | "checkbox" | "multiselect" | "email" | "phone" | "number" | "date";
  required?: boolean;
  placeholder?: string;
  description?: string;
  options?: string[];
};

export type PaymentRequirement = {
  mode: "none" | "full" | "deposit";
  priceCents?: number;
  depositCents?: number;
  depositPercent?: number;
  currency?: string;
};

export type DurationOption = { id: string; label: string; minutes: number; active?: boolean };

export type BookingType = {
  id: string;
  name: string;
  durationMinutes: number;
  durationOptions?: DurationOption[];
  config?: {
    description?: string;
    location?: string;
    categoryId?: string;
    imageUrl?: string;
    priceDisplay?: string;
    bookingQuestions?: BookingQuestion[];
    staffAssignment?: "any" | "specific" | "customer_choice";
    staffIds?: string[];
    locationIds?: string[];
    payment?: PaymentRequirement;
    groupBooking?: { enabled: boolean; capacity: number };
    recurring?: { enabled: boolean; allowedFrequencies: string[]; maxOccurrences: number };
    cancellationPolicy?: { allowed?: string; cutoffHours?: number };
    extendedCancellationPolicy?: {
      allowed?: string;
      policyText?: string;
      cutoff?: { enabled?: boolean; value?: number; unit?: string };
    };
  };
};

export type StaffOption = { id: string; name: string };
export type LocationOption = { id: string; name: string; kind?: string; address?: string };
export type Slot = { startsAt: string; endsAt: string; remaining?: number; capacity?: number };

export const workspace = {
  slug: "brightline-dental",
  name: "Brightline Dental Studio",
  timezone: "America/Chicago",
  businessPhone: "(615) 555-0142",
  businessAddress: "1204 Music Row, Nashville, TN 37203",
  consentText:
    "By checking this box, I agree to receive appointment-related text messages from Brightline Dental Studio at the mobile number provided. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help.",
  termsUrl: "/terms",
  privacyUrl: "/privacy",
  aiBookingEnabled: true,
  waitlistEnabled: true,
};

export const bookingTypes: BookingType[] = [
  {
    id: "svc-consult",
    name: "New Patient Consultation",
    durationMinutes: 30,
    config: {
      description:
        "A relaxed first visit — we'll review your goals, take a quick look, and map out a care plan that fits your schedule.",
      location: "In person",
      priceDisplay: "Free",
      bookingQuestions: [
        {
          id: "q-reason",
          label: "What's the main reason for your visit?",
          type: "select",
          required: true,
          options: ["Routine checkup", "Tooth pain", "Cosmetic consult", "Second opinion", "Other"],
        },
        {
          id: "q-insurance",
          label: "Dental insurance provider",
          type: "text",
          required: false,
          placeholder: "e.g. Delta Dental",
          description: "Leave blank if you'll be paying out of pocket.",
        },
        {
          id: "q-notes",
          label: "Anything we should know before your visit?",
          type: "textarea",
          required: false,
          placeholder: "Dental anxiety, sensitivities, previous work…",
        },
      ],
      staffAssignment: "customer_choice",
      staffIds: ["st-1", "st-2", "st-3"],
      payment: { mode: "none" },
    },
  },
  {
    id: "svc-cleaning",
    name: "Cleaning & Exam",
    durationMinutes: 60,
    durationOptions: [
      { id: "d-60", label: "Standard · 60 min", minutes: 60, active: true },
      { id: "d-90", label: "Deep clean · 90 min", minutes: 90 },
    ],
    config: {
      description: "Full hygiene appointment with exam, polish, and personalized home-care recommendations.",
      location: "In person",
      priceDisplay: "$129",
      staffAssignment: "any",
      payment: { mode: "none" },
    },
  },
  {
    id: "svc-whitening",
    name: "Whitening Session",
    durationMinutes: 75,
    config: {
      description: "Professional in-office whitening. Includes a take-home touch-up kit.",
      location: "In person",
      priceDisplay: "$349",
      staffAssignment: "specific",
      staffIds: ["st-2"],
      payment: { mode: "deposit", priceCents: 34900, depositPercent: 25, currency: "usd" },
      groupBooking: { enabled: true, capacity: 2 },
    },
  },
  {
    id: "svc-implant",
    name: "Implant Evaluation",
    durationMinutes: 45,
    config: {
      description: "3D imaging and a full evaluation with Dr. Reyes to determine implant candidacy.",
      location: "In person",
      priceDisplay: "$89",
      staffAssignment: "specific",
      staffIds: ["st-1"],
      payment: { mode: "full", priceCents: 8900, currency: "usd" },
      recurring: { enabled: false, allowedFrequencies: [], maxOccurrences: 1 },
    },
  },
  {
    id: "svc-aligner",
    name: "Clear Aligner Check-in",
    durationMinutes: 20,
    config: {
      description: "Recurring progress check for active aligner patients.",
      location: "In person or video",
      priceDisplay: "Included",
      staffAssignment: "any",
      payment: { mode: "none" },
      recurring: { enabled: true, allowedFrequencies: ["weekly", "biweekly", "monthly"], maxOccurrences: 8 },
    },
  },
];

export const staffOptions: StaffOption[] = [
  { id: "st-1", name: "Dr. Maya Reyes" },
  { id: "st-2", name: "Dr. Daniel Cho" },
  { id: "st-3", name: "Alyssa Morgan, RDH" },
];

export const locationOptions: LocationOption[] = [
  { id: "loc-1", name: "Music Row Office", kind: "in_person", address: "1204 Music Row, Nashville, TN" },
  { id: "loc-2", name: "Video visit", kind: "video", address: "Transovo meeting link" },
];

function dayISO(offset: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function buildDay(offset: number, weekday: string, slotCount: number) {
  const date = dayISO(offset, 9);
  return {
    date,
    weekday,
    dayNum: new Date(date).getDate(),
    month: new Date(date).toLocaleString("en-US", { month: "short" }),
    count: slotCount,
  };
}

export const availableDays: Array<{ date: string; weekday: string; dayNum: number; month: string; count: number }> = [
  buildDay(1, "Tue", 6),
  buildDay(2, "Wed", 4),
  buildDay(3, "Thu", 8),
  buildDay(4, "Fri", 3),
  buildDay(7, "Mon", 0),
  buildDay(8, "Tue", 5),
];

function slot(offset: number, hour: number, minute = 0, remaining = 1, capacity = 1): Slot {
  return { startsAt: dayISO(offset, hour, minute), endsAt: dayISO(offset, hour, minute + 30), remaining, capacity };
}

const dayOneSlots: Slot[] = [
  slot(1, 9, 0, 2, 2),
  slot(1, 9, 30, 1, 2),
  slot(1, 10, 30, 2, 2),
  slot(1, 13, 0),
  slot(1, 14, 30),
  slot(1, 16, 0, 2, 2),
];

export const slotsForSelectedDay: Slot[] = dayOneSlots;

export const slotsByDay: Record<string, Slot[]> = {
  [dayISO(1, 9).slice(0, 10)]: dayOneSlots,
  [dayISO(2, 9).slice(0, 10)]: [slot(2, 9, 30), slot(2, 11, 0), slot(2, 14, 0), slot(2, 15, 30)],
  [dayISO(3, 9).slice(0, 10)]: [
    slot(3, 8, 30),
    slot(3, 9, 0),
    slot(3, 9, 30),
    slot(3, 10, 0),
    slot(3, 13, 30),
    slot(3, 14, 0),
    slot(3, 15, 30),
    slot(3, 16, 30),
  ],
  [dayISO(4, 9).slice(0, 10)]: [slot(4, 9, 30), slot(4, 11, 0), slot(4, 14, 30)],
  [dayISO(7, 9).slice(0, 10)]: [],
  [dayISO(8, 9).slice(0, 10)]: [slot(8, 9, 0), slot(8, 10, 30), slot(8, 13, 0), slot(8, 14, 30), slot(8, 16, 0)],
};

export const aiSuggestedSlots: Slot[] = [
  { startsAt: dayISO(1, 9, 30), endsAt: dayISO(1, 10, 0) },
  { startsAt: dayISO(2, 11, 0), endsAt: dayISO(2, 11, 30) },
  { startsAt: dayISO(3, 15, 30), endsAt: dayISO(3, 16, 0) },
];

export const aiSeedMessages: Array<{ role: "assistant" | "user"; content: string; slots?: Slot[] }> = [
  {
    role: "assistant",
    content:
      "Hi! I'm the Brightline scheduling assistant. Tell me what you need — for example, “a cleaning next week, mornings only” — and I'll find times that work.",
  },
  {
    role: "user",
    content: "Hi, I'd like a consultation sometime this week in the morning if possible.",
  },
  {
    role: "assistant",
    content:
      "I found a few morning openings for a New Patient Consultation. Tap any time below to select it, or keep chatting if none of these work.",
    slots: aiSuggestedSlots,
  },
];

export const squareConfig = {
  applicationId: "sandbox-sq0idb-demo",
  locationId: "L-DEMO-001",
  sandbox: true,
};

export const confirmationResource = {
  headline: "Before your visit",
  bodyHtml:
    "Please arrive 10 minutes early to complete your new-patient forms. Bring a photo ID and your insurance card if applicable.",
  ctaLabel: "Get directions",
  ctaUrl: "https://maps.example.com/brightline-dental",
};
