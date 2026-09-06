export interface BookingQuestion {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "radio" | "checkbox";
  required?: boolean;
  placeholder?: string;
  options?: string[];
  description?: string;
}

export interface PaymentRequirement {
  mode: "none" | "full" | "deposit";
  priceCents?: number;
  depositPercent?: number;
  depositCents?: number;
  currency?: string;
}

export interface DurationOption {
  id: string;
  label: string;
  minutes: number;
  active?: boolean;
}

export interface BookingType {
  id: string;
  name: string;
  durationMinutes: number;
  config?: {
    description?: string;
    location?: string;
    priceDisplay?: string;
    bookingQuestions?: BookingQuestion[];
    staffAssignment?: "any" | "specific" | "customer_choice";
    payment?: PaymentRequirement;
    groupBooking?: { enabled: boolean; capacity: number };
    recurring?: { enabled: boolean; maxOccurrences: number };
    durationOptions?: DurationOption[];
  };
}

export interface StaffOption {
  id: string;
  name: string;
}

export interface LocationOption {
  id: string;
  name: string;
  kind?: string;
  address?: string;
}

export interface Slot {
  startsAt: string;
  endsAt: string;
  remaining?: number;
  capacity?: number;
}

export const bookingData = {
  workspaceName: "Brightline Wellness Studio",
  timezone: "America/New_York",
  businessPhone: "(571) 555-0142",
  businessAddress: "418 Market Street, Alexandria, VA 22314",
  smsConsentText:
    "I agree to receive appointment-related text messages from Brightline Wellness Studio, including confirmations and reminders. Message and data rates may apply. Reply STOP to opt out at any time.",
  termsUrl: "/terms",
  privacyUrl: "/privacy",
  staff: [
    { id: "st-1", name: "Dr. Maya Chen" },
    { id: "st-2", name: "Jordan Reyes" },
    { id: "st-3", name: "Priya Nair" },
  ] as StaffOption[],
  locations: [
    {
      id: "loc-1",
      name: "Old Town Studio",
      kind: "In person",
      address: "418 Market Street, Alexandria, VA",
    },
    {
      id: "loc-2",
      name: "Video call",
      kind: "Virtual",
      address: "Meeting link sent after booking",
    },
  ] as LocationOption[],
  types: [
    {
      id: "bt-1",
      name: "Initial Consultation",
      durationMinutes: 30,
      config: {
        description:
          "A first visit to discuss your goals, review history, and build a plan together.",
        location: "Old Town Studio or video call",
        staffAssignment: "customer_choice",
        durationOptions: [
          { id: "d1", label: "30 minutes", minutes: 30, active: true },
          { id: "d2", label: "45 minutes", minutes: 45 },
          { id: "d3", label: "60 minutes", minutes: 60 },
        ],
        bookingQuestions: [
          {
            id: "q1",
            label: "What brings you in?",
            type: "textarea",
            required: true,
            placeholder: "Briefly describe your goals or concerns…",
          },
          {
            id: "q2",
            label: "How did you hear about us?",
            type: "select",
            options: ["Google search", "Referral", "Instagram", "Other"],
          },
        ],
      },
    },
    {
      id: "bt-2",
      name: "Follow-Up Session",
      durationMinutes: 45,
      config: {
        description: "Progress review and plan adjustment for returning clients.",
        location: "Old Town Studio",
        staffAssignment: "any",
        recurring: { enabled: true, maxOccurrences: 12 },
        payment: { mode: "full", priceCents: 9500, currency: "usd" },
      },
    },
    {
      id: "bt-3",
      name: "Deep Tissue Massage — 60 min",
      durationMinutes: 60,
      config: {
        description: "Focused therapeutic bodywork. Please arrive 10 minutes early.",
        location: "Old Town Studio",
        staffAssignment: "customer_choice",
        payment: { mode: "deposit", priceCents: 12000, depositPercent: 25, currency: "usd" },
        bookingQuestions: [
          {
            id: "q3",
            label: "Any areas to focus on or avoid?",
            type: "text",
            placeholder: "e.g. shoulders, lower back",
          },
          {
            id: "q4",
            label: "I confirm I have no contraindications",
            type: "checkbox",
            required: true,
            placeholder: "I confirm",
            description: "Recent surgery, pregnancy, or acute injury may require rescheduling.",
          },
        ],
      },
    },
    {
      id: "bt-4",
      name: "Group Mobility Class",
      durationMinutes: 50,
      config: {
        description: "Small-group guided mobility work. Max 6 attendees per session.",
        location: "Old Town Studio",
        staffAssignment: "any",
        groupBooking: { enabled: true, capacity: 6 },
      },
    },
  ] as BookingType[],
};

export function formatPrice(payment?: PaymentRequirement): string | null {
  if (!payment || payment.mode === "none") return null;
  const cents =
    payment.mode === "deposit"
      ? payment.depositCents ||
        Math.round((payment.priceCents || 0) * ((payment.depositPercent || 0) / 100))
      : payment.priceCents;
  if (!cents) return null;
  const currency = (payment.currency || "usd").toUpperCase();
  const amount = (cents / 100).toFixed(2);
  return payment.mode === "deposit"
    ? `Deposit $${amount} ${currency}`
    : `$${amount} ${currency}`;
}

const TIMES = [
  "09:00", "09:30", "10:00", "10:30", "11:00",
  "13:00", "13:30", "14:00", "14:30", "15:00",
  "15:30", "16:00", "16:30",
];

export function slotsForDate(dateKey: string, durationMinutes: number): Slot[] {
  const day =
    Number(dateKey.replace(/-/g, "").slice(-2)) +
    Number(dateKey.replace(/-/g, "").slice(4, 6));
  return TIMES.map((time, i) => {
    const hash = (day * 31 + i * 17) % 10;
    if (hash < 3) return null;
    const start = new Date(`${dateKey}T${time}:00`);
    const end = new Date(start.getTime() + durationMinutes * 60000);
    const remaining = hash >= 8 ? ((day + i) % 3) + 1 : undefined;
    return {
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      remaining,
      capacity: remaining !== undefined ? 6 : undefined,
    };
  }).filter(Boolean) as Slot[];
}

export function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatSlotDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
